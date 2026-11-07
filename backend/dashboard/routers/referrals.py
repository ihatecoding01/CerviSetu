"""Referral pathway API. The role middleware decides who may call a route; every record is then checked here too."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.tools import messaging, referral_pathway as rp

router = APIRouter(prefix="/api/referrals", tags=["Referral Pathway"])


class ReferralIn(BaseModel):
    patient_name: str = Field(..., min_length=2, max_length=120)
    age: Optional[int] = Field(None, ge=9, le=110)
    area: str = Field("", max_length=80)
    phone: str = Field("", max_length=20)
    family_phone: str = Field("", max_length=20)
    health_post: str = Field(..., min_length=2, max_length=120)
    screening_finding: str = Field(..., min_length=2, max_length=400)
    red_flags: str = Field("", max_length=400)
    urgent: bool = False
    refer: bool = True
    message_consent: Optional[str] = Field(None, pattern="^(GRANTED|WITHHELD)$")
    family_consent: bool = False
    form: Dict[str, str] = Field(default_factory=dict)


class AshaRegisterIn(BaseModel):
    request_id: str = Field("", max_length=64)
    patient_name: str = Field(..., min_length=2, max_length=120)
    age: Optional[int] = Field(None, ge=9, le=110)
    phone: str = Field("", pattern=r"^$|^(\+91[ -]?)?[6-9][0-9]{9}$")
    preferred_language: str = Field("", max_length=20)
    area: str = Field(..., min_length=2, max_length=80)
    screening_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    screening_method: str
    screening_result: str
    refer: bool
    referral_date: str = Field("", pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    notes: str = Field("", max_length=400)
    consent_contact: str
    consent_followup: str


class DuplicateIn(BaseModel):
    name: str = Field("", max_length=120)
    phone: str = Field("", max_length=20)
    query: str = Field("", max_length=120)


class StatusIn(BaseModel):
    status: str


class ClinicalIn(BaseModel):
    colposcopy: Optional[str] = Field(None, max_length=400)
    colposcopy_findings: Optional[Dict[str, str]] = None
    biopsy: Optional[str] = Field(None, max_length=40)
    histopathology: Optional[str] = Field(None, max_length=400)
    mri: Optional[str] = Field(None, max_length=400)
    final_diagnosis: Optional[str] = Field(None, max_length=400)
    treatment_plan: Optional[str] = Field(None, max_length=800)
    remarks: Optional[str] = Field(None, max_length=800)
    next_follow_up: Optional[str] = Field(None, max_length=20)


class ReminderIn(BaseModel):
    channel: str = Field("SMS", pattern="^(SMS|VOICE|WHATSAPP)$")


class ReplyIn(BaseModel):
    reply: str


class ContactIn(BaseModel):
    outcome: str
    note: str = Field("", max_length=400)


class VisitIn(BaseModel):
    outcome: str
    consent: Optional[str] = None
    note: str = Field("", max_length=400)


class NoteIn(BaseModel):
    note: str = Field("", max_length=400)


def _staff(request: Request) -> Optional[Dict[str, Any]]:
    return getattr(request.state, "staff", None)


def _actor(request: Request) -> str:
    return (_staff(request) or {}).get("staff_id", "STAFF")


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except rp.ReferralError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


def _own(request: Request, referral_id: str) -> Dict[str, Any]:
    """The record, if this account may touch it. Otherwise 404, so other patients' records stay invisible."""
    row = _run(rp._get, referral_id)
    if not rp.visible_to(_staff(request), row):
        raise HTTPException(status_code=404, detail="Referral not found.")
    return row


def _out(request: Request, row: Dict[str, Any]) -> Dict[str, Any]:
    return rp.view_for(_staff(request), row)


@router.get("")
async def board(request: Request):
    return {"referrals": rp.list_for(_staff(request)), "routes": rp.current_routes(), "messaging_mode": messaging.mode()}


@router.post("", status_code=201)
async def create(req: ReferralIn, request: Request):
    staff = _staff(request)
    if staff and staff["role"] == "NURSE" and req.health_post != staff.get("health_post"):
        raise HTTPException(status_code=403, detail="You can only add referrals for your own health post.")
    return _out(request, _run(rp.create, req.model_dump(), _actor(request)))


def _asha(request: Request) -> Dict[str, Any]:
    staff = _staff(request)
    if not staff or staff["role"] != "ASHA" or not staff.get("health_post"):
        raise HTTPException(status_code=403, detail="Only an ASHA worker with a health post can do this.")
    return staff


@router.post("/register", status_code=201)
async def register(req: AshaRegisterIn, request: Request):
    """ASHA registers a woman screened at her own health post. The health post and ASHA come from her session."""
    staff = _asha(request)
    return _out(request, _run(rp.register_by_asha, req.model_dump(), staff))


@router.post("/duplicates")
async def duplicates(req: DuplicateIn, request: Request):
    return {"matches": rp.find_duplicates(_asha(request), req.name, req.phone, req.query)}


@router.post("/run-cycle")
async def run_cycle():
    return rp.run_cycle()


@router.get("/{referral_id}/events")
async def events(referral_id: str, request: Request):
    _own(request, referral_id)
    return {"events": rp.events(referral_id)}


@router.post("/{referral_id}/status")
async def status(referral_id: str, req: StatusIn, request: Request):
    _own(request, referral_id)
    return _run(rp.update_status, referral_id, req.status, _actor(request))


@router.post("/{referral_id}/clinical")
async def clinical(referral_id: str, req: ClinicalIn, request: Request):
    _own(request, referral_id)
    return _run(rp.record_clinical, referral_id, req.model_dump(), _actor(request))


@router.post("/{referral_id}/arrival")
async def arrival(referral_id: str, request: Request):
    _own(request, referral_id)
    return _out(request, _run(rp.confirm_arrival, referral_id, _actor(request)))


@router.post("/{referral_id}/review")
async def review(referral_id: str, req: NoteIn, request: Request):
    _own(request, referral_id)
    return _run(rp.resolve_review, referral_id, req.note, _actor(request))


@router.post("/{referral_id}/reminder")
async def reminder(referral_id: str, req: ReminderIn, request: Request):
    _own(request, referral_id)
    return _run(rp.send_reminder, referral_id, _actor(request), req.channel)


@router.post("/{referral_id}/reply")
async def reply(referral_id: str, req: ReplyIn, request: Request):
    _own(request, referral_id)
    return _out(request, _run(rp.record_reply, referral_id, req.reply, _actor(request)))


@router.post("/{referral_id}/contact")
async def contact(referral_id: str, req: ContactIn, request: Request):
    _own(request, referral_id)
    return _out(request, _run(rp.record_contact, referral_id, req.outcome, req.note, _actor(request)))


@router.post("/{referral_id}/visit")
async def visit(referral_id: str, req: VisitIn, request: Request):
    _own(request, referral_id)
    return _out(request, _run(rp.record_visit, referral_id, req.outcome, req.consent, req.note, _actor(request)))


@router.post("/{referral_id}/assign-asha")
async def assign(referral_id: str, request: Request):
    row = rp._view(_own(request, referral_id))
    if not rp.assign_asha(row, row["follow_up_day"], actor=_actor(request)):
        raise HTTPException(status_code=409, detail="Already assigned, or no ASHA is registered at this health post.")
    return _out(request, rp._view(rp._get(referral_id)))


@router.get("/{referral_id}/files")
async def files(referral_id: str, request: Request):
    _own(request, referral_id)
    files = rp.list_files(referral_id)
    if (_staff(request) or {}).get("role") == "ASHA":  # never clinical reports
        files = [f for f in files if f.get("kind") in rp.ASHA_UPLOAD_KINDS]
    return {"files": files}


@router.post("/{referral_id}/files", status_code=201)
async def upload(referral_id: str, request: Request, kind: str = Form(...), photo_consent: bool = Form(False), file: UploadFile = File(...)):
    _own(request, referral_id)
    staff = _staff(request) or {}
    if staff.get("role") == "ASHA":
        if kind not in rp.ASHA_UPLOAD_KINDS:
            raise HTTPException(status_code=403, detail="ASHA workers can attach screening reports and referral slips only.")
        if not photo_consent:
            raise HTTPException(status_code=422, detail="Record her consent before attaching her documents.")
    data = await file.read(rp.MAX_UPLOAD_BYTES + 1)
    return _run(rp.add_file, referral_id, kind, file.filename or "file", data, photo_consent, _actor(request))


@router.get("/{referral_id}/files/{file_id}")
async def download(referral_id: str, file_id: str, request: Request, inline: bool = False):
    if (_staff(request) or {}).get("role") == "ASHA" and not any(f.get("file_id") == file_id and f.get("kind") in rp.ASHA_UPLOAD_KINDS for f in rp.list_files(referral_id)):
        raise HTTPException(status_code=403, detail="This file is for the clinical team only.")
    _own(request, referral_id)
    data, content_type, name = _run(rp.read_file, referral_id, file_id)
    return Response(data, media_type=content_type, headers={
        "Content-Disposition": f'{"inline" if inline and content_type.startswith("image/") else "attachment"}; filename="{name}"', "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


class ConfirmIn(BaseModel):
    values: Dict[str, str] = Field(default_factory=dict)


@router.post("/{referral_id}/files/{file_id}/read")
async def read_document(referral_id: str, file_id: str, request: Request):
    """OCR an attached file and propose findings for review. Nothing reaches the record here."""
    from backend.tools import document_reading
    _own(request, referral_id)
    return _run(document_reading.read, referral_id, file_id, _actor(request))


@router.get("/{referral_id}/files/{file_id}/reading")
async def get_reading(referral_id: str, file_id: str, request: Request):
    from backend.tools import document_reading
    _own(request, referral_id)
    return {"reading": document_reading.get(referral_id, file_id)}


@router.post("/{referral_id}/files/{file_id}/confirm")
async def confirm_reading(referral_id: str, file_id: str, req: ConfirmIn, request: Request):
    from backend.tools import document_reading
    _own(request, referral_id)
    return _run(document_reading.confirm, referral_id, file_id, req.values, _actor(request))


@router.post("/{referral_id}/files/{file_id}/reject")
async def reject_reading(referral_id: str, file_id: str, request: Request):
    from backend.tools import document_reading
    _own(request, referral_id)
    return {"reading": _run(document_reading.reject, referral_id, file_id, _actor(request))}


@router.delete("/{referral_id}/files/{file_id}")
async def remove_file(referral_id: str, file_id: str, request: Request):
    _own(request, referral_id)
    return _run(rp.delete_file, referral_id, file_id, _actor(request))


@router.post("/{referral_id}/files/sample", status_code=201)
async def upload_sample_file(referral_id: str, kind: str = "HISTOPATHOLOGY_REPORT", request: Request = None):
    """Attach a verified sample report (Histopathology or Pap Smear) and read it immediately."""
    from backend.tools import document_reading
    if kind not in ("HISTOPATHOLOGY_REPORT", "PAP_REPORT"):
        raise HTTPException(status_code=422, detail="Sample report must be HISTOPATHOLOGY_REPORT or PAP_REPORT.")
    _own(request, referral_id)
    return _run(document_reading.create_sample_report, referral_id, kind, _actor(request))


@router.post("/scan-intake")
async def scan_intake(request: Request, file: UploadFile = File(...)):
    """Read a screening slip to pre-fill registration. Nothing is stored; staff check every value."""
    from backend.tools import document_reading
    data = await file.read(rp.MAX_UPLOAD_BYTES + 1)
    if len(data) > rp.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 10 MB.")
    return _run(document_reading.scan_intake, data, _actor(request))
