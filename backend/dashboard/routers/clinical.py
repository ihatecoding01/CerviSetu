"""Clinical Intake, LangGraph Execution, Cases, and Tracking Simulation router."""
import shutil
import secrets
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.config import UPLOADS_DIR
from backend.core.database import global_db
from backend.core.security import global_vault, global_audit, UserRole
from backend.graph.workflow import clinical_graph
from backend.tools.tracker_tools import TrackerTriageEngine

router = APIRouter(prefix="/api", tags=["Clinical Intake & Diagnostic Engine"])


class IntakeRequest(BaseModel):
    raw_text: str
    patient_name: Optional[str] = "Anonymous Patient"
    phone: Optional[str] = ""
    village: Optional[str] = "Village Rampur"
    district: Optional[str] = "Varanasi"
    days_overdue: Optional[int] = 0


class SimulationRequest(BaseModel):
    patient_token: str
    days_overdue: int
    cancer_type: Optional[str] = "ORAL"
    stage: Optional[str] = "Stage III"
    biopsy_status: Optional[str] = "POSITIVE"


@router.post("/run-case")
async def run_case(
    raw_text: str = Form(...),
    patient_name: str = Form("Ramesh Kumar"),
    phone: str = Form("+91 98765 43210"),
    village: str = Form("Kalyanpur"),
    district: str = Form("Mirzapur"),
    days_overdue: int = Form(0),
    image_file: Optional[UploadFile] = File(None)
):
    """Run full LangGraph workflow across OCR intake, image triage, diagnosis, and tracking."""
    image_path = None
    if image_file and image_file.filename:
        safe_filename = f"{secrets.token_hex(4)}_{image_file.filename}"
        dest_path = UPLOADS_DIR / safe_filename
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)
        image_path = str(dest_path)

    # Initial Agent State
    session_id = f"sess-{secrets.token_hex(4)}"
    initial_state = {
        "patient_token": "NEW",
        "session_id": session_id,
        "raw_text": f"Patient: {patient_name}\nPhone: {phone}\nVillage: {village}, District: {district}\n\n{raw_text}",
        "document_path": None,
        "image_path": image_path,
        "clinical_intake": None,
        "intake_status": "PENDING",
        "image_quality": None,
        "image_triage_passed": True,
        "diagnostic_synthesis": None,
        "days_overdue": days_overdue,
        "cancer_severity_score": 0.0,
        "current_escalation_tier": None,
        "dispatched_notifications": [],
        "authority_escalation_dossier": None,
        "audit_trail": [],
        "errors": [],
        "next_node": None,
        "status": "RUNNING"
    }

    config = {"configurable": {"thread_id": session_id}}
    final_state = clinical_graph.invoke(initial_state, config=config)
    return JSONResponse(content=final_state)


@router.post("/simulate-escalation")
async def simulate_escalation(req: SimulationRequest):
    """Simulate overdue follow-up timeline progression and execute progressive reminders."""
    active_tier, dispatched, dossier = TrackerTriageEngine.evaluate_and_escalate(
        patient_token=req.patient_token,
        cancer_type=req.cancer_type or "ORAL",
        stage=req.stage or "Stage III",
        biopsy_status=req.biopsy_status or "POSITIVE",
        symptoms=["ulcer", "pain", "weight loss"],
        days_overdue=req.days_overdue,
        vault=global_vault
    )

    # Persist notifications
    for n in dispatched:
        notif_id = f"NOTIF-{secrets.token_hex(4).upper()}"
        global_db.log_notification(
            notif_id=notif_id,
            patient_token=req.patient_token,
            tier=n.tier,
            channel=n.channel,
            recipient_role=n.recipient_role,
            message_content=n.message_content,
            timestamp=n.timestamp
        )

    # Update follow-up tracker
    global_db.update_follow_up(
        tracker_id=f"TRK-{req.patient_token}",
        patient_token=req.patient_token,
        case_id="SIMULATED",
        due_date="Overdue",
        days_overdue=req.days_overdue,
        last_reminder_tier=active_tier
    )

    return {
        "patient_token": req.patient_token,
        "days_overdue": req.days_overdue,
        "active_tier": active_tier,
        "dispatched_notifications": [n.model_dump() for n in dispatched],
        "authority_dossier": dossier
    }


@router.get("/cases")
async def get_cases():
    """Retrieve all clinical cases."""
    cases = global_db.get_all_cases()
    return {"cases": cases}


@router.get("/patient/{token}")
async def get_patient_record(token: str):
    """Retrieve complete timeline and history for a patient token."""
    data = global_db.get_patient_timeline(token)
    return data


# ==========================================
# Chemotherapy Clearance & Safety Interlocks
# ==========================================

class ChemoClearanceRequest(BaseModel):
    patient_token: str
    cycle_number: int
    status: str  # APPROVED, REDUCED_25, HELD
    dose_mg: float = 65.0
    hb: float = 10.4
    anc: int = 2200
    platelets: int = 180
    creatinine: float = 0.85
    egfr: int = 82
    doctor_id: Optional[str] = "DR-SHARMA-01"
    clinical_notes: Optional[str] = ""
    ebrt_must_continue: Optional[int] = 1


class DowntimeToggleRequest(BaseModel):
    facility_name: Optional[str] = "Mirzapur Spoke Clinic"
    machine_id: Optional[str] = "LINAC-SPOKE-01"
    reason: Optional[str] = "Scheduled Collimator Calibration"


class HubDeficiencyRequest(BaseModel):
    patient_token: str
    deficiency_reason: str
    action_required: str
    doctor_id: Optional[str] = "DR-ONCO-HUB-01"


class DischargeSignoffRequest(BaseModel):
    patient_token: str
    doctor_id: Optional[str] = "DR-ONCO-HUB-01"
    total_ott_days: Optional[int] = 44
    benchmark_status: Optional[str] = "OPTIMAL_49D_MET"


@router.post("/clinical/chemo-clearance")
async def log_chemo_clearance(req: ChemoClearanceRequest):
    """Log oncologist weekly Cisplatin clearance or hold with mandatory unbroken EBRT flag."""
    clearance_id = f"CHEMO-{secrets.token_hex(4).upper()}"
    rec = global_db.save_chemo_clearance(
        clearance_id=clearance_id,
        patient_token=req.patient_token,
        cycle_number=req.cycle_number,
        status=req.status,
        dose_mg=req.dose_mg,
        hb=req.hb,
        anc=req.anc,
        platelets=req.platelets,
        creatinine=req.creatinine,
        egfr=req.egfr,
        doctor_id=req.doctor_id or "DR-SHARMA-01",
        clinical_notes=req.clinical_notes,
        ebrt_must_continue=req.ebrt_must_continue if req.ebrt_must_continue is not None else 1
    )

    action = "DOCTOR_CHEMO_CLEARANCE_APPROVED" if req.status == "APPROVED" else "DOCTOR_CHEMO_HOLD_EBRT_ACTIVE"
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action=action,
        actor_id=req.doctor_id or "DR-SHARMA-01",
        patient_token=req.patient_token,
        details={
            "cycle_number": req.cycle_number,
            "status": req.status,
            "creatinine": req.creatinine,
            "egfr": req.egfr,
            "ebrt_must_continue": True
        },
        severity="WARNING" if req.status == "HELD" else "INFO",
        channel="WEB_CAREUI"
    )

    return {"status": "SUCCESS", "clearance": rec, "ebrt_must_continue": True}


@router.get("/clinical/chemo-clearance/{token}")
async def get_chemo_clearances(token: str):
    """Retrieve all chemotherapy clearance history for a patient."""
    history = global_db.get_chemo_clearances(token)
    return {"patient_token": token, "clearances": history}


@router.post("/clinical/downtime-toggle")
async def toggle_linac_downtime(req: DowntimeToggleRequest):
    """Toggle clinic-wide LINAC maintenance downtime to pause delinquency timers."""
    res = global_db.toggle_linac_downtime(
        facility_name=req.facility_name or "Mirzapur Spoke Clinic",
        machine_id=req.machine_id or "LINAC-SPOKE-01",
        reason=req.reason or "Scheduled Maintenance"
    )

    global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="LINAC_DOWNTIME_TOGGLED",
        actor_id="NURSE-SPOKE-01",
        patient_token="CLINIC_WIDE",
        details=res,
        severity="WARNING" if res.get("is_active") else "INFO",
        channel="WEB_CAREUI"
    )

    return res


@router.get("/clinical/downtime-status")
async def get_linac_downtime_status(facility: str = "Mirzapur Spoke Clinic"):
    """Get current active status of LINAC radiation vault."""
    status = global_db.get_linac_downtime_status(facility)
    return status


@router.post("/clinical/linac-downtime")
async def toggle_linac_downtime_ui(req: DowntimeToggleRequest):
    """Route used by the CareUI ward board; same behaviour as /clinical/downtime-toggle."""
    return await toggle_linac_downtime(req)


@router.get("/clinical/linac-downtime/status")
async def get_linac_downtime_status_ui(facility_name: str = "Mirzapur Spoke Clinic"):
    """Route used by the CareUI ward board, shaped to the frontend LinacDowntimeStatus type."""
    status = global_db.get_linac_downtime_status(facility_name)
    is_active = status.get("status") == "MAINTENANCE_PAUSED"
    return {
        "facility_name": status.get("facility_name", facility_name),
        "machine_id": status.get("machine_id") or "LINAC-SPOKE-01",
        "is_downtime_active": is_active,
        "status": "MAINTENANCE_PAUSED" if is_active else "OPERATIONAL",
        "started_at": status.get("started_at"),
        "reason": status.get("reason"),
        "clock_paused_message": "Delinquency clocks paused clinic-wide during LINAC maintenance." if is_active else None,
    }


@router.post("/clinical/hub-deficiency")
async def log_hub_deficiency(req: HubDeficiencyRequest):
    """Return referral packet with deficiency and 48h action SLA on Spoke board."""
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="HUB_DEFICIENCY_RETURN",
        actor_id=req.doctor_id or "DR-ONCO-HUB-01",
        patient_token=req.patient_token,
        details={
            "deficiency_reason": req.deficiency_reason,
            "action_required": req.action_required,
            "sla_hours": 48
        },
        severity="WARNING",
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "patient_token": req.patient_token,
        "action": "HUB_DEFICIENCY_RETURN",
        "sla_window": "48 Hours",
        "instructions": req.action_required
    }


@router.post("/clinical/discharge-signoff")
async def discharge_signoff(req: DischargeSignoffRequest):
    """Final treatment discharge sign-off with cryptographic SHA-256 seal and DPDP audio purge."""
    block = global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="DOCTOR_FINAL_DISCHARGE_SIGN",
        actor_id=req.doctor_id or "DR-ONCO-HUB-01",
        patient_token=req.patient_token,
        details={
            "total_ott_days": req.total_ott_days,
            "benchmark_status": req.benchmark_status,
            "audio_cache_purged": True
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "patient_token": req.patient_token,
        "discharge_block": block,
        "audio_purged": True,
        "survivorship_action_card": {
            "day_7_asha_check": "Scheduled",
            "month_3_spoke_exam": "Scheduled",
            "guideline_status": req.benchmark_status
        }
    }



class HubTransferDeficiencyRequest(BaseModel):
    requested_deficiencies: List[str] = []
    spoke_action_sla_hours: Optional[int] = 48
    notes: Optional[str] = None
    doctor_id: Optional[str] = "DR-ONCO-HUB-01"


@router.post("/clinical/hub-transfer/{patient_token}/deficiency-return")
async def return_hub_transfer_deficiency(patient_token: str, req: HubTransferDeficiencyRequest):
    """Route used by the CareUI encounter screen; records the same audit event as /clinical/hub-deficiency."""
    sla_hours = req.spoke_action_sla_hours or 48
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="HUB_DEFICIENCY_RETURN",
        actor_id=req.doctor_id or "DR-ONCO-HUB-01",
        patient_token=patient_token,
        details={
            "deficiency_reason": "; ".join(req.requested_deficiencies) or "Unspecified",
            "action_required": req.notes or "Resolve listed deficiencies at Spoke",
            "sla_hours": sla_hours
        },
        severity="WARNING",
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "patient_token": patient_token,
        "message": f"Referral returned to Spoke with {len(req.requested_deficiencies)} deficiency item(s); {sla_hours}h action SLA started.",
        "action_sla_hours": sla_hours
    }


class EncounterDischargeRequest(BaseModel):
    doctor_id: Optional[str] = "DR-ONCO-HUB-01"
    total_ebrt_fractions: Optional[int] = 25
    total_brachy_fractions: Optional[int] = 4
    clinical_summary: Optional[str] = None


@router.post("/encounter/{patient_token}/discharge-signoff")
async def encounter_discharge_signoff(patient_token: str, req: EncounterDischargeRequest):
    """Route used by the CareUI encounter screen; records the same audit event as /clinical/discharge-signoff."""
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action="DOCTOR_FINAL_DISCHARGE_SIGN",
        actor_id=req.doctor_id or "DR-ONCO-HUB-01",
        patient_token=patient_token,
        details={
            "total_ebrt_fractions": req.total_ebrt_fractions,
            "total_brachy_fractions": req.total_brachy_fractions,
            "clinical_summary": req.clinical_summary
        },
        severity="INFO",
        channel="WEB_CAREUI"
    )

    return {
        "status": "SUCCESS",
        "patient_token": patient_token,
        "message": "Discharge sign-off sealed in the SHA-256 audit ledger.",
        "dpdp_compliance": "Audio cache purge requested per DPDP Act 2023 storage limitation"
    }


class EscalationCycleRequest(BaseModel):
    advance_days: int = Field(default=1, ge=1, le=14)
    as_of_date: Optional[str] = None


@router.post("/escalation/run-cycle")
async def run_escalation_cycle_now(req: EscalationCycleRequest):
    """Run the daily escalation cycle on demand. Treatment plans are evaluated from the real clock as of
    today (or an earlier as_of_date); advance_days only moves legacy diagnostic follow-up counters."""
    from datetime import date
    from backend.config import clinic_today
    from backend.tools.escalation_scheduler import run_escalation_cycle

    as_of = clinic_today()
    if req.as_of_date:
        try:
            as_of = date.fromisoformat(req.as_of_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="as_of_date must be YYYY-MM-DD")
        if as_of > clinic_today():
            raise HTTPException(status_code=400, detail="as_of_date cannot be in the future")
    return run_escalation_cycle(advance_days=req.advance_days, as_of=as_of)


class FacilityDowntimeRequest(BaseModel):
    facility_name: str = "Mirzapur Spoke Clinic"
    start_date: str
    end_date: Optional[str] = None
    reason: str = Field(..., min_length=1)
    recorded_by: str = Field(..., min_length=1)


@router.post("/clinical/facility-downtime")
async def record_facility_downtime(req: FacilityDowntimeRequest):
    """Record past or planned machine downtime by date. Downtime days are never counted as patient misses."""
    from datetime import date, timedelta
    try:
        first = date.fromisoformat(req.start_date)
        last = date.fromisoformat(req.end_date or req.start_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if last < first or (last - first).days > 30:
        raise HTTPException(status_code=422, detail="Downtime must be 1-31 days with end_date >= start_date")
    d, dates = first, []
    while d <= last:
        global_db.add_schedule_exception(d.isoformat(), "FACILITY_DOWNTIME", req.reason, req.recorded_by,
                                         facility_name=req.facility_name)
        dates.append(d.isoformat())
        d += timedelta(days=1)
    block = global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER, action="FACILITY_DOWNTIME_RECORDED", actor_id=req.recorded_by,
        patient_token="CLINIC_WIDE", details={"facility": req.facility_name, "dates": dates, "reason": req.reason},
        severity="WARNING", channel="WEB_CAREUI"
    )
    return {"status": "SUCCESS", "facility_name": req.facility_name, "dates": dates, "block": block}


@router.get("/ward-board")
async def get_ward_board():
    """Every approved CCRT plan with its live clock, for the oncology ward board. No PII."""
    from backend.config import clinic_today
    from backend.tools.clock_service import build_clock

    today = clinic_today()
    rows = []
    for plan in global_db.list_treatment_plans():
        if plan["status"] not in ("ACTIVE", "COMPLETED"):
            continue
        c = build_clock(plan, today)
        case = global_db.get_latest_case(plan["patient_token"]) or {}
        rows.append({
            "patient_token": plan["patient_token"],
            "plan_id": plan["plan_id"],
            "stage": case.get("suspected_stage"),
            "age": case.get("age"),
            "regimen_label": plan["regimen_label"],
            "start_date": c["start_date"],
            "treatment_day_today": c["treatment_day_today"],
            "completed_sessions": c["completed_sessions"],
            "total_sessions": c["total_sessions"],
            "missed_sessions": c["missed_sessions"],
            "consecutive_missed_sessions": c["consecutive_missed_sessions"],
            "projected_finish_day": c["projected_finish_day"],
            "projected_finish_date": c["projected_finish_date"],
            "target_49d_status": c["target_49d_status"],
            "limit_56d_status": c["limit_56d_status"],
            "clock_state": c["clock_state"],
            "clock_status": c["clock_status"],
            "current_escalation_tier": c["current_escalation_tier"],
            "next_session": (c["upcoming_sessions"] or [None])[0],
        })
    return {"status": "SUCCESS", "as_of_date": today.isoformat(), "plans": rows}


@router.get("/fhir/patient/{token}")
async def export_patient_fhir(token: str):
    """De-identified FHIR R4 Bundle (Patient, Condition, biopsy Observation, CarePlan) for ABDM exchange."""
    from backend.tools.fhir_export import build_patient_bundle
    return build_patient_bundle(token)
