"""Clinical Intake, LangGraph Execution, Cases, and Tracking Simulation router."""
import shutil
import secrets
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.config import UPLOADS_DIR
from backend.core.database import global_db
from backend.core.security import global_vault
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

