"""Pillar 1: OCR and Clinical Intake Agent."""
from typing import Any, Dict, Optional
from src.core.database import global_db
from src.core.security import global_audit, global_vault
from src.core.state import ClinicalAgentState, ClinicalIntake
from src.tools.ocr_tools import OCRIntakePipeline


class OCRIntakeAgent:
    """Agent responsible for reading clinical documents, anonymizing PII, and extracting structured clinical data."""

    def __init__(self):
        self.pipeline = OCRIntakePipeline(vault=global_vault)

    def process(self, state: ClinicalAgentState) -> Dict[str, Any]:
        """Execute intake parsing and PII redaction on state."""
        raw_text = state.get("raw_text") or ""
        doc_path = state.get("document_path")
        patient_token = state.get("patient_token")

        content_to_parse = raw_text
        if doc_path and not content_to_parse:
            content_to_parse = doc_path

        if not content_to_parse:
            return {
                "intake_status": "FAILED",
                "errors": ["No input document or text provided for clinical intake."],
                "audit_trail": ["Intake failed: empty input."]
            }

        parsed_doc = self.pipeline.process_raw_intake(
            raw_input=content_to_parse,
            existing_token=patient_token if patient_token != "NEW" else None
        )

        token = parsed_doc.patient_token
        entities = parsed_doc.extracted_entities

        # Persist patient and initial case to database
        global_db.save_patient(
            patient_token=token,
            age=entities.get("age"),
            gender=entities.get("gender"),
            region_code="RURAL_COMMUNITY"
        )

        intake_model = ClinicalIntake(
            patient_token=token,
            age=entities.get("age"),
            gender=entities.get("gender"),
            presenting_complaints=entities.get("symptoms", []),
            clinical_history=parsed_doc.raw_anonymized_text[:300],
            biopsy_status=parsed_doc.biopsy_status,
            cancer_suspected=True if parsed_doc.cancer_type != "Unknown" else False,
            suspected_cancer_type=parsed_doc.cancer_type,
            estimated_stage=parsed_doc.suspected_stage,
            severity_score=parsed_doc.severity_score,
            prescribed_investigations=["Biopsy / Histopathology", "Radiological Scan", "CBC / LFT / KFT"],
            next_follow_up_days=parsed_doc.follow_up_days,
            raw_anonymized_notes=parsed_doc.raw_anonymized_text
        )

        return {
            "patient_token": token,
            "clinical_intake": intake_model.model_dump(),
            "intake_status": "COMPLETED",
            "cancer_severity_score": parsed_doc.severity_score,
            "audit_trail": [f"Intake completed for {token}. Cancer: {parsed_doc.cancer_type} ({parsed_doc.suspected_stage})"]
        }
