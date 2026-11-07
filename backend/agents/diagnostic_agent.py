"""Diagnostic Synthesis Agent for AI-assisted clinical differential and workup recommendations."""
import json
import secrets
from typing import Any, Dict, List, Optional
from backend.core.database import global_db
from backend.core.security import global_audit
from backend.core.state import ClinicalAgentState, DiagnosticSynthesis


AI_SUMMARY_SYSTEM_PROMPT = (
    "You assist doctors in a Mumbai cervical screening and referral pathway. "
    "Given de-identified structured intake data, write: (1) a 2-3 sentence clinician summary that restates "
    "the documented findings, notes missing data, states that blanks are not negative results and that histopathology "
    "confirms a diagnosis, and never delays referral; never invent findings or prescribe doses. (2) A short, warm patient message (max 2 sentences) "
    "in simple Hindi (Devanagari) and the same in simple English, telling her the next step and to keep her "
    "hospital visit. Do not mention the word cancer in the patient message. Do not give medical advice or numbers."
)

AI_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "clinician_summary": {"type": "string"},
        "patient_message_hindi": {"type": "string"},
        "patient_message_english": {"type": "string"},
    },
    "required": ["clinician_summary", "patient_message_hindi", "patient_message_english"],
    "additionalProperties": False,
}


class DiagnosticAgent:
    """Synthesizes OCR intake findings and validated medical scan parameters into a preliminary differential diagnosis."""

    def __init__(self, llm: Any = None):
        self.llm = llm

    def process(self, state: ClinicalAgentState) -> Dict[str, Any]:
        """Synthesize clinical intake and imaging indicators."""
        intake = state.get("clinical_intake") or {}
        img_q = state.get("image_quality") or {}
        patient_token = state.get("patient_token") or "UNASSIGNED"

        cancer_type = intake.get("suspected_cancer_type", "Unknown")
        stage = intake.get("estimated_stage", "Unknown")
        symptoms = intake.get("presenting_complaints", [])
        severity = state.get("cancer_severity_score", 0.3)
        modality = img_q.get("detected_modality", "CLINICAL_EVALUATION")

        # Formulate differential diagnoses
        differentials: List[str] = []
        if cancer_type == "ORAL":
            differentials = [
                "Oral Squamous Cell Carcinoma (High Probability)",
                "Severe Dysplastic Leukoplakia / Erythroplakia",
                "Chronic Traumatic Ulcerative Granuloma"
            ]
        elif cancer_type == "BREAST":
            differentials = [
                "Invasive Ductal Carcinoma (BI-RADS 4/5)",
                "Fibroadenoma with Atypical Hyperplasia",
                "Phyllodes Tumor"
            ]
        elif cancer_type == "CERVICAL":
            differentials = [
                "Invasive Cervical Squamous Cell Carcinoma",
                "High-Grade Squamous Intraepithelial Lesion (HSIL/CIN-3)",
                "Chronic Severe Cervicitis with Atypia"
            ]
        elif cancer_type == "LUNG":
            differentials = [
                "Non-Small Cell Lung Carcinoma (NSCLC - Bronchogenic)",
                "Pulmonary Tuberculosis with Cavitary/Consolidation Lesion",
                "Small Cell Lung Carcinoma"
            ]
        else:
            differentials = [
                f"Malignant Neoplasm ({cancer_type} - {stage})",
                "Advanced Inflammatory / Granulomatous Disease",
                "Benign Proliferative Lesion"
            ]

        # Red flag warnings
        red_flags = []
        if severity >= 0.70:
            red_flags.append("HIGH_SEVERITY_ALERT: Advanced stage presentation or high malignancy probability.")
        if "weight loss" in symptoms or "hemoptysis" in symptoms:
            red_flags.append("Constitutional B-symptoms present indicating potential systemic involvement.")
        if intake.get("biopsy_status") == "PENDING":
            red_flags.append("URGENT: Histopathological confirmation pending - expedite biopsy tissue report.")

        # Recommended Workup
        workup = [
            f"Confirmatory Biopsy & Immunohistochemistry (IHC) for {cancer_type}",
            "High-resolution Cross-Sectional Imaging (Contrast CT / MRI / PET-CT)",
            "Complete Metastatic Workup (Chest X-ray, LFTs, Serum Biomarkers)",
            "Referral to Regional Comprehensive Cancer Center"
        ]

        urgency = "CRITICAL_EMERGENCY" if severity >= 0.75 else "PRIORITY" if severity >= 0.45 else "ROUTINE"

        # Label is derived from the score so the two never contradict each other
        confidence_score = round(min(0.95, 0.50 + (severity * 0.45)), 2)
        if confidence_score >= 0.80 and img_q.get("is_valid", True) and intake.get("biopsy_status") != "NEGATIVE":
            confidence_level = "HIGH"
        elif confidence_score >= 0.65:
            confidence_level = "MODERATE"
        else:
            confidence_level = "LOW"

        synthesis = DiagnosticSynthesis(
            differential_diagnosis=differentials,
            primary_impression=f"Screening record for clinician review - Urgency: {urgency}",
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            red_flag_symptoms=red_flags,
            recommended_workup=workup,
            treatment_pathway_notes="For the treating clinician to decide. This summary is not a diagnosis.",
            urgency=urgency
        )

        # The AI clinician summary / patient message is not generated here; a clinician requests it
        # explicitly via generate_ai_summary() so intake never spends a second LLM call on unused drafts.

        # Persist case to database
        case_id = f"CASE-{secrets.token_hex(4).upper()}"
        global_db.save_clinical_case(
            case_id=case_id,
            patient_token=patient_token,
            cancer_type=cancer_type,
            suspected_stage=stage,
            severity_score=severity,
            intake_data=intake,
            diagnostic_data=synthesis.model_dump(),
            status="ACTIVE"
        )

        global_audit.record_event(
            action="DIAGNOSTIC_SYNTHESIS_GENERATED",
            actor="DIAGNOSTIC_AGENT",
            patient_token=patient_token,
            details={
                "case_id": case_id,
                "primary_impression": synthesis.primary_impression,
                "urgency": synthesis.urgency,
                "ai_generated": synthesis.ai_generated
            }
        )

        return {
            "diagnostic_synthesis": synthesis.model_dump(),
            "audit_trail": [f"Diagnostic synthesis compiled. Primary: {synthesis.primary_impression}"]
        }



SUMMARY_PROMPT_VERSION = "summary-v2"
SUMMARY_MAX_TOKENS = 700
SUMMARY_FACT_FIELDS = ("suspected_cancer_type", "estimated_stage", "biopsy_status", "histology",
                       "screening_findings", "treatment_plan", "presenting_complaints", "age")


def generate_ai_summary(intake: Dict[str, Any], synthesis: Dict[str, Any], llm: Any = None) -> Dict[str, Any]:
    """On-demand clinician summary + patient message drafts from validated, de-identified structured fields.

    Returns {"status": GENERATED | CACHED | AI_DISABLED | AI_UNAVAILABLE | INVALID_OUTPUT, ...}. Drafts always
    require clinician approval and are never sent to the patient by this function.
    """
    from backend.core import ai_usage
    from backend.core.llm_client import global_llm
    client = llm or global_llm

    if not getattr(client, "enabled", True):
        return {"status": "AI_DISABLED"}

    facts = {k: intake.get(k) for k in SUMMARY_FACT_FIELDS}
    facts["urgency"] = synthesis.get("urgency")
    facts["red_flags"] = synthesis.get("red_flag_symptoms")
    model = getattr(client, "model", "unknown")
    key = ai_usage.cache_key("clinical_summary", model=model, prompt_version=SUMMARY_PROMPT_VERSION,
                             schema=AI_SUMMARY_SCHEMA, max_tokens=SUMMARY_MAX_TOKENS, facts=facts)
    cached = ai_usage.cache_get(key)
    if cached is not None:
        ai_usage.record_usage("clinical_summary", "chat/completions", model, True, cache_hit=True)
        return {"status": "CACHED", **cached}

    ai = client.structured(AI_SUMMARY_SYSTEM_PROMPT, json.dumps(facts, ensure_ascii=False), AI_SUMMARY_SCHEMA,
                           "clinical_summary", max_tokens=SUMMARY_MAX_TOKENS)
    if not ai:
        return {"status": "AI_UNAVAILABLE"}
    fields = AI_SUMMARY_SCHEMA["required"]
    if not all(isinstance(ai.get(k), str) and ai[k].strip() for k in fields):
        return {"status": "INVALID_OUTPUT"}
    draft = {k: ai[k].strip() for k in fields}
    ai_usage.cache_put(key, "clinical_summary", draft)
    return {"status": "GENERATED", **draft}
