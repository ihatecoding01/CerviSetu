"""Diagnostic Synthesis Agent for AI-assisted clinical differential and workup recommendations."""
import secrets
from typing import Any, Dict, List, Optional
from backend.core.database import global_db
from backend.core.security import global_audit
from backend.core.state import ClinicalAgentState, DiagnosticSynthesis


class DiagnosticAgent:
    """Synthesizes OCR intake findings and validated medical scan parameters into a preliminary differential diagnosis."""

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
            primary_impression=f"Suspected {cancer_type} ({stage}) - Urgency: {urgency}",
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            red_flag_symptoms=red_flags,
            recommended_workup=workup,
            treatment_pathway_notes=f"Recommended standard multidisciplinary oncology tumor board review for {cancer_type} ({stage}).",
            urgency=urgency
        )

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

        # Initialize Follow-Up Tracker in database
        global_db.update_follow_up(
            tracker_id=f"TRK-{secrets.token_hex(4).upper()}",
            patient_token=patient_token,
            case_id=case_id,
            due_date="in 7 days",
            days_overdue=state.get("days_overdue", 0)
        )

        global_audit.record_event(
            action="DIAGNOSTIC_SYNTHESIS_GENERATED",
            actor="DIAGNOSTIC_AGENT",
            patient_token=patient_token,
            details={
                "case_id": case_id,
                "primary_impression": synthesis.primary_impression,
                "urgency": synthesis.urgency
            }
        )

        return {
            "diagnostic_synthesis": synthesis.model_dump(),
            "audit_trail": [f"Diagnostic synthesis compiled. Primary: {synthesis.primary_impression}"]
        }
