"""De-identified FHIR R4 Bundle export (ABDM-aligned) for a CerviSetu patient token."""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from backend.core.database import global_db

CANCER_CODES = {
    # ICD-10 and SNOMED CT codes for the cancer types the intake recognises
    "CERVICAL": ("C53.9", "363354003", "Malignant tumor of cervix"),
    "BREAST": ("C50.9", "254837009", "Malignant neoplasm of breast"),
    "ORAL": ("C06.9", "363505006", "Malignant tumor of oral cavity"),
    "LUNG": ("C34.9", "363358000", "Malignant tumor of lung"),
}
BIOPSY_SNOMED = {"POSITIVE": "10828004", "NEGATIVE": "260385009", "PENDING": "385643006", "SUSPICIOUS": "419984006"}


def _parse(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}


def build_patient_bundle(patient_token: str) -> Dict[str, Any]:
    """Patient + Condition + biopsy Observation + CarePlan per case; identity stays in the vault."""
    timeline = global_db.get_patient_timeline(patient_token)
    patient_ref = f"Patient/{patient_token}"
    entries: List[Dict[str, Any]] = [{
        "fullUrl": f"urn:cervisetu:{patient_ref}",
        "resource": {
            "resourceType": "Patient",
            "id": patient_token,
            "identifier": [{"system": "urn:cervisetu:pseudonymous-token", "value": patient_token}],
            "gender": "female",
            "meta": {"security": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ObservationValue", "code": "PSEUDED"}]},
        },
    }]

    for case in timeline.get("cases", []):
        intake = _parse(case.get("intake_data") or case.get("intake_json"))
        cancer = case.get("cancer_type") or intake.get("suspected_cancer_type") or ""
        icd, snomed, display = CANCER_CODES.get(cancer, ("C80.1", "363346000", "Malignant neoplastic disease"))
        case_id = case.get("case_id")
        stage = case.get("suspected_stage") or intake.get("estimated_stage")

        condition = {
            "resourceType": "Condition",
            "id": f"{case_id}-condition",
            "subject": {"reference": patient_ref},
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]},
            "code": {"coding": [
                {"system": "http://hl7.org/fhir/sid/icd-10", "code": icd, "display": display},
                {"system": "http://snomed.info/sct", "code": snomed, "display": display},
            ]},
            "recordedDate": case.get("created_at"),
        }
        if stage and stage != "Unknown":
            condition["stage"] = [{"summary": {"text": f"FIGO {stage.replace('Stage ', '')}"}}]
        entries.append({"fullUrl": f"urn:cervisetu:Condition/{case_id}", "resource": condition})

        biopsy = intake.get("biopsy_status")
        if biopsy:
            entries.append({"fullUrl": f"urn:cervisetu:Observation/{case_id}-biopsy", "resource": {
                "resourceType": "Observation",
                "id": f"{case_id}-biopsy",
                "status": "final" if biopsy in ("POSITIVE", "NEGATIVE") else "preliminary",
                "code": {"text": "Histopathology (biopsy) result"},
                "subject": {"reference": patient_ref},
                "valueCodeableConcept": {
                    "coding": [{"system": "http://snomed.info/sct", "code": BIOPSY_SNOMED.get(biopsy, "385643006")}],
                    "text": intake.get("histology") or biopsy,
                },
            }})

        if intake.get("treatment_plan"):
            entries.append({"fullUrl": f"urn:cervisetu:CarePlan/{case_id}", "resource": {
                "resourceType": "CarePlan",
                "id": f"{case_id}-careplan",
                "status": "draft",
                "intent": "plan",
                "subject": {"reference": patient_ref},
                "addresses": [{"reference": f"Condition/{case_id}-condition"}],
                "description": intake["treatment_plan"],
                "note": [{"text": "Overall treatment time target <=49 days, hard limit 56 days (GEC-ESTRO / NCG)."}],
            }})

    return {
        "resourceType": "Bundle",
        "type": "collection",
        **({"meta": {"tag": [{"system": "urn:cervisetu:data-label", "code": "SYNTHETIC_DEMO",
                              "display": "Synthetic demo patient - not real clinical data"}]}}
           if global_db.is_synthetic_patient(patient_token) else {}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": entries,
    }
