"""Role-based staff sign-in and signed staff sessions (demo-grade, see limits below).

Staff sign in with a staff ID and PIN, or with the one-click demo sign-in for a role. A session is a
signed, HttpOnly cookie `<payload>.<signature>` (HMAC-SHA256 under a key derived from VAULT_SECRET_KEY)
holding the staff ID, role, a random session id and the expiry. Server-side we keep only SHA-256 of
the session id, so logout revokes a session and a leaked database does not yield usable cookies.

Roles and what they may do are defined in ROLE_RULES; `required_roles()` maps an API request to the
roles allowed to make it, and the app middleware enforces it.

Limits: the staff directory is a fixed demo roster with PINs (hashed at rest), there is no per-IP rate
limiting beyond the per-account lockout, and demo sign-in is refused when CERVISETU_ENV=production.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Dict, Optional, Tuple

from backend.config import APP_ENV, VAULT_SECRET_KEY
from backend.core.database import global_db

COOKIE_NAME = "cervisetu_staff_session"
SESSION_TTL_SECONDS = int(os.getenv("CERVISETU_STAFF_SESSION_MINUTES", "30")) * 60
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 5 * 60
_KEY = hmac.new(VAULT_SECRET_KEY.encode(), b"cervisetu-staff-session-v1", hashlib.sha256).digest()
_PIN_KEY = hmac.new(VAULT_SECRET_KEY.encode(), b"cervisetu-staff-pin-v1", hashlib.sha256).digest()

DOCTOR, NURSE, ASHA, ADMIN = "DOCTOR", "NURSE", "ASHA", "ADMIN"
ROLE_LABELS = {DOCTOR: "Doctor", NURSE: "Nurse", ASHA: "ASHA Worker", ADMIN: "Administrator"}

# Demo staff roster. PINs come from CERVISETU_STAFF_DEMO_PIN (see .env.example) and are kept only as
# keyed hashes in memory; the demo sign-in button does not need a PIN.
_DEMO_PIN = os.getenv("CERVISETU_STAFF_DEMO_PIN", "246810")
STAFF_DIRECTORY: Dict[str, Dict[str, str]] = {
    "DR-1001": {"name": "Dr. A. Sharma", "role": DOCTOR, "facility": "Mirzapur District Spoke"},
    "RN-2001": {"name": "Sister Sunita Patel", "role": NURSE, "facility": "Mirzapur District Spoke"},
    "AW-3001": {"name": "Meena Devi", "role": ASHA, "facility": "Vindhyachal Rural Ward 2"},
    "AD-4001": {"name": "District Programme Officer", "role": ADMIN, "facility": "Mirzapur District Health Society"},
}
DEMO_ACCOUNT_FOR_ROLE = {DOCTOR: "DR-1001", NURSE: "RN-2001", ASHA: "AW-3001", ADMIN: "AD-4001"}


def _pin_hash(staff_id: str, pin: str) -> str:
    return hmac.new(_PIN_KEY, f"{staff_id}:{pin}".encode(), hashlib.sha256).hexdigest()


_PIN_HASHES = {sid: _pin_hash(sid, _DEMO_PIN) for sid in STAFF_DIRECTORY}

# (method or "*", path regex, allowed roles). First match wins; unmatched /api paths stay public.
ALL_STAFF = (DOCTOR, NURSE, ASHA, ADMIN)
CLINICAL = (DOCTOR, NURSE, ADMIN)
ROLE_RULES = [
    # Doctor decisions
    ("POST", r"^/api/clinical/chemo-clearance$", (DOCTOR, ADMIN)),
    ("POST", r"^/api/clinical/discharge-signoff$", (DOCTOR, ADMIN)),
    ("POST", r"^/api/encounter/[^/]+/discharge-signoff$", (DOCTOR, ADMIN)),
    ("POST", r"^/api/clinical/hub-deficiency$", (DOCTOR, ADMIN)),
    ("POST", r"^/api/clinical/hub-transfer/[^/]+/deficiency-return$", (DOCTOR, ADMIN)),
    ("POST", r"^/api/logs/doctor/", (DOCTOR, ADMIN)),
    ("POST", r"^/api/patient/[^/]+/treatment-plan(/pause)?$", (DOCTOR, ADMIN)),
    ("GET", r"^/api/vault/inspect/", (DOCTOR, ADMIN)),
    ("GET", r"^/api/fhir/patient/", (DOCTOR, ADMIN)),
    # Nurse and clinical floor actions
    ("POST", r"^/api/logs/nurse/", (DOCTOR, NURSE, ADMIN)),
    ("POST", r"^/api/patient/[^/]+/clock/no-show$", CLINICAL),
    ("POST", r"^/api/clinical/(linac-downtime|downtime-toggle|facility-downtime)$", CLINICAL),
    ("POST", r"^/api/run-case$", CLINICAL),
    ("GET", r"^/api/clinical/chemo-clearance/", CLINICAL),
    ("POST", r"^/api/documents/", CLINICAL),
    ("*", r"^/api/encounter/[^/]+/(voice-consult|consult-audio)", CLINICAL),
    ("*", r"^/api/patient/[^/]+/(purge-audio-cache|audio-cache)$", CLINICAL),
    # ASHA field work
    ("*", r"^/api/logs/asha/", (ASHA, DOCTOR, NURSE, ADMIN)),
    # Shared staff views
    ("GET", r"^/api/(cases|ward-board|audit-logs)$", ALL_STAFF),
    ("GET", r"^/api/logs/(events|summary|verify-chain)$", ALL_STAFF),
    ("*", r"^/api/prevention/", CLINICAL),
    ("POST", r"^/api/(escalation/run-cycle|simulate-escalation)$", CLINICAL),
]
_COMPILED = [(m, re.compile(p), roles) for m, p, roles in ROLE_RULES]


def required_roles(method: str, path: str) -> Optional[Tuple[str, ...]]:
    """Roles allowed to call this endpoint, or None if it needs no staff session."""
    for m, pattern, roles in _COMPILED:
        if (m == "*" or m == method.upper()) and pattern.search(path):
            return roles
    return None


def auth_enforced() -> bool:
    return os.getenv("CERVISETU_STAFF_AUTH", "1") != "0"


def demo_signin_allowed() -> bool:
    return APP_ENV != "production" and os.getenv("CERVISETU_STAFF_DEMO_SIGNIN", "1") != "0"


def _init_tables():
    with global_db._get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_sessions (
                sid_hash TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                role TEXT NOT NULL,
                expires_at REAL NOT NULL,
                revoked INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_login_attempts (
                staff_id TEXT PRIMARY KEY,
                failed INTEGER DEFAULT 0,
                locked_until REAL DEFAULT 0
            )
        """)
        conn.commit()


_init_tables()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(_KEY, payload.encode(), hashlib.sha256).digest())


def public_profile(staff_id: str) -> Dict[str, str]:
    entry = STAFF_DIRECTORY[staff_id]
    return {"staff_id": staff_id, "name": entry["name"], "role": entry["role"],
            "role_label": ROLE_LABELS[entry["role"]], "facility": entry["facility"]}


class LoginError(Exception):
    def __init__(self, code: str, message: str, status: int = 401):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def check_credentials(staff_id: str, pin: str) -> str:
    """Normalized staff ID if the PIN is right; raises LoginError (with lockout after repeated failures)."""
    sid = (staff_id or "").strip().upper()
    now = time.time()
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT failed, locked_until FROM staff_login_attempts WHERE staff_id = ?",
                           (sid,)).fetchone()
        if row and row["locked_until"] > now:
            raise LoginError("LOCKED", "Too many wrong attempts. Please wait a few minutes and try again.", 429)
        ok = sid in STAFF_DIRECTORY and hmac.compare_digest(_PIN_HASHES[sid], _pin_hash(sid, pin or ""))
        if ok:
            conn.execute("DELETE FROM staff_login_attempts WHERE staff_id = ?", (sid,))
            conn.commit()
            return sid
        failed = (row["failed"] if row else 0) + 1
        locked_until = now + LOCKOUT_SECONDS if failed >= MAX_FAILED_ATTEMPTS else 0
        conn.execute("""INSERT INTO staff_login_attempts (staff_id, failed, locked_until) VALUES (?, ?, ?)
                        ON CONFLICT(staff_id) DO UPDATE SET failed = excluded.failed,
                        locked_until = excluded.locked_until""",
                     (sid, 0 if locked_until else failed, locked_until))
        conn.commit()
    raise LoginError("INVALID_CREDENTIALS", "Staff ID or PIN is not correct.")


def issue_session(staff_id: str) -> str:
    role = STAFF_DIRECTORY[staff_id]["role"]
    sid = secrets.token_urlsafe(24)
    expires = time.time() + SESSION_TTL_SECONDS
    with global_db._get_conn() as conn:
        conn.execute("INSERT INTO staff_sessions (sid_hash, staff_id, role, expires_at) VALUES (?, ?, ?, ?)",
                     (hashlib.sha256(sid.encode()).hexdigest(), staff_id, role, expires))
        conn.commit()
    payload = _b64(json.dumps({"s": staff_id, "r": role, "sid": sid, "exp": int(expires)}).encode())
    return f"{payload}.{_sign(payload)}"


def verify_session(cookie: Optional[str]) -> Optional[Dict[str, str]]:
    """Staff profile bound to a valid cookie, else None (missing, tampered, expired or revoked)."""
    if not cookie or "." not in cookie:
        return None
    payload, signature = cookie.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        data = json.loads(_unb64(payload))
        staff_id, role, sid, exp = data["s"], data["r"], data["sid"], float(data["exp"])
    except (ValueError, KeyError, TypeError):
        return None
    if time.time() > exp or staff_id not in STAFF_DIRECTORY:
        return None
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT staff_id, role, expires_at, revoked FROM staff_sessions WHERE sid_hash = ?",
                           (hashlib.sha256(sid.encode()).hexdigest(),)).fetchone()
    if (not row or row["revoked"] or row["staff_id"] != staff_id or row["role"] != role
            or time.time() > row["expires_at"]):
        return None
    return public_profile(staff_id)


def revoke_session(cookie: Optional[str]) -> None:
    if not cookie or "." not in cookie:
        return
    try:
        sid = json.loads(_unb64(cookie.rsplit(".", 1)[0]))["sid"]
    except (ValueError, KeyError, TypeError):
        return
    with global_db._get_conn() as conn:
        conn.execute("UPDATE staff_sessions SET revoked = 1 WHERE sid_hash = ?",
                     (hashlib.sha256(sid.encode()).hexdigest(),))
        conn.commit()


def set_session_cookie(response, request, staff_id: str) -> None:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(COOKIE_NAME, issue_session(staff_id), max_age=SESSION_TTL_SECONDS,
                        httponly=True, samesite="strict", secure=secure, path="/api")
