"""Short-lived signed patient sessions for the patient portal (demo-grade, see limits below).

A session is issued only after a successful sandbox OTP verification (mobile login or ABHA) and is
bound to exactly one patient token. The cookie value is `<payload>.<signature>`: the payload holds
the token, a random session id and the expiry; the signature is HMAC-SHA256 under a key derived from
VAULT_SECRET_KEY. Server-side we keep only SHA-256(session id), so logout revokes a session and a
leaked database does not yield usable cookies.

Limits (not production-grade without a full threat model): OTPs are sandbox codes shown on screen,
there is no device binding or rate limiting per IP, and the signing key is the vault key derivative.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from backend.config import VAULT_SECRET_KEY
from backend.core.database import global_db

COOKIE_NAME = "cervisetu_patient_session"
SESSION_TTL_SECONDS = int(os.getenv("CERVISETU_PATIENT_SESSION_MINUTES", "30")) * 60
_KEY = hmac.new(VAULT_SECRET_KEY.encode(), b"cervisetu-patient-session-v1", hashlib.sha256).digest()


def _init_table():
    with global_db._get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_sessions (
                sid_hash TEXT PRIMARY KEY,
                patient_token TEXT NOT NULL,
                expires_at REAL NOT NULL,
                revoked INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


_init_table()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(_KEY, payload.encode(), hashlib.sha256).digest())


def issue_session(patient_token: str) -> str:
    sid = secrets.token_urlsafe(24)
    expires = time.time() + SESSION_TTL_SECONDS
    with global_db._get_conn() as conn:
        conn.execute("INSERT INTO patient_sessions (sid_hash, patient_token, expires_at) VALUES (?, ?, ?)",
                     (hashlib.sha256(sid.encode()).hexdigest(), patient_token, expires))
        conn.commit()
    payload = _b64(json.dumps({"t": patient_token, "sid": sid, "exp": int(expires)}).encode())
    return f"{payload}.{_sign(payload)}"


def verify_session(cookie: Optional[str]) -> Optional[str]:
    """Patient token bound to a valid cookie, else None (missing, tampered, expired or revoked)."""
    if not cookie or "." not in cookie:
        return None
    payload, signature = cookie.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        data = json.loads(_unb64(payload))
        token, sid, exp = data["t"], data["sid"], float(data["exp"])
    except (ValueError, KeyError, TypeError):
        return None
    if time.time() > exp:
        return None
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT patient_token, expires_at, revoked FROM patient_sessions WHERE sid_hash = ?",
                           (hashlib.sha256(sid.encode()).hexdigest(),)).fetchone()
    if not row or row["revoked"] or row["patient_token"] != token or time.time() > row["expires_at"]:
        return None
    return token


def revoke_session(cookie: Optional[str]) -> None:
    if not cookie or "." not in cookie:
        return
    try:
        sid = json.loads(_unb64(cookie.rsplit(".", 1)[0]))["sid"]
    except (ValueError, KeyError, TypeError):
        return
    with global_db._get_conn() as conn:
        conn.execute("UPDATE patient_sessions SET revoked = 1 WHERE sid_hash = ?",
                     (hashlib.sha256(sid.encode()).hexdigest(),))
        conn.commit()


def set_session_cookie(response, request, patient_token: str) -> None:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    samesite = "none" if secure else "lax"
    response.set_cookie(COOKIE_NAME, issue_session(patient_token), max_age=SESSION_TTL_SECONDS,
                        httponly=True, samesite=samesite, secure=secure, path="/")
