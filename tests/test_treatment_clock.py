"""Tests for the date-driven CCRT treatment clock: pure engine (fixed dates) and API integration."""
import secrets
from datetime import date, timedelta

from fastapi.testclient import TestClient

from backend.config import ESCALATION_POLICY, clinic_today
from backend.core.database import global_db
from backend.dashboard.app import app
from backend.graph.workflow import clinical_graph
from backend.tools import treatment_clock as tc

client = TestClient(app)

MONDAY = date(2026, 1, 5)
PLAN = tc.PlanConfig(start_date=MONDAY)  # sample regimen: 25 EBRT + 4 brachy, Mon-Fri


def _scheduled(plan, completed=(), exclusions=None, today=MONDAY):
    clock = tc.compute_clock(plan, completed, exclusions or {}, today=today)
    return [date.fromisoformat(e["date"]) for e in clock["timeline"] if e["event"] == tc.SCHEDULED]


def _attend_all_but(plan, skip_slots, today):
    """Attend every slot in order except the first `skip_slots` slots on or after day 1."""
    completed, missed = [], 0
    d = plan.start_date
    while len(completed) < plan.total_sessions and d < today:
        slots = _scheduled(plan, completed, today=d)
        if not slots or slots[0] != d:
            d += timedelta(days=1)
            continue
        if missed < skip_slots and d > plan.start_date:
            missed += 1
        else:
            completed.append(d)
        d += timedelta(days=1)
    return completed


# ---------- pure engine ----------

def test_new_plan_has_no_fabricated_progress():
    c = tc.compute_clock(PLAN, [], today=MONDAY)
    assert c["completed_sessions"] == 0
    assert c["missed_sessions"] == 0
    assert c["clock_state"] == tc.ACTIVE
    assert c["projected_finish_day"] == 45  # projected from the generated schedule, not a default
    assert c["clock_status"] == tc.OPTIMAL


def test_perfect_attendance_finishes_day_45_and_completes():
    done = _scheduled(PLAN)
    c = tc.compute_clock(PLAN, done, today=MONDAY + timedelta(days=60))
    assert c["completed_sessions"] == 29
    assert c["projected_finish_day"] == 45
    assert c["clock_state"] == tc.COMPLETED
    assert c["target_49d_status"] == "WITHIN_TARGET"


def test_six_missed_sessions_move_past_49_days():
    today = MONDAY + timedelta(days=20)
    done = _attend_all_but(PLAN, 6, today)
    c = tc.compute_clock(PLAN, done, today=today)
    assert c["missed_sessions"] == 6
    assert c["projected_finish_day"] > 49
    assert c["clock_status"] in (tc.WARNING, tc.BREACH_RISK)


def test_long_absence_is_breach_risk():
    c = tc.compute_clock(PLAN, [], today=MONDAY + timedelta(days=14))
    assert c["missed_sessions"] == 10
    assert c["projected_finish_day"] > 56
    assert c["clock_status"] == tc.BREACH_RISK
    assert c["limit_56d_status"] == "EXCEEDS_LIMIT"


def test_classification_boundaries():
    assert tc.classify(49, 49, 56) == tc.OPTIMAL
    assert tc.classify(50, 49, 56) == tc.WARNING
    assert tc.classify(56, 49, 56) == tc.WARNING
    assert tc.classify(57, 49, 56) == tc.BREACH_RISK


def test_rest_day_shifts_schedule_without_a_miss():
    rest = tc.PlanConfig(start_date=MONDAY, rest_dates=frozenset({MONDAY + timedelta(days=2)}))
    c = tc.compute_clock(rest, [], today=MONDAY)
    assert c["missed_sessions"] == 0
    assert c["projected_finish_day"] > 45
    assert {"date": (MONDAY + timedelta(days=2)).isoformat(), "event": tc.PLANNED_REST} in c["schedule_exceptions"]


def test_brachy_gap_and_interval():
    plan = tc.PlanConfig(start_date=MONDAY, ebrt_sessions=2, brachy_sessions=2, brachy_gap_days=3, brachy_interval_days=3)
    slots = _scheduled(plan)
    # EBRT Mon, Tue; first brachy >= Tue+3 = Fri; next brachy >= Fri+3 = Mon
    assert slots == [MONDAY, MONDAY + timedelta(days=1), MONDAY + timedelta(days=4), MONDAY + timedelta(days=7)]
    assert tc.compute_clock(plan, [], today=MONDAY)["projected_finish_day"] == 7


def test_today_slot_is_not_missed_until_the_day_ends():
    assert tc.compute_clock(PLAN, [], today=MONDAY)["missed_sessions"] == 0
    tomorrow = tc.compute_clock(PLAN, [], today=MONDAY + timedelta(days=1))
    assert tomorrow["missed_sessions"] == 1
    assert tomorrow["consecutive_missed_sessions"] == 1


def test_explicit_no_show_today_counts_immediately():
    c = tc.compute_clock(PLAN, [], no_shows=[MONDAY], today=MONDAY)
    assert c["missed_sessions"] == 1


def test_facility_downtime_and_pause_are_not_patient_misses():
    exclusions = {MONDAY + timedelta(days=i): tc.FACILITY_DOWNTIME for i in range(3)}
    exclusions[MONDAY + timedelta(days=3)] = tc.CLINICIAN_APPROVED_PAUSE
    c = tc.compute_clock(PLAN, [], exclusions, today=MONDAY + timedelta(days=4))
    assert c["missed_sessions"] == 0
    # Four lost weekdays: EBRT now ends day 38, brachy on days 42, 45, 49, 52 (weekends skipped)
    assert c["projected_finish_day"] == 52


def test_paused_today_reports_paused_state():
    c = tc.compute_clock(PLAN, [], {MONDAY: tc.CLINICIAN_APPROVED_PAUSE}, today=MONDAY)
    assert c["clock_state"] == tc.PAUSED


def test_not_started_and_incomplete_schedule_states():
    assert tc.compute_clock(PLAN, [], today=MONDAY - timedelta(days=1))["clock_state"] == tc.NOT_STARTED
    broken = tc.PlanConfig(start_date=MONDAY, treatment_weekdays=frozenset())
    assert tc.compute_clock(broken, [], today=MONDAY)["clock_state"] == tc.INCOMPLETE_SCHEDULE
    assert tc.compute_clock(None, [], today=MONDAY)["clock_state"] == tc.NO_PLAN


def test_make_up_session_on_weekend_counts():
    saturday = MONDAY + timedelta(days=5)
    c = tc.compute_clock(PLAN, [saturday], today=saturday)
    assert c["completed_sessions"] == 1
    assert any(e["event"] == tc.RESCHEDULED for e in c["timeline"])


def test_escalation_tiers_follow_policy():
    assert tc.escalation_tiers(0, ESCALATION_POLICY, True) == []
    assert tc.escalation_tiers(3, ESCALATION_POLICY, True)[-1] == "TIER_3_ASHA"
    assert tc.escalation_tiers(5, ESCALATION_POLICY, False)[-1] == "TIER_3_ASHA"
    assert tc.escalation_tiers(5, ESCALATION_POLICY, True)[-1] == "TIER_4_AUTHORITY_ESCALATION"


# ---------- API integration ----------

def _new_patient(name="Sunita Devi"):
    out = clinical_graph.invoke(
        {"raw_text": f"Patient: {name}\nCarcinoma cervix stage IIB. Biopsy: squamous cell carcinoma.", "days_overdue": 0},
        config={"configurable": {"thread_id": f"clock-{secrets.token_hex(3)}"}},
    )
    return out["patient_token"]


def _approve(token, start, **extra):
    return client.post(f"/api/patient/{token}/treatment-plan",
                       json={"approved_by": "DR-ONCO-01", "start_date": start.isoformat(), **extra})


def test_plan_approval_starts_clock_and_hides_pii():
    token = _new_patient("Sunita Devi")
    assert client.get(f"/api/patient/{token}/clock").json()["clock_state"] == "NO_PLAN"

    res = _approve(token, clinic_today())
    assert res.status_code == 200
    clock = client.get(f"/api/patient/{token}/clock")
    assert clock.status_code == 200
    body = clock.json()
    assert body["completed_sessions"] == 0 and body["total_sessions"] == 29
    assert body["projected_finish_day"] is not None
    assert "Sunita" not in clock.text

    assert _approve(token, clinic_today()).status_code == 409
    assert _approve("PT-DOES-NOT-EXIST", clinic_today()).status_code == 404


def test_nurse_session_logging_updates_clock_with_guards():
    token = _new_patient()
    today = clinic_today()
    _approve(token, today)

    def log(n, **kw):
        return client.post("/api/logs/nurse/fraction",
                           json={"nurse_id": "NURSE-01", "patient_token": token, "fraction_number": n, **kw})

    first = log(1)
    assert first.status_code == 200 and first.json()["clock_updated"] is True
    assert first.json()["clock"]["completed_sessions"] == 1

    dup = log(1)
    assert dup.status_code == 200 and dup.json()["duplicate"] is True
    assert dup.json()["clock"]["completed_sessions"] == 1

    assert log(3).status_code in (400, 409)                       # out of order / same date
    assert log(2, session_date=(today + timedelta(days=1)).isoformat()).status_code == 400  # future
    assert log(99).status_code == 400

    cancelled = log(2, session_status="CANCELLED")
    assert cancelled.status_code == 200
    assert cancelled.json()["clock"]["completed_sessions"] == 1   # cancelled sessions never count


def test_nurse_log_without_plan_keeps_legacy_behaviour():
    res = client.post("/api/logs/nurse/fraction",
                      json={"nurse_id": "NURSE-01", "patient_token": "PT-RURAL-7891", "fraction_number": 15})
    assert res.status_code == 200
    assert res.json()["clock_updated"] is False and "block" in res.json()


def test_missed_sessions_escalate_once_per_tier():
    token = _new_patient("Kamla Devi")
    _approve(token, clinic_today() - timedelta(days=14))

    first = client.post("/api/escalation/run-cycle", json={}).json()
    mine = next(r for r in first["treatment_plans"] if r["patient_token"] == token)
    assert mine["consecutive_missed_sessions"] >= 9
    assert "TIER_3_ASHA" in mine["newly_escalated_tiers"]

    second = client.post("/api/escalation/run-cycle", json={}).json()
    again = next(r for r in second["treatment_plans"] if r["patient_token"] == token)
    assert again["newly_escalated_tiers"] == []                    # idempotent re-run

    plan = global_db.get_treatment_plan(token)
    tiers = [e["tier"] for e in global_db.get_treatment_escalations(plan["plan_id"])]
    assert len(tiers) == len(set(tiers))
    assert any(t["patient_token"] == token for t in global_db.get_active_asha_tickets())
    clock = client.get(f"/api/patient/{token}/clock").json()
    assert clock["clock_status"] == "BREACH_RISK" and clock["current_escalation_tier"]


def test_facility_downtime_and_pause_never_penalise_patient():
    today = clinic_today()
    start = today - timedelta(days=6)
    down, paused = _new_patient(), _new_patient()
    _approve(down, start, facility_name="Test Spoke A")
    _approve(paused, start)

    res = client.post("/api/clinical/facility-downtime", json={
        "facility_name": "Test Spoke A", "start_date": start.isoformat(), "end_date": today.isoformat(),
        "reason": "LINAC calibration", "recorded_by": "PHYSICIST-01"})
    assert res.status_code == 200
    assert client.get(f"/api/patient/{down}/clock").json()["missed_sessions"] == 0

    res = client.post(f"/api/patient/{paused}/treatment-plan/pause", json={
        "approved_by": "DR-ONCO-01", "start_date": start.isoformat(), "end_date": today.isoformat(),
        "reason": "Grade 3 diarrhoea"})
    assert res.status_code == 200
    clock = client.get(f"/api/patient/{paused}/clock").json()
    assert clock["missed_sessions"] == 0 and clock["clock_state"] == "PAUSED"


def test_ward_board_and_healing_clock_use_live_clock():
    token = _new_patient()
    _approve(token, clinic_today())
    board = client.get("/api/ward-board").json()
    row = next(r for r in board["plans"] if r["patient_token"] == token)
    assert row["completed_sessions"] == 0 and row["clock_status"] in ("OPTIMAL", "WARNING", "BREACH_RISK")

    healing = client.get(f"/api/patient/{token}/healing-clock").json()["clock"]
    assert healing["clock_source"] == "TREATMENT_CLOCK"
    assert healing["total_steps_completed"] == 0
    assert healing["projected_finish_days"] == row["projected_finish_day"]


def test_run_cycle_rejects_future_dates():
    future = (clinic_today() + timedelta(days=3)).isoformat()
    assert client.post("/api/escalation/run-cycle", json={"as_of_date": future}).status_code == 400
    assert client.get(f"/api/patient/PT-X/clock?as_of_date={future}").status_code == 400
