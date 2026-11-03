"""Automatic missed-visit escalation cycle: advances overdue patients through the 4-tier safety net.

Runs once a day in the background (and on demand via /api/escalation/run-cycle for demos).
Patients on an approved CCRT plan are evaluated from the real treatment clock (missed sessions
derived from dates). Diagnostic follow-ups without a plan keep the legacy day counter.
Paused clinic-wide while the LINAC is down so machine downtime never triggers false escalations.
"""
import asyncio
import logging
import os
import secrets
from datetime import date
from typing import Any, Dict, List, Optional

from backend.core.database import global_db
from backend.core.security import global_audit, global_vault
from backend.tools.tracker_tools import TrackerTriageEngine

logger = logging.getLogger(__name__)

ESCALATION_INTERVAL_HOURS = float(os.getenv("CERVISETU_ESCALATION_INTERVAL_HOURS", "24"))


def _open_trackers() -> List[Dict[str, Any]]:
    """Latest unresolved follow-up tracker per patient, joined with its case details."""
    with global_db._get_conn() as conn:
        rows = conn.execute("""
            SELECT f.tracker_id, f.patient_token, f.case_id, f.days_overdue, f.last_reminder_tier,
                   c.cancer_type, c.suspected_stage, c.intake_json
            FROM follow_up_tracker f
            LEFT JOIN clinical_cases c ON c.case_id = f.case_id
            WHERE f.is_resolved = 0
              AND f.last_updated = (SELECT MAX(last_updated) FROM follow_up_tracker f2 WHERE f2.patient_token = f.patient_token)
        """).fetchall()
    return [dict(r) for r in rows]


def run_escalation_cycle(advance_days: int = 1, as_of: Optional[date] = None) -> Dict[str, Any]:
    """Evaluate every active treatment plan from its clock, then advance legacy follow-up counters."""
    from backend.config import clinic_today
    from backend.tools.clock_service import evaluate_plan

    as_of = as_of or clinic_today()
    if global_db.is_linac_downtime_active():
        return {"status": "PAUSED_LINAC_DOWNTIME", "advance_days": advance_days, "as_of_date": as_of.isoformat(),
                "escalations": [], "treatment_plans": []}

    plans = global_db.list_treatment_plans(status="ACTIVE")
    clock_results = [evaluate_plan(p, as_of) for p in plans]
    on_clock = {p["patient_token"] for p in plans}

    escalations = []
    for t in _open_trackers():
        if t["patient_token"] in on_clock:
            continue  # driven by the treatment clock above, not the day counter
        days = (t["days_overdue"] or 0) + advance_days
        tier, dispatched, _dossier = TrackerTriageEngine.evaluate_and_escalate(
            patient_token=t["patient_token"],
            cancer_type=t["cancer_type"] or "CERVICAL",
            stage=t["suspected_stage"] or "Unknown",
            biopsy_status="POSITIVE",
            symptoms=[],
            days_overdue=days,
            vault=global_vault,
        )

        new_tier = tier != t["last_reminder_tier"]
        if new_tier:
            # Only the newly reached tier is sent, so a daily run never re-sends earlier reminders
            for n in dispatched[-1:]:
                global_db.log_notification(
                    notif_id=f"NOTIF-{secrets.token_hex(4).upper()}",
                    patient_token=t["patient_token"],
                    tier=n.tier,
                    channel=n.channel,
                    recipient_role=n.recipient_role,
                    message_content=n.message_content,
                    timestamp=n.timestamp,
                )
            if tier and "TIER_3" in tier:
                _open_asha_ticket(t["patient_token"], days)

        global_db.update_follow_up(
            tracker_id=t["tracker_id"],
            patient_token=t["patient_token"],
            case_id=t["case_id"],
            due_date="Overdue" if days > 0 else "Scheduled",
            days_overdue=days,
            last_reminder_tier=tier,
        )
        escalations.append({"patient_token": t["patient_token"], "days_overdue": days, "tier": tier,
                            "newly_escalated": new_tier, "source": "LEGACY_FOLLOWUP_COUNTER"})

    global_audit.record_event(
        action="AUTO_ESCALATION_CYCLE",
        actor="ESCALATION_SCHEDULER",
        patient_token="CLINIC_WIDE",
        details={"advance_days": advance_days, "as_of_date": as_of.isoformat(),
                 "treatment_plans": len(clock_results),
                 "clock_newly_escalated": sum(bool(r["newly_escalated_tiers"]) for r in clock_results),
                 "patients": len(escalations),
                 "newly_escalated": sum(e["newly_escalated"] for e in escalations)},
    )
    return {"status": "COMPLETED", "advance_days": advance_days, "as_of_date": as_of.isoformat(),
            "treatment_plans": clock_results, "escalations": escalations, "dispatch_mode": "SIMULATED"}


def _open_asha_ticket(patient_token: str, days_missed: int, current_step: int = 0) -> None:
    """Stigma-safe ASHA ticket: first name only, details come from the encrypted vault."""
    try:
        pii = global_vault.retrieve_pii(patient_token)
    except Exception:
        pii = {}
    names = pii.get("extracted_names") or []
    first_name = names[0].split()[0] if names else "Patient"
    global_db.create_asha_ticket(
        ticket_id=f"ASHA-{secrets.token_hex(4).upper()}",
        patient_token=patient_token,
        asha_worker_id="ASHA-AUTO",
        patient_first_name=first_name,
        guardian_name=pii.get("guardian_name", ""),
        village=pii.get("village", ""),
        landmark="",
        contact_phone=(pii.get("extracted_phones") or [""])[0],
        days_missed=days_missed,
        current_step=current_step,
        delay_root_cause="Auto-escalated: missed visits",
    )


async def escalation_loop() -> None:
    """Background task: run one cycle per interval for the lifetime of the server."""
    while True:
        await asyncio.sleep(ESCALATION_INTERVAL_HOURS * 3600)
        try:
            run_escalation_cycle(advance_days=1)
        except Exception as e:
            logger.warning("Escalation cycle failed: %s", e)
