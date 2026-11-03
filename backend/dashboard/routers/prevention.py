"""Prevention, Adolescent HPV Vaccination, Screening Triage & Precancer Surveillance router."""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.database import global_db
from backend.core.security import global_audit, UserRole

router = APIRouter(prefix="/api/prevention", tags=["Prevention, HPV Vaccination & Screening Continuum"])


class HpvVaccinationRequest(BaseModel):
    patient_token: str
    patient_name: str
    age: int
    dose_number: int
    vaccine_brand: Optional[str] = "Cervavac"
    administered_date: Optional[str] = None
    school_or_center: Optional[str] = "Primary Health Centre Mirzapur"
    status: Optional[str] = "COMPLETED"


class ScreeningRequest(BaseModel):
    patient_token: str
    patient_name: str
    age: int
    invitation_date: Optional[str] = None
    test_type: str  # VIA, HPV_DNA, PAP_SMEAR
    test_date: Optional[str] = None
    result: str     # NEGATIVE, VIA_POSITIVE, SUSPECTED_HIGH_RISK_HPV, ABNORMAL_PAP
    notes: Optional[str] = ""


class PrecancerTreatmentRequest(BaseModel):
    patient_token: str
    patient_name: str
    diagnosis: str  # CIN_1, CIN_2, CIN_3_HSIL
    treatment_type: str  # THERMAL_ABLATION, CRYOTHERAPY, LEEP
    appointment_date: str
    completion_date: Optional[str] = None
    margins_clear: Optional[int] = 1
    surveillance_interval_months: Optional[int] = 6
    notes: Optional[str] = ""


class OutreachTriggerRequest(BaseModel):
    vaccine_id: str


# ==========================================
# 1. Adolescent HPV Vaccination Endpoints
# ==========================================

@router.post("/vaccination")
async def log_hpv_vaccination(req: HpvVaccinationRequest):
    """Log an HPV vaccine administration (Dose 1 or 2) and schedule outreach."""
    vaccine_id = f"VAC-{secrets.token_hex(4).upper()}"
    adm_date = req.administered_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # If Dose 1, automatically project Dose 2 due date (+60 days)
    next_due = None
    if req.dose_number == 1:
        try:
            parsed = datetime.strptime(adm_date, "%Y-%m-%d")
            next_due = (parsed + timedelta(days=60)).strftime("%Y-%m-%d")
        except Exception:
            next_due = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%d")

    rec = global_db.save_hpv_vaccination(
        vaccine_id=vaccine_id,
        patient_token=req.patient_token,
        patient_name=req.patient_name,
        age=req.age,
        dose_number=req.dose_number,
        vaccine_brand=req.vaccine_brand or "Cervavac",
        administered_date=adm_date,
        next_due_date=next_due,
        school_or_center=req.school_or_center or "Primary Health Centre Mirzapur",
        status=req.status or "COMPLETED",
        outreach_sent=0
    )

    # Cryptographic Audit Ledger Entry
    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="NURSE_HPV_VACCINE_LOG",
        actor_id="NURSE-PHC-01",
        patient_token=req.patient_token,
        details={
            "vaccine_id": vaccine_id,
            "dose_number": req.dose_number,
            "vaccine_brand": req.vaccine_brand,
            "school_or_center": req.school_or_center
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "vaccination": rec}


@router.get("/vaccinations")
async def list_hpv_vaccinations(status: Optional[str] = None):
    """List HPV vaccination records with optional status filter."""
    records = global_db.get_hpv_vaccinations(status=status)
    return {"vaccinations": records, "total": len(records)}


@router.post("/vaccination/outreach")
async def trigger_vaccine_outreach(req: OutreachTriggerRequest):
    """Trigger automated vernacular SMS/IVR reminder outreach for pending Dose 2."""
    updated = global_db.trigger_vaccine_outreach(req.vaccine_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Vaccine record not found")

    global_audit.record_user_event(
        user_role=UserRole.SYSTEM,
        action="COMMUNITY_OUTREACH_DISPATCHED",
        actor_id="OUTREACH_ENGINE",
        patient_token=updated["patient_token"],
        details={"vaccine_id": req.vaccine_id, "channel": "SMS_VERNACULAR"},
        severity="INFO",
        channel="SMS"
    )

    return {"status": "SUCCESS", "message": "Vernacular outreach SMS dispatched to guardian", "record": updated}


# ==========================================
# 2. Screening Records & Triage Endpoints
# ==========================================

@router.post("/screening")
async def record_screening_result(req: ScreeningRequest):
    """Ingest a primary screening result (VIA, HPV DNA, Pap Smear) and determine triage pathway."""
    screening_id = f"SCR-{secrets.token_hex(4).upper()}"
    t_date = req.test_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Clinical Staging & Triage Recommendation Rules
    res_upper = req.result.upper()
    if "NEGATIVE" in res_upper or "NORMAL" in res_upper:
        staging = "NORMAL"
        triage = "ROUTINE_RECALL_5Y"
    elif "VIA_POSITIVE" in res_upper or "ACETOWHITE" in res_upper:
        staging = "PRE_CANCEROUS"
        triage = "THERMAL_ABLATION"
    elif "HPV" in res_upper or "HIGH_RISK" in res_upper:
        staging = "PRE_CANCEROUS"
        triage = "COLPOSCOPY"
    elif "INVASIVE" in res_upper or "MALIGNANT" in res_upper:
        staging = "SUSPECTED_INVASIVE"
        triage = "ONCOLOGY_REFERRAL"
    else:
        staging = "REVIEW_REQUIRED"
        triage = "COLPOSCOPY"

    rec = global_db.save_screening_record(
        screening_id=screening_id,
        patient_token=req.patient_token,
        patient_name=req.patient_name,
        age=req.age,
        invitation_date=req.invitation_date,
        test_type=req.test_type,
        test_date=t_date,
        result=req.result,
        clinical_staging=staging,
        triage_action=triage,
        clinician_reviewed=1
    )

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="NURSE_SCREENING_RESULT_LOG",
        actor_id="NURSE-SCREENING-01",
        patient_token=req.patient_token,
        details={"test_type": req.test_type, "result": req.result, "triage_action": triage},
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "screening": rec, "recommended_pathway": triage}


@router.get("/screenings")
async def list_screenings(patient_token: Optional[str] = None):
    """List screening results with optional patient token filter."""
    records = global_db.get_screening_records(patient_token=patient_token)
    return {"screenings": records, "total": len(records)}


# ==========================================
# 3. Precancer Episodes & 6-12m Surveillance
# ==========================================

@router.post("/precancer-treatment")
async def log_precancer_treatment(req: PrecancerTreatmentRequest):
    """Document thermal ablation or LEEP precancer procedure and schedule surveillance recall."""
    precancer_id = f"PREC-{secrets.token_hex(4).upper()}"
    comp_date = req.completion_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Project 6-month surveillance recall
    try:
        parsed = datetime.strptime(comp_date, "%Y-%m-%d")
        surv_due = (parsed + timedelta(days=req.surveillance_interval_months * 30)).strftime("%Y-%m-%d")
    except Exception:
        surv_due = (datetime.now(timezone.utc) + timedelta(days=180)).strftime("%Y-%m-%d")

    rec = global_db.save_precancer_episode(
        precancer_id=precancer_id,
        patient_token=req.patient_token,
        patient_name=req.patient_name,
        diagnosis=req.diagnosis,
        treatment_type=req.treatment_type,
        appointment_date=req.appointment_date,
        completion_date=comp_date,
        margins_clear=req.margins_clear if req.margins_clear is not None else 1,
        surveillance_interval_months=req.surveillance_interval_months or 6,
        surveillance_due_date=surv_due,
        surveillance_status="SCHEDULED",
        notes=req.notes
    )

    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="DOCTOR_PRECANCER_TREATMENT_COMPLETE",
        actor_id="DR-SHARMA-01",
        patient_token=req.patient_token,
        details={
            "diagnosis": req.diagnosis,
            "treatment_type": req.treatment_type,
            "margins_clear": req.margins_clear,
            "surveillance_due_date": surv_due
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "precancer_episode": rec}


@router.get("/precancer-surveillance")
async def get_precancer_surveillance_list(status: Optional[str] = None):
    """Retrieve post-treatment precancer surveillance roster."""
    records = global_db.get_precancer_surveillance_list(status=status)
    return {"surveillance_list": records, "total": len(records)}
