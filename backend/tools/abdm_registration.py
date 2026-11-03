"""ABDM-style (ABHA) registration and demo patient login: consent capture + sandbox OTP.

DEMO / SANDBOX ONLY. Without NHA gateway credentials nothing here talks to ABDM or UIDAI:
- identity verification is SIMULATED: no SMS is sent, the OTP is returned to the caller on screen;
- the ABHA number/address issued is a "Synthetic ABHA Sandbox ID - not issued by ABDM";
- the OTP is demo authentication, not secure production authentication (refused when CERVISETU_ENV=production).
What is real: every consent is mandatory and recorded, OTPs are stored hashed with expiry / resend
window / attempt lockout, and Aadhaar/VID and mobile numbers are never stored (keyed hash + last 4 only).
An Aadhaar number is never a login credential: re-registering the same identity is refused and the
patient is pointed to mobile OTP or ABHA-number login instead.

Demographic and biometric verification need ABDM facility approval (biometrics also needs a
UIDAI-certified RD device), so they are reported as unavailable rather than faked.
"""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from typing import Any, Dict, Optional

from backend.config import ABDM_MODE, APP_ENV, VAULT_SECRET_KEY
from backend.core.database import global_db
from backend.tools.synthetic_journey import ensure_synthetic_journey
from backend.core.security import global_audit, global_vault

OTP_TTL_SECONDS = 600
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
OTP_MAX_SENDS = 3

SYNTHETIC_ABHA_LABEL = "Synthetic ABHA Sandbox ID - not issued by ABDM"
AUTH_NOTICE = "Demo authentication: sandbox OTP shown on screen; not secure production authentication."
# The seeded demo patient can log in by mobile OTP like any registered patient
DEMO_MOBILE_LINKS = {"9876543210": "PT-RURAL-7891"}

# The five consents shown on the CARE ABDM form; every one must be explicitly accepted
CONSENT_ITEMS = {
    "share_identity_with_nha": "Voluntarily share Aadhaar/Virtual ID and demographics with UIDAI/NHA to create ABHA number and address",
    "link_health_records": "Use ABHA address/number to link legacy and future government health records",
    "share_records_with_providers": "Share health records with healthcare providers for this encounter",
    "anonymised_public_health_use": "Anonymised use of health records for public health purposes",
    "admin_explained_consent": "Health worker confirms the consent contents were explained to the beneficiary",
}

UNSUPPORTED_METHODS = {
    "DEMOGRAPHICS": "Demographic authentication requires ABDM facility (HFR/HPR) approval; not enabled in sandbox.",
    "BIOMETRICS": "Biometric authentication requires a UIDAI-certified RD device and ABDM approval; not enabled.",
}


class RegistrationError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def verhoeff_valid(number: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(ch)]]
    return c == 0


def _keyed_hash(value: str) -> str:
    return hmac.new(VAULT_SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def _init_table():
    with global_db._get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS abdm_otp_sessions (
                txn_id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                id_type TEXT NOT NULL,
                identifier_hash TEXT NOT NULL,
                identifier_last4 TEXT NOT NULL,
                mobile_last4 TEXT,
                otp_hash TEXT NOT NULL,
                created_at REAL NOT NULL,
                last_sent_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                attempts INTEGER DEFAULT 0,
                sends INTEGER DEFAULT 1,
                status TEXT DEFAULT 'PENDING',
                link_token TEXT,
                pending_json TEXT,
                claimed_until REAL
            )
        """)
        try:  # older sandbox DBs predate the verify lease
            conn.execute("ALTER TABLE abdm_otp_sessions ADD COLUMN claimed_until REAL")
        except sqlite3.OperationalError:
            pass
        # Every identifier is a keyed hash: Aadhaar/VID, synthetic ABHA number and address
        conn.execute("""
            CREATE TABLE IF NOT EXISTS synthetic_abha_ids (
                patient_token TEXT PRIMARY KEY,
                identity_hash TEXT UNIQUE,
                abha_number_hash TEXT UNIQUE NOT NULL,
                abha_address_hash TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_mobile_links (
                mobile_hash TEXT PRIMARY KEY,
                patient_token TEXT NOT NULL,
                linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        for mobile, token in DEMO_MOBILE_LINKS.items():
            conn.execute("INSERT OR IGNORE INTO patient_mobile_links (mobile_hash, patient_token) VALUES (?, ?)",
                         (_keyed_hash(mobile), token))
        conn.commit()


_init_table()


def _normalise_identifier(mode: str, identifier: str) -> Dict[str, str]:
    raw = re.sub(r"[\s-]", "", identifier or "")
    if mode == "GENERATE":
        if re.fullmatch(r"\d{12}", raw):
            if raw[0] in "01" or not verhoeff_valid(raw):
                raise RegistrationError("INVALID_AADHAAR", "Aadhaar number failed the checksum.")
            return {"id_type": "AADHAAR", "value": raw}
        if re.fullmatch(r"\d{16}", raw):
            return {"id_type": "VID", "value": raw}
        raise RegistrationError("INVALID_IDENTIFIER", "Enter a 12-digit Aadhaar number or 16-digit Virtual ID.")
    if re.fullmatch(r"\d{14}", raw):
        return {"id_type": "ABHA_NUMBER", "value": raw}
    addr = (identifier or "").strip().lower()
    if re.fullmatch(r"[a-z0-9._]{4,32}@(sbx|abdm)", addr):
        return {"id_type": "ABHA_ADDRESS", "value": addr}
    raise RegistrationError("INVALID_IDENTIFIER", "Enter a 14-digit ABHA number or an ABHA address (name@sbx).")


def _mobile10(mobile: Optional[str]) -> str:
    return re.sub(r"\D", "", mobile or "")[-10:]


def _check_mode():
    if ABDM_MODE != "sandbox_simulated":
        raise RegistrationError("ABDM_GATEWAY_NOT_CONFIGURED", "Live ABDM gateway integration is not configured.", 503)
    if APP_ENV == "production":
        raise RegistrationError("SIMULATION_DISABLED", "Sandbox OTP is demo authentication and is disabled in production.", 503)


def _new_otp_session(mode: str, id_type: str, identifier_hash: str, last4: str, mobile_last4: Optional[str],
                     link_token: Optional[str], pending: Dict[str, Any]) -> Dict[str, str]:
    otp = f"{secrets.randbelow(1_000_000):06d}"
    txn_id = f"ABDM-TXN-{secrets.token_hex(8)}"
    now = time.time()
    with global_db._get_conn() as conn:
        conn.execute("""
            INSERT INTO abdm_otp_sessions
            (txn_id, mode, id_type, identifier_hash, identifier_last4, mobile_last4, otp_hash,
             created_at, last_sent_at, expires_at, link_token, pending_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (txn_id, mode, id_type, identifier_hash, last4, mobile_last4, _keyed_hash(txn_id + otp),
              now, now, now + OTP_TTL_SECONDS, link_token, json.dumps(pending)))
        conn.commit()
    return {"txn_id": txn_id, "otp": otp}


def _otp_response(txn_id: str, otp: str, sent_to: str, **extra) -> Dict[str, Any]:
    return {
        "txn_id": txn_id,
        "otp_sent_to": sent_to,
        "resend_after_seconds": OTP_RESEND_SECONDS,
        "expires_in_seconds": OTP_TTL_SECONDS,
        "mode": "SANDBOX_SIMULATED",
        "identity_verification": "SIMULATED",
        "auth_notice": AUTH_NOTICE,
        "sandbox_otp": otp,
        **extra,
    }


def request_otp(
    mode: str, identifier: str, beneficiary_name: str, consents: Dict[str, bool],
    mobile: Optional[str] = None, method: str = "OTP", link_token: Optional[str] = None,
    requested_by: str = "CARE_ADMIN",
) -> Dict[str, Any]:
    mode = (mode or "").upper()
    if mode not in ("GENERATE", "LINK"):
        raise RegistrationError("INVALID_MODE", "mode must be GENERATE or LINK.")
    method = (method or "OTP").upper()
    if method in UNSUPPORTED_METHODS:
        raise RegistrationError("METHOD_UNAVAILABLE", UNSUPPORTED_METHODS[method], 501)
    if method != "OTP":
        raise RegistrationError("INVALID_METHOD", "method must be OTP, DEMOGRAPHICS or BIOMETRICS.")
    missing = [k for k in CONSENT_ITEMS if consents.get(k) is not True]
    if missing:
        raise RegistrationError("CONSENT_REQUIRED", f"All consents must be accepted: {', '.join(missing)}")
    name = (beneficiary_name or "").strip()
    if not (2 <= len(name) <= 80):
        raise RegistrationError("NAME_REQUIRED", "Beneficiary name is required.")
    mobile_digits = _mobile10(mobile)
    if mobile and not re.fullmatch(r"[6-9]\d{9}", mobile_digits):
        raise RegistrationError("INVALID_MOBILE", "Enter a valid 10-digit Indian mobile number.")
    _check_mode()

    ident = _normalise_identifier(mode, identifier)
    session = _new_otp_session(mode, ident["id_type"], _keyed_hash(ident["value"]), ident["value"][-4:],
                               mobile_digits[-4:] or None, link_token,
                               {"consents": consents, "requested_by": requested_by})
    # Name/mobile wait here (encrypted) until the OTP is verified
    global_vault.store_pii(session["txn_id"], {"name": name, "mobile": mobile_digits or None})
    global_audit.record_event("ABDM_OTP_REQUESTED", requested_by, session["txn_id"],
                              {"mode": mode, "id_type": ident["id_type"], "simulated": True})
    sent_to = f"Aadhaar-linked mobile ******{mobile_digits[-4:]}" if mobile_digits else "Aadhaar-linked mobile"
    return _otp_response(session["txn_id"], session["otp"], sent_to, id_type=ident["id_type"])


def request_mobile_login(mobile: str) -> Dict[str, Any]:
    """Demo patient login by mobile OTP. Only works for mobiles linked during registration (or the demo patient)."""
    digits = _mobile10(mobile)
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise RegistrationError("INVALID_MOBILE", "Enter a valid 10-digit Indian mobile number.")
    _check_mode()
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT patient_token FROM patient_mobile_links WHERE mobile_hash = ?",
                           (_keyed_hash(digits),)).fetchone()
    if not row:
        # Revealing "not registered" is acceptable only because this path exists solely in the sandbox demo
        # (_check_mode refuses it in production); a real deployment must answer identically either way.
        raise RegistrationError("MOBILE_NOT_REGISTERED", "This mobile is not registered. Register with ABHA first.", 404)
    session = _new_otp_session("MOBILE_LOGIN", "MOBILE", _keyed_hash(digits), digits[-4:], digits[-4:],
                               row["patient_token"], {"requested_by": "PATIENT"})
    global_audit.record_event("PATIENT_LOGIN_OTP_REQUESTED", "PATIENT", row["patient_token"],
                              {"txn_id": session["txn_id"], "simulated": True})
    return _otp_response(session["txn_id"], session["otp"], f"mobile ******{digits[-4:]}")


def _session(txn_id: str) -> Dict[str, Any]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM abdm_otp_sessions WHERE txn_id = ?", (txn_id,)).fetchone()
    if not row:
        raise RegistrationError("UNKNOWN_TRANSACTION", "Transaction not found.", 404)
    return dict(row)


def resend_otp(txn_id: str) -> Dict[str, Any]:
    _check_mode()
    s = _session(txn_id)
    now = time.time()
    if s["status"] != "PENDING":
        raise RegistrationError("TRANSACTION_CLOSED", "This transaction is no longer active.", 409)
    wait = int(s["last_sent_at"] + OTP_RESEND_SECONDS - now)
    if wait > 0:
        raise RegistrationError("RESEND_TOO_SOON", f"Wait {wait}s before resending.", 429)
    if s["sends"] >= OTP_MAX_SENDS:
        raise RegistrationError("TOO_MANY_RESENDS", "OTP resend limit reached; start again.", 429)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    with global_db._get_conn() as conn:
        conn.execute("""UPDATE abdm_otp_sessions SET otp_hash = ?, last_sent_at = ?, expires_at = ?,
                        attempts = 0, sends = sends + 1 WHERE txn_id = ?""",
                     (_keyed_hash(txn_id + otp), now, now + OTP_TTL_SECONDS, txn_id))
        conn.commit()
    return {"txn_id": txn_id, "resend_after_seconds": OTP_RESEND_SECONDS, "mode": "SANDBOX_SIMULATED",
            "auth_notice": AUTH_NOTICE, "sandbox_otp": otp}


def _set_status(txn_id: str, status: str):
    with global_db._get_conn() as conn:
        conn.execute("UPDATE abdm_otp_sessions SET status = ? WHERE txn_id = ?", (status, txn_id))
        conn.commit()


def _check_otp(txn_id: str, otp: str) -> Dict[str, Any]:
    """Validate an OTP attempt (expiry, lockout, constant-time compare). Returns the session on success."""
    _check_mode()
    s = _session(txn_id)
    if s["status"] != "PENDING":
        raise RegistrationError("TRANSACTION_CLOSED", "This transaction is no longer active.", 409)
    if time.time() > s["expires_at"]:
        _set_status(txn_id, "EXPIRED")
        raise RegistrationError("OTP_EXPIRED", "OTP expired; request a new one.", 410)
    if s["attempts"] >= OTP_MAX_ATTEMPTS:
        _set_status(txn_id, "LOCKED")
        raise RegistrationError("TOO_MANY_ATTEMPTS", "Too many wrong attempts; start again.", 429)
    if not hmac.compare_digest(_keyed_hash(txn_id + (otp or "").strip()), s["otp_hash"]):
        with global_db._get_conn() as conn:
            conn.execute("UPDATE abdm_otp_sessions SET attempts = attempts + 1 WHERE txn_id = ?", (txn_id,))
            conn.commit()
        left = OTP_MAX_ATTEMPTS - s["attempts"] - 1
        if left <= 0:
            _set_status(txn_id, "LOCKED")
        raise RegistrationError("OTP_INVALID", f"Incorrect OTP. {max(left, 0)} attempt(s) left.", 401)
    # Not consumed here: _consume_otp runs only after registration is persisted, so a failed save can retry
    return s


def _consume_otp(txn_id: str, lease: Dict[str, float]):
    """Mark the OTP used exactly once, and only by the current lease holder (a stale holder cannot)."""
    with global_db._get_conn() as conn:
        cur = conn.execute("""UPDATE abdm_otp_sessions SET status = 'VERIFIED'
                              WHERE txn_id = ? AND status = 'PENDING' AND claimed_until = ?""",
                           (txn_id, lease["until"]))
        conn.commit()
    if cur.rowcount != 1:
        raise RegistrationError("TRANSACTION_CLOSED", "This transaction is no longer active.", 409)


ABHA_ID_MAX_ATTEMPTS = 20
VERIFY_LEASE_SECONDS = 30


def _claim(txn_id: str) -> Dict[str, float]:
    """Single-writer lease on a transaction: concurrent verifies of the same OTP cannot both proceed.

    The compare-and-set runs in one SQLite statement, so exactly one caller wins. The returned value is a
    fencing token: _renew extends it before each write phase and _consume_otp requires it, so a holder that
    stalled past its lease (and was taken over) fails at its next step instead of writing or consuming.
    A crashed holder's lease simply expires, after which the same valid OTP can be retried.
    """
    now = time.time()
    with global_db._get_conn() as conn:
        cur = conn.execute("""UPDATE abdm_otp_sessions SET claimed_until = ?
                              WHERE txn_id = ? AND status = 'PENDING' AND COALESCE(claimed_until, 0) < ?""",
                           (now + VERIFY_LEASE_SECONDS, txn_id, now))
        conn.commit()
    if cur.rowcount != 1:
        if _session(txn_id)["status"] != "PENDING":
            raise RegistrationError("TRANSACTION_CLOSED", "This transaction is no longer active.", 409)
        raise RegistrationError("VERIFY_IN_PROGRESS", "This OTP is already being verified; retry in a moment.", 409)
    return {"until": now + VERIFY_LEASE_SECONDS}


def _renew(txn_id: str, lease: Dict[str, float]):
    """Extend our lease; if another verify took it over after ours lapsed, stop before writing anything else."""
    until = time.time() + VERIFY_LEASE_SECONDS
    with global_db._get_conn() as conn:
        cur = conn.execute("""UPDATE abdm_otp_sessions SET claimed_until = ?
                              WHERE txn_id = ? AND status = 'PENDING' AND claimed_until = ?""",
                           (until, txn_id, lease["until"]))
        conn.commit()
    if cur.rowcount != 1:
        raise RegistrationError("VERIFY_IN_PROGRESS", "This OTP is already being verified; retry in a moment.", 409)
    lease["until"] = until


def _release(txn_id: str, lease: Dict[str, float]):
    with global_db._get_conn() as conn:
        conn.execute("""UPDATE abdm_otp_sessions SET claimed_until = NULL
                        WHERE txn_id = ? AND status = 'PENDING' AND claimed_until = ?""", (txn_id, lease["until"]))
        conn.commit()


def _assign_token(txn_id: str, pending_json: Optional[str], token: str) -> str:
    """Record the token this transaction will create (compare-and-set); returns whichever token won."""
    pending = json.loads(pending_json or "{}")
    with global_db._get_conn() as conn:
        cur = conn.execute("UPDATE abdm_otp_sessions SET pending_json = ? WHERE txn_id = ? AND pending_json IS ?",
                           (json.dumps({**pending, "assigned_token": token}), txn_id, pending_json))
        conn.commit()
    if cur.rowcount == 1:
        return token
    return json.loads(_session(txn_id)["pending_json"] or "{}").get("assigned_token") or token


def _new_patient_token() -> str:
    for _ in range(ABHA_ID_MAX_ATTEMPTS):
        token = f"PT-ABHA-{secrets.token_hex(3).upper()}"
        if not _find_abha("patient_token", token) and not global_db.get_treatment_plan(token):
            return token
    raise RegistrationError("ABHA_ID_UNAVAILABLE", "Could not allocate a Synthetic ABHA right now; please retry.", 503)


def _staged_key(txn_id: str) -> str:
    return f"{txn_id}::ABHA_STAGED"


def _promote_profile(txn_id: str, token: str):
    """Publish this transaction's staged profile under the patient token, once its ABHA row is ours.

    The staged key is private to the transaction, so a losing/aborted transaction can never write to (or
    read) another patient's {token}::ABHA profile. Ownership is proven by the row's address hash matching
    the staged address before anything is published.
    """
    try:
        staged = global_vault.retrieve_pii(_staged_key(txn_id))
    except Exception:
        return  # already promoted and cleaned up by an earlier attempt
    row = _find_abha("patient_token", token)
    if not row or row["abha_address_hash"] != _keyed_hash(staged["abha_address"]):
        raise RegistrationError("ABHA_ID_UNAVAILABLE", "Could not allocate a unique Synthetic ABHA right now; please retry.", 503)
    global_vault.store_pii(f"{token}::ABHA", staged)
    global_vault.delete_pii(_staged_key(txn_id))


def _create_abha_record(txn_id: str, token: str, identity_hash: Optional[str], pii: Dict[str, Any]):
    """Insert a unique synthetic ABHA number + address, retrying (bounded) only on number/address collisions."""
    handle = re.sub(r"[^a-z0-9]", "", pii["name"].lower())[:16] or "beneficiary"
    for attempt in range(ABHA_ID_MAX_ATTEMPTS):
        digits = f"91{secrets.randbelow(10**12):012d}"
        abha_number = f"{digits[:2]}-{digits[2:6]}-{digits[6:10]}-{digits[10:]}"
        # Existing handle.NNNN@sbx format; widen the suffix once the 4-digit space looks crowded for this name
        suffix = f"{secrets.randbelow(10000):04d}" if attempt < ABHA_ID_MAX_ATTEMPTS // 2 else f"{secrets.randbelow(10**6):06d}"
        abha_address = f"{handle}.{suffix}@sbx"
        number_hash, address_hash = _keyed_hash(digits), _keyed_hash(abha_address)
        if _find_abha("abha_number_hash", number_hash) or _find_abha("abha_address_hash", address_hash):
            continue
        # Stage first (txn-private key): if the insert below lands, its profile already exists (resume-safe)
        global_vault.store_pii(_staged_key(txn_id), {"name": pii["name"], "mobile": pii.get("mobile"),
                                                  "abha_number": abha_number, "abha_address": abha_address})
        try:
            with global_db._get_conn() as conn:
                conn.execute("""INSERT INTO synthetic_abha_ids (patient_token, identity_hash, abha_number_hash, abha_address_hash)
                                VALUES (?, ?, ?, ?)""", (token, identity_hash, number_hash, address_hash))
                conn.commit()
            return
        except sqlite3.IntegrityError as e:
            msg = str(e)
            if "patient_token" in msg and _find_abha("patient_token", token):
                return  # row exists; _promote_profile checks it is really ours before publishing anything
            if "abha_number_hash" in msg or "abha_address_hash" in msg:
                continue  # lost a race for the same value: try another
            if "identity_hash" in msg:
                raise RegistrationError("ALREADY_REGISTERED",
                                        "This identity already has a Synthetic ABHA. Log in with Mobile OTP or Link existing ABHA.", 409)
            raise
    global_audit.record_event("ABDM_ABHA_ID_EXHAUSTED", "SYSTEM", token, {"attempts": ABHA_ID_MAX_ATTEMPTS})
    raise RegistrationError("ABHA_ID_UNAVAILABLE", "Could not allocate a unique Synthetic ABHA right now; please retry.", 503)


def _find_abha(column: str, value_hash: str) -> Optional[Dict[str, Any]]:
    assert column in ("identity_hash", "abha_number_hash", "abha_address_hash", "patient_token")
    with global_db._get_conn() as conn:
        row = conn.execute(f"SELECT * FROM synthetic_abha_ids WHERE {column} = ?", (value_hash,)).fetchone()
    return dict(row) if row else None


def _profile(token: str) -> Dict[str, Any]:
    try:
        return global_vault.retrieve_pii(f"{token}::ABHA")
    except Exception:
        return {}


def _abha_card(token: str, verified_via: str) -> Dict[str, Any]:
    p = _profile(token)
    return {
        "label": SYNTHETIC_ABHA_LABEL,
        "abha_number": p.get("abha_number"),
        "abha_address": p.get("abha_address"),
        "full_name": p.get("name"),
        "mobile_masked": f"******{p['mobile'][-4:]}" if p.get("mobile") else None,
        "id_verified_via": verified_via,
    }


def _link_mobile(mobile: Optional[str], token: str):
    # First patient keeps the mobile: a shared family phone must not hijack another patient's login
    # (later patients on the same phone log in with their Synthetic ABHA number instead)
    if mobile:
        with global_db._get_conn() as conn:
            conn.execute("INSERT OR IGNORE INTO patient_mobile_links (mobile_hash, patient_token) VALUES (?, ?)",
                         (_keyed_hash(mobile), token))
            conn.commit()


def verify_otp(txn_id: str, otp: str) -> Dict[str, Any]:
    """Verify an OTP and complete login / registration.

    Persistence spans independent stores (separate SQLite commits plus the file-backed vault), so this is
    NOT atomic. Instead every step is idempotent and the OTP is consumed last:
      lease -> assigned token (CAS) -> staged vault profile (txn-private key) -> ABHA row -> promote profile
      -> mobile link -> synthetic journey -> consents -> audit (idempotency key) -> consume OTP (fenced).
    A failure or crash anywhere before consumption leaves the OTP PENDING; retrying the same OTP resumes
    on the same token and converges. Known limitations (accepted for the sandbox):
      * The audit log is an append-only file, not a DB table: ABDM_ABHA_VERIFIED carries an idempotency key
        and is skipped if already present, which holds only while one writer holds the lease.
      * A transaction that fails and is never retried leaves its staged profile under its own
        {txn_id}::ABHA_STAGED key. It is never published to a patient token or exposed, but nothing
        sweeps it yet (cleanup gap).
      * The lease is renewed before each write phase. A holder stalled longer than VERIFY_LEASE_SECONDS
        inside one phase can be taken over; it then fails at its next renew/consume (fencing), but a
        write already in flight in that phase still lands. All phase writes are idempotent, so the new
        holder converges on the same token.
    """
    _check_otp(txn_id, otp)
    lease = _claim(txn_id)
    try:
        return _verify_claimed(txn_id, _session(txn_id), lease)  # re-read: an earlier attempt may have assigned a token
    finally:
        _release(txn_id, lease)  # no-op once consumed; frees the lease after a failure so the same OTP can retry


def _verify_claimed(txn_id: str, s: Dict[str, Any], lease: Dict[str, float]) -> Dict[str, Any]:
    if s["mode"] == "MOBILE_LOGIN":
        token = s["link_token"]
        _consume_otp(txn_id, lease)
        global_audit.record_event("PATIENT_LOGIN_VERIFIED", "PATIENT", token, {"txn_id": txn_id, "simulated": True})
        abha = _find_abha("patient_token", token)
        return {"verified": True, "patient_token": token, "abha_created": False, "returning": True,
                "mode": "SANDBOX_SIMULATED", "auth_notice": AUTH_NOTICE,
                "synthetic_patient": global_db.is_synthetic_patient(token),
                "abha_card": _abha_card(token, f"Mobile OTP ending {s['identifier_last4']}") if abha else None}

    pii = global_vault.retrieve_pii(txn_id)
    pending = json.loads(s["pending_json"] or "{}")
    verified_via = f"{s['id_type']} ending {s['identifier_last4']} (simulated)"

    # A retry after a partial success resumes the record this transaction already created (no duplicate patient)
    assigned = pending.get("assigned_token")
    resumed = _find_abha("patient_token", assigned) if assigned else None

    if resumed:
        existing = None
    elif s["mode"] == "GENERATE":
        if _find_abha("identity_hash", s["identifier_hash"]):
            # Aadhaar is never a login credential: point to mobile OTP / ABHA-number login instead
            raise RegistrationError("ALREADY_REGISTERED",
                                    "This identity already has a Synthetic ABHA. Log in with Mobile OTP or Link existing ABHA.", 409)
        existing = None
    else:
        column = "abha_number_hash" if s["id_type"] == "ABHA_NUMBER" else "abha_address_hash"
        existing = _find_abha(column, s["identifier_hash"])
        if not existing and not s["link_token"]:
            raise RegistrationError("ABHA_NOT_FOUND", "No Synthetic ABHA found for this identifier; generate one first.", 404)

    if existing:
        token, created = existing["patient_token"], False
        _link_mobile(pii.get("mobile"), token)
    else:
        if resumed:
            token = assigned
        else:
            token = assigned or _assign_token(txn_id, s["pending_json"], s["link_token"] or _new_patient_token())
            _renew(txn_id, lease)
            _create_abha_record(txn_id, token, s["identifier_hash"] if s["mode"] == "GENERATE" else None, pii)
        _promote_profile(txn_id, token)
        _link_mobile(pii.get("mobile"), token)
        if not s["link_token"]:
            # New demo patient: deterministic SYNTHETIC journey, isolated from real clinical queues
            _renew(txn_id, lease)
            ensure_synthetic_journey(token)
        created = True

    _renew(txn_id, lease)

    for key in CONSENT_ITEMS:
        global_db.record_dpdp_consent(
            consent_id=f"{txn_id}-{key}", patient_token=token, consent_type=f"ABDM_{key.upper()}",
            granted_by="PATIENT_VIA_HEALTH_WORKER", language="ENGLISH",
            sha256_hash=hashlib.sha256(f"{txn_id}|{key}|{CONSENT_ITEMS[key]}".encode()).hexdigest(),
        )
    # Idempotency key: a retry after a crash between this event and consumption does not log it twice
    # (the lease makes the check-then-append single-writer)
    audit_key = f"ABDM_ABHA_VERIFIED:{txn_id}"
    if not any(e.get("details", {}).get("idempotency_key") == audit_key
               for e in global_audit.get_events(patient_token=token, limit=10_000)):
        global_audit.record_event("ABDM_ABHA_VERIFIED", pending.get("requested_by", "CARE_ADMIN"), token,
                                  {"txn_id": txn_id, "mode": s["mode"], "created": created, "simulated": True,
                                   "consents": list(CONSENT_ITEMS), "idempotency_key": audit_key})
    _consume_otp(txn_id, lease)
    return {
        "verified": True,
        "patient_token": token,
        "abha_created": created,
        "returning": not created,
        "mode": "SANDBOX_SIMULATED",
        "auth_notice": AUTH_NOTICE,
        "synthetic_patient": global_db.is_synthetic_patient(token),
        "abha_card": _abha_card(token, verified_via),
    }


def patient_profile(token: str) -> Dict[str, Any]:
    """Portal header data: name + masked synthetic ABHA + synthetic flag. Empty profile for non-ABHA patients."""
    p = _profile(token)
    number = p.get("abha_number") or ""
    case = global_db.get_latest_case(token) or {}
    plan = global_db.get_treatment_plan(token) or {}
    return {
        "stage": case.get("suspected_stage"),
        "facility_name": plan.get("facility_name"),
        "patient_token": token,
        "display_name": p.get("name"),
        "abha_number_masked": f"XX-XXXX-XXXX-{number[-4:]}" if number else None,
        "abha_address": p.get("abha_address"),
        "abha_label": SYNTHETIC_ABHA_LABEL if number else None,
        "synthetic_patient": global_db.is_synthetic_patient(token),
        "data_label": "SYNTHETIC_DEMO" if global_db.is_synthetic_patient(token) else None,
    }
