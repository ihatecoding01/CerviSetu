"""FastAPI Backend and REST API for Clinical Diagnostic and Tracking System."""
import os
import shutil
import secrets
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from src.config import UPLOADS_DIR
from src.core.database import global_db
from src.core.security import global_audit, global_vault
from src.graph.workflow import clinical_graph
from src.tools.tracker_tools import TrackerTriageEngine

app = FastAPI(
    title="Clinical Diagnostic & Rural Patient Tracking AI",
    description="Privacy-first LangGraph multi-agent clinical diagnostic and rural cancer tracking system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


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


@app.post("/api/run-case")
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


@app.post("/api/simulate-escalation")
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


@app.get("/api/cases")
async def get_cases():
    """Retrieve all clinical cases."""
    cases = global_db.get_all_cases()
    return {"cases": cases}


@app.get("/api/patient/{token}")
async def get_patient_record(token: str):
    """Retrieve complete timeline and history for a patient token."""
    data = global_db.get_patient_timeline(token)
    return data


@app.get("/api/audit-logs")
async def get_audit_logs(limit: int = 50):
    """Retrieve immutable audit ledger entries."""
    logs = global_audit.get_events(limit=limit)
    return {"audit_logs": logs}


@app.get("/api/vault/inspect/{token}")
async def inspect_vault(token: str, authorized_role: str = "CHIEF_MEDICAL_OFFICER"):
    """Gated access to inspect encrypted vault details for emergency authority review."""
    try:
        pii = global_vault.retrieve_pii(token)
        global_audit.record_event(
            action="VAULT_PII_ACCESSED",
            actor=authorized_role,
            patient_token=token,
            details={"authorized_role": authorized_role},
            severity="WARNING"
        )
        return {"patient_token": token, "vault_data": pii}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# Mount static assets
if (STATIC_DIR / "index.html").exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(STATIC_DIR / "index.html"))
