"""OCR and Clinical Document Parsing Tools with PII de-identification."""
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from backend.core.security import PIIShield, TokenVault, global_vault, global_audit


class ParsedClinicalDocument(BaseModel):
    """Structured output from OCR & clinical document parsing."""
    patient_token: str
    raw_anonymized_text: str
    extracted_entities: Dict[str, Any]
    detected_pii_types: List[str]
    cancer_type: str = "Unknown"
    suspected_stage: str = "Unknown"
    biopsy_status: str = "PENDING"
    severity_score: float = 0.0
    follow_up_days: int = 7


class DocumentParserTool:
    """Ingests raw medical reports, prescriptions, and lab notes."""

    @classmethod
    def read_document(cls, file_path_or_text: str) -> str:
        """Read text from file or return text directly."""
        path = Path(file_path_or_text)
        if path.exists() and path.is_file():
            try:
                # Text or markdown file
                if path.suffix.lower() in [".txt", ".md", ".json", ".csv"]:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        return f.read()
                # Basic simulated OCR for images/PDFs if OCR library not attached
                else:
                    return f"[Extracted document content from {path.name}]"
            except Exception as e:
                return f"[Error reading document: {str(e)}]"
        return file_path_or_text


class ClinicalEntityExtractorTool:
    """Extracts medical entities, cancer staging, and follow-up requirements from clinical text."""

    CANCER_KEYWORDS = {
        "oral": ["oral", "tongue", "buccal", "mouth", "lip", "palate", "gingiva", "leukoplakia", "erythroplakia", "tobacco chew", "oral ulcer"],
        "breast": ["breast", "mammary", "nipple", "mammography", "birads", "infiltrating ductal"],
        "cervical": ["cervix", "cervical", "pap smear", "post-coital", "hpv"],
        "lung": ["lung", "pulmonary", "bronchial", "hemoptysis", "chest mass"],
        "colorectal": ["colon", "rectal", "rectum", "colorectal", "bowel"],
    }

    STAGE_PATTERNS = [
        (r'\bstage\s*(?:iv|4)\b', "Stage IV"),
        (r'\bstage\s*(?:iii|3)\b', "Stage III"),
        (r'\bstage\s*(?:ii|2)\b', "Stage II"),
        (r'\bstage\s*(?:i|1)\b', "Stage I"),
        (r'\badvanced\s*(?:stage|disease)\b', "Advanced"),
        (r'\bearly\s*(?:stage|lesion)\b', "Early"),
        (r'\bmetastatic\b', "Stage IV (Metastatic)"),
    ]

    BIOPSY_KEYWORDS = {
        "POSITIVE": ["malignancy confirmed", "carcinoma present", "positive for malignant cells", "invasive carcinoma"],
        "SUSPICIOUS": ["suspicious for malignancy", "atypia", "dysplasia", "indeterminate biopsy", "urgent biopsy recommended"],
        "PENDING": ["biopsy pending", "sample sent for histopathology", "biopsy advised", "fnac advised"],
        "NEGATIVE": ["benign", "no malignancy seen", "negative for neoplastic cells"]
    }

    @classmethod
    def extract_entities(cls, text: str) -> Dict[str, Any]:
        """Parse structured clinical entities from clinical notes."""
        lower_text = text.lower()
        
        # 1. Identify Cancer Type
        detected_cancer = "Unknown"
        for c_type, keywords in cls.CANCER_KEYWORDS.items():
            if any(k in lower_text for k in keywords):
                detected_cancer = c_type.upper()
                break
        if detected_cancer == "Unknown" and "carcinoma" in lower_text or "malignan" in lower_text or "tumor" in lower_text:
            detected_cancer = "SUSPECTED_CARCINOMA"

        # 2. Identify Staging
        detected_stage = "Unknown"
        for pattern, stage_label in cls.STAGE_PATTERNS:
            if re.search(pattern, lower_text):
                detected_stage = stage_label
                break

        # 3. Identify Biopsy Status
        biopsy_status = "PENDING"
        for status, kws in cls.BIOPSY_KEYWORDS.items():
            if any(k in lower_text for k in kws):
                biopsy_status = status
                break

        # 4. Extract Symptoms & Complaints
        symptoms = []
        common_symptoms = [
            "non-healing ulcer", "painless lump", "weight loss", "difficulty swallowing",
            "hoarseness of voice", "bleeding", "persistent cough", "lymphadenopathy",
            "fatigue", "fever", "foul smelling discharge"
        ]
        for sym in common_symptoms:
            if sym in lower_text:
                symptoms.append(sym)

        # 5. Extract Age & Gender if present
        age_match = re.search(r'\b(?:age|aged|yo|years old)[:\s]+(\d{1,3})\b', lower_text)
        age = int(age_match.group(1)) if age_match else None
        
        gender = None
        if re.search(r'\b(female|woman|lady|f)\b', lower_text):
            gender = "FEMALE"
        elif re.search(r'\b(male|man|gentleman|m)\b', lower_text):
            gender = "MALE"

        # 6. Extract Follow-Up timeline
        follow_up_days = 7
        followup_match = re.search(r'follow[-\s]?up\s*(?:in|after)?\s*(\d+)\s*(day|week|month)', lower_text)
        if followup_match:
            num = int(followup_match.group(1))
            unit = followup_match.group(2)
            if "week" in unit:
                follow_up_days = num * 7
            elif "month" in unit:
                follow_up_days = num * 30
            else:
                follow_up_days = num

        # 7. Calculate Baseline Clinical Severity Score (0.0 to 1.0)
        severity = 0.2
        if "Stage IV" in detected_stage or "Metastatic" in detected_stage:
            severity = 0.95
        elif "Stage III" in detected_stage:
            severity = 0.85
        elif "Stage II" in detected_stage:
            severity = 0.65
        elif "Stage I" in detected_stage:
            severity = 0.45

        if biopsy_status == "POSITIVE":
            severity = max(severity, 0.80)
        elif biopsy_status == "SUSPICIOUS":
            severity = max(severity, 0.60)

        if len(symptoms) >= 3:
            severity = min(1.0, severity + 0.1)

        return {
            "cancer_type": detected_cancer,
            "suspected_stage": detected_stage,
            "biopsy_status": biopsy_status,
            "symptoms": symptoms,
            "age": age,
            "gender": gender,
            "follow_up_days": follow_up_days,
            "severity_score": round(severity, 2)
        }


class OCRIntakePipeline:
    """Full Intake Pipeline: Ingestion -> PII Redaction -> Tokenization Vault -> Clinical Entity Extraction."""

    def __init__(self, vault: Optional[TokenVault] = None):
        self.vault = vault or global_vault

    def process_raw_intake(
        self,
        raw_input: str,
        patient_metadata: Optional[Dict[str, Any]] = None,
        existing_token: Optional[str] = None
    ) -> ParsedClinicalDocument:
        """Sanitize intake text, encrypt PII into vault, and produce de-identified structured state."""
        # 1. Read document text
        document_text = DocumentParserTool.read_document(raw_input)
        
        # 2. De-identify and mask PII
        masked_text, extracted_pii = PIIShield.mask_text(document_text)
        
        # 3. Create or reuse anonymized token
        token_id = existing_token or PIIShield.generate_token()

        # 4. Consolidate metadata & PII into Encrypted Vault
        vault_payload = patient_metadata or {}
        vault_payload.update({
            "extracted_names": extracted_pii.get("names", []),
            "extracted_phones": extracted_pii.get("phones", []),
            "extracted_ids": extracted_pii.get("ids", []),
            "extracted_emails": extracted_pii.get("emails", [])
        })
        self.vault.store_pii(token_id, vault_payload)

        # 5. Extract Clinical Entities from sanitized text
        entities = ClinicalEntityExtractorTool.extract_entities(masked_text)

        # 6. Record Audit Event
        global_audit.record_event(
            action="CLINICAL_INTAKE_PROCESSED",
            actor="OCR_INTAKE_AGENT",
            patient_token=token_id,
            details={
                "cancer_type": entities["cancer_type"],
                "suspected_stage": entities["suspected_stage"],
                "severity_score": entities["severity_score"]
            }
        )

        return ParsedClinicalDocument(
            patient_token=token_id,
            raw_anonymized_text=masked_text,
            extracted_entities=entities,
            detected_pii_types=[k for k, v in extracted_pii.items() if v],
            cancer_type=entities["cancer_type"],
            suspected_stage=entities["suspected_stage"],
            biopsy_status=entities["biopsy_status"],
            severity_score=entities["severity_score"],
            follow_up_days=entities["follow_up_days"]
        )
