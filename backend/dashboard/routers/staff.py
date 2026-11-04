"""Staff sign-in API: staff ID + PIN, one-click demo sign-in per role, session check and logout."""
from typing import Optional

from fastapi import APIRouter, Cookie, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.core import staff_session as ss
from backend.core.security import global_audit

router = APIRouter(prefix="/api/staff", tags=["Staff Sign-in (role-based)"])

SessionCookie = Cookie(default=None, alias=ss.COOKIE_NAME)


class StaffLoginRequest(BaseModel):
    staff_id: str
    pin: str


class DemoLoginRequest(BaseModel):
    role: str


def _signed_in(request: Request, staff_id: str, method: str) -> JSONResponse:
    profile = ss.public_profile(staff_id)
    global_audit.record_user_event(
        user_role=profile["role"], action="STAFF_SIGN_IN", actor_id=staff_id, patient_token="N/A",
        details={"method": method}, channel="WEB_CAREUI",
    )
    resp = JSONResponse({"authenticated": True, "staff": profile, "demo": method == "DEMO_BUTTON"})
    ss.set_session_cookie(resp, request, staff_id)
    return resp


@router.post("/login")
async def login(body: StaffLoginRequest, request: Request):
    try:
        staff_id = ss.check_credentials(body.staff_id, body.pin)
    except ss.LoginError as e:
        return JSONResponse({"detail": {"code": e.code, "message": e.message}}, status_code=e.status)
    return _signed_in(request, staff_id, "STAFF_ID_PIN")


@router.post("/demo-login")
async def demo_login(body: DemoLoginRequest, request: Request):
    if not ss.demo_signin_allowed():
        return JSONResponse({"detail": {"code": "DEMO_DISABLED", "message": "Demo sign-in is turned off."}},
                            status_code=403)
    staff_id = ss.DEMO_ACCOUNT_FOR_ROLE.get((body.role or "").upper())
    if not staff_id:
        return JSONResponse({"detail": {"code": "UNKNOWN_ROLE", "message": "Unknown staff role."}}, status_code=400)
    return _signed_in(request, staff_id, "DEMO_BUTTON")


@router.get("/session")
async def current_session(cookie: Optional[str] = SessionCookie):
    profile = ss.verify_session(cookie)
    return {"authenticated": bool(profile), "staff": profile,
            "auth_enforced": ss.auth_enforced(), "demo_signin": ss.demo_signin_allowed()}


@router.post("/logout")
async def logout(cookie: Optional[str] = SessionCookie):
    profile = ss.verify_session(cookie)
    ss.revoke_session(cookie)
    if profile:
        global_audit.record_user_event(
            user_role=profile["role"], action="STAFF_SIGN_OUT", actor_id=profile["staff_id"],
            patient_token="N/A", details={}, channel="WEB_CAREUI",
        )
    resp = JSONResponse({"logged_out": True})
    resp.delete_cookie(ss.COOKIE_NAME, path="/api")
    return resp
