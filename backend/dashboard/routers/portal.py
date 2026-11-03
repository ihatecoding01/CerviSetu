"""Patient-portal API: every patient-data route requires a patient session bound to the requested token.

Separate from /api/patient/* (used by the staff workspace), so staff workflows are unchanged and patient
authentication is not weakened to fit staff components. Responses carry no Aadhaar, mobile number or
staff-only notes.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import JSONResponse

from backend.core import patient_session
from backend.core.database import global_db
from backend.tools import treatment_clock as tc
from backend.tools.abdm_registration import patient_profile
from backend.tools.clock_service import get_patient_clock

router = APIRouter(prefix="/api/portal", tags=["Patient Portal (session-scoped)"])

SessionCookie = Cookie(default=None, alias=patient_session.COOKIE_NAME)

# Timeline events a patient sees; everything comes from persisted plan/session/exception records
HISTORY_EVENTS = {
    tc.PATIENT_COMPLETED: "COMPLETED",
    tc.RESCHEDULED: "COMPLETED",
    tc.PATIENT_MISSED: "MISSED",
    tc.CLINICIAN_APPROVED_PAUSE: "APPROVED_PAUSE",
    tc.FACILITY_DOWNTIME: "FACILITY_DOWNTIME",
    tc.PLANNED_REST: "PLANNED_REST",
}


def _require(token: str, cookie: Optional[str]) -> str:
    bound = patient_session.verify_session(cookie)
    if not bound:
        raise HTTPException(status_code=401, detail={"code": "SESSION_REQUIRED", "message": "Please log in again."})
    if bound != token:
        raise HTTPException(status_code=403, detail={"code": "WRONG_PATIENT", "message": "This record is not yours."})
    return bound


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
    plan = global_db.get_treatment_plan(token)
    base = {
        "patient_token": token,
        "display_name": profile["display_name"],
        "synthetic_patient": profile["synthetic_patient"],
        "abha_sandbox_id_masked": profile["abha_number_masked"],
        "abha_sandbox_address": profile["abha_address"],
        "stage": profile["stage"],
        "has_plan": bool(plan),
    }
    if not plan:
        return {**base, "clock": None}
    c = get_patient_clock(token)
    return {
        **base,
        "facility_name": plan["facility_name"],
        "plan_status": plan["status"],
        "clock": {
            "state": c["clock_state"],
            "status": c["clock_status"],
            "start_date": c["start_date"],
            "as_of_date": c["as_of_date"],
            "treatment_day_today": c["treatment_day_today"],
            "completed_sessions": c["completed_sessions"],
            "total_sessions": c["total_sessions"],
            "external_completed": c["ebrt_completed"],
            "external_planned": c["ebrt_sessions_planned"],
            "internal_completed": c["brachy_completed"],
            "internal_planned": c["brachy_sessions_planned"],
            "missed_sessions": c["missed_sessions"],
            "consecutive_missed_sessions": c["consecutive_missed_sessions"],
            "next_session": (c["upcoming_sessions"] or [None])[0],
            "expected_completion_date": c["projected_finish_date"],
            "expected_completion_day": c["projected_finish_day"],
            "target_days": c["target_days"],
            "limit_days": c["limit_days"],
            # Highest support step reached in the current missed streak; dispatch is simulated in this demo
            "support_tier": c["current_escalation_tier"],
        },
    }


@router.get("/{token}/sessions")
async def session_history(token: str, cookie: Optional[str] = SessionCookie) -> Dict[str, Any]:
    _require(token, cookie)
    plan = global_db.get_treatment_plan(token)
    if not plan:
        return {"patient_token": token, "has_plan": False, "events": [], "upcoming": []}
    c = get_patient_clock(token)
    synthetic = global_db.is_synthetic_patient(token)
    events: List[Dict[str, Any]] = []
    for e in c.get("timeline", []):
        kind = HISTORY_EVENTS.get(e.get("event"))
        if kind:
            events.append({"date": e["date"], "type": kind, "session_number": e.get("session_number"),
                           "phase": e.get("phase"), "synthetic": synthetic})
    upcoming = [{"date": u["date"], "session_number": u["session_number"], "phase": u["phase"]}
                for u in c.get("upcoming_sessions", [])[:5]]
    return {"patient_token": token, "has_plan": True, "synthetic": synthetic,
            "events": sorted(events, key=lambda x: x["date"], reverse=True), "upcoming": upcoming}
