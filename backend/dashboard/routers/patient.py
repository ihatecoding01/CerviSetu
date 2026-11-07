"""Patient record helpers: AI summary for review, voice clips and audio purge."""
import json
import secrets
import sqlite3
from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.config import clinic_today
from backend.core.database import global_db
from backend.core.security import PIIShield, global_audit, UserRole

router = APIRouter(prefix="/api/patient", tags=["Patient Record"])

































class AISummaryRequest(BaseModel):
    requested_by: str = "UNKNOWN"


@router.post("/{token}/ai-summary")
async def generate_case_ai_summary(token: str, req: AISummaryRequest):
    """Explicitly generate the AI clinician summary + patient message drafts for the latest case.

    Uses only the validated, de-identified intake fields. Drafts require clinician review and are never
    sent to the patient automatically.
    """
    from backend.agents.diagnostic_agent import generate_ai_summary

    case = global_db.get_latest_case_record(token)
    if not case:
        raise HTTPException(status_code=404, detail="No clinical case for this patient token")
    result = generate_ai_summary(case["intake_data"], case["diagnostic_data"])
    status = result["status"]

    diag = dict(case["diagnostic_data"])
    if status in ("GENERATED", "CACHED"):
        diag.update(
            ai_clinician_summary=result["clinician_summary"],
            patient_message_hindi=result["patient_message_hindi"],
            patient_message_english=result["patient_message_english"],
            ai_generated=True,
        )
    diag.update(ai_summary_status=status, requires_clinician_approval=True, patient_message_sent=False)
    global_db.update_case_diagnostic(case["case_id"], diag)

    global_audit.record_user_event(
        user_role=UserRole.DOCTOR, action="AI_SUMMARY_REQUESTED", actor_id=req.requested_by,
        patient_token=token, details={"case_id": case["case_id"], "status": status},
        severity="INFO", channel="WEB_CAREUI"
    )
    return {
        "status": status,
        "patient_token": token,
        "case_id": case["case_id"],
        "ai_clinician_summary": diag.get("ai_clinician_summary", ""),
        "patient_message_hindi": diag.get("patient_message_hindi", ""),
        "patient_message_english": diag.get("patient_message_english", ""),
        "ai_generated": status in ("GENERATED", "CACHED"),
        "requires_clinician_approval": True,
        "patient_message_sent": False,
    }










# ==========================================
# Real-Time Patient Accompaniment Endpoints
# ==========================================











@router.post("/{token}/purge-audio-cache")
@router.delete("/{token}/audio-cache")
async def purge_patient_audio_cache(token: str):
    """DPDP-mandated voice audio purge: really deletes the patient's stored consultation recordings."""
    from backend.dashboard.routers.encounter_voice import purge_audio
    removed = purge_audio(token)
    block = global_audit.record_user_event(
        user_role=UserRole.SYSTEM,
        action="DPDP_AUDIO_CACHE_PURGED",
        actor_id="PRIVACY_GUARD",
        patient_token=token,
        details={"storage_limitation_clause": "DPDP_ACT_2023_SEC_8", "recordings_deleted": removed},
        severity="INFO",
        channel="SYSTEM"
    )

    return {
        "status": "SUCCESS",
        "patient_token": token,
        "audio_purged": True,
        "recordings_deleted": removed,
        "compliance": "DPDP Storage Limitation Verified",
        "audit_block": block
    }



VOICE_TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "symptom_category": {"type": "string", "enum": ["DIARRHEA", "NAUSEA_VOMITING", "PELVIC_PAIN", "BURNING_URINATION",
                                                         "BLEEDING", "FEVER", "FATIGUE", "SKIN_REACTION", "OTHER"]},
        "grade": {"type": "integer", "description": "0, 1, 2 or 3"},
        "english_summary": {"type": "string"},
    },
    "required": ["symptom_category", "grade", "english_summary"],
    "additionalProperties": False,
}


# Obvious red-flag words handled without an LLM call. Only categories where the safe action is the
# same regardless of nuance (grade 3 -> nurse alert) are ruled; everything else goes to LLM triage.
VOICE_RED_FLAG_RULES = {
    "BLEEDING": ("खून", "ख़ून", "रक्तस्राव", "khoon", "khun", "bleeding", "blood"),
    "FEVER": ("बुखार", "bukhar", "bukhaar", "fever"),
}
VOICE_TRIAGE_MAX_TOKENS = 200
MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024


def _rule_triage(masked_transcript: str) -> Optional[dict]:
    text = masked_transcript.lower()
    hits = [cat for cat, words in VOICE_RED_FLAG_RULES.items() if any(w in text for w in words)]
    if len(hits) != 1:
        return None
    return {"symptom_category": hits[0], "grade": 3, "english_summary": f"Red-flag keyword detected: {hits[0].lower()}"}


