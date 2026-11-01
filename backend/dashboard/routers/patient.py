"""Patient Co-Pilot, 29-Step Healing Clock, and Hub-Spoke Handoff router."""
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from backend.core.database import global_db
from backend.core.security import global_audit, UserRole

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
    """Retrieve 29-step visual Healing Clock progress for patient."""
    clock = global_db.get_or_create_healing_clock(token)
    return {"status": "SUCCESS", "patient_token": token, "clock": clock}


@router.post("/demo/advance-fraction-15")
async def advance_fraction_15(req: AdvanceFraction15Request):
    """Demo trigger: Advance patient to Fraction 15 (Day 21 milestone), firing hub-spoke bridge."""
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

