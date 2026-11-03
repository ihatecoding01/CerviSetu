"""ABDM / ABHA registration endpoints (consent + OTP, sandbox-simulated until NHA credentials exist)."""
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.core import patient_session
from backend.tools import abdm_registration as abdm

router = APIRouter(prefix="/api/abdm", tags=["ABDM / ABHA Registration"])


class OtpRequest(BaseModel):
    mode: str = Field(..., description="GENERATE (Aadhaar/VID) or LINK (existing ABHA number/address)")
    identifier: str
    beneficiary_name: str
    consents: Dict[str, bool]
    mobile: Optional[str] = None
    method: str = "OTP"
    link_token: Optional[str] = None
    requested_by: str = "CARE_ADMIN"


class ResendRequest(BaseModel):
    txn_id: str


class MobileLoginRequest(BaseModel):
    mobile: str


class VerifyRequest(BaseModel):
    txn_id: str
    otp: str


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except abdm.RegistrationError as e:
        raise HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


@router.get("/consents")
async def consent_items():
    return {"consents": abdm.CONSENT_ITEMS, "unsupported_methods": abdm.UNSUPPORTED_METHODS, "mode": abdm.ABDM_MODE}


@router.post("/otp/request")
async def request_otp(req: OtpRequest):
    return _call(abdm.request_otp, **req.model_dump())


@router.post("/otp/resend")
async def resend_otp(req: ResendRequest):
    return _call(abdm.resend_otp, req.txn_id)


@router.post("/otp/verify")
async def verify_otp(req: VerifyRequest, request: Request):
    """On success also sets the HttpOnly patient-session cookie bound to the verified patient token."""
    result = _call(abdm.verify_otp, req.txn_id, req.otp)
    resp = JSONResponse(result)
    patient_session.set_session_cookie(resp, request, result["patient_token"])
    return resp


@router.post("/login/mobile/request")
async def request_mobile_login(req: MobileLoginRequest):
    """Demo patient login by mobile OTP (sandbox OTP; not production authentication)."""
    return _call(abdm.request_mobile_login, req.mobile)


@router.get("/profile/{token}")
async def patient_profile(token: str):
    return abdm.patient_profile(token)
