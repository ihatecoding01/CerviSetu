"""Tests for the automatic missed-visit escalation cycle."""
from fastapi.testclient import TestClient

from backend.core.database import global_db
from backend.dashboard.app import app
from backend.graph.workflow import clinical_graph

client = TestClient(app)


def _tier_for(token, result):
    return next(e for e in result["escalations"] if e["patient_token"] == token)


def test_cycle_advances_tiers_and_opens_asha_ticket():
    out = clinical_graph.invoke(
        {"raw_text": "Patient: Leela Devi\nCarcinoma cervix stage IIB. Biopsy: squamous cell carcinoma.", "days_overdue": 0},
        config={"configurable": {"thread_id": "escalation-test"}},
    )
    token = out["patient_token"]

    day1 = client.post("/api/escalation/run-cycle", json={"advance_days": 1}).json()
    assert _tier_for(token, day1)["days_overdue"] == 1

    day3 = client.post("/api/escalation/run-cycle", json={"advance_days": 2}).json()
    entry = _tier_for(token, day3)
    assert entry["days_overdue"] == 3
    assert entry["newly_escalated"] is True

    tickets = [t for t in global_db.get_active_asha_tickets() if t["patient_token"] == token]
    assert tickets and tickets[0]["patient_first_name"] == "Leela"


def test_cycle_pauses_during_linac_downtime():
    global_db.toggle_linac_downtime(reason="Test")
    try:
        res = client.post("/api/escalation/run-cycle", json={"advance_days": 1}).json()
        assert res["status"] == "PAUSED_LINAC_DOWNTIME"
    finally:
        global_db.toggle_linac_downtime()
