"""District authority escalation with a person in the loop.

Personal details stay in the vault until an authorised clinician approves a case and generates the dossier;
each step is recorded in the audit chain. Approving does not send anything: staff hand the dossier to the
district office and then record that they did.
"""
import html
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.core.database import global_db
from backend.core.security import global_audit, global_vault

PENDING, APPROVED, DECLINED, SENT = "PENDING_REVIEW", "APPROVED", "DECLINED", "SENT_TO_DISTRICT"

with global_db._get_conn() as _conn:
    _conn.execute("""CREATE TABLE IF NOT EXISTS authority_cases (
        case_id TEXT PRIMARY KEY, patient_token TEXT NOT NULL, diagnosis TEXT, days_overdue INTEGER, reason TEXT,
        status TEXT NOT NULL, decided_by TEXT, decided_at TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    _conn.commit()


class CaseError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def raise_case(token: str, diagnosis: str, days_overdue: int, reason: str) -> Dict[str, Any]:
    """Open a review case, or return the one already open for this patient."""
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM authority_cases WHERE patient_token = ? AND status IN (?, ?)", (token, PENDING, APPROVED)).fetchone()
        if row:
            return dict(row)
        case_id = f"DIST-{secrets.token_hex(4).upper()}"
        conn.execute("INSERT INTO authority_cases (case_id, patient_token, diagnosis, days_overdue, reason, status) VALUES (?, ?, ?, ?, ?, ?)",
                     (case_id, token, diagnosis, days_overdue, reason, PENDING))
        conn.commit()
    global_audit.record_event(action="AUTHORITY_CASE_RAISED", actor="ESCALATION_ENGINE", patient_token=token,
                              details={"case_id": case_id, "reason": reason}, severity="WARNING")
    return get_case(case_id)


def get_case(case_id: str) -> Dict[str, Any]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM authority_cases WHERE case_id = ?", (case_id,)).fetchone()
    if not row:
        raise CaseError(404, "Case not found")
    return dict(row)


def list_cases(limit: int = 50) -> List[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM authority_cases ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def _transition(case_id: str, allowed_from: tuple, new_status: str, actor: str, action: str) -> Dict[str, Any]:
    case = get_case(case_id)
    if case["status"] not in allowed_from:
        raise CaseError(409, "This case has already moved on.")
    with global_db._get_conn() as conn:
        conn.execute("UPDATE authority_cases SET status = ?, decided_by = ?, decided_at = ? WHERE case_id = ?",
                     (new_status, actor, datetime.now(timezone.utc).isoformat(), case_id))
        conn.commit()
    global_audit.record_event(action=action, actor=actor, patient_token=case["patient_token"], details={"case_id": case_id},
                              severity="CRITICAL" if new_status == APPROVED else "INFO")
    return get_case(case_id)


def approve(case_id: str, actor: str) -> Dict[str, Any]:
    return _transition(case_id, (PENDING,), APPROVED, actor, "AUTHORITY_CASE_APPROVED")


def decline(case_id: str, actor: str) -> Dict[str, Any]:
    return _transition(case_id, (PENDING,), DECLINED, actor, "AUTHORITY_CASE_DECLINED")


def mark_sent(case_id: str, actor: str) -> Dict[str, Any]:
    return _transition(case_id, (APPROVED,), SENT, actor, "AUTHORITY_DOSSIER_SENT")


def dossier_html(case_id: str, actor: str) -> str:
    """Printable dossier with the minimum details needed to reach the patient. Every viewing is audited."""
    case = get_case(case_id)
    if case["status"] not in (APPROVED, SENT):
        raise CaseError(403, "A clinician must approve this case first.")
    pii: Dict[str, Any] = {}
    try:
        pii = global_vault.retrieve_pii(case["patient_token"])
    except Exception:
        pass
    global_audit.record_event(action="AUTHORITY_DOSSIER_UNMASKED", actor=actor, patient_token=case["patient_token"],
                              details={"case_id": case_id}, severity="CRITICAL")
    missing = "Not on record"
    address = pii.get("full_address") or ", ".join(x for x in (pii.get("village"), pii.get("district")) if x) or missing
    rows = [("Case", case_id), ("Patient token", case["patient_token"]), ("Name", pii.get("full_name") or pii.get("name") or missing),
            ("Phone", pii.get("phone") or pii.get("mobile") or missing), ("Address", address),
            ("Guardian", pii.get("guardian_name") or missing), ("Guardian phone", pii.get("guardian_phone") or missing),
            ("Diagnosis", case["diagnosis"] or missing), ("Missed days", str(case["days_overdue"])), ("Reason", case["reason"] or missing),
            ("Approved by", case["decided_by"] or missing), ("Approved at", case["decided_at"] or missing)]
    body = "".join(f"<tr><th>{html.escape(k)}</th><td>{html.escape(str(v))}</td></tr>" for k, v in rows)
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>District escalation {html.escape(case_id)}</title>
<style>body{{font-family:Arial,'Noto Sans',sans-serif;margin:32px;color:#111}}table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid #bbb;padding:8px;text-align:left;font-size:14px}}th{{width:30%;background:#f4f4f4}}
button{{margin-top:16px;padding:8px 16px}}@media print{{button{{display:none}}}}</style></head><body>
<h1>District Health Authority Escalation</h1><p>Confidential. Contains personal health information. Share only with the District Chief Medical Officer's office.</p>
<table>{body}</table><p>Treatment must complete within 56 days for the best chance of cure. Please arrange welfare contact and transport support.</p>
<button onclick="window.print()">Print or save as PDF</button></body></html>"""
