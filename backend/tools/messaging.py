"""Sends patient reminders and records what truly happened to each one.

Modes (CERVISETU_MESSAGING_MODE):
  simulated (default): nothing leaves the server; every attempt is logged as SIMULATED.
  twilio: real SMS, WhatsApp and voice calls, but only to numbers in CERVISETU_MESSAGING_ALLOWED_NUMBERS.
A real patient rollout also needs consent records and approved templates, so the allow-list is never bypassed.
"""
import hashlib
import hmac
import base64
import logging
import os
import secrets
from datetime import date
from typing import Any, Dict, List, Optional
from xml.sax.saxutils import escape

import httpx

from backend.core.database import global_db
from backend.core.security import global_vault

logger = logging.getLogger(__name__)

CHANNELS = ("SMS", "WHATSAPP", "VOICE")
SIMULATED, SENT, FAILED, BLOCKED, NO_NUMBER, DUPLICATE = "SIMULATED", "SENT", "FAILED", "BLOCKED_NOT_ALLOWED", "NO_PHONE_NUMBER", "ALREADY_SENT"


def _init():
    with global_db._get_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS message_log (
            message_id TEXT PRIMARY KEY, patient_token TEXT, channel TEXT NOT NULL, tier TEXT, body TEXT NOT NULL,
            phone_last4 TEXT, status TEXT NOT NULL, provider TEXT, provider_id TEXT, error TEXT, dedupe_key TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        conn.commit()


_init()


def mode() -> str:
    return "twilio" if os.getenv("CERVISETU_MESSAGING_MODE", "simulated").lower() == "twilio" else "simulated"


def normalise(phone: Optional[str]) -> Optional[str]:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    return f"+{digits}" if 11 <= len(digits) <= 15 else None


def allowed_numbers() -> set:
    return {n for n in (normalise(x) for x in os.getenv("CERVISETU_MESSAGING_ALLOWED_NUMBERS", "").split(",")) if n}


def configured() -> bool:
    return all(os.getenv(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"))


def status_summary() -> Dict[str, Any]:
    return {"mode": mode(), "provider_configured": configured(), "approved_numbers": len(allowed_numbers())}


def _twilio_send(channel: str, to: str, body: str, language: str, transport=None) -> str:
    sid, auth = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    sender = os.environ["TWILIO_FROM_NUMBER"]
    base = f"https://api.twilio.com/2010-04-01/Accounts/{sid}"
    extra = {}
    callback = os.getenv("CERVISETU_PUBLIC_BASE_URL", "").rstrip("/")
    if callback:
        extra["StatusCallback"] = f"{callback}/api/messages/provider-status"
    if channel == "VOICE":
        path, data = "/Calls.json", {"To": to, "From": sender,
                                     "Twiml": f'<Response><Say language="{language}">{escape(body)}</Say></Response>'}
    elif channel == "WHATSAPP":
        wa_from = os.getenv("TWILIO_WHATSAPP_FROM") or sender
        path, data = "/Messages.json", {"To": f"whatsapp:{to}", "From": f"whatsapp:{wa_from}", "Body": body}
    else:
        path, data = "/Messages.json", {"To": to, "From": sender, "Body": body}
    with httpx.Client(auth=(sid, auth), timeout=20.0, transport=transport) as client:
        res = client.post(base + path, data={**data, **extra})
        res.raise_for_status()
        return res.json().get("sid", "")


def send(channel: str, body: str, phone: Optional[str] = None, patient_token: Optional[str] = None,
         tier: Optional[str] = None, live: bool = False, language: str = "hi-IN", dedupe: Optional[str] = None,
         transport=None) -> Dict[str, Any]:
    """Send or simulate one message, and log the true outcome. `live=False` can never reach a real person."""
    to = normalise(phone)
    status, provider, provider_id, error = SIMULATED, None, None, None
    if live and mode() == "twilio":
        provider = "twilio"
        if not to:
            status = NO_NUMBER
        elif to not in allowed_numbers():
            status = BLOCKED
        elif not configured():
            status, error = FAILED, "PROVIDER_NOT_CONFIGURED"
        else:
            try:
                provider_id, status = _twilio_send(channel, to, body, language, transport), SENT
            except httpx.HTTPStatusError as e:
                status, error = FAILED, f"HTTP_{e.response.status_code}"
            except httpx.HTTPError:
                status, error = FAILED, "NETWORK"
            logger.info("Message %s via %s: %s", channel, provider, status)
    record = {"message_id": secrets.token_urlsafe(10), "patient_token": patient_token, "channel": channel, "tier": tier,
              "body": body, "phone_last4": to[-4:] if to else None, "status": status, "provider": provider,
              "provider_id": provider_id, "error": error}
    with global_db._get_conn() as conn:
        if dedupe and conn.execute("SELECT 1 FROM message_log WHERE dedupe_key = ?", (dedupe,)).fetchone():
            return {**record, "status": DUPLICATE}
        conn.execute("""INSERT INTO message_log (message_id, patient_token, channel, tier, body, phone_last4, status, provider,
                        provider_id, error, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (record["message_id"], patient_token, channel, tier, body, record["phone_last4"], status, provider,
                      provider_id, error, dedupe))
        conn.commit()
    return record


def patient_phone(token: str) -> Optional[str]:
    try:
        pii = global_vault.retrieve_pii(token)
    except Exception:
        return None
    return pii.get("phone") or pii.get("mobile")


def send_to_patient(channel: str, body: str, token: str, tier: str, live: bool) -> Dict[str, Any]:
    """One reminder per patient, tier and day, however often the escalation cycle runs."""
    dedupe = f"{token}:{tier}:{channel}:{date.today().isoformat()}" if live else None
    return send(channel, body, patient_phone(token) if live else None, token, tier, live, dedupe=dedupe)


def update_status(provider_id: str, status: str, error: Optional[str] = None) -> bool:
    with global_db._get_conn() as conn:
        changed = conn.execute("UPDATE message_log SET status = ?, error = COALESCE(?, error), updated_at = CURRENT_TIMESTAMP WHERE provider_id = ?",
                               (status.upper(), error, provider_id)).rowcount
        conn.commit()
    return bool(changed)


def valid_twilio_signature(url: str, params: Dict[str, str], signature: str) -> bool:
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not token or not signature:
        return False
    payload = url + "".join(k + params[k] for k in sorted(params))
    expected = base64.b64encode(hmac.new(token.encode(), payload.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(expected, signature)


def recent(limit: int = 50) -> List[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT message_id, patient_token, channel, tier, body, phone_last4, status, provider, error, created_at, updated_at FROM message_log ORDER BY created_at DESC, rowid DESC LIMIT ?",
                            (limit,)).fetchall()
    return [dict(r) for r in rows]
