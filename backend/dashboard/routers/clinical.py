"""AI summary run, case list, patient record and FHIR export."""
import re
import secrets
from typing import List, Optional, Tuple
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.core.database import global_db
from backend.core.security import PIIShield, global_vault, global_audit, UserRole
from backend.core.run_trace import traced_invoke
from backend.graph.workflow import clinical_graph

router = APIRouter(prefix="/api", tags=["Clinical Intake & Diagnostic Engine"])








def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _combine_intake_text(typed: str, ocr_text: str) -> Tuple[str, str]:
    """Typed clinician text first (it wins for rule extraction, which takes the first match), then OCR text
    under a labelled divider. OCR text already contained in the typed text is not duplicated."""
    typed, ocr_text = typed.strip(), ocr_text.strip()
    if not ocr_text:
        return typed, "TYPED_ONLY"
    if typed and _normalise(ocr_text) in _normalise(typed):
        return typed, "TYPED_ONLY_OCR_DUPLICATE"
    if not typed:
        return ocr_text, "OCR_ONLY"
    return f"{typed}\n\n--- Text read from uploaded document (OCR) ---\n{ocr_text}", "TYPED_AND_OCR"


@router.post("/run-case")
async def run_case(
    raw_text: str = Form(""),
    patient_name: str = Form(""),
    phone: str = Form(""),
    area: str = Form(""),
    health_post: str = Form(""),
    image_file: Optional[UploadFile] = File(None)
):
    """Run the LangGraph workflow on typed notes and/or an uploaded clinical document.

    Uploaded documents go through file validation, a local image-quality gate and OCR (when enabled);
    OCR text is masked by the intake pipeline before any LLM sees it and reuses the same extraction call.
    The document itself is processed in memory and not written to disk.
    """
    from backend.tools.document_ocr import DocumentRejected, process_document

    document = None
    ocr_text = ""
    if image_file and image_file.filename:
        try:
            doc = process_document(await image_file.read())
        except DocumentRejected as e:
            raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})
        ocr_text = doc.pop("text", "")
        document = {k: v for k, v in doc.items() if v is not None}
        if ocr_text:
            document["ocr_text_masked"] = PIIShield.mask_text(ocr_text)[0][:4000]
        if doc["status"] != "COMPLETED" and not raw_text.strip():
            raise HTTPException(status_code=422, detail={
                "code": doc["status"],
                "message": "The document could not be read. Type the clinical notes instead.",
                "document_processing": document,
            })

    text, sources = _combine_intake_text(raw_text, ocr_text)
    if not text:
        raise HTTPException(status_code=422, detail={"code": "NO_INPUT", "message": "Provide clinical notes or a document."})

    # Initial Agent State
    session_id = f"sess-{secrets.token_hex(4)}"
    initial_state = {
        "patient_token": "NEW",
        "session_id": session_id,
        "raw_text": f"Patient: {patient_name}\nPhone: {phone}\nArea: {area}, Health post: {health_post}\n\n{text}",
        "document_path": None,
        "image_path": None,
        "clinical_intake": None,
        "intake_status": "PENDING",
        "image_quality": None,
        "image_triage_passed": True,
        "diagnostic_synthesis": None,
        "cancer_severity_score": 0.0,
        "audit_trail": [],
        "errors": [],
        "next_node": None,
        "status": "RUNNING"
    }

    config = {"configurable": {"thread_id": session_id}}
    final_state, trace = traced_invoke(clinical_graph, initial_state, config)
    final_state["execution_trace"] = trace
    final_state["intake_sources"] = {"combination": sources, "typed_text": bool(raw_text.strip()),
                                     "document_ocr": bool(ocr_text and sources != "TYPED_ONLY_OCR_DUPLICATE")}
    final_state["document_processing"] = document
    return JSONResponse(content=final_state)




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






















































@router.get("/fhir/patient/{token}")
async def export_patient_fhir(token: str):
    """De-identified FHIR R4 Bundle (Patient, Condition, biopsy Observation, CarePlan) for ABDM exchange."""
    from backend.tools.fhir_export import build_patient_bundle
    return build_patient_bundle(token)
