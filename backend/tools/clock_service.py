"""Connects the pure treatment clock engine to stored plans, sessions, exceptions and escalation.

Every call recomputes the clock from source records, so there is no cached progress to drift.
SMS and voice go through backend.tools.messaging: simulated unless a provider and approved numbers are configured.
"""
import json
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from backend.config import CLINIC_TIMEZONE, ESCALATION_POLICY, SEVERITY_THRESHOLDS, clinic_today
from backend.core.database import global_db
from backend.core.security import global_audit, global_vault
from backend.tools import treatment_clock as tc
from backend.tools.tracker_tools import (
    CancerRiskScorerTool,
    CommunityWorkerDispatchTool,
    EmergencyAuthorityEscalationTool,
    MultiChannelReminderTool,
)

NO_SHOW = "PATIENT_NO_SHOW"
TIER_ORDER = ["TIER_1_SMS", "TIER_2_IVR", "TIER_3_ASHA", "TIER_4_AUTHORITY_ESCALATION"]


class ClockError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def plan_config(plan: Dict[str, Any]) -> tc.PlanConfig:
    return tc.PlanConfig(
        start_date=date.fromisoformat(plan["start_date"]),
        ebrt_sessions=plan["ebrt_sessions"],
        brachy_sessions=plan["brachy_sessions"],
        treatment_weekdays=frozenset(int(x) for x in plan["treatment_weekdays"].split(",") if x != ""),
        brachy_gap_days=plan["brachy_gap_days"],
        brachy_interval_days=plan["brachy_interval_days"],
        rest_dates=frozenset(date.fromisoformat(d) for d in json.loads(plan["rest_dates"] or "[]")),
        target_days=plan["target_days"],
        limit_days=plan["limit_days"],
    )


def _clinic_date(utc_timestamp: str) -> date:
    """SQLite CURRENT_TIMESTAMP values are UTC; convert to the clinic's calendar date."""
    dt = datetime.fromisoformat(utc_timestamp)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CLINIC_TIMEZONE).date()


def _exclusions(plan: Dict[str, Any], today: date):
    """Dates with no patient-attributable slot (downtime, approved pauses) plus explicit no-shows."""
    start = date.fromisoformat(plan["start_date"])
    exclusions: Dict[date, str] = {}
    no_shows = set()
    for e in global_db.get_schedule_exceptions(plan["plan_id"], plan["facility_name"]):
        d = date.fromisoformat(e["exception_date"])
        if e["exception_type"] == NO_SHOW:
            no_shows.add(d)
        else:
            exclusions.setdefault(d, e["exception_type"])
    # LINAC downtime toggled from the clinic dashboard counts for every calendar day it was active
    for period in global_db.get_linac_downtime_periods(plan["facility_name"]):
        first = max(_clinic_date(period["started_at"]), start)
        last = min(_clinic_date(period["ended_at"]) if period["ended_at"] else today, today)
        d = first
        while d <= last:
            exclusions.setdefault(d, tc.FACILITY_DOWNTIME)
            d += timedelta(days=1)
    return exclusions, no_shows


def _current_tier(plan_id: str, episode_start: Optional[str]) -> Optional[str]:
    if not episode_start:
        return None
    tiers = [e["tier"] for e in global_db.get_treatment_escalations(plan_id) if e["episode_start_date"] == episode_start]
    return max(tiers, key=TIER_ORDER.index) if tiers else None


def build_clock(plan: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    today = today or clinic_today()
    completed = [date.fromisoformat(s["session_date"])
                 for s in global_db.get_treatment_sessions(plan["plan_id"]) if s["status"] == "COMPLETED"]
    exclusions, no_shows = _exclusions(plan, today)
    clock = tc.compute_clock(plan_config(plan), completed, exclusions, no_shows, today)
    clock.update(
        plan_id=plan["plan_id"],
        patient_token=plan["patient_token"],
        plan_status=plan["status"],
        regimen_label=plan["regimen_label"],
        facility_name=plan["facility_name"],
        approved_by=plan["approved_by"],
        current_escalation_tier=_current_tier(plan["plan_id"], clock.get("missed_streak_start_date")),
        clock_source="TREATMENT_CLOCK",
    )
    return clock


def get_patient_clock(token: str, today: Optional[date] = None) -> Dict[str, Any]:
    plan = global_db.get_treatment_plan(token)
    if not plan:
        return {"patient_token": token, "clock_state": tc.NO_PLAN, "clock_status": tc.NO_PLAN,
                "clock_source": "TREATMENT_CLOCK",
                "detail": "Clock starts only when a clinician approves a CCRT treatment plan."}
    return build_clock(plan, today)


def healing_clock_view(token: str) -> Dict[str, Any]:
    """Legacy /healing-clock shape. Real plans drive it; seeded demo patients keep their demo values."""
    plan = global_db.get_treatment_plan(token)
    if plan:
        c = build_clock(plan)
        day = c.get("projected_finish_day")
        return {
            "patient_token": token,
            "ebrt_start_date": c["start_date"],
            "ebrt_fractions_completed": c["ebrt_completed"],
            "brachy_fractions_completed": c["brachy_completed"],
            "total_steps_completed": c["completed_sessions"],
            "total_steps": c["total_sessions"],
            "projected_finish_days": day,
            "clock_target_49d_status": "OPTIMAL" if day is not None and day <= c["target_days"] else "EXCEEDED",
            "clock_limit_56d_status": "ON_TRACK" if day is not None and day <= c["limit_days"] else "BREACH_RISK",
            "is_completed": int(c["clock_state"] == tc.COMPLETED),
            "clock_status": c["clock_status"],
            "clock_source": "TREATMENT_CLOCK",
        }
    with global_db._get_conn() as conn:
        legacy = conn.execute("SELECT * FROM patient_healing_clock WHERE patient_token = ?", (token,)).fetchone()
    if legacy:
        return {**dict(legacy), "clock_source": "LEGACY_DEMO"}
    return {
        "patient_token": token, "ebrt_start_date": None, "ebrt_fractions_completed": 0,
        "brachy_fractions_completed": 0, "total_steps_completed": 0, "projected_finish_days": None,
        "clock_target_49d_status": tc.NOT_STARTED, "clock_limit_56d_status": tc.NOT_STARTED,
        "is_completed": 0, "clock_status": tc.NO_PLAN, "clock_source": "TREATMENT_CLOCK",
    }


def _is_high_risk(token: str) -> bool:
    case = global_db.get_latest_case(token) or {}
    stage = case.get("suspected_stage") or ""
    score, _ = CancerRiskScorerTool.evaluate_risk(case.get("cancer_type") or "CERVICAL", stage, "POSITIVE", [])
    return score >= SEVERITY_THRESHOLDS["high_risk_cutoff"] or "stage iii" in stage.lower() or "stage iv" in stage.lower()


def _dispatch(tier: str, token: str, streak: int):
    case = global_db.get_latest_case(token) or {}
    cancer, stage = case.get("cancer_type") or "CERVICAL", case.get("suspected_stage") or "Unknown"
    if tier == "TIER_1_SMS":
        return MultiChannelReminderTool.dispatch_tier_1_sms(token, live=True)
    if tier == "TIER_2_IVR":
        return MultiChannelReminderTool.dispatch_tier_2_ivr(token, live=True)
    score, _ = CancerRiskScorerTool.evaluate_risk(cancer, stage, "POSITIVE", [])
    if tier == "TIER_3_ASHA":
        return CommunityWorkerDispatchTool.dispatch_asha_visit(token, cancer, score, vault=global_vault)
    notif, _dossier = EmergencyAuthorityEscalationTool.generate_authority_escalation_dossier(
        token, cancer, stage, score, streak, vault=global_vault)
    return notif


def evaluate_plan(plan: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    """Detect missed sessions and dispatch newly reached escalation tiers. Safe to run repeatedly."""
    today = today or clinic_today()
    token = plan["patient_token"]
    clock = build_clock(plan, today)

    for d in global_db.sync_missed_sessions(plan["plan_id"], token, clock["missed_dates"]):
        global_audit.record_event(action="PATIENT_MISSED_SESSION_DETECTED", actor="TREATMENT_CLOCK",
                                  patient_token=token, details={"plan_id": plan["plan_id"], "missed_date": d})

    if clock["clock_state"] == tc.COMPLETED and plan["status"] == "ACTIVE":
        global_db.set_treatment_plan_status(plan["plan_id"], "COMPLETED")
        global_audit.record_event(action="CCRT_COURSE_COMPLETED", actor="TREATMENT_CLOCK", patient_token=token,
                                  details={"plan_id": plan["plan_id"], "finish_day": clock["projected_finish_day"]})

    streak = clock["consecutive_missed_sessions"]
    paused = global_db.is_linac_downtime_active(plan["facility_name"])
    newly = []
    if streak and not paused and clock["clock_state"] == tc.ACTIVE:
        for tier in tc.escalation_tiers(streak, ESCALATION_POLICY, _is_high_risk(token)):
            if global_db.record_treatment_escalation(plan["plan_id"], token, clock["missed_streak_start_date"], tier, streak):
                newly.append(tier)
    if newly:
        # Earlier tiers reached in the same run are recorded but only the highest one is sent
        notif = _dispatch(newly[-1], token, streak)
        global_db.log_notification(
            notif_id=f"NOTIF-{secrets.token_hex(4).upper()}", patient_token=token, tier=notif.tier,
            channel=f"{notif.channel} (SIMULATED)", recipient_role=notif.recipient_role,
            message_content=notif.message_content, timestamp=notif.timestamp,
        )
        if "TIER_3_ASHA" in newly:
            from backend.tools.escalation_scheduler import _open_asha_ticket
            _open_asha_ticket(token, streak, clock["completed_sessions"])
        global_audit.record_event(action="TREATMENT_CLOCK_ESCALATION", actor="TREATMENT_CLOCK", patient_token=token,
                                  details={"plan_id": plan["plan_id"], "tiers": newly, "missed_streak": streak,
                                           "dispatch_mode": "SIMULATED"})

    return {
        "patient_token": token,
        "plan_id": plan["plan_id"],
        "clock_status": clock["clock_status"],
        "projected_finish_day": clock["projected_finish_day"],
        "missed_sessions": clock["missed_sessions"],
        "consecutive_missed_sessions": streak,
        "newly_escalated_tiers": newly,
        "escalation_paused_for_downtime": bool(streak and paused),
        "dispatch_mode": "SIMULATED",
    }


def log_session(
    token: str, session_number: int, session_date: Optional[str], status: str,
    recorded_by: str, machine_id: Optional[str], dose_gy: Optional[float], today: Optional[date] = None,
) -> Dict[str, Any]:
    """Record a delivered (or cancelled) session against the active plan and recompute the clock."""
    today = today or clinic_today()
    plan = global_db.get_treatment_plan(token)
    if not plan:
        raise ClockError(404, "NO_ACTIVE_TREATMENT_PLAN")
    if plan["status"] != "ACTIVE":
        raise ClockError(409, "Treatment course is already completed")
    try:
        when = date.fromisoformat(session_date) if session_date else today
    except ValueError:
        raise ClockError(422, "session_date must be YYYY-MM-DD")
    cfg = plan_config(plan)
    if when > today:
        raise ClockError(400, "Cannot record a session in the future")
    if when < cfg.start_date:
        raise ClockError(400, "Session date is before the plan start date")
    if not 1 <= session_number <= cfg.total_sessions:
        raise ClockError(400, f"session_number must be between 1 and {cfg.total_sessions}")
    if status not in ("COMPLETED", "CANCELLED"):
        raise ClockError(422, "session_status must be COMPLETED or CANCELLED")

    done = [s for s in global_db.get_treatment_sessions(plan["plan_id"]) if s["status"] == "COMPLETED"]
    if status == "COMPLETED":
        same = next((s for s in done if s["session_number"] == session_number), None)
        if same and same["session_date"] == when.isoformat():
            return {"duplicate": True, "session_id": same["session_id"], "clock": build_clock(plan, today)}
        if same:
            raise ClockError(409, f"Session {session_number} was already recorded on {same['session_date']}")
        if any(s["session_date"] == when.isoformat() for s in done):
            raise ClockError(409, f"A session was already recorded on {when.isoformat()}")
        if session_number != len(done) + 1:
            raise ClockError(400, f"Next session to record is {len(done) + 1}")
        if done and when.isoformat() < max(s["session_date"] for s in done):
            raise ClockError(400, "Session date is earlier than the last recorded session")

    try:
        session_id = global_db.record_treatment_session(
            plan["plan_id"], token, session_number, when.isoformat(), status, recorded_by, machine_id, dose_gy)
    except sqlite3.IntegrityError:
        raise ClockError(409, "Duplicate session record")

    escalation = evaluate_plan(plan, today)
    plan = global_db.get_treatment_plan(token) or plan
    return {"duplicate": False, "session_id": session_id, "clock": build_clock(plan, today), "escalation": escalation}
