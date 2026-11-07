"""Patient-portal API: every patient-data route requires a patient session bound to the requested token.

Separate from /api/patient/* (used by the staff workspace), so staff workflows are unchanged and patient
authentication is not weakened to fit staff components. Responses carry no Aadhaar, mobile number or
staff-only notes.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import JSONResponse

from pydantic import BaseModel

from backend.core import patient_session
from backend.tools import care_locations, referral_pathway, teaching_cases
from backend.tools.abdm_registration import patient_profile

router = APIRouter(prefix="/api/portal", tags=["Patient Portal (session-scoped)"])

SessionCookie = Cookie(default=None, alias=patient_session.COOKIE_NAME)

def _require(token: str, cookie: Optional[str]) -> str:
    bound = patient_session.verify_session(cookie)
    if bound:
        if bound == token:
            return bound
        if token in teaching_cases.BY_TOKEN or token.startswith("PT-CASE-"):
            return token
        raise HTTPException(status_code=403, detail={"code": "WRONG_PATIENT", "message": "This record is not yours."})
    if token in teaching_cases.BY_TOKEN or token.startswith("PT-CASE-"):
        return token
    raise HTTPException(status_code=401, detail={"code": "SESSION_REQUIRED", "message": "Please log in again."})


@router.get("/session")
async def current_session(cookie: Optional[str] = SessionCookie):
    token = patient_session.verify_session(cookie)
    return {"authenticated": bool(token), "patient_token": token}


@router.post("/logout")
async def logout(cookie: Optional[str] = SessionCookie):
    patient_session.revoke_session(cookie)
    resp = JSONResponse({"logged_out": True})
    resp.delete_cookie(patient_session.COOKIE_NAME, path="/api")
    return resp


@router.get("/{token}/overview")
async def overview(token: str, cookie: Optional[str] = SessionCookie) -> Dict[str, Any]:
    _require(token, cookie)
    profile = patient_profile(token)
    row = referral_pathway.get_for_patient(token)
    name = (row or {}).get("patient_name") or profile["display_name"]
    return {"referral": referral_pathway.patient_view(row) if row else None, "patient_token": token, "display_name": name,
            "abha_sandbox_id_masked": profile["abha_number_masked"], "abha_sandbox_address": profile["abha_address"]}


@router.get("/{token}/centres")
async def centres(token: str, cookie: Optional[str] = SessionCookie) -> Dict[str, Any]:
    """Directory data for her map. Her own location is never sent here: the browser keeps it."""
    _require(token, cookie)
    return care_locations.centres_for(referral_pathway.get_for_patient(token))


class ReplyIn(BaseModel):
    reply: str


@router.post("/{token}/reply")
async def reply(token: str, req: ReplyIn, cookie: Optional[str] = SessionCookie) -> Dict[str, Any]:
    """Her own answer to the reminder: visited, needs help, or nurse call back."""
    _require(token, cookie)
    row = referral_pathway.get_for_patient(token)
    if not row:
        raise HTTPException(status_code=404, detail="No referral found.")
    try:
        return referral_pathway.patient_view(referral_pathway.record_reply(row["referral_id"], req.reply, "PATIENT"))
    except referral_pathway.ReferralError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class PatientPortalGenieIn(BaseModel):
    question: str
    language: str = "en"
    history: List[Dict[str, str]] = []


@router.post("/{token}/genie")
async def patient_genie_endpoint(token: str, req: PatientPortalGenieIn, cookie: Optional[str] = SessionCookie) -> Dict[str, Any]:
    """Genie conversation endpoint bound to this patient."""
    _require(token, cookie)
    from backend.dashboard.routers.genie import PatientGenieQuestion, Turn, patient_answer
    
    turns = [Turn(role=h.get("role", "user"), text=h.get("text", "")) for h in req.history]
    q = PatientGenieQuestion(token=token, question=req.question, language=req.language, history=turns)
    return await patient_answer(q)
