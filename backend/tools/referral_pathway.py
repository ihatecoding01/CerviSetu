"""Cervical referral pathway: from an abnormal screening to hospital care, with the 14-day follow-up.

Days 1-10 daily reminder, days 11-13 intensive contact, day 14 ASHA home visit that records her decision.
Reminders go through backend.tools.messaging, which simulates and says so unless a provider is configured.
"""
import hashlib
import json
import os
import secrets
from datetime import date, timedelta
import logging
from typing import Any, Dict, List, Optional, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from pathlib import Path

from backend.tools import teaching_cases
from backend.config import APP_ENV, VAULT_SECRET_KEY, clinic_today
from backend.core.database import global_db
from backend.core.security import UserRole, global_audit, global_vault
from backend.tools import messaging

logger = logging.getLogger(__name__)

ROUTINE, REFERRED, ARRIVED, COLPOSCOPY, BIOPSY, REPORT, PLANNED, COMPLETED, DECLINED = (
    "ROUTINE_SCREENING", "REFERRED", "ARRIVED", "COLPOSCOPY_DONE", "BIOPSY_TAKEN", "REPORT_READY",
    "TREATMENT_PLANNED", "COMPLETED", "DECLINED")
STATUS_ORDER = [REFERRED, ARRIVED, COLPOSCOPY, BIOPSY, REPORT, PLANNED, COMPLETED]
FOLLOW_UP_DAYS = 14
REMINDER = "Namaste. This is your health centre. Your hospital visit is still pending. Please go soon. Press 1 if you have visited, 2 for help, 3 for a nurse call back."

FAMILY_REMINDER = "Namaste. This is your family's health centre. Please remind her about her pending hospital visit."
UPLOAD_KINDS = {"VIA_IMAGE", "COLPOSCOPY_IMAGE", "HISTOPATHOLOGY_REPORT", "MRI_REPORT", "OTHER_REPORT"}
IMAGE_KINDS = {"VIA_IMAGE", "COLPOSCOPY_IMAGE"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_FILE_AES = AESGCM(hashlib.sha256(VAULT_SECRET_KEY.encode() + b"cervisetu-referral-files-v1").digest())

# Starting referral routes from the programme. Administrators change them in referral_routes.
ROUTES = {
    "Dharavi Urban Health Centre": "Sion Hospital",
    "Bandra Bhabha Health Post": "Cooper Hospital",
    "BMC Khar Health Post": "Cooper Hospital",
    "Parel Health Post": "KEM Hospital",
    "Naigaon Health Post": "KEM Hospital",
    "Malavani Health Post": "Siddharth Hospital",
    "Charni Road Health Post": "Sir JJ Hospital",
}
POST_AREAS = {"Dharavi Urban Health Centre": "Dharavi", "Bandra Bhabha Health Post": "Bandra", "BMC Khar Health Post": "Khar",
              "Parel Health Post": "Parel", "Naigaon Health Post": "Naigaon", "Malavani Health Post": "Malavani",
              "Charni Road Health Post": "Charni Road"}
NEW_COLUMNS = {
    "form_json": "TEXT NOT NULL DEFAULT '{}'", "assigned_asha": "TEXT", "message_consent": "TEXT", "family_consent": "INTEGER NOT NULL DEFAULT 0",
    "stopped_at": "TEXT", "doctor_review": "TEXT", "doctor_review_note": "TEXT", "colposcopy_json": "TEXT NOT NULL DEFAULT '{}'",
    "biopsy": "TEXT NOT NULL DEFAULT ''", "mri": "TEXT NOT NULL DEFAULT ''", "final_diagnosis": "TEXT NOT NULL DEFAULT ''",
    "treatment_plan": "TEXT NOT NULL DEFAULT ''", "remarks": "TEXT NOT NULL DEFAULT ''", "visit_outcome": "TEXT",
}


def _init() -> None:
    with global_db._get_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS referrals (
            referral_id TEXT PRIMARY KEY, patient_token TEXT NOT NULL UNIQUE, age INTEGER, area TEXT NOT NULL,
            health_post TEXT NOT NULL, hospital TEXT, screening_finding TEXT NOT NULL, colposcopy TEXT NOT NULL DEFAULT '',
            histopathology TEXT NOT NULL DEFAULT '', red_flags TEXT NOT NULL DEFAULT '', urgent INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL, referred_on TEXT, arrived_on TEXT, consent TEXT, consent_note TEXT,
            next_follow_up TEXT, fictional INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        have = {c["name"] for c in conn.execute("PRAGMA table_info(referrals)").fetchall()}
        for column, kind in NEW_COLUMNS.items():
            if column not in have:  # Safe migration: adds columns, keeps every existing row
                conn.execute(f"ALTER TABLE referrals ADD COLUMN {column} {kind}")
        conn.execute("""CREATE TABLE IF NOT EXISTS referral_events (
            event_id TEXT PRIMARY KEY, referral_id TEXT NOT NULL, event_date TEXT NOT NULL, follow_up_day INTEGER,
            kind TEXT NOT NULL, channel TEXT, detail TEXT, status TEXT, actor TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS health_posts (
            name TEXT PRIMARY KEY, area TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS referral_routes (
            health_post TEXT PRIMARY KEY, hospital TEXT NOT NULL, updated_by TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS referral_files (
            file_id TEXT PRIMARY KEY, referral_id TEXT NOT NULL, kind TEXT NOT NULL, filename TEXT NOT NULL,
            content_type TEXT NOT NULL, nonce BLOB NOT NULL, ciphertext BLOB NOT NULL, photo_consent INTEGER NOT NULL DEFAULT 0,
            uploaded_by TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        for post, hospital in ROUTES.items():
            conn.execute("INSERT OR IGNORE INTO health_posts (name, area) VALUES (?, ?)", (post, POST_AREAS[post]))
            conn.execute("INSERT OR IGNORE INTO referral_routes (health_post, hospital, updated_by) VALUES (?, ?, 'PROGRAMME')", (post, hospital))
        conn.commit()


_init()


def current_routes() -> Dict[str, str]:
    with global_db._get_conn() as conn:
        rows = conn.execute("""SELECT r.health_post, r.hospital FROM referral_routes r
                               JOIN health_posts p ON p.name = r.health_post WHERE p.active = 1""").fetchall()
    return {r["health_post"]: r["hospital"] for r in rows}


class ReferralError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code, self.detail = status_code, detail


def follow_up_day(referred_on: Optional[str], today: Optional[date] = None) -> int:
    """Day 1 is the day of referral. 0 means no referral yet."""
    if not referred_on:
        return 0
    return max(1, ((today or clinic_today()) - date.fromisoformat(referred_on)).days + 1)


def follow_up_step(day: int) -> str:
    if day <= 0:
        return "NONE"
    return "DAILY_REMINDER" if day <= 10 else "INTENSIVE_CONTACT" if day <= 13 else "ASHA_VISIT"


def _following(row: Dict[str, Any]) -> bool:
    """Only confirmed arrival, a recorded refusal or a closed record ends follow-up. A reply never does."""
    return row["status"] == REFERRED


def lane(row: Dict[str, Any], today: Optional[date] = None) -> str:
    if not _following(row):
        return "on_track"
    day = follow_up_day(row["referred_on"], today)
    return "on_track" if day <= 10 else "attention" if day <= 13 else "visit_due"


def _name(token: str) -> str:
    try:
        return global_vault.retrieve_pii(token).get("name") or token
    except Exception:
        return token


def _view(row, today: Optional[date] = None) -> Dict[str, Any]:
    r = dict(row)
    following = _following(r)
    day = follow_up_day(r["referred_on"], today) if following else 0
    r["form"] = json.loads(r.pop("form_json") or "{}")
    r["colposcopy_findings"] = json.loads(r.pop("colposcopy_json") or "{}")
    r.update(patient_name=_name(r["patient_token"]), urgent=bool(r["urgent"]), fictional=bool(r["fictional"]),
             family_consent=bool(r["family_consent"]), messaging_allowed=can_message(r),
             following=following, follow_up_day=day, follow_up_step=follow_up_step(day), lane=lane(r, today))
    return r


def can_message(row: Dict[str, Any]) -> bool:
    return row.get("message_consent") == "GRANTED" and not row.get("stopped_at")


PATIENT_FIELDS = ("referral_id", "patient_token", "patient_name", "health_post", "hospital", "status", "referred_on", "arrived_on",
                  "next_follow_up", "fictional", "following", "follow_up_day", "follow_up_step", "messaging_allowed", "stopped_at", "urgent")
ASHA_FIELDS = ("referral_id", "patient_token", "patient_name", "age", "area", "health_post", "hospital", "status", "referred_on",
               "consent", "consent_note", "visit_outcome", "fictional", "following", "follow_up_day", "follow_up_step", "lane",
               "messaging_allowed", "assigned_asha", "doctor_review", "urgent")
HOSPITAL_FIELDS = ("referral_id", "patient_token", "patient_name", "age", "health_post", "hospital", "screening_finding", "red_flags",
                   "urgent", "status", "referred_on", "arrived_on", "fictional", "following", "follow_up_day", "follow_up_step", "lane")


def patient_view(row: Dict[str, Any]) -> Dict[str, Any]:
    """What she sees herself. Results are explained by her clinician, so findings are not in this view."""
    return {k: row[k] for k in PATIENT_FIELDS}


def visible_to(staff: Optional[Dict[str, Any]], row: Dict[str, Any]) -> bool:
    if staff is None:
        return True
    role = staff["role"]
    if role == "DOCTOR":
        return True
    if role == "NURSE":
        return row["health_post"] == staff.get("health_post")
    if role == "ASHA":
        return row.get("assigned_asha") == staff["staff_id"] and row["health_post"] == staff.get("health_post")
    if role == "HOSPITAL":
        return row.get("hospital") == staff.get("hospital")
    return False


def view_for(staff: Optional[Dict[str, Any]], row: Dict[str, Any]) -> Dict[str, Any]:
    """Least privilege per role: ASHA and hospital desk never receive reports or diagnosis fields."""
    role = staff["role"] if staff else "DOCTOR"
    if role == "ASHA":
        out = {k: row[k] for k in ASHA_FIELDS}
        out["contact_phone"] = _phone(row["patient_token"])
        return out
    if role == "HOSPITAL":
        return {k: row[k] for k in HOSPITAL_FIELDS}
    out = dict(row)
    out["contact_phone"] = _phone(row["patient_token"])
    return out


def list_for(staff: Optional[Dict[str, Any]], today: Optional[date] = None) -> List[Dict[str, Any]]:
    return [view_for(staff, r) for r in list_referrals(today) if visible_to(staff, r)]


def _phone(token: str) -> str:
    try:
        return global_vault.retrieve_pii(token).get("phone") or ""
    except Exception:
        return ""


def _get(referral_id: str) -> Dict[str, Any]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM referrals WHERE referral_id = ?", (referral_id,)).fetchone()
    if not row:
        raise ReferralError(404, "Referral not found.")
    return dict(row)


def list_referrals(today: Optional[date] = None) -> List[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM referrals ORDER BY urgent DESC, referred_on").fetchall()
    return [_view(r, today) for r in rows]


def get_for_patient(token: str) -> Optional[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM referrals WHERE patient_token = ?", (token,)).fetchone()
    return _view(row) if row else None


def events(referral_id: str) -> List[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM referral_events WHERE referral_id = ? ORDER BY created_at, rowid",
                            (referral_id,)).fetchall()
    return [dict(r) for r in rows]


def _event(referral_id: str, kind: str, day: int = 0, channel: Optional[str] = None, detail: str = "",
           status: Optional[str] = None, actor: str = "SYSTEM", on: Optional[date] = None) -> None:
    with global_db._get_conn() as conn:
        conn.execute("""INSERT INTO referral_events (event_id, referral_id, event_date, follow_up_day, kind, channel, detail, status, actor)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (secrets.token_hex(8), referral_id, (on or clinic_today()).isoformat(), day, kind, channel, detail, status, actor))
        conn.commit()


def _audit(action: str, token: str, actor: str, **details) -> None:
    global_audit.record_event(action=action, actor=actor, patient_token=token, user_role=UserRole.SYSTEM, details=details)


def create(data: Dict[str, Any], actor: str, fictional: bool = False, referred_on: Optional[date] = None) -> Dict[str, Any]:
    """Record the screening. `refer` False means routine screening with no follow-up. The route is always the saved one."""
    token = data.get("patient_token") or f"PT-{secrets.token_hex(4).upper()}"
    if get_for_patient(token):
        raise ReferralError(409, "This patient already has a referral record.")
    refer = bool(data.get("refer", True))
    post = data["health_post"]
    hospital = current_routes().get(post)
    if refer and not hospital:
        raise ReferralError(422, "This health post has no active referral route.")
    referral_id = f"REF-{secrets.token_hex(4).upper()}"
    start = referred_on or clinic_today()
    global_vault.store_pii(token, {"name": data["patient_name"], "phone": data.get("phone") or "", "address": data.get("area", ""),
                                   "family_phone": data.get("family_phone") or ""})
    consent = data.get("message_consent") if data.get("message_consent") in ("GRANTED", "WITHHELD") else None
    with global_db._get_conn() as conn:
        conn.execute("""INSERT INTO referrals (referral_id, patient_token, age, area, health_post, hospital, screening_finding,
                        red_flags, urgent, status, referred_on, fictional, form_json, message_consent, family_consent)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (referral_id, token, data.get("age"), data.get("area", ""), post, hospital if refer else None,
                      data["screening_finding"], data.get("red_flags", ""), int(bool(data.get("urgent"))),
                      REFERRED if refer else ROUTINE, start.isoformat() if refer else None, int(fictional),
                      json.dumps(data.get("form") or {}), consent, int(bool(data.get("family_consent")))))
        conn.commit()
    _event(referral_id, "REFERRED" if refer else "SCREENED", 1 if refer else 0, detail=hospital if refer else data["screening_finding"], actor=actor, on=start)
    _audit("REFERRAL_CREATED" if refer else "SCREENING_RECORDED", token, actor, referral_id=referral_id, hospital=hospital if refer else None)
    if refer and data.get("phone") and not fictional:
        from backend.tools.abdm_registration import link_mobile
        link_mobile(data["phone"], token)
    return _view(_get(referral_id))


def confirm_arrival(referral_id: str, actor: str) -> Dict[str, Any]:
    """The receiving hospital confirms she came. This is what closes the 14-day follow-up."""
    row = _get(referral_id)
    if row["status"] not in (REFERRED, DECLINED):
        raise ReferralError(409, "Arrival is already recorded or this record is not referred.")
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET status = ?, arrived_on = ?, doctor_review = NULL WHERE referral_id = ?",
                     (ARRIVED, clinic_today().isoformat(), referral_id))
        conn.commit()
    _event(referral_id, ARRIVED, actor=actor)
    _audit("REFERRAL_ARRIVED", row["patient_token"], actor, referral_id=referral_id)
    return _view(_get(referral_id))


def update_status(referral_id: str, status: str, actor: str) -> Dict[str, Any]:
    row = _get(referral_id)
    if status not in STATUS_ORDER:
        raise ReferralError(422, "Unknown status.")
    if status == ARRIVED:
        return confirm_arrival(referral_id, actor)
    if row["status"] not in STATUS_ORDER[1:]:
        raise ReferralError(409, "Confirm her arrival at the hospital first.")
    if STATUS_ORDER.index(status) < STATUS_ORDER.index(row["status"]):
        raise ReferralError(409, "A referral cannot move backwards.")
    if status in (REPORT, PLANNED, COMPLETED) and not row["histopathology"].strip() and row["biopsy"] != "Not indicated":
        raise ReferralError(422, "Enter the histopathology report first.")
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET status = ? WHERE referral_id = ?", (status, referral_id))
        conn.commit()
    _event(referral_id, status, actor=actor)
    _audit(f"REFERRAL_{status}", row["patient_token"], actor, referral_id=referral_id)
    return _view(_get(referral_id))


CLINICAL_FIELDS = ("colposcopy", "biopsy", "histopathology", "mri", "final_diagnosis", "treatment_plan", "remarks", "next_follow_up")


def record_clinical(referral_id: str, data: Dict[str, Any], actor: str) -> Dict[str, Any]:
    """Doctor's record. The app stores these and never infers them. A final diagnosis needs a histopathology report."""
    row = _get(referral_id)
    if row["status"] not in STATUS_ORDER[1:]:
        raise ReferralError(409, "Confirm her arrival at the hospital first.")
    merged = {k: (data.get(k) if data.get(k) is not None else row[k] or "") for k in CLINICAL_FIELDS}
    histology = merged["histopathology"].strip()
    if merged["final_diagnosis"].strip() and histology in ("", "Pending") and merged["biopsy"] != "Not indicated":
        raise ReferralError(422, "A final diagnosis needs the histopathology report, unless biopsy was not indicated.")
    findings = data.get("colposcopy_findings")
    with global_db._get_conn() as conn:
        conn.execute(f"UPDATE referrals SET {', '.join(k + ' = ?' for k in CLINICAL_FIELDS)}, colposcopy_json = ? WHERE referral_id = ?",
                     (*[merged[k] for k in CLINICAL_FIELDS], json.dumps(findings) if findings is not None else row["colposcopy_json"], referral_id))
        conn.commit()
    _event(referral_id, "CLINICAL_RECORD_UPDATED", actor=actor)
    _audit("REFERRAL_CLINICAL_RECORD_UPDATED", row["patient_token"], actor, referral_id=referral_id)
    return _view(_get(referral_id))


def send_reminder(referral_id: str, actor: str, channel: str = "SMS", today: Optional[date] = None) -> Dict[str, Any]:
    row = _get(referral_id)
    if not _following(row):
        raise ReferralError(409, "Follow-up is closed for this referral.")
    if not can_message(row):
        raise ReferralError(409, "She has not agreed to messages, or has asked to stop them.")
    on = today or clinic_today()
    day = follow_up_day(row["referred_on"], on)
    live = messaging.mode() == "twilio"
    token = row["patient_token"]
    sent = messaging.send(channel, REMINDER, messaging.patient_phone(token) if live else None, token,
                          follow_up_step(day), live, dedupe=f"{referral_id}:{channel}:{on.isoformat()}")
    if sent["status"] != messaging.DUPLICATE:
        _event(referral_id, "REMINDER", day, channel, status=sent["status"], actor=actor, on=on)
    return sent


def _remind_family(row: Dict[str, Any], on: date) -> bool:
    """Only with her separate consent, and in neutral wording that never names a finding."""
    if not row["family_consent"] or not can_message(row):
        return False
    try:
        phone = global_vault.retrieve_pii(row["patient_token"]).get("family_phone")
    except Exception:
        phone = None
    if not phone:
        return False
    live = messaging.mode() == "twilio"
    sent = messaging.send("SMS", FAMILY_REMINDER, phone if live else None, row["patient_token"], "FAMILY", live,
                          dedupe=f"{row['referral_id']}:FAMILY:{on.isoformat()}")
    if sent["status"] == messaging.DUPLICATE:
        return False
    _event(row["referral_id"], "FAMILY_REMINDER", follow_up_day(row["referred_on"], on), "SMS", status=sent["status"], on=on)
    return True


def record_reply(referral_id: str, reply: str, actor: str) -> Dict[str, Any]:
    """A reply is recorded for staff to act on. Only confirmed arrival closes follow-up. STOP ends all messaging at once."""
    if reply not in ("VISITED", "NEEDS_HELP", "NURSE_CALL_BACK", "STOP"):
        raise ReferralError(422, "Unknown reply.")
    row = _get(referral_id)
    if reply == "STOP":
        with global_db._get_conn() as conn:
            conn.execute("UPDATE referrals SET stopped_at = ? WHERE referral_id = ?", (clinic_today().isoformat(), referral_id))
            conn.commit()
    _event(referral_id, "PATIENT_REPLY", follow_up_day(row["referred_on"]), detail=reply, actor=actor)
    _audit("REFERRAL_PATIENT_REPLY", row["patient_token"], actor, referral_id=referral_id, reply=reply)
    return _view(_get(referral_id))


def record_contact(referral_id: str, outcome: str, note: str, actor: str) -> Dict[str, Any]:
    if outcome not in ("REACHED", "NO_ANSWER", "WRONG_NUMBER"):
        raise ReferralError(422, "Unknown contact outcome.")
    row = _get(referral_id)
    _event(referral_id, f"CONTACT_{outcome}", follow_up_day(row["referred_on"]), detail=note, actor=actor)
    _audit("REFERRAL_CONTACT_ATTEMPT", row["patient_token"], actor, referral_id=referral_id, outcome=outcome)
    return _view(_get(referral_id))


def _flag_review(row: Dict[str, Any], reason: str, on: Optional[date] = None) -> None:
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET doctor_review = ?, doctor_review_note = NULL WHERE referral_id = ?", (reason, row["referral_id"]))
        conn.commit()
    _event(row["referral_id"], f"DOCTOR_REVIEW_{reason}", follow_up_day(row["referred_on"], on), on=on)
    _audit("REFERRAL_DOCTOR_REVIEW", row["patient_token"], "SYSTEM", referral_id=row["referral_id"], reason=reason)


def record_visit(referral_id: str, outcome: str, consent: Optional[str], note: str, actor: str) -> Dict[str, Any]:
    """ASHA home visit. Refusal or no contact goes to a doctor. Agreement keeps her on the way until arrival."""
    if outcome not in ("MET_PATIENT", "NOT_AT_HOME", "UNREACHABLE"):
        raise ReferralError(422, "Unknown visit outcome.")
    if consent not in (None, "POSITIVE", "NEGATIVE"):
        raise ReferralError(422, "Consent must be POSITIVE or NEGATIVE.")
    if outcome == "MET_PATIENT" and not consent:
        raise ReferralError(422, "Record her decision.")
    row = _get(referral_id)
    if row["status"] != REFERRED:
        raise ReferralError(409, "She has already reached the hospital or closed this referral.")
    decided = consent if outcome == "MET_PATIENT" else None
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET visit_outcome = ?, consent = ?, consent_note = ?, status = ? WHERE referral_id = ?",
                     (outcome, decided, note, DECLINED if decided == "NEGATIVE" else REFERRED, referral_id))
        conn.commit()
    _event(referral_id, f"VISIT_{outcome}", follow_up_day(row["referred_on"]), detail=note, actor=actor)
    if decided:
        _event(referral_id, f"CONSENT_{decided}", follow_up_day(row["referred_on"]), detail=note, actor=actor)
    _audit("REFERRAL_HOME_VISIT", row["patient_token"], actor, referral_id=referral_id, outcome=outcome, consent=decided)
    if decided == "NEGATIVE":
        _flag_review(row, "REFUSED")
    elif outcome != "MET_PATIENT":
        _flag_review(row, "NO_CONTACT")
    return _view(_get(referral_id))


def resolve_review(referral_id: str, note: str, actor: str) -> Dict[str, Any]:
    row = _get(referral_id)
    if not row["doctor_review"]:
        raise ReferralError(409, "This referral is not waiting for review.")
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET doctor_review_note = ? WHERE referral_id = ?", (note, referral_id))
        conn.commit()
    _event(referral_id, "DOCTOR_REVIEW_DONE", detail=note, actor=actor)
    _audit("REFERRAL_DOCTOR_REVIEW_DONE", row["patient_token"], actor, referral_id=referral_id)
    return _view(_get(referral_id))


def assign_asha(row: Dict[str, Any], day: int, asha_id: Optional[str] = None, actor: str = "SYSTEM", on: Optional[date] = None) -> bool:
    if row.get("assigned_asha"):
        return False
    from backend.core.staff_session import ashas_at
    available = ashas_at(row["health_post"])
    worker = asha_id if asha_id in available else (available[0] if available and not asha_id else None)
    if not worker:
        return False
    with global_db._get_conn() as conn:
        conn.execute("UPDATE referrals SET assigned_asha = ? WHERE referral_id = ? AND assigned_asha IS NULL", (worker, row["referral_id"]))
        conn.commit()
    _event(row["referral_id"], "ASHA_VISIT_ORDERED", day, detail=worker, actor=actor, on=on)
    _audit("REFERRAL_ASHA_VISIT_ORDERED", row["patient_token"], actor, referral_id=row["referral_id"], asha=worker)
    return True


def run_cycle(today: Optional[date] = None) -> Dict[str, int]:
    """One daily pass. Safe to repeat: one message per channel per day, one assignment, one review flag."""
    on = today or clinic_today()
    result = {"reminders": 0, "family_reminders": 0, "visits_ordered": 0, "reviews": 0, "skipped_no_consent": 0}
    for r in list_referrals(on):
        if not r["following"]:
            continue
        day = r["follow_up_day"]
        step = follow_up_step(day)
        if step == "ASHA_VISIT":
            if assign_asha(r, day, on=on):
                result["visits_ordered"] += 1
            if day > FOLLOW_UP_DAYS and not r["visit_outcome"] and not r["doctor_review"] and not r["consent"]:
                _flag_review(r, "NO_CONTACT", on)
                result["reviews"] += 1
            continue
        if not r["messaging_allowed"]:
            result["skipped_no_consent"] += 1
            continue
        for channel in (["SMS"] if step == "DAILY_REMINDER" else ["SMS", "VOICE"]):
            if send_reminder(r["referral_id"], "SYSTEM", channel, on)["status"] != messaging.DUPLICATE:
                result["reminders"] += 1
        if step == "INTENSIVE_CONTACT" and _remind_family(r, on):
            result["family_reminders"] += 1
    return result


def daily_summary() -> Dict[str, Any]:
    return {"as_of": clinic_today().isoformat(), **run_cycle()}


async def follow_up_loop() -> None:
    """Runs the daily pass in the background. The dedupe keys make extra runs harmless."""
    import asyncio
    hours = float(os.getenv("CERVISETU_FOLLOW_UP_INTERVAL_HOURS", "24"))
    while True:
        try:
            run_cycle()
        except Exception:
            logger.exception("Referral follow-up cycle failed")
        await asyncio.sleep(hours * 3600)


def aggregate_counts() -> Dict[str, int]:
    """Numbers only, for administrators. No names, tokens or clinical details."""
    rows = list_referrals()
    return {"referrals": sum(1 for r in rows if r["status"] != ROUTINE),
            "arrivals": sum(1 for r in rows if r["arrived_on"]),
            "in_follow_up": sum(1 for r in rows if r["following"]),
            "overdue": sum(1 for r in rows if r["following"] and r["follow_up_day"] >= FOLLOW_UP_DAYS),
            "declined": sum(1 for r in rows if r["status"] == DECLINED)}


def _sniff(data: bytes) -> Optional[str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def add_file(referral_id: str, kind: str, filename: str, data: bytes, photo_consent: bool, actor: str) -> Dict[str, Any]:
    row = _get(referral_id)
    if kind not in UPLOAD_KINDS:
        raise ReferralError(422, "Unknown report type.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ReferralError(413, "The file is larger than 10 MB.")
    content_type = _sniff(data)
    if not content_type:
        raise ReferralError(422, "Only PNG, JPEG or PDF files are accepted.")
    if kind in IMAGE_KINDS and not photo_consent:
        raise ReferralError(422, "Record her consent for photographs first.")
    file_id = secrets.token_hex(12)
    nonce = os.urandom(12)
    safe_name = "".join(c for c in os.path.basename(filename or "file") if c.isalnum() or c in "._- ")[:120] or "file"
    with global_db._get_conn() as conn:
        conn.execute("""INSERT INTO referral_files (file_id, referral_id, kind, filename, content_type, nonce, ciphertext, photo_consent, uploaded_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (file_id, referral_id, kind, safe_name, content_type, nonce, _FILE_AES.encrypt(nonce, data, file_id.encode()), int(photo_consent), actor))
        conn.commit()
    _event(referral_id, "FILE_ADDED", detail=kind, actor=actor)
    _audit("REFERRAL_FILE_ADDED", row["patient_token"], actor, referral_id=referral_id, kind=kind)
    return {"file_id": file_id, "kind": kind, "filename": safe_name, "content_type": content_type}


def list_files(referral_id: str) -> List[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT file_id, kind, filename, content_type, created_at FROM referral_files WHERE referral_id = ? ORDER BY created_at", (referral_id,)).fetchall()
    return [dict(r) for r in rows]


def read_file(referral_id: str, file_id: str) -> Tuple[bytes, str, str]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM referral_files WHERE file_id = ? AND referral_id = ?", (file_id, referral_id)).fetchone()
    if not row:
        raise ReferralError(404, "File not found.")
    return _FILE_AES.decrypt(row["nonce"], row["ciphertext"], file_id.encode()), row["content_type"], row["filename"]


VIA_IMAGES = Path(__file__).resolve().parents[1] / "seed_assets" / "via"
HOSPITALS = [("Sion Hospital", "Sion"), ("KEM Hospital", "Parel"), ("Cooper Hospital", "Juhu"), ("Sir JJ Hospital", "Byculla"),
             ("Siddharth Hospital", "Goregaon"), ("Nair Hospital", "Mumbai Central")]


# OpenStreetMap lookups for the fictional demo directory. Real deployments enter and check coordinates in the admin directory.
# Sir JJ Hospital is left out on purpose: the lookup found no match, and a guess could send someone to the wrong place.
SEED_LOCATIONS = {"Sion Hospital": (19.0348427, 72.8582305, "OpenStreetMap way 1413471846"),
                  "KEM Hospital": (19.0015510, 72.8421800, "OpenStreetMap way 113561413"),
                  "Cooper Hospital": (19.1076442, 72.8368030, "OpenStreetMap node 4109115231"),
                  "Siddharth Hospital": (19.1593521, 72.8403801, "OpenStreetMap node 6884803646 (hospital blood bank)"),
                  "Nair Hospital": (18.9730222, 72.8219132, "OpenStreetMap node 7664032237")}


def seed() -> None:
    """Fictional cases from the doctors, clearly flagged, outside production only."""
    if APP_ENV == "production":
        return
    with global_db._get_conn() as conn:
        for name, area in HOSPITALS:
            if not conn.execute("SELECT 1 FROM admin_hospitals WHERE name = ?", (name,)).fetchone():
                conn.execute("INSERT INTO admin_hospitals (hospital_id, name, hospital_type, area, services, created_by) VALUES (?, ?, 'TERTIARY_HOSPITAL', ?, '', 'SEED')",
                             (f"HOSP-{secrets.token_hex(4).upper()}", name, area))
        for name, (lat, lng, source) in SEED_LOCATIONS.items():
            conn.execute("UPDATE admin_hospitals SET latitude = ?, longitude = ?, location_source = ? WHERE name = ? AND latitude IS NULL AND created_by = 'SEED'", (lat, lng, source, name))
        # Seeded before message consent existed: these are fictional records, so mark them agreed.
        conn.execute("UPDATE referrals SET message_consent = 'GRANTED' WHERE fictional = 1 AND message_consent IS NULL")
        conn.commit()
    for case in teaching_cases.CASES:
        token = case["token"]
        if not get_for_patient(token):
            create({"patient_token": token, "patient_name": case["name"], "age": case["age"], "area": case["area"], "health_post": case["post"],
                    "screening_finding": case["finding"], "red_flags": case["red_flags"], "refer": case["refer"], "urgent": case["urgent"],
                    "message_consent": "GRANTED", "form": case["form"]}, "SEED", True,
                   clinic_today() - timedelta(days=max(case.get("ago", 1) - 1, 0)))
        row = get_for_patient(token)
        # Earlier seeds held a shorter version of these cases: bring the intake up to the doctors' sheet.
        with global_db._get_conn() as conn:
            conn.execute("UPDATE referrals SET screening_finding = ?, red_flags = ?, form_json = ? WHERE referral_id = ? AND fictional = 1",
                         (case["finding"], case["red_flags"], json.dumps(case["form"]), row["referral_id"]))
            conn.commit()
        image = next(iter(sorted(VIA_IMAGES.glob(f"{case['key']}.*"))), None)
        if image and not any(f["kind"] == "VIA_IMAGE" for f in list_files(row["referral_id"])):
            add_file(row["referral_id"], "VIA_IMAGE", f"VIA {case['name']}{image.suffix}", image.read_bytes(), True, "SEED")
    rita = get_for_patient("PT-CASE-RITA")
    if rita and rita["status"] == REFERRED:
        confirm_arrival(rita["referral_id"], "SEED")
    if rita and rita["status"] in (ARRIVED, REPORT) and rita.get("treatment_plan") != teaching_cases.BY_TOKEN["PT-CASE-RITA"]["plan"]:
        case = teaching_cases.BY_TOKEN["PT-CASE-RITA"]
        record_clinical(rita["referral_id"], {"colposcopy": case["colposcopy"]["impression"], "colposcopy_findings": case["colposcopy"], "biopsy": case["biopsy"],
                                              "histopathology": case["histopathology"], "mri": case["mri"], "final_diagnosis": case["final_diagnosis"],
                                              "treatment_plan": case["plan"]}, "SEED")
        if rita["status"] == ARRIVED:
            update_status(rita["referral_id"], REPORT, "SEED")
