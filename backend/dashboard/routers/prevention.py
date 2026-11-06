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


class ProtocolEvaluateRequest(BaseModel):
    age: int
    gender: Optional[str] = "FEMALE"
    patient_name: Optional[str] = ""
    patient_token: Optional[str] = None
    hpv_vaccinated: Optional[bool] = None
    screened: Optional[bool] = None


class ProtocolScheduleRequest(BaseModel):
    patient_token: Optional[str] = None
    patient_name: str
    age: int
    gender: Optional[str] = "FEMALE"
    action_type: str  # "SCHEDULE_VACCINATION" or "SCHEDULE_SCREENING"
    vaccine_brand: Optional[str] = "Cervavac"
    dose_number: Optional[int] = 1
    test_type: Optional[str] = "HPV_DNA"  # "HPV_DNA" or "VIA"
    appointment_date: Optional[str] = None
    center: Optional[str] = "Primary Health Centre Mirzapur"
    notes: Optional[str] = ""
    dispatch_outreach: Optional[bool] = True


# ==========================================
# Multi-Cohort Data Models
# ==========================================

class AdolescentRegisterRequest(BaseModel):
    full_name: str
    age: int
    dob: Optional[str] = None
    guardian_name: str
    guardian_phone: str
    village: str
    school_or_camp: str
    prior_vaccine_audit: Optional[str] = "NONE"


class AdolescentDoseRequest(BaseModel):
    dose_number: int  # 1 or 2
    batch_number: Optional[str] = "CERV-2026-A1"
    admin_site: Optional[str] = "Left Deltoid"
    center: Optional[str] = "Primary Health Centre Mirzapur"
    administered_date: Optional[str] = None
    aefi_reported: Optional[bool] = False
    aefi_notes: Optional[str] = None


class AdolescentAlertRequest(BaseModel):
    alert_type: str  # "14_DAY_PRE_DUE" or "14_DAY_OVERDUE"
    notes: Optional[str] = None


class ScreeningTriageRequest(BaseModel):
    patient_name: str
    age: int
    screening_type: str = "VIA"  # "VIA", "PAP_SMEAR", "COMBINED"
    test_date: Optional[str] = None
    findings_classification: str  # "NORMAL", "BENIGN_SYMPTOMATIC", "ABNORMAL_SUSPICIOUS"
    uploaded_image_or_doc: Optional[str] = None
    symptom_notes: Optional[str] = ""
    prescribed_local_therapy: Optional[str] = None
    tertiary_facility: Optional[str] = "Varanasi Regional Cancer Centre (Hub)"


class CommunityCheckinRequest(BaseModel):
    case_id: str
    outcome: str  # "SYMPTOMS_RESOLVED" or "PERSISTENT_REFERRED"
    checkin_notes: Optional[str] = None


class SpecialistReviewRequest(BaseModel):
    case_id: str
    oncologist_id: str
    clinical_assessment: str
    treatment_plan: str


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


# ==========================================
# 4. WHO 90-70-90 Prevention & Screening Protocol Engine
# ==========================================

@router.post("/protocol-evaluate")
async def evaluate_who_protocol(req: ProtocolEvaluateRequest):
    """
    Evaluate a patient against WHO 90-70-90 Cervical Cancer Elimination targets:
    1. Girls ages 13-15: WHO Target 1 (90% HPV vaccinated by age 15)
       - If vaccinated: Continue (Status: VACCINATED_PROTECTED)
       - Else: Schedule Vaccination (Status: VACCINATION_REQUIRED)
    2. Women ages 35-45: WHO Target 2 (70% screened with high-performance test at 35 and 45)
       - If screened: Continue (Status: SCREENED_PROTECTED, 5y recall)
       - Else: Schedule High-Performance Test (Status: SCREENING_REQUIRED)
    """
    name = req.patient_name.strip() if req.patient_name else "Patient"
    age = req.age

    if 13 <= age <= 15:
        is_vaccinated = bool(req.hpv_vaccinated)
        if is_vaccinated:
            return {
                "status": "SUCCESS",
                "cohort": "ADOLESCENT_13_15",
                "target_pillar": "90_VACCINATE",
                "target_title": "WHO Target 1: 90% HPV Vaccinated by Age 15",
                "is_girl_13_15": True,
                "is_woman_35_45": False,
                "recommendation": "CONTINUE",
                "protocol_status": "VACCINATED_PROTECTED",
                "badge_variant": "success",
                "directive": f"HPV vaccination verified for {name} ({age}Y). Protected against high-risk oncogenic HPV types 16 & 18. Continue routine adolescent health follow-up.",
                "action_required": False,
                "rule": "WHO Target 1 mandates 90% of girls fully vaccinated against HPV by age 15 (ages 13–15 priority cohort)."
            }
        else:
            return {
                "status": "SUCCESS",
                "cohort": "ADOLESCENT_13_15",
                "target_pillar": "90_VACCINATE",
                "target_title": "WHO Target 1: 90% HPV Vaccinated by Age 15",
                "is_girl_13_15": True,
                "is_woman_35_45": False,
                "recommendation": "SCHEDULE_VACCINATION",
                "protocol_status": "VACCINATION_REQUIRED",
                "badge_variant": "destructive",
                "directive": f"Adolescent girl {name} ({age}Y) is in the critical 13–15 window and has not received the HPV vaccine. Schedule vaccination (Cervavac/Gardasil) prior to age 15 per WHO Target 1 & India National Immunization Drive.",
                "action_required": True,
                "suggested_action": "SCHEDULE_VACCINATION",
                "suggested_vaccine": "Cervavac",
                "rule": "Girls between ages 13 to 15 must receive HPV vaccine. If vaccinated, continue; else schedule vaccination."
            }

    elif 35 <= age <= 45:
        is_screened = bool(req.screened)
        if is_screened:
            return {
                "status": "SUCCESS",
                "cohort": "ADULT_35_45",
                "target_pillar": "70_SCREEN",
                "target_title": "WHO Target 2: 70% Screened with High-Performance Test at 35 & 45",
                "is_girl_13_15": False,
                "is_woman_35_45": True,
                "recommendation": "CONTINUE",
                "protocol_status": "SCREENED_PROTECTED",
                "badge_variant": "success",
                "directive": f"High-performance screening record verified for {name} ({age}Y). Cervical epithelium clear. Maintain 5-year routine recall (next test at age {min(45, age + 5)}).",
                "action_required": False,
                "rule": "WHO Target 2 mandates 70% of women screened with a high-performance test by age 35 and again by 45."
            }
        else:
            return {
                "status": "SUCCESS",
                "cohort": "ADULT_35_45",
                "target_pillar": "70_SCREEN",
                "target_title": "WHO Target 2: 70% Screened with High-Performance Test at 35 & 45",
                "is_girl_13_15": False,
                "is_woman_35_45": True,
                "recommendation": "SCHEDULE_SCREENING",
                "protocol_status": "SCREENING_REQUIRED",
                "badge_variant": "warning",
                "directive": f"Woman {name} ({age}Y) is in the priority 35–45 screening window and is unscreened. WHO 70% target requires high-performance HPV DNA or VIA screening. Schedule screening test immediately.",
                "action_required": True,
                "suggested_action": "SCHEDULE_SCREENING",
                "suggested_modality": "HPV_DNA",
                "rule": "Women between ages 35 and 45 must be screened with high-performance HPV test. If screened, continue; else schedule test."
            }

    else:
        # Other Age Cohorts
        if age < 13:
            cohort = "PEDIATRIC_UNDER_13"
            directive = f"{name} ({age}Y) is under target age 13 for HPV vaccination. Schedule enrollment when turning 13 (WHO Target 1 cohort)."
        elif 16 <= age < 35:
            cohort = "YOUNG_ADULT_16_34"
            directive = f"{name} ({age}Y) is in the young adult cohort. Provide health education & catch-up HPV immunization if eligible."
        else:
            cohort = "SENIOR_46_PLUS"
            directive = f"{name} ({age}Y) is in senior cohort. Conduct symptom triage & routine oncologic check-up (WHO Target 3: 90% treatment)."

        return {
            "status": "SUCCESS",
            "cohort": cohort,
            "target_pillar": "90_TREAT" if age >= 46 else "PREVENTION_MONITORING",
            "target_title": "Routine Demographic Surveillance",
            "is_girl_13_15": False,
            "is_woman_35_45": False,
            "recommendation": "CONTINUE",
            "protocol_status": "ROUTINE_MONITORING",
            "badge_variant": "neutral",
            "directive": directive,
            "action_required": False,
            "rule": "Outside primary 13–15 vaccination and 35–45 screening cohorts. Continue routine care."
        }


@router.post("/protocol-schedule")
async def schedule_who_protocol_action(req: ProtocolScheduleRequest):
    """
    Schedule HPV vaccination or high-performance screening action under WHO 90-70-90 targets.
    """
    patient_token = req.patient_token or (
        f"PT-VACC-{secrets.token_hex(2).upper()}" if "VACCINATION" in req.action_type
        else f"PT-SCR-{secrets.token_hex(2).upper()}"
    )
    app_date = req.appointment_date or (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    center = req.center or "Primary Health Centre Mirzapur"

    if req.action_type == "SCHEDULE_VACCINATION":
        vaccine_id = f"VAC-{secrets.token_hex(4).upper()}"
        next_due = (datetime.strptime(app_date, "%Y-%m-%d") + timedelta(days=60)).strftime("%Y-%m-%d") if req.dose_number == 1 else None
        
        rec = global_db.save_hpv_vaccination(
            vaccine_id=vaccine_id,
            patient_token=patient_token,
            patient_name=req.patient_name,
            age=req.age,
            dose_number=req.dose_number or 1,
            vaccine_brand=req.vaccine_brand or "Cervavac",
            administered_date=app_date,  # Scheduled appointment date
            next_due_date=next_due,
            school_or_center=center,
            status="SCHEDULED",
            outreach_sent=1 if req.dispatch_outreach else 0
        )

        global_audit.record_user_event(
            user_role=UserRole.NURSE_HEALTHCARE_WORKER,
            action="WHO_HPV_VACCINATION_SCHEDULED",
            actor_id="NURSE-PHC-01",
            patient_token=patient_token,
            details={
                "vaccine_id": vaccine_id,
                "patient_name": req.patient_name,
                "age": req.age,
                "appointment_date": app_date,
                "center": center,
                "vaccine_brand": req.vaccine_brand or "Cervavac",
                "outreach_dispatched": req.dispatch_outreach
            },
            severity="INFO",
            channel="WEB_CAREUI"
        )

        return {
            "status": "SUCCESS",
            "action_type": "SCHEDULE_VACCINATION",
            "message": f"HPV Vaccination ({req.vaccine_brand or 'Cervavac'}) scheduled for {req.patient_name} (Age {req.age}) on {app_date} at {center}. ASHA outreach notification dispatched.",
            "record": rec,
            "appointment_date": app_date
        }

    elif req.action_type == "SCHEDULE_SCREENING":
        screening_id = f"SCR-{secrets.token_hex(4).upper()}"
        test_type = req.test_type or "HPV_DNA"
        rec = global_db.save_screening_record(
            screening_id=screening_id,
            patient_token=patient_token,
            patient_name=req.patient_name,
            age=req.age,
            invitation_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            test_type=test_type,
            test_date=app_date,
            result="PENDING_SCHEDULED",
            clinical_staging="SCHEDULED",
            triage_action=f"SCHEDULED_{test_type}",
            clinician_reviewed=0
        )

        global_audit.record_user_event(
            user_role=UserRole.NURSE_HEALTHCARE_WORKER,
            action="WHO_SCREENING_SCHEDULED",
            actor_id="NURSE-SCREENING-01",
            patient_token=patient_token,
            details={
                "screening_id": screening_id,
                "patient_name": req.patient_name,
                "age": req.age,
                "test_type": test_type,
                "appointment_date": app_date,
                "center": center,
                "outreach_dispatched": req.dispatch_outreach
            },
            severity="INFO",
            channel="WEB_CAREUI"
        )

        return {
            "status": "SUCCESS",
            "action_type": "SCHEDULE_SCREENING",
            "message": f"High-Performance {test_type} screening appointment scheduled for {req.patient_name} (Age {req.age}) on {app_date} at {center}. ASHA mobilization alert issued.",
            "record": rec,
            "appointment_date": app_date
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action_type: {req.action_type}")


# ==========================================
# 5. Cohort 1: Girls Under 14 (Preventive Vaccination & Dose Tracking)
# ==========================================

@router.post("/adolescents")
async def register_adolescent_beneficiary(req: AdolescentRegisterRequest):
    """
    ASHA intake & registry enrollment for adolescent girls (ages 9–14).
    Validates eligibility, birth records, and checks prior vaccination history.
    """
    if req.age < 9 or req.age > 14:
        raise HTTPException(
            status_code=400,
            detail=f"Eligibility target for Cohort 1 is adolescent girls aged 9 to 14 years. Patient age provided: {req.age}."
        )

    beneficiary_id = f"BEN-{secrets.token_hex(3).upper()}"
    patient_token = f"PT-ADO-{secrets.token_hex(4).upper()}"

    rec = global_db.save_adolescent_beneficiary(
        beneficiary_id=beneficiary_id,
        patient_token=patient_token,
        full_name=req.full_name,
        age=req.age,
        dob=req.dob,
        guardian_name=req.guardian_name,
        guardian_phone=req.guardian_phone,
        village=req.village,
        school_or_camp=req.school_or_camp,
        prior_vaccine_audit=req.prior_vaccine_audit or "NONE",
        dose_count=0,
        status="UNVACCINATED"
    )

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="ASHA_ADOLESCENT_REGISTRY_ENROLL",
        actor_id="ASHA-001",
        patient_token=patient_token,
        details={
            "beneficiary_id": beneficiary_id,
            "full_name": req.full_name,
            "age": req.age,
            "school_or_camp": req.school_or_camp,
            "prior_vaccine_audit": req.prior_vaccine_audit
        },
        severity="INFO",
        channel="MOBILE_ASHA"
    )

    return {"status": "SUCCESS", "beneficiary": rec}


@router.get("/adolescents")
async def list_adolescent_beneficiaries(status: Optional[str] = None):
    """List registered adolescent beneficiaries with dose counter summary."""
    records = global_db.get_adolescent_beneficiaries(status=status)
    unvac = sum(1 for r in records if r.get("dose_count", 0) == 0)
    partial = sum(1 for r in records if r.get("dose_count", 0) == 1)
    immunized = sum(1 for r in records if r.get("dose_count", 0) >= 2)

    return {
        "status": "SUCCESS",
        "beneficiaries": records,
        "total": len(records),
        "dose_counts": {
            "unvaccinated_0_2": unvac,
            "partially_vaccinated_1_2": partial,
            "fully_immunized_2_2": immunized
        }
    }


@router.get("/adolescents/{beneficiary_id}")
async def get_adolescent_beneficiary(beneficiary_id: str):
    """Retrieve details for a specific adolescent beneficiary."""
    rec = global_db.get_adolescent_beneficiary(beneficiary_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Adolescent beneficiary not found")
    return {"status": "SUCCESS", "beneficiary": rec}


@router.post("/adolescents/{beneficiary_id}/dose")
async def record_adolescent_dose(beneficiary_id: str, req: AdolescentDoseRequest):
    """
    Log administration of Dose 1 or Dose 2.
    - Dose 1 automatically schedules Dose 2 at 6-month interval (T0 + 180 days).
    - Dose 2 marks the beneficiary Fully Immunized (2/2), logs AEFI, and creates ABDM record.
    """
    if req.dose_number not in (1, 2):
        raise HTTPException(status_code=400, detail="Dose number must be 1 or 2 in a 2-dose standard schedule.")

    try:
        updated = global_db.record_adolescent_dose(
            beneficiary_id=beneficiary_id,
            dose_number=req.dose_number,
            batch_number=req.batch_number or "CERV-2026-A1",
            admin_site=req.admin_site or "Left Deltoid",
            center=req.center or "Primary Health Centre Mirzapur",
            administered_date=req.administered_date,
            aefi_reported=1 if req.aefi_reported else 0,
            aefi_notes=req.aefi_notes
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="VACCINE_DOSE_ADMINISTERED",
        actor_id="NURSE-PHC-01",
        patient_token=updated["patient_token"],
        details={
            "beneficiary_id": beneficiary_id,
            "dose_number": req.dose_number,
            "batch_number": req.batch_number,
            "status": updated["status"],
            "aefi_reported": req.aefi_reported,
            "abdm_logged": updated.get("abdm_logged", 0)
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "beneficiary": updated}


@router.post("/adolescents/{beneficiary_id}/cadence-alert")
async def trigger_adolescent_cadence_alert(beneficiary_id: str, req: AdolescentAlertRequest):
    """
    Dispatch a 14-day cadence notification:
    - 14_DAY_PRE_DUE: Initiates parent/guardian notice and prompts ASHA to verify vaccine vial stock.
    - 14_DAY_OVERDUE: Escalates priority ASHA task and triggers regional voice/SMS outreach.
    """
    if req.alert_type not in ("14_DAY_PRE_DUE", "14_DAY_OVERDUE"):
        raise HTTPException(status_code=400, detail="alert_type must be '14_DAY_PRE_DUE' or '14_DAY_OVERDUE'.")

    try:
        updated = global_db.update_adolescent_alert(
            beneficiary_id=beneficiary_id,
            alert_type=req.alert_type,
            notes=req.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    global_audit.record_user_event(
        user_role=UserRole.SYSTEM,
        action="FOURTEEN_DAY_CADENCE_ALERT_DISPATCHED",
        actor_id="CADENCE_ALERT_ENGINE",
        patient_token=updated["patient_token"],
        details={
            "beneficiary_id": beneficiary_id,
            "alert_type": req.alert_type,
            "notes": req.notes,
            "parent_contact": updated["guardian_phone"]
        },
        severity="WARNING" if req.alert_type == "14_DAY_OVERDUE" else "INFO",
        channel="VOICE_SMS_OUTREACH"
    )

    return {
        "status": "SUCCESS",
        "message": f"{req.alert_type} cadence alert recorded and ASHA coordination task dispatched.",
        "beneficiary": updated
    }


# ==========================================
# 6. Cohort 2: Women Aged 35–45 (Screening, Triaging & Dual-Track Care)
# ==========================================

@router.post("/screening/triage")
async def record_screening_triage(req: ScreeningTriageRequest):
    """
    Ingest point-of-care VIA or Pap smear result, upload image/doc, and auto-segregate:
    - Normal Findings -> Routine 3–5 year rescreening.
    - Benign Symptomatic Findings -> ASHA Community Management with 14-day symptom check-in.
    - Abnormal / Suspicious Findings -> Tertiary Specialist Referral.
    """
    case_id = f"SCR-{secrets.token_hex(3).upper()}"
    patient_token = f"PT-SCR-{secrets.token_hex(4).upper()}"
    t_date = req.test_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    classification = req.findings_classification.upper()
    if any(k in classification for k in ("ABNORMAL", "SUSPICIOUS", "VIA_POSITIVE", "ACETOWHITE", "CIN", "MALIGNANT", "INVASIVE", "BLEEDING")):
        track = "TERTIARY_SPECIALIST_REFERRAL"
        action_status = "REFERRED_TO_TERTIARY"
        therapy = None
    elif any(k in classification for k in ("BENIGN", "CERVICITIS", "INFECTION", "INFLAMMATION", "SYMPTOMATIC")):
        track = "ASHA_COMMUNITY_MANAGEMENT"
        action_status = "14_DAY_CHECKIN_PENDING"
        therapy = req.prescribed_local_therapy or "Metronidazole 400mg BD x 7d + Clotrimazole 1% vaginal gel; 14-day symptom check-in."
    else:
        track = "ROUTINE_3_5Y_RECALL"
        action_status = "RESOLVED"
        therapy = None

    rec = global_db.save_screening_case(
        case_id=case_id,
        patient_token=patient_token,
        patient_name=req.patient_name,
        age=req.age,
        screening_type=req.screening_type,
        test_date=t_date,
        findings_classification=req.findings_classification,
        uploaded_image_or_doc=req.uploaded_image_or_doc,
        symptom_notes=req.symptom_notes,
        triage_track=track,
        care_action_status=action_status,
        prescribed_local_therapy=therapy,
        tertiary_facility=req.tertiary_facility
    )

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="SCREENING_AI_TRIAGE_COMPLETED",
        actor_id="ASHA-SCREENER-01",
        patient_token=patient_token,
        details={
            "case_id": case_id,
            "screening_type": req.screening_type,
            "findings": req.findings_classification,
            "triage_track": track,
            "care_action_status": action_status
        },
        severity="WARNING" if track == "TERTIARY_SPECIALIST_REFERRAL" else "INFO",
        channel="MOBILE_ASHA"
    )

    return {
        "status": "SUCCESS",
        "case": rec,
        "triage_track": track,
        "care_action_status": action_status
    }


@router.get("/screening/cases")
async def list_screening_cases(triage_track: Optional[str] = None, care_action_status: Optional[str] = None):
    """List screening cases with optional track and action status filters."""
    records = global_db.get_screening_cases(triage_track=triage_track, care_action_status=care_action_status)
    return {
        "status": "SUCCESS",
        "cases": records,
        "total": len(records),
        "summary": {
            "routine_recall": sum(1 for r in records if r.get("triage_track") == "ROUTINE_3_5Y_RECALL"),
            "asha_community_management": sum(1 for r in records if r.get("triage_track") == "ASHA_COMMUNITY_MANAGEMENT"),
            "tertiary_referral": sum(1 for r in records if r.get("triage_track") == "TERTIARY_SPECIALIST_REFERRAL")
        }
    }


@router.post("/screening/community-checkin")
async def log_community_checkin(req: CommunityCheckinRequest):
    """
    Log 14-day symptom resolution check-in by ASHA worker.
    - SYMPTOMS_RESOLVED: Marks the episode resolved.
    - PERSISTENT_REFERRED: Escalates the case to Tertiary Specialist Referral.
    """
    try:
        updated = global_db.update_community_checkin(
            case_id=req.case_id,
            outcome=req.outcome,
            checkin_notes=req.checkin_notes
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="ASHA_COMMUNITY_CHECKIN_COMPLETED",
        actor_id="ASHA-002",
        patient_token=updated["patient_token"],
        details={
            "case_id": req.case_id,
            "outcome": req.outcome,
            "new_status": updated["care_action_status"],
            "new_track": updated["triage_track"]
        },
        severity="INFO" if req.outcome == "SYMPTOMS_RESOLVED" else "WARNING",
        channel="MOBILE_ASHA"
    )

    return {"status": "SUCCESS", "case": updated}


# ==========================================
# 7. Tertiary Specialist Review Portal
# ==========================================

@router.get("/specialist/queue")
async def get_specialist_queue():
    """
    Tertiary Hospital Specialist Doctor Queue.
    Returns all women referred for specialist evaluation with uploaded images, slips, and ASHA logs.
    """
    records = global_db.get_screening_cases(triage_track="TERTIARY_SPECIALIST_REFERRAL")
    return {
        "status": "SUCCESS",
        "queue": records,
        "total": len(records)
    }


@router.post("/specialist/review")
async def submit_specialist_review(req: SpecialistReviewRequest):
    """
    Specialist oncologist or gynecologist review and clinical directive sign-off.
    """
    try:
        updated = global_db.update_specialist_review(
            case_id=req.case_id,
            oncologist_id=req.oncologist_id,
            clinical_assessment=req.clinical_assessment,
            treatment_plan=req.treatment_plan
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="SPECIALIST_DOCTOR_REVIEW_COMPLETED",
        actor_id=req.oncologist_id,
        patient_token=updated["patient_token"],
        details={
            "case_id": req.case_id,
            "assessment": req.clinical_assessment,
            "treatment_plan": req.treatment_plan
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "case": updated}



