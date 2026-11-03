"""Synthetic demo journeys: deterministic, labelled, and isolated from real clinical queues."""
from datetime import date

from fastapi.testclient import TestClient

from backend.core.database import global_db
from backend.dashboard.app import app
from backend.tools import synthetic_journey as sj
from backend.tools.clock_service import get_patient_clock

client = TestClient(app)
# Fixed clinic date: these tests never depend on the real current date
TODAY = date(2026, 11, 3)


def test_spec_is_deterministic_per_token():
    a = sj.journey_spec("PT-ABHA-AAAAAA", TODAY)
    assert a == sj.journey_spec("PT-ABHA-AAAAAA", TODAY)
    assert 5 <= (TODAY - a["start_date"]).days <= 30
    assert sj.journey_spec("PT-ABHA-BBBBBB", TODAY) != a


def test_journey_created_once_and_labelled():
    token = "PT-ABHA-SYN001"
    first = sj.ensure_synthetic_journey(token, TODAY)
    sessions_before = global_db.get_treatment_sessions(first["plan_id"])
    second = sj.ensure_synthetic_journey(token, date(2026, 11, 10))
    assert first["created"] and not second["created"]
    assert global_db.get_treatment_sessions(first["plan_id"]) == sessions_before
    plan = global_db.get_treatment_plan(token)
    assert plan["regimen_label"].startswith("[SYNTHETIC DEMO]") and plan["approved_by"] == sj.GENERATOR_ID
    assert all(s["recorded_by"] == sj.GENERATOR_ID for s in sessions_before)
    assert global_db.is_synthetic_patient(token)
    clock = get_patient_clock(token, TODAY)
    assert clock["completed_sessions"] == first["sessions_completed"]


def test_synthetic_patients_excluded_from_real_queues():
    token = "PT-ABHA-SYN002"
    sj.ensure_synthetic_journey(token, TODAY)
    assert token not in {c["patient_token"] for c in client.get("/api/cases").json()["cases"]}
    assert token not in {p["patient_token"] for p in client.get("/api/ward-board").json()["plans"]}
    assert token not in {p["patient_token"] for p in global_db.list_treatment_plans(status="ACTIVE")}
    assert token in {p["patient_token"] for p in global_db.list_treatment_plans(include_synthetic=True)}
    run = client.post("/api/escalation/run-cycle", json={}).json()
    assert token not in str(run)
    bundle = client.get(f"/api/fhir/patient/{token}").json()
    assert bundle["meta"]["tag"][0]["code"] == "SYNTHETIC_DEMO"
