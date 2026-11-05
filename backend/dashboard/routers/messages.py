"""Message log, a test send for approved numbers, and delivery updates from the provider."""
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.tools import messaging

router = APIRouter(prefix="/api/messages", tags=["Patient Messaging"])


class TestMessage(BaseModel):
    channel: str
    phone: str = Field(..., max_length=20)
    body: str = Field("This is a test message from CerviSetu.", max_length=500)


@router.get("")
async def message_log(limit: int = 50):
    return {**messaging.status_summary(), "messages": messaging.recent(min(max(limit, 1), 200))}


@router.post("/test")
async def send_test(req: TestMessage):
    if req.channel not in messaging.CHANNELS:
        raise HTTPException(status_code=422, detail="Choose SMS, WHATSAPP or VOICE")
    return messaging.send(req.channel, req.body, req.phone, tier="STAFF_TEST", live=True, language=os.getenv("CERVISETU_TEST_VOICE_LANGUAGE", "en-IN"))


@router.post("/provider-status")
async def provider_status(request: Request):
    params = {k: str(v) for k, v in (await request.form()).items()}
    base = os.getenv("CERVISETU_PUBLIC_BASE_URL", "").rstrip("/")
    if not messaging.valid_twilio_signature(f"{base}/api/messages/provider-status", params, request.headers.get("X-Twilio-Signature", "")):
        raise HTTPException(status_code=403, detail="Invalid signature")
    sid = params.get("MessageSid") or params.get("CallSid") or ""
    status = params.get("MessageStatus") or params.get("CallStatus") or ""
    if sid and status:
        messaging.update_status(sid, status, params.get("ErrorCode"))
    return {"ok": True}
