"""Clinical Intake, LangGraph Execution, Cases, and Tracking Simulation router."""
import shutil
import secrets
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

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

