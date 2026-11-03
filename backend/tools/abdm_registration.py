"""ABDM (ABHA) M1 registration: consent capture + Aadhaar/ABHA OTP verification.

Without NHA gateway credentials this runs in SANDBOX_SIMULATED mode: the OTP is generated here and
returned to the caller (clearly labelled) instead of being sent by UIDAI, and the ABHA number/address
issued is a fake "@sbx" identity. Everything else is real: consent is mandatory and recorded, the
OTP is hashed with expiry / resend window / attempt limit, and the Aadhaar/VID is never stored
(only a keyed hash and the last 4 digits).

Demographic and biometric verification need ABDM facility approval (biometrics also needs a
UIDAI-certified RD device), so they are reported as unavailable rather than faked.
"""
import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Any, Dict, Optional

from backend.config import ABDM_MODE, APP_ENV, VAULT_SECRET_KEY
from backend.core.database import global_db
from backend.core.security import global_audit, global_vault

OTP_TTL_SECONDS = 600
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
OTP_MAX_SENDS = 3

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
                pending_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS abha_links (
                identifier_hash TEXT PRIMARY KEY,
                patient_token TEXT NOT NULL,
                abha_number TEXT NOT NULL,
                abha_address TEXT NOT NULL,
                linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
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


def _check_mode():
    if ABDM_MODE != "sandbox_simulated":
        raise RegistrationError("ABDM_GATEWAY_NOT_CONFIGURED", "Live ABDM gateway integration is not configured.", 503)
    if APP_ENV == "production":
        raise RegistrationError("SIMULATION_DISABLED", "Simulated ABDM OTP is disabled in production.", 503)


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
    mobile_digits = re.sub(r"\D", "", mobile or "")[-10:]
    if mobile and not re.fullmatch(r"[6-9]\d{9}", mobile_digits):
        raise RegistrationError("INVALID_MOBILE", "Enter a valid 10-digit Indian mobile number.")
    _check_mode()

    ident = _normalise_identifier(mode, identifier)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    txn_id = f"ABDM-TXN-{secrets.token_hex(8)}"
    now = time.time()
    # Name/mobile wait here (encrypted) until the OTP is verified; never stored if it isn't
    global_vault.store_pii(txn_id, {"name": name, "mobile": mobile_digits or None})
    with global_db._get_conn() as conn:
        conn.execute("""
            INSERT INTO abdm_otp_sessions
            (txn_id, mode, id_type, identifier_hash, identifier_last4, mobile_last4, otp_hash,
             created_at, last_sent_at, expires_at, link_token, pending_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (txn_id, mode, ident["id_type"], _keyed_hash(ident["value"]), ident["value"][-4:],
              mobile_digits[-4:] or None, _keyed_hash(txn_id + otp), now, now, now + OTP_TTL_SECONDS,
              link_token, json.dumps({"consents": consents, "requested_by": requested_by})))
        conn.commit()
    global_audit.record_event("ABDM_OTP_REQUESTED", requested_by, txn_id,
                              {"mode": mode, "id_type": ident["id_type"], "simulated": True})
    return {
        "txn_id": txn_id,
        "id_type": ident["id_type"],
        "otp_sent_to": f"Aadhaar-linked mobile ******{mobile_digits[-4:]}" if mobile_digits else "Aadhaar-linked mobile",
        "resend_after_seconds": OTP_RESEND_SECONDS,
        "expires_in_seconds": OTP_TTL_SECONDS,
        "mode": "SANDBOX_SIMULATED",
        "sandbox_otp": otp,
    }


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
    return {"txn_id": txn_id, "resend_after_seconds": OTP_RESEND_SECONDS, "mode": "SANDBOX_SIMULATED", "sandbox_otp": otp}


def _set_status(txn_id: str, status: str):
    with global_db._get_conn() as conn:
        conn.execute("UPDATE abdm_otp_sessions SET status = ? WHERE txn_id = ?", (status, txn_id))
        conn.commit()


def verify_otp(txn_id: str, otp: str) -> Dict[str, Any]:
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

    pii = global_vault.retrieve_pii(txn_id)
    pending = json.loads(s["pending_json"] or "{}")
    with global_db._get_conn() as conn:
        existing = conn.execute("SELECT * FROM abha_links WHERE identifier_hash = ?", (s["identifier_hash"],)).fetchone()

    if existing:
        token, abha_number, abha_address = existing["patient_token"], existing["abha_number"], existing["abha_address"]
        created = False
    elif s["mode"] == "LINK" and not s["link_token"]:
        raise RegistrationError("ABHA_NOT_FOUND", "No ABHA found for this identifier in the sandbox; generate one first.", 404)
    else:
        token = s["link_token"] or f"PT-ABHA-{secrets.token_hex(3).upper()}"
        digits = f"91{secrets.randbelow(10**12):012d}"
        abha_number = f"{digits[:2]}-{digits[2:6]}-{digits[6:10]}-{digits[10:]}"
        handle = re.sub(r"[^a-z0-9]", "", pii["name"].lower())[:16] or "beneficiary"
        abha_address = f"{handle}.{secrets.randbelow(10000):04d}@sbx"
        if not s["link_token"]:
            global_db.save_patient(token, None, "F", "ABDM")
        with global_db._get_conn() as conn:
            conn.execute("INSERT INTO abha_links (identifier_hash, patient_token, abha_number, abha_address) VALUES (?, ?, ?, ?)",
                         (s["identifier_hash"], token, abha_number, abha_address))
            conn.commit()
        created = True

    profile = {"name": pii["name"], "mobile": pii.get("mobile"), "abha_number": abha_number, "abha_address": abha_address}
    global_vault.store_pii(f"{token}::ABHA", profile)
    for key in CONSENT_ITEMS:
        global_db.record_dpdp_consent(
            consent_id=f"{txn_id}-{key}", patient_token=token, consent_type=f"ABDM_{key.upper()}",
            granted_by="PATIENT_VIA_HEALTH_WORKER", language="ENGLISH",
            sha256_hash=hashlib.sha256(f"{txn_id}|{key}|{CONSENT_ITEMS[key]}".encode()).hexdigest(),
        )
    _set_status(txn_id, "VERIFIED")
    global_audit.record_event("ABDM_ABHA_VERIFIED", pending.get("requested_by", "CARE_ADMIN"), token,
                              {"txn_id": txn_id, "mode": s["mode"], "created": created, "simulated": True,
                               "consents": list(CONSENT_ITEMS)})
    return {
        "verified": True,
        "patient_token": token,
        "abha_created": created,
        "mode": "SANDBOX_SIMULATED",
        "abha_card": {
            "abha_number": abha_number,
            "abha_address": abha_address,
            "full_name": pii["name"],
            "mobile_masked": f"******{pii['mobile'][-4:]}" if pii.get("mobile") else None,
            "id_verified_via": f"{s['id_type']} ending {s['identifier_last4']}",
        },
    }
