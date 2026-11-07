"""Doctor-approved pathway rules, enforced with real role sessions."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.config import clinic_today
from backend.core.database import global_db
from backend.dashboard import routers  # noqa: F401
from backend.dashboard.app import app
from backend.tools import referral_pathway as rp

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32
PDF = b"%PDF-1.4 test"


def _new(post="Parel Health Post", ago=0, consent="GRANTED", **extra):
    row = rp.create({"patient_name": "Test Woman", "health_post": post, "screening_finding": "Pap: HSIL", "area": "Parel",
                     "message_consent": consent, **extra}, "TEST", True, clinic_today() - timedelta(days=ago))
    return row


@pytest.fixture
def clients(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    made = {}
    for role in ("DOCTOR", "NURSE", "ASHA", "HOSPITAL", "ADMIN"):
        c = TestClient(app)
        assert c.post("/api/staff/demo-login", json={"role": role}).status_code == 200
        made[role] = c
    return made


def _day(row, n):
    return clinic_today() + timedelta(days=n - 1 - (rp.follow_up_day(row["referred_on"]) - 1))


def test_route_edit_changes_new_referrals_only(clients):
    with global_db._get_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO admin_hospitals (hospital_id, name, hospital_type, area, services, created_by) VALUES ('HOSP-T1', 'Nair Hospital', 'TERTIARY_HOSPITAL', 'Mumbai Central', '', 'T')")
        conn.execute("INSERT OR IGNORE INTO admin_hospitals (hospital_id, name, hospital_type, area, services, created_by) VALUES ('HOSP-T2', 'Sion Hospital', 'TERTIARY_HOSPITAL', 'Sion', '', 'T')")
        conn.commit()
    post = "Dharavi Urban Health Centre"
    old = _new(post)
    assert old["hospital"] == "Sion Hospital"
    assert clients["ADMIN"].put(f"/api/admin/routes/{post}", json={"hospital": "Nair Hospital"}).status_code == 200
    assert _new(post)["hospital"] == "Nair Hospital"
    assert rp._get(old["referral_id"])["hospital"] == "Sion Hospital"
    assert clients["ADMIN"].put(f"/api/admin/routes/{post}", json={"hospital": "Sion Hospital"}).status_code == 200
    assert clients["ADMIN"].put(f"/api/admin/routes/{post}", json={"hospital": "Made Up"}).status_code == 422


def test_client_cannot_choose_the_hospital(clients):
    body = {"patient_name": "Asha K", "health_post": "Parel Health Post", "screening_finding": "VIA positive", "hospital": "Cooper Hospital"}
    assert clients["NURSE"].post("/api/referrals", json=body).json()["hospital"] == "KEM Hospital"


def test_nurse_is_limited_to_her_health_post(clients):
    theirs = _new("BMC Khar Health Post")
    assert clients["NURSE"].post(f"/api/referrals/{theirs['referral_id']}/reminder", json={"channel": "SMS"}).status_code == 404
    body = {"patient_name": "Asha K", "health_post": "BMC Khar Health Post", "screening_finding": "VIA positive"}
    assert clients["NURSE"].post("/api/referrals", json=body).status_code == 403
    assert all(r["health_post"] == "Parel Health Post" for r in clients["NURSE"].get("/api/referrals").json()["referrals"])


def test_only_doctor_records_clinical_details(clients):
    row = _new()
    rp.confirm_arrival(row["referral_id"], "T")
    for role in ("NURSE", "ASHA", "HOSPITAL", "ADMIN"):
        assert clients[role].post(f"/api/referrals/{row['referral_id']}/clinical", json={"final_diagnosis": "x"}).status_code == 403
    res = clients["DOCTOR"].post(f"/api/referrals/{row['referral_id']}/clinical", json={"final_diagnosis": "CIN 2"})
    assert res.status_code == 422  # needs histopathology first
    ok = clients["DOCTOR"].post(f"/api/referrals/{row['referral_id']}/clinical", json={"histopathology": "CIN 2", "final_diagnosis": "CIN 2", "treatment_plan": "LEEP"})
    assert ok.status_code == 200 and ok.json()["final_diagnosis"] == "CIN 2"


def test_clinical_record_needs_arrival(clients):
    row = _new()
    assert clients["DOCTOR"].post(f"/api/referrals/{row['referral_id']}/clinical", json={"remarks": "x"}).status_code == 409


def test_hospital_sees_only_its_referrals_and_no_clinical_record(clients):
    mine, other = _new("Parel Health Post"), _new("BMC Khar Health Post")
    rows = clients["HOSPITAL"].get("/api/referrals").json()["referrals"]
    assert {r["hospital"] for r in rows} == {"KEM Hospital"}
    assert not {"histopathology", "final_diagnosis", "form", "contact_phone"} & set(rows[0])
    assert clients["HOSPITAL"].post(f"/api/referrals/{other['referral_id']}/arrival").status_code == 404
    assert clients["HOSPITAL"].post(f"/api/referrals/{mine['referral_id']}/arrival").status_code == 200


def test_arrival_closes_follow_up_but_a_reply_does_not(clients):
    row = _new()
    rp.record_reply(row["referral_id"], "VISITED", "PATIENT")
    assert rp.get_for_patient(row["patient_token"])["following"] is True
    rp.confirm_arrival(row["referral_id"], "T")
    now = rp.get_for_patient(row["patient_token"])
    assert now["following"] is False
    with pytest.raises(rp.ReferralError):
        rp.send_reminder(row["referral_id"], "T")


def test_cycle_steps_and_is_idempotent():
    row = _new(ago=0)
    on = clinic_today()
    first = rp.run_cycle(on)
    assert first["reminders"] >= 1
    assert rp.run_cycle(on)["reminders"] == 0
    assert rp.follow_up_step(10) == "DAILY_REMINDER" and rp.follow_up_step(11) == "INTENSIVE_CONTACT" and rp.follow_up_step(14) == "ASHA_VISIT"
    assert sum(1 for e in rp.events(row["referral_id"]) if e["kind"] == "REMINDER") == 1


def test_day_14_assigns_asha_once_then_no_contact_goes_to_doctor():
    row = _new("Malavani Health Post", ago=13)
    rp.run_cycle()
    now = rp.get_for_patient(row["patient_token"])
    assert now["assigned_asha"] == "AW-3001" and not now["doctor_review"]
    rp.run_cycle()
    assert sum(1 for e in rp.events(row["referral_id"]) if e["kind"] == "ASHA_VISIT_ORDERED") == 1
    rp.run_cycle(clinic_today() + timedelta(days=1))
    assert rp.get_for_patient(row["patient_token"])["doctor_review"] == "NO_CONTACT"


def test_asha_sees_only_assigned_and_refusal_goes_to_doctor(clients):
    other = _new("Malavani Health Post")
    row = _new("Malavani Health Post", ago=13)
    rp.run_cycle()
    rows = clients["ASHA"].get("/api/referrals").json()["referrals"]
    ids = {r["referral_id"] for r in rows}
    assert row["referral_id"] in ids and other["referral_id"] not in ids
    assert not {"screening_finding", "histopathology", "final_diagnosis", "form"} & set(rows[0])
    assert clients["ASHA"].post(f"/api/referrals/{other['referral_id']}/visit", json={"outcome": "NOT_AT_HOME"}).status_code == 404
    assert clients["ASHA"].post(f"/api/referrals/{row['referral_id']}/visit", json={"outcome": "MET_PATIENT"}).status_code == 422
    res = clients["ASHA"].post(f"/api/referrals/{row['referral_id']}/visit", json={"outcome": "MET_PATIENT", "consent": "NEGATIVE", "note": "Family"})
    assert res.status_code == 200 and res.json()["status"] == rp.DECLINED
    assert rp.get_for_patient(row["patient_token"])["doctor_review"] == "REFUSED"


def test_no_message_consent_means_no_messages():
    for consent in (None, "WITHHELD"):
        row = _new(consent=consent)
        with pytest.raises(rp.ReferralError):
            rp.send_reminder(row["referral_id"], "T")
    assert rp.run_cycle()["skipped_no_consent"] >= 2


def test_stop_ends_messaging_immediately():
    row = _new()
    rp.record_reply(row["referral_id"], "STOP", "PATIENT")
    with pytest.raises(rp.ReferralError):
        rp.send_reminder(row["referral_id"], "T")


def test_family_message_needs_separate_consent():
    without = _new(ago=11, family_phone="9000000001")
    with_ = _new(ago=11, family_phone="9000000002", family_consent=True)
    rp.run_cycle()
    assert not [e for e in rp.events(without["referral_id"]) if e["kind"] == "FAMILY_REMINDER"]
    assert [e for e in rp.events(with_["referral_id"]) if e["kind"] == "FAMILY_REMINDER"]


def test_admin_sees_counts_only_and_no_clinical_data(clients):
    data = clients["ADMIN"].get("/api/admin/dashboard").json()
    assert set(data) == {"referrals", "arrivals", "in_follow_up", "overdue", "declined"}
    assert all(isinstance(v, int) for v in data.values())
    assert clients["ADMIN"].get("/api/referrals").status_code == 403
    assert clients["ADMIN"].get("/api/cases").status_code == 403


def test_admin_manages_staff_and_sees_own_actions(clients):
    a = clients["ADMIN"]
    body = {"staff_id": "AW-7001", "name": "New ASHA", "role": "ASHA", "health_post": "Parel Health Post", "pin": "123456"}
    if a.post("/api/admin/staff", json=body).status_code == 201:
        assert a.post("/api/admin/staff", json=body).status_code == 409
    assert a.post("/api/admin/staff", json={**body, "staff_id": "AW-7002", "health_post": None}).status_code == 422
    fresh = TestClient(app)
    assert fresh.post("/api/staff/login", json={"staff_id": "AW-7001", "pin": "123456"}).status_code == 200
    assert a.post("/api/admin/staff/AW-7001/status", json={"active": False}).status_code == 200
    assert fresh.get("/api/referrals").status_code == 401
    assert fresh.post("/api/staff/login", json={"staff_id": "AW-7001", "pin": "123456"}).status_code != 200
    assert a.post("/api/admin/staff/AW-7001/status", json={"active": True}).status_code == 200
    assert any(x["action"] == "ADMIN_STAFF_DEACTIVATED" for x in a.get("/api/admin/my-actions").json()["actions"])
    for role in ("DOCTOR", "NURSE", "ASHA", "HOSPITAL"):
        assert clients[role].get("/api/admin/staff").status_code == 403


def test_uploads_are_validated_consented_and_private(clients):
    row = _new()
    url = f"/api/referrals/{row['referral_id']}/files"
    doctor = clients["DOCTOR"]
    assert doctor.post(url, data={"kind": "VIA_IMAGE"}, files={"file": ("a.png", PNG, "image/png")}).status_code == 422
    assert doctor.post(url, data={"kind": "MRI_REPORT"}, files={"file": ("a.exe", b"MZ123", "application/pdf")}).status_code == 422
    made = doctor.post(url, data={"kind": "VIA_IMAGE", "photo_consent": "true"}, files={"file": ("../a.png", PNG, "image/png")})
    assert made.status_code == 201 and "/" not in made.json()["filename"]
    fid = made.json()["file_id"]
    got = doctor.get(f"{url}/{fid}")
    assert got.status_code == 200 and got.content == PNG and "attachment" in got.headers["content-disposition"]
    with global_db._get_conn() as conn:
        assert PNG not in bytes(conn.execute("SELECT ciphertext FROM referral_files WHERE file_id = ?", (fid,)).fetchone()[0])
    for role in ("ASHA", "HOSPITAL", "ADMIN"):
        assert clients[role].get(f"{url}/{fid}").status_code == 403
    assert TestClient(app).get(f"{url}/{fid}").status_code == 401
    other = _new("BMC Khar Health Post")
    assert clients["NURSE"].get(f"/api/referrals/{other['referral_id']}/files").status_code == 404


def test_patient_can_only_read_her_own_referral(monkeypatch):
    from backend.core import patient_session
    mine, other = _new(), _new()
    c = TestClient(app)
    c.cookies.set(patient_session.COOKIE_NAME, patient_session.issue_session(mine["patient_token"]))
    res = c.get(f"/api/portal/{mine['patient_token']}/overview")
    assert res.status_code == 200
    assert not {"screening_finding", "histopathology", "final_diagnosis"} & set(res.json()["referral"])
    assert c.get(f"/api/portal/{other['patient_token']}/overview").status_code == 403
    assert c.post(f"/api/portal/{other['patient_token']}/reply", json={"reply": "VISITED"}).status_code == 403
    assert c.post(f"/api/portal/{mine['patient_token']}/reply", json={"reply": "STOP"}).status_code == 200
    assert date.fromisoformat(rp.get_for_patient(mine["patient_token"])["stopped_at"])


@pytest.mark.parametrize("path", ["/api/patient/PT-CASE-NISHI", "/api/abdm/profile/PT-CASE-NISHI", "/api/dev/ai-usage"])
def test_patient_and_dev_data_refuse_signed_out_and_field_roles(clients, monkeypatch, path):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    assert TestClient(app).get(path).status_code == 401
    for role in ("ASHA", "HOSPITAL", "ADMIN"):
        assert clients[role].get(path).status_code == 403
