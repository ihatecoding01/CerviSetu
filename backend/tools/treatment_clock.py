"""Date-driven CCRT overall-treatment-time (OTT) clock engine.

Pure functions only: no database, HTTP or wall-clock access. Callers pass `today` explicitly
so results are deterministic and testable.

Conventions
-----------
* Dates are clinic-local calendar dates (see CLINIC_TIMEZONE in backend.config).
* The plan start date is treatment day 0; the next calendar date is day 1.
  A course whose last session falls on day 45 therefore has an OTT of 45 days under this
  convention (the published 49/56-day limits are applied to the same day number).
* Sessions are delivered in order: all external-beam (EBRT) sessions, then brachytherapy.
* A scheduled slot is a configured treatment weekday that is not a planned rest date, a
  facility-downtime date or a clinician-approved pause date. Brachytherapy slots also respect
  the configured gap after the last EBRT session and the interval between brachy sessions.
* A completed session always counts on the date it was given. A completion on a date that
  was not a scheduled slot is reported as RESCHEDULED (make-up session).
* A past scheduled slot with no completion is PATIENT_MISSED. Today's slot is only missed if
  explicitly recorded as a no-show; otherwise it is still upcoming.
* The projection plans every remaining session onto the next future slots.

This is a scheduling/operational support tool. It does not make clinical decisions: plans,
pauses and schedule changes must come from clinician-approved records.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, FrozenSet, Iterable, List, Mapping, Optional

# Event types used in the per-date timeline
PATIENT_COMPLETED = "PATIENT_COMPLETED"
PATIENT_MISSED = "PATIENT_MISSED"
FACILITY_DOWNTIME = "FACILITY_DOWNTIME"
CLINICIAN_APPROVED_PAUSE = "CLINICIAN_APPROVED_PAUSE"
PLANNED_REST = "PLANNED_REST"
SCHEDULED = "SCHEDULED"
RESCHEDULED = "RESCHEDULED"

EXCLUSION_TYPES = (FACILITY_DOWNTIME, CLINICIAN_APPROVED_PAUSE)

# Clock states (non-ACTIVE states are returned instead of forcing an OPTIMAL/WARNING/BREACH_RISK status)
NO_PLAN = "NO_PLAN"
NOT_STARTED = "NOT_STARTED"
ACTIVE = "ACTIVE"
PAUSED = "PAUSED"
COMPLETED = "COMPLETED"
INCOMPLETE_SCHEDULE = "INCOMPLETE_SCHEDULE"

OPTIMAL = "OPTIMAL"
WARNING = "WARNING"
BREACH_RISK = "BREACH_RISK"

# Safety bound so a misconfigured plan (e.g. no treatment weekdays) cannot loop forever
MAX_SCHEDULE_DAYS = 400


@dataclass(frozen=True)
class PlanConfig:
    """Clinician-approved regimen. Defaults describe the sample CCRT regimen, not a universal one."""

    start_date: date
    ebrt_sessions: int = 25
    brachy_sessions: int = 4
    treatment_weekdays: FrozenSet[int] = frozenset({0, 1, 2, 3, 4})  # Monday=0
    brachy_gap_days: int = 3        # earliest first brachy = last EBRT date + gap
    brachy_interval_days: int = 3   # earliest next brachy = previous brachy + interval
    rest_dates: FrozenSet[date] = frozenset()
    target_days: int = 49
    limit_days: int = 56

    @property
    def total_sessions(self) -> int:
        return self.ebrt_sessions + self.brachy_sessions


@dataclass
class _Walk:
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    missed: List[date] = field(default_factory=list)
    finish: Optional[date] = None
    consumed: int = 0


def escalation_tiers(consecutive_missed: int, policy: Mapping[str, int], high_risk: bool) -> List[str]:
    """Escalation tiers reached by a run of consecutive patient-attributable missed sessions."""
    tiers = []
    if consecutive_missed >= policy["tier_1_sms_days"]:
        tiers.append("TIER_1_SMS")
    if consecutive_missed >= policy["tier_2_ivr_days"]:
        tiers.append("TIER_2_IVR")
    if consecutive_missed >= policy["tier_3_asha_days"]:
        tiers.append("TIER_3_ASHA")
    if consecutive_missed >= policy["tier_4_authority_days"] and high_risk:
        tiers.append("TIER_4_AUTHORITY_ESCALATION")
    return tiers


def classify(projected_day: int, target_days: int, limit_days: int) -> str:
    if projected_day <= target_days:
        return OPTIMAL
    if projected_day <= limit_days:
        return WARNING
    return BREACH_RISK


def _walk(
    plan: PlanConfig,
    completed_dates: FrozenSet[date],
    exclusions: Mapping[date, str],
    no_shows: FrozenSet[date],
    today: date,
) -> _Walk:
    w = _Walk()
    last_ebrt: Optional[date] = None
    next_brachy_min: Optional[date] = None
    d = plan.start_date
    end = plan.start_date + timedelta(days=MAX_SCHEDULE_DAYS)

    while w.consumed < plan.total_sessions and d <= end:
        in_brachy = w.consumed >= plan.ebrt_sessions
        if in_brachy and next_brachy_min is None:
            next_brachy_min = last_ebrt + timedelta(days=plan.brachy_gap_days)

        is_weekday = d.weekday() in plan.treatment_weekdays
        phase_ok = not in_brachy or d >= next_brachy_min
        excluded_type = PLANNED_REST if d in plan.rest_dates else exclusions.get(d)
        is_slot = is_weekday and phase_ok and excluded_type is None
        number = w.consumed + 1
        phase = "BRACHY" if in_brachy else "EBRT"

        if d in completed_dates:
            w.consumed += 1
            w.timeline.append({"date": d, "event": PATIENT_COMPLETED if is_slot else RESCHEDULED,
                               "session_number": number, "phase": phase})
        elif is_slot and (d < today or (d == today and d in no_shows)):
            w.missed.append(d)
            w.timeline.append({"date": d, "event": PATIENT_MISSED, "session_number": None, "phase": phase})
            if in_brachy:
                next_brachy_min = d + timedelta(days=1)
            d += timedelta(days=1)
            continue
        elif is_slot:
            w.consumed += 1
            w.timeline.append({"date": d, "event": SCHEDULED, "session_number": number, "phase": phase})
        else:
            if is_weekday and phase_ok and excluded_type:
                w.timeline.append({"date": d, "event": excluded_type, "session_number": None, "phase": phase})
            d += timedelta(days=1)
            continue

        # A session was given or planned on `d`
        if w.consumed == plan.ebrt_sessions:
            last_ebrt = d
        elif in_brachy:
            next_brachy_min = d + timedelta(days=plan.brachy_interval_days)
        if w.consumed == plan.total_sessions:
            w.finish = d
        d += timedelta(days=1)

    return w


def compute_clock(
    plan: Optional[PlanConfig],
    completed_dates: Iterable[date],
    exclusions: Optional[Mapping[date, str]] = None,
    no_shows: Iterable[date] = (),
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """Recalculate the full clock state from source records. Never persists anything."""
    if plan is None:
        return {"clock_state": NO_PLAN, "clock_status": NO_PLAN}
    if today is None:
        raise ValueError("today must be passed explicitly")

    exclusions = dict(exclusions or {})
    completed = frozenset(completed_dates)
    w = _walk(plan, completed, exclusions, frozenset(no_shows), today)

    completed_count = sum(1 for e in w.timeline if e["event"] in (PATIENT_COMPLETED, RESCHEDULED))
    last_completed = max(completed) if completed else None
    # Consecutive patient-attributable misses since the most recent completed session
    streak = [m for m in w.missed if last_completed is None or m > last_completed]

    result: Dict[str, Any] = {
        "start_date": plan.start_date.isoformat(),
        "as_of_date": today.isoformat(),
        "treatment_day_today": (today - plan.start_date).days,
        "day_convention": "start_date is treatment day 0",
        "total_sessions": plan.total_sessions,
        "ebrt_sessions_planned": plan.ebrt_sessions,
        "brachy_sessions_planned": plan.brachy_sessions,
        "completed_sessions": completed_count,
        "ebrt_completed": min(completed_count, plan.ebrt_sessions),
        "brachy_completed": max(0, completed_count - plan.ebrt_sessions),
        "remaining_sessions": plan.total_sessions - completed_count,
        "missed_sessions": len(w.missed),
        "missed_dates": [m.isoformat() for m in w.missed],
        "consecutive_missed_sessions": len(streak),
        "missed_streak_start_date": streak[0].isoformat() if streak else None,
        "target_days": plan.target_days,
        "limit_days": plan.limit_days,
        "upcoming_sessions": [
            {"date": e["date"].isoformat(), "session_number": e["session_number"], "phase": e["phase"]}
            for e in w.timeline if e["event"] == SCHEDULED
        ][:5],
        "schedule_exceptions": [
            {"date": e["date"].isoformat(), "event": e["event"]}
            for e in w.timeline if e["event"] in (FACILITY_DOWNTIME, CLINICIAN_APPROVED_PAUSE, PLANNED_REST)
        ],
        "timeline": [
            {"date": e["date"].isoformat(), "event": e["event"],
             "session_number": e["session_number"], "phase": e["phase"]}
            for e in w.timeline
        ],
    }

    if w.finish is None:
        result.update(projected_finish_date=None, projected_finish_day=None, days_until_projected_finish=None,
                      target_49d_status=None, limit_56d_status=None,
                      clock_state=INCOMPLETE_SCHEDULE, clock_status=INCOMPLETE_SCHEDULE)
        return result

    finish_day = (w.finish - plan.start_date).days
    band = classify(finish_day, plan.target_days, plan.limit_days)
    result.update(
        projected_finish_date=w.finish.isoformat(),
        projected_finish_day=finish_day,
        days_until_projected_finish=(w.finish - today).days,
        target_49d_status="WITHIN_TARGET" if finish_day <= plan.target_days else "EXCEEDS_TARGET",
        limit_56d_status="WITHIN_LIMIT" if finish_day <= plan.limit_days else "EXCEEDS_LIMIT",
        projection_band=band,
    )

    if completed_count >= plan.total_sessions:
        state, status = COMPLETED, COMPLETED
    elif today < plan.start_date:
        state, status = NOT_STARTED, NOT_STARTED
    elif exclusions.get(today) == CLINICIAN_APPROVED_PAUSE:
        state, status = PAUSED, PAUSED
    else:
        state, status = ACTIVE, band
    result.update(clock_state=state, clock_status=status)
    return result
