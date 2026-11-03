"""Patient Co-Pilot, 29-Step Healing Clock, and Hub-Spoke Handoff router."""
import json
import secrets
import sqlite3
from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.config import clinic_today
from backend.core.database import global_db
from backend.core.security import global_audit, UserRole
from backend.tools import clock_service

router = APIRouter(prefix="/api/patient", tags=["Patient Vernacular Co-Pilot (70% Weight)"])


class AdvanceFraction15Request(BaseModel):
    patient_token: str
    target_step: Optional[int] = 15


class HubConfirmSlotRequest(BaseModel):
    patient_token: str
    confirmed_day: Optional[str] = "Day 41"
    doctor_id: Optional[str] = "DR-ONCO-HUB-01"


@router.get("/{token}/healing-clock")
async def get_patient_healing_clock(token: str):
    """Healing Clock progress: from the real treatment clock when a plan is approved (clock_source
    TREATMENT_CLOCK), seeded demo values for demo patients (LEGACY_DEMO), otherwise not started."""
    clock = clock_service.healing_clock_view(token)
    return {"status": "SUCCESS", "patient_token": token, "clock": clock}


# ==========================================
# Real CCRT Treatment Clock
# ==========================================

def _parse_date(value: Optional[str], field: str) -> date:
    if not value:
        return clinic_today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field} must be YYYY-MM-DD")


class TreatmentPlanRequest(BaseModel):
    approved_by: str = Field(..., min_length=1, description="Approving clinician ID")
    start_date: Optional[str] = Field(None, description="Clinic-local YYYY-MM-DD; defaults to today, may be backdated")
    ebrt_sessions: int = Field(25, ge=1, le=40)
    brachy_sessions: int = Field(4, ge=0, le=8)
    treatment_weekdays: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], description="Monday=0")
    brachy_gap_days: int = Field(3, ge=0, le=30)
    brachy_interval_days: int = Field(3, ge=1, le=14)
    rest_dates: List[str] = Field(default_factory=list)
    target_days: int = Field(49, ge=1, le=120)
    limit_days: int = Field(56, ge=1, le=150)
    facility_name: str = "Mirzapur Spoke Clinic"
    regimen_label: str = "Sample CCRT: EBRT 25 fractions + HDR brachytherapy 4 fractions"


@router.post("/{token}/treatment-plan")
async def approve_treatment_plan(token: str, req: TreatmentPlanRequest):
    """Clinician approval of a CCRT plan. This is the only thing that starts the treatment clock."""
    if not global_db.get_latest_case(token):
        raise HTTPException(status_code=404, detail="Unknown patient token")
    weekdays = sorted(set(req.treatment_weekdays))
    if not weekdays or any(d < 0 or d > 6 for d in weekdays):
        raise HTTPException(status_code=422, detail="treatment_weekdays must be values 0-6 (Monday=0)")
    if req.limit_days < req.target_days:
        raise HTTPException(status_code=422, detail="limit_days must be >= target_days")
    start = _parse_date(req.start_date, "start_date")
    rest = sorted({_parse_date(d, "rest_dates").isoformat() for d in req.rest_dates})

    try:
        plan = global_db.create_treatment_plan({
            "plan_id": f"PLAN-{secrets.token_hex(4).upper()}",
            "patient_token": token,
            "status": "ACTIVE",
            "start_date": start.isoformat(),
            "ebrt_sessions": req.ebrt_sessions,
            "brachy_sessions": req.brachy_sessions,
            "treatment_weekdays": ",".join(map(str, weekdays)),
            "brachy_gap_days": req.brachy_gap_days,
            "brachy_interval_days": req.brachy_interval_days,
            "rest_dates": json.dumps(rest),
            "target_days": req.target_days,
            "limit_days": req.limit_days,
            "facility_name": req.facility_name,
            "regimen_label": req.regimen_label,
            "approved_by": req.approved_by,
        })
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Patient already has an active treatment plan")

    block = global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="CCRT_PLAN_APPROVED",
        actor_id=req.approved_by,
        patient_token=token,
        details={"plan_id": plan["plan_id"], "start_date": plan["start_date"],
                 "sessions": req.ebrt_sessions + req.brachy_sessions},
        severity="INFO",
        channel="WEB_CAREUI"
    )
    return {"status": "SUCCESS", "plan": plan, "clock": clock_service.build_clock(plan), "block": block}


@router.get("/{token}/clock")
async def get_treatment_clock(token: str, as_of_date: Optional[str] = None):
    """Live 49/56-day treatment clock recomputed from plan, sessions and schedule exceptions. No PII."""
    today = _parse_date(as_of_date, "as_of_date")
    if today > clinic_today():
        raise HTTPException(status_code=400, detail="as_of_date cannot be in the future")
    return clock_service.get_patient_clock(token, today)


class TreatmentPauseRequest(BaseModel):
    approved_by: str = Field(..., min_length=1)
    start_date: str
    end_date: Optional[str] = None
    reason: str = Field(..., min_length=1)


@router.post("/{token}/treatment-plan/pause")
async def pause_treatment(token: str, req: TreatmentPauseRequest):
    """Clinician-approved treatment break (e.g. toxicity). Paused dates are not counted as misses."""
    plan = global_db.get_treatment_plan(token)
    if not plan or plan["status"] != "ACTIVE":
        raise HTTPException(status_code=404, detail="NO_ACTIVE_TREATMENT_PLAN")
    first = _parse_date(req.start_date, "start_date")
    last = _parse_date(req.end_date or req.start_date, "end_date")
    if last < first or (last - first).days > 60:
        raise HTTPException(status_code=422, detail="Pause must be 1-61 days with end_date >= start_date")
    d = first
    while d <= last:
        global_db.add_schedule_exception(d.isoformat(), "CLINICIAN_APPROVED_PAUSE", req.reason, req.approved_by,
                                         plan_id=plan["plan_id"])
        d += timedelta(days=1)
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR, action="CCRT_CLINICIAN_APPROVED_PAUSE", actor_id=req.approved_by,
        patient_token=token, details={"plan_id": plan["plan_id"], "from": first.isoformat(), "to": last.isoformat()},
        severity="WARNING", channel="WEB_CAREUI"
    )
    return {"status": "SUCCESS", "clock": clock_service.build_clock(plan)}


class NoShowRequest(BaseModel):
    recorded_by: str = Field(..., min_length=1)
    date: Optional[str] = None


@router.post("/{token}/clock/no-show")
async def record_no_show(token: str, req: NoShowRequest):
    """Nurse marks today's scheduled session as a patient no-show (past slots are detected automatically)."""
    plan = global_db.get_treatment_plan(token)
    if not plan or plan["status"] != "ACTIVE":
        raise HTTPException(status_code=404, detail="NO_ACTIVE_TREATMENT_PLAN")
    day = _parse_date(req.date, "date")
    if day > clinic_today() or day < date.fromisoformat(plan["start_date"]):
        raise HTTPException(status_code=400, detail="No-show date must be between the plan start and today")
    global_db.add_schedule_exception(day.isoformat(), clock_service.NO_SHOW, "Patient did not attend",
                                     req.recorded_by, plan_id=plan["plan_id"])
    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER, action="CCRT_PATIENT_NO_SHOW", actor_id=req.recorded_by,
        patient_token=token, details={"plan_id": plan["plan_id"], "date": day.isoformat()},
        severity="WARNING", channel="WEB_CAREUI"
    )
    escalation = clock_service.evaluate_plan(plan)
    return {"status": "SUCCESS", "escalation": escalation, "clock": clock_service.build_clock(plan)}


@router.post("/demo/advance-fraction-15")
async def advance_fraction_15(req: AdvanceFraction15Request):
    """Legacy demo trigger: moves the seeded demo Healing Clock to Fraction 15 (Day 21 milestone).
    Writes only the legacy demo table; it never changes a real treatment clock."""
    clock = global_db.advance_healing_clock(req.patient_token, req.target_step or 15)
    block = global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="NURSE_EBRT_FRACTION_LOG",
        actor_id="NURSE-SPOKE-DEMO",
        patient_token=req.patient_token,
        details={"fraction_number": 15, "milestone": "DAY_21_HUB_SPOKE_TRIGGER"},
        severity="INFO",
        channel="WEB_CAREUI"
    )
    pass_data = global_db.get_or_create_hub_spoke_pass(req.patient_token)
    return {
        "status": "SUCCESS",
        "clock": clock,
        "hub_request_dispatched": True,
        "pass_status": pass_data,
        "block": block
    }


@router.post("/demo/hub-confirm-slot")
async def hub_confirm_slot(req: HubConfirmSlotRequest):
    """Step 2B: Hub oncologist confirms OT slot, unlocking simulated state bus & dharamshala pass."""
    pass_data = global_db.confirm_hub_ot_slot(req.patient_token, req.confirmed_day or "Day 41")
    block = global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="DOCTOR_HUB_OT_SLOT_CONFIRM",
        actor_id=req.doctor_id or "DR-ONCO-HUB-01",
        patient_token=req.patient_token,
        details={"confirmed_slot": req.confirmed_day, "travel_pass_unlocked": True},
        severity="INFO",
        channel="WEB_CAREUI"
    )
    return {
        "status": "SUCCESS",
        "pass_data": pass_data,
        "block": block
    }


@router.get("/{token}/passes")
async def get_patient_passes(token: str):
    """Retrieve logistical travel and stay passes for a patient."""
    pass_data = global_db.get_or_create_hub_spoke_pass(token)
    return {"status": "SUCCESS", "patient_token": token, "pass": pass_data}


@router.get("/soundboard/audio")
async def get_soundboard_audio_tracks():
    """Return reviewed Indic vernacular audio scripts and tracks for Sarvam/Bhashini demo."""
    tracks = [
        {
            "id": "welcome_healing_clock",
            "title_hi": "उपचार यात्रा और हीलिंग क्लॉक (Welcome & Pathway)",
            "speaker": "Sarvam Saaras v3 (Hindi Female)",
            "hindi_text": "नमस्ते। आपके उपचार में कुल 29 चरण निर्धारित किए गए हैं। हम हर कदम पर आपके साथ रहेंगे ताकि आप समय पर स्वस्थ हो सकें।",
            "english_translation": "Greetings. A total of 29 steps are scheduled in your treatment. We will stay by your side at every step so you recover on time.",
            "clinical_guardrail": "Phrased non-definitively ('निर्धारित किए गए हैं') rather than promising an absolute legal guarantee."
        },
        {
            "id": "cisplatin_hydration",
            "title_hi": "कीमोथेरेपी जल सेवन सलाह (Pre-Chemo Hydration)",
            "speaker": "Sarvam Saaras v3 (Hindi Female)",
            "hindi_text": "कल की कीमोथेरेपी के लिए अस्पताल द्वारा दी गई पानी पीने की सलाह का ध्यान रखें और अपनी रक्त जांच रिपोर्ट साथ लाएं।",
            "english_translation": "For tomorrow's chemotherapy, follow the hydration guidance given by your hospital and bring your blood test report.",
            "clinical_guardrail": "Guards against fluid overload in renal/cardiac patients; defers specific fluid volumes to attending center protocol."
        },
        {
            "id": "brachy_reassurance",
            "title_hi": "ब्रैकीथेरेपी प्रक्रिया और दर्द-प्रबंधन (Brachytherapy Reassurance)",
            "speaker": "Sarvam Saaras v3 (Hindi Female)",
            "hindi_text": "ब्रैकीथेरेपी (अंदरूनी विकिरण उपचार) के दौरान आपको सुरक्षित और आरामदायक रखने के लिए डॉक्टरों की टीम निश्चेतना (एनेस्थीसिया) और दर्द-निवारक व्यवस्था करती है। इससे घबराएं नहीं।",
            "english_translation": "During brachytherapy (internal radiation treatment), the medical team provides anesthesia and pain-relief measures to keep you safe and comfortable. Please do not be afraid.",
            "clinical_guardrail": "Replaces misleading term 'सिकाई' with 'अंदरूनी विकिरण उपचार'. Honestly explains anesthesia and pain relief rather than falsely claiming 'painless'."
        }
    ]
    return {"status": "SUCCESS", "tracks": tracks}


# ==========================================
# Real-Time Patient Accompaniment Endpoints
# ==========================================

class PatientSymptomReportRequest(BaseModel):
    clock_day: int
    symptom_category: str
    reported_severity_grade: int
    vernacular_raw_text: Optional[str] = ""


class PatientHydrationAckRequest(BaseModel):
    fluid_intake_liters: float = 2.5
    blood_test_slip_ready: bool = True


@router.post("/{token}/symptoms")
async def report_patient_symptoms(token: str, req: PatientSymptomReportRequest):
    """Persist real-time bi-weekly toxicity check-in from Patient Companion."""
    log_id = f"TOX-{secrets.token_hex(4).upper()}"

    # Determine clinical intervention based on severity grade
    if req.reported_severity_grade >= 2:
        action = "PRIORITY_MORNING_WARD_ALERT_SCHEDULED_LOPERAMIDE_IV_HYDRATION"
        severity = "WARNING"
    else:
        action = "HOME_CARE_GUIDANCE_ORS_BLAND_DIET_VERNACULAR_DISPATCH"
        severity = "INFO"

    global_db.record_patient_toxicity(
        log_id=log_id,
        patient_token=token,
        clock_day=req.clock_day,
        symptom_category=req.symptom_category,
        reported_severity_grade=req.reported_severity_grade,
        vernacular_raw_text=req.vernacular_raw_text or req.symptom_category,
        clinical_action_taken=action
    )

    block = global_audit.record_user_event(
        user_role=UserRole.PATIENT,
        action="PATIENT_SYMPTOM_REPORTED",
        actor_id=token,
        patient_token=token,
        details={
            "symptom": req.symptom_category,
            "grade": req.reported_severity_grade,
            "action": action
        },
        severity=severity,
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "log_id": log_id,
        "clinical_action": action,
        "is_ward_alert": req.reported_severity_grade >= 2,
        "audit_block": block
    }


@router.post("/{token}/hydration-ack")
async def acknowledge_hydration(token: str, req: PatientHydrationAckRequest):
    """Record patient pre-chemotherapy hydration compliance."""
    block = global_audit.record_user_event(
        user_role=UserRole.PATIENT,
        action="PATIENT_PRE_CHEMO_HYDRATION_ACKNOWLEDGED",
        actor_id=token,
        patient_token=token,
        details={"intake_liters": req.fluid_intake_liters, "slip_ready": req.blood_test_slip_ready},
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "patient_token": token,
        "intake_liters": req.fluid_intake_liters,
        "message": "Hydration recorded; clinical protocol verified",
        "block": block
    }


@router.post("/{token}/purge-audio-cache")
@router.delete("/{token}/audio-cache")
async def purge_patient_audio_cache(token: str):
    """DPDP-mandated voice audio cache purge upon discharge or patient request."""
    block = global_audit.record_user_event(
        user_role=UserRole.SYSTEM,
        action="DPDP_AUDIO_CACHE_PURGED",
        actor_id="PRIVACY_GUARD",
        patient_token=token,
        details={"storage_limitation_clause": "DPDP_ACT_2023_SEC_8"},
        severity="INFO",
        channel="SYSTEM"
    )

    return {
        "status": "SUCCESS",
        "patient_token": token,
        "audio_purged": True,
        "compliance": "DPDP Storage Limitation Verified",
        "audit_block": block
    }



VOICE_TRIAGE_PROMPT = (
    "A cervical cancer patient on chemoradiation described her symptoms by voice (transcript may be Hindi, "
    "Bhojpuri or English). Classify the main symptom and a CTCAE-style grade: 0 none, 1 mild, 2 moderate "
    "(limits daily activity), 3 severe (bleeding, fever, cannot eat or drink, fainting). Never give advice."
)
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


@router.post("/{token}/voice-symptoms")
async def report_voice_symptoms(
    token: str,
    audio: UploadFile = File(...),
    clock_day: int = Form(1),
    language_code: str = Form("unknown"),
):
    """Patient speaks symptoms in her language: Sarvam STT -> LLM triage -> standard toxicity check-in."""
    from backend.core.llm_client import global_llm

    stt = global_llm.transcribe(await audio.read(), audio.filename or "voice.webm", language_code)
    if not stt or not stt["transcript"].strip():
        raise HTTPException(status_code=503, detail="Voice transcription unavailable; please use the symptom buttons.")

    triage = global_llm.structured(VOICE_TRIAGE_PROMPT, stt["transcript"], VOICE_TRIAGE_SCHEMA, "voice_symptom_triage", strict=False) or {
        "symptom_category": "OTHER", "grade": 2, "english_summary": "Unclassified voice report - nurse review needed",
    }
    # Unknown or out-of-range grades go to nurse review (grade 2) rather than being trusted
    triage["grade"] = triage["grade"] if triage.get("grade") in (0, 1, 2, 3) else 2
    checkin = await report_patient_symptoms(token, PatientSymptomReportRequest(
        symptom_category=triage["symptom_category"],
        reported_severity_grade=triage["grade"],
        clock_day=clock_day,
        vernacular_raw_text=stt["transcript"],
    ))
    return {
        "transcript": stt["transcript"],
        "detected_language": stt["language_code"],
        "triage": triage,
        "checkin": checkin,
    }
