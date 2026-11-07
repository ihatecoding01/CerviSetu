"""Genie is role-specific: each role sees only what its portal may show, and patient Genie needs her own session."""
import pytest
from fastapi.testclient import TestClient

from backend.core import patient_session as ps
from backend.dashboard.app import app
from backend.dashboard.routers import genie


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    monkeypatch.setattr(genie.global_llm, "structured", lambda *a, **k: None)
    return TestClient(app)


def _ask(client, role, question):
    assert client.post("/api/staff/demo-login", json={"role": role}).status_code == 200
    res = client.post("/api/genie/ask", json={"question": question})
    assert res.status_code == 200
    return res.json()


def test_asha_genie_never_sees_screening_findings(client):
    snap_rows = [r for r in genie.referral_pathway.list_referrals() if r["screening_finding"]]
    data = _ask(client, "ASHA", "Who needs attention today?")
    assert data["role"] == "ASHA" and data["open_tab"] is None
    for r in snap_rows:
        assert r["screening_finding"] not in data["answer"]


def test_admin_genie_gets_counts_and_no_patients(client):
    data = _ask(client, "ADMIN", "Tell me about PT-CASE-RITA")
    assert data["role"] == "ADMIN" and data["patients"] == []
    assert "PT-" not in data["answer"]
    assert "not available to administrators" in data["answer"]


def test_hospital_desk_can_use_genie(client):
    assert _ask(client, "HOSPITAL", "How do I confirm an arrival?")["role"] == "HOSPITAL"


def test_admin_snapshot_has_no_rows():
    import asyncio
    snap = asyncio.run(genie._snapshot({"role": "ADMIN"}))
    assert snap["referrals"] == [] and "counts" in snap


def test_patient_genie_needs_her_own_session():
    client = TestClient(app)
    body = {"token": "PT-NO-REFERRAL", "question": "Where is my hospital?"}
    assert client.post("/api/genie/patient-ask", json=body).status_code == 401
    client.cookies.set(ps.COOKIE_NAME, ps.issue_session("PT-SOMEONE-ELSE"))
    assert client.post("/api/genie/patient-ask", json=body).status_code == 403
