"""ASHA patient registration: server-side checks, consent, duplicates, uploads and access limits."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.dashboard.app import app

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    return TestClient(app)


def _sign_in(client, role):
    assert client.post("/api/staff/demo-login", json={"role": role}).status_code == 200


def _body(**over):
    today = date.today().isoformat()
    body = {"request_id": "", "patient_name": "Kamala Gaikwad", "age": 38, "phone": "9876500011", "preferred_language": "mr",
            "area": "Malvani Gate 5", "screening_date": today, "screening_method": "VIA", "screening_result": "POSITIVE",
            "refer": True, "referral_date": today, "notes": "", "consent_contact": "GRANTED", "consent_followup": "GRANTED"}
    body.update(over)
    return body


def test_asha_registers_into_her_own_follow_up_list(client):
    _sign_in(client, "ASHA")
    r = client.post("/api/referrals/register", json=_body(patient_name="Shobha Pawar", phone="9876500021"))
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["status"] == "REFERRED" and rec["health_post"] == "Malavani Health Post" and rec["hospital"]
    assert "screening_finding" not in rec  # ASHA view never shows findings, even ones she entered
    mine = [x["referral_id"] for x in client.get("/api/referrals").json()["referrals"]]
    assert rec["referral_id"] in mine
    events = [e["kind"] for e in client.get(f"/api/referrals/{rec['referral_id']}/events").json()["events"]]
    assert "REGISTERED_BY_ASHA" in events
    # The existing 14-day workflow applies: she can record a call on her new patient
    assert client.post(f"/api/referrals/{rec['referral_id']}/contact", json={"outcome": "NO_ANSWER"}).status_code == 200


def test_health_post_comes_from_her_session_not_the_form(client):
    _sign_in(client, "ASHA")
    r = client.post("/api/referrals/register", json={**_body(patient_name="Usha More", phone="9876500031"), "health_post": "Parel Health Post"})
    assert r.status_code == 201 and r.json()["health_post"] == "Malavani Health Post"


@pytest.mark.parametrize("over", [
    {"patient_name": ""}, {"phone": "12345"}, {"area": ""}, {"screening_result": "CANCER"}, {"screening_method": "MRI"},
    {"consent_contact": ""}, {"screening_date": (date.today() + timedelta(days=1)).isoformat()},
])
def test_invalid_input_is_refused(client, over):
    _sign_in(client, "ASHA")
    assert client.post("/api/referrals/register", json=_body(**over)).status_code == 422


def test_declined_follow_up_goes_to_doctor_review_and_no_reminders(client):
    _sign_in(client, "ASHA")
    r = client.post("/api/referrals/register", json=_body(patient_name="Hema Naik", phone="9876500041", consent_contact="WITHHELD", consent_followup="WITHHELD"))
    assert r.status_code == 201
    assert r.json()["status"] == "DECLINED" and r.json()["messaging_allowed"] is False


def test_duplicates_are_found_within_her_health_post(client):
    _sign_in(client, "ASHA")
    client.post("/api/referrals/register", json=_body(patient_name="Nirmala Sawant", phone="9876500051"))
    by_name = client.post("/api/referrals/duplicates", json={"name": "nirmala sawant"}).json()["matches"]
    by_phone = client.post("/api/referrals/duplicates", json={"phone": "98765 00051"}).json()["matches"]
    assert by_name and by_phone and by_name[0]["yours"] is True
    assert client.post("/api/referrals/duplicates", json={"name": "Nobody Here Ever"}).json()["matches"] == []


def test_same_request_twice_creates_one_record(client):
    _sign_in(client, "ASHA")
    body = _body(patient_name="Vidya Bhosale", phone="9876500061", request_id="req-once-123")
    a, b = client.post("/api/referrals/register", json=body), client.post("/api/referrals/register", json=body)
    assert a.json()["referral_id"] == b.json()["referral_id"]


def test_asha_uploads_screening_papers_only_with_consent(client):
    _sign_in(client, "ASHA")
    rid = client.post("/api/referrals/register", json=_body(patient_name="Seema Mane", phone="9876500071")).json()["referral_id"]
    up = lambda kind, consent: client.post(f"/api/referrals/{rid}/files", data={"kind": kind, "photo_consent": consent}, files={"file": ("slip.pdf", PDF, "application/pdf")})
    assert up("REFERRAL_SLIP", "false").status_code == 422
    assert up("HISTOPATHOLOGY_REPORT", "true").status_code == 403
    ok = up("REFERRAL_SLIP", "true")
    assert ok.status_code == 201, ok.text
    assert [f["kind"] for f in client.get(f"/api/referrals/{rid}/files").json()["files"]] == ["REFERRAL_SLIP"]
    bad = client.post(f"/api/referrals/{rid}/files", data={"kind": "SCREENING_REPORT", "photo_consent": "true"}, files={"file": ("x.txt", b"hello", "text/plain")})
    assert bad.status_code == 422


def test_other_roles_cannot_use_asha_registration(client):
    _sign_in(client, "NURSE")
    assert client.post("/api/referrals/register", json=_body()).status_code == 403
    assert client.post("/api/referrals/duplicates", json={"name": "x"}).status_code == 403
