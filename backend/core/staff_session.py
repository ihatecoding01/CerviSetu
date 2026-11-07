"""Role-based staff sign-in and signed staff sessions (demo-grade, see limits below).

Staff sign in with a staff ID and PIN, or with the one-click demo sign-in for a role. A session is a
signed, HttpOnly cookie `<payload>.<signature>` (HMAC-SHA256 under a key derived from VAULT_SECRET_KEY)
holding the staff ID, role, a random session id and the expiry. Server-side we keep only SHA-256 of
the session id, so logout revokes a session and a leaked database does not yield usable cookies.

Roles and what they may do are defined in ROLE_RULES; `required_roles()` maps an API request to the
roles allowed to make it, and the app middleware enforces it.

Limits: the staff directory starts from a test roster with PINs (hashed at rest), there is no per-IP rate
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
SESSION_TTL_SECONDS = int(os.getenv("CERVISETU_STAFF_SESSION_MINUTES", "720")) * 60  # Idle limit: use renews it
RENEW_AFTER_SECONDS = 5 * 60
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 5 * 60
_KEY = hmac.new(VAULT_SECRET_KEY.encode(), b"cervisetu-staff-session-v1", hashlib.sha256).digest()
_PIN_KEY = hmac.new(VAULT_SECRET_KEY.encode(), b"cervisetu-staff-pin-v1", hashlib.sha256).digest()

DOCTOR, NURSE, ASHA, HOSPITAL, ADMIN = "DOCTOR", "NURSE", "ASHA", "HOSPITAL", "ADMIN"
ROLE_LABELS = {DOCTOR: "Doctor", NURSE: "Nurse", ASHA: "ASHA Worker", HOSPITAL: "Hospital Desk", ADMIN: "Administrator"}

# Test roster, saved to staff_accounts once. Administrators manage accounts from then on.
# PINs come from CERVISETU_STAFF_DEMO_PIN (see .env.example); only keyed hashes are stored.
_DEMO_PIN = os.getenv("CERVISETU_STAFF_DEMO_PIN", "246810")
_DEFAULT_STAFF = [
    ("DR-1001", "Dr. A. Sharma", DOCTOR, None, None),
    ("RN-2001", "Sister Sunita Patel", NURSE, "Parel Health Post", None),
    ("AW-3001", "Meena Devi", ASHA, "Malavani Health Post", None),
    ("HD-5001", "KEM Referral Desk", HOSPITAL, None, "KEM Hospital"),
    ("AD-4001", "Programme Administrator", ADMIN, None, None),
]
DEMO_ACCOUNT_FOR_ROLE = {DOCTOR: "DR-1001", NURSE: "RN-2001", ASHA: "AW-3001", HOSPITAL: "HD-5001", ADMIN: "AD-4001"}
STAFF_DIRECTORY: Dict[str, Dict[str, Optional[str]]] = {}
_PIN_HASHES: Dict[str, str] = {}


def _pin_hash(staff_id: str, pin: str) -> str:
    return hmac.new(_PIN_KEY, f"{staff_id}:{pin}".encode(), hashlib.sha256).hexdigest()


def _load_directory() -> None:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM staff_accounts WHERE active = 1").fetchall()
    STAFF_DIRECTORY.clear()
    _PIN_HASHES.clear()
    for r in rows:
        STAFF_DIRECTORY[r["staff_id"]] = {"name": r["name"], "role": r["role"], "health_post": r["health_post"], "hospital": r["hospital"]}
        _PIN_HASHES[r["staff_id"]] = r["pin_hash"]


def list_accounts() -> list:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT staff_id, name, role, health_post, hospital, active FROM staff_accounts ORDER BY role, staff_id").fetchall()
    return [{**dict(r), "active": bool(r["active"])} for r in rows]


def save_account(staff_id: str, name: str, role: str, health_post: Optional[str], hospital: Optional[str], pin: Optional[str]) -> None:
    with global_db._get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM staff_accounts WHERE staff_id = ?", (staff_id,)).fetchone()
        if exists:
            conn.execute("UPDATE staff_accounts SET name = ?, role = ?, health_post = ?, hospital = ? WHERE staff_id = ?",
                         (name, role, health_post, hospital, staff_id))
            if pin:
                conn.execute("UPDATE staff_accounts SET pin_hash = ? WHERE staff_id = ?", (_pin_hash(staff_id, pin), staff_id))
            conn.execute("UPDATE staff_sessions SET revoked = 1 WHERE staff_id = ?", (staff_id,))
        else:
            conn.execute("INSERT INTO staff_accounts (staff_id, name, role, health_post, hospital, pin_hash) VALUES (?, ?, ?, ?, ?, ?)",
                         (staff_id, name, role, health_post, hospital, _pin_hash(staff_id, pin or "")))
        conn.commit()
    _load_directory()


def set_account_active(staff_id: str, active: bool) -> bool:
    with global_db._get_conn() as conn:
        done = conn.execute("UPDATE staff_accounts SET active = ? WHERE staff_id = ?", (int(active), staff_id)).rowcount
        if not active:
            conn.execute("UPDATE staff_sessions SET revoked = 1 WHERE staff_id = ?", (staff_id,))
        conn.commit()
    _load_directory()
    return bool(done)


def ashas_at(health_post: str) -> list:
    return sorted(sid for sid, s in STAFF_DIRECTORY.items() if s["role"] == ASHA and s["health_post"] == health_post)


# (method or "*", path regex, allowed roles). First match wins; unmatched /api paths stay public.
# Administrators manage the directory and accounts only; patient-facing work stays with clinical and field staff.
ALL_STAFF = (DOCTOR, NURSE, ASHA)
CLINICAL = (DOCTOR, NURSE)
ROLE_RULES = [
    ("GET", r"^/api/patient/[^/]+$", CLINICAL),
    ("POST", r"^/api/patient/[^/]+/ai-summary$", CLINICAL),
    ("GET", r"^/api/abdm/profile/", CLINICAL),
    ("GET", r"^/api/dev/ai-usage$", (DOCTOR,)),
    ("POST", r"^/api/logs/event$", ALL_STAFF),
    ("*", r"^/api/admin/", (ADMIN,)),
    ("POST", r"^/api/logs/doctor/", (DOCTOR,)),
    ("GET", r"^/api/vault/inspect/", (DOCTOR,)),
    ("GET", r"^/api/fhir/patient/", (DOCTOR,)),
    ("POST", r"^/api/logs/nurse/", CLINICAL),
    ("POST", r"^/api/run-case$", CLINICAL),
    ("POST", r"^/api/genie/ask$", (DOCTOR, NURSE, ASHA, HOSPITAL, ADMIN)),
    ("POST", r"^/api/documents/", CLINICAL),
    ("POST", r"^/api/messages/test$", CLINICAL),
    ("GET", r"^/api/messages$", CLINICAL),
    ("*", r"^/api/encounter/[^/]+/(voice-consult|consult-audio)", CLINICAL),
    ("*", r"^/api/patient/[^/]+/(purge-audio-cache|audio-cache)$", CLINICAL),
    # Referral pathway. Which referrals each account may touch is checked per record in the router.
    ("POST", r"^/api/referrals/[^/]+/(status|clinical|review)$", (DOCTOR,)),
    ("POST", r"^/api/referrals/[^/]+/arrival$", (HOSPITAL, DOCTOR)),
    ("POST", r"^/api/referrals/[^/]+/visit$", (ASHA,)),
    ("POST", r"^/api/referrals/[^/]+/contact$", (NURSE, ASHA)),
    ("POST", r"^/api/referrals/scan-intake$", (DOCTOR, NURSE, ASHA)),
    ("POST", r"^/api/referrals/(register|duplicates)$", (ASHA,)),
    ("DELETE", r"^/api/referrals/[^/]+/files/[^/]+$", (DOCTOR,)),
    ("POST", r"^/api/referrals/[^/]+/files/[^/]+/(confirm|reject)$", (DOCTOR,)),
    ("POST", r"^/api/referrals/[^/]+/files/[^/]+/read$", CLINICAL),
    ("GET", r"^/api/referrals/[^/]+/files/[^/]+/reading$", CLINICAL),
    ("POST", r"^/api/referrals/[^/]+/files$", (DOCTOR, NURSE, ASHA)),
    ("GET", r"^/api/referrals/[^/]+/files", (DOCTOR, NURSE, ASHA)),
    ("GET", r"^/api/referrals", (DOCTOR, NURSE, ASHA, HOSPITAL)),
    ("POST", r"^/api/referrals", CLINICAL),
    ("GET", r"^/api/(cases|audit-logs)$", CLINICAL),
    ("GET", r"^/api/logs/(events|summary|verify-chain)$", CLINICAL),
    ("*", r"^/api/prevention/", CLINICAL),
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS staff_accounts (
                staff_id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, health_post TEXT, hospital TEXT,
                pin_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
        """)
        for sid, name, role, post, hospital in _DEFAULT_STAFF:
            conn.execute("""INSERT OR IGNORE INTO staff_accounts (staff_id, name, role, health_post, hospital, pin_hash)
                            VALUES (?, ?, ?, ?, ?, ?)""", (sid, name, role, post, hospital, _pin_hash(sid, _DEMO_PIN)))
        conn.commit()
    _load_directory()


_init_tables()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(_KEY, payload.encode(), hashlib.sha256).digest())


def public_profile(staff_id: str) -> Dict[str, str]:
    entry = STAFF_DIRECTORY[staff_id]
    facility = entry["health_post"] or entry["hospital"] or "Mumbai Cervical Care Programme"
    return {"staff_id": staff_id, "name": entry["name"], "role": entry["role"], "role_label": ROLE_LABELS[entry["role"]],
            "facility": facility, "health_post": entry["health_post"], "hospital": entry["hospital"]}


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


def renewed_cookie(cookie: Optional[str]) -> Optional[str]:
    """A later-expiring cookie for this valid session, so staff who are working are never signed out.

    Keeps the same session id, so requests in flight stay valid and logout still ends it. None if not due yet.
    """
    if not verify_session(cookie):
        return None
    data = json.loads(_unb64(cookie.rsplit(".", 1)[0]))
    expires = time.time() + SESSION_TTL_SECONDS
    if expires - float(data["exp"]) < RENEW_AFTER_SECONDS:
        return None
    with global_db._get_conn() as conn:
        conn.execute("UPDATE staff_sessions SET expires_at = ? WHERE sid_hash = ?",
                     (expires, hashlib.sha256(data["sid"].encode()).hexdigest()))
        conn.commit()
    payload = _b64(json.dumps({**data, "exp": int(expires)}).encode())
    return f"{payload}.{_sign(payload)}"


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
    write_cookie(response, request, issue_session(staff_id))


def write_cookie(response, request, value: str) -> None:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    samesite = "none" if secure else "lax"
    response.set_cookie(COOKIE_NAME, value, max_age=SESSION_TTL_SECONDS,
                        httponly=True, samesite=samesite, secure=secure, path="/")
