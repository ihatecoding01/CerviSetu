"""Staff sign-in: PIN login, demo sign-in, role checks, lockout and logout."""
import pytest
from fastapi.testclient import TestClient

from backend.core import staff_session as ss
from backend.dashboard.app import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    with ss.global_db._get_conn() as conn:
        conn.execute("DELETE FROM staff_login_attempts")
        conn.commit()
    return TestClient(app)


def _demo(client, role):
    r = client.post("/api/staff/demo-login", json={"role": role})
    assert r.status_code == 200, r.text
    return r.json()["staff"]


def test_staff_routes_need_sign_in(client):
    r = client.get("/api/cases")
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "STAFF_SIGN_IN_REQUIRED"


def test_public_routes_stay_open(client):
    assert client.get("/api/facilities/search?query=Mirzapur").status_code == 200
    assert client.get("/api/staff/session").json()["authenticated"] is False


def test_pin_login_and_session(client):
    r = client.post("/api/staff/login", json={"staff_id": "dr-1001", "pin": ss._DEMO_PIN})
    assert r.status_code == 200
    assert r.json()["staff"]["role"] == "DOCTOR"
    assert ss.COOKIE_NAME in r.headers["set-cookie"] and "HttpOnly" in r.headers["set-cookie"]
    s = client.get("/api/staff/session").json()
    assert s["authenticated"] and s["staff"]["staff_id"] == "DR-1001"
    assert client.get("/api/cases").status_code == 200


def test_wrong_pin_rejected_and_locks(client):
    for _ in range(ss.MAX_FAILED_ATTEMPTS):
        r = client.post("/api/staff/login", json={"staff_id": "RN-2001", "pin": "000000"})
        assert r.status_code == 401
    r = client.post("/api/staff/login", json={"staff_id": "RN-2001", "pin": ss._DEMO_PIN})
    assert r.status_code == 429


def test_roles_are_enforced(client):
    _demo(client, "ASHA")
    assert client.get("/api/logs/asha/tickets").status_code != 401
    r = client.post("/api/clinical/discharge-signoff", json={})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"
    assert client.get("/api/fhir/patient/PT-RURAL-7891").status_code == 403


def test_nurse_cannot_approve_chemo_but_doctor_can_reach_it(client):
    _demo(client, "NURSE")
    assert client.post("/api/clinical/chemo-clearance", json={}).status_code == 403
    _demo(client, "DOCTOR")
    assert client.post("/api/clinical/chemo-clearance", json={}).status_code not in (401, 403)


def test_logout_revokes(client):
    _demo(client, "DOCTOR")
    cookie = client.cookies.get(ss.COOKIE_NAME)
    client.post("/api/staff/logout")
    assert ss.verify_session(cookie) is None
    assert client.get("/api/cases").status_code == 401


def test_tampered_cookie_rejected():
    cookie = ss.issue_session("DR-1001")
    payload, sig = cookie.rsplit(".", 1)
    assert ss.verify_session(f"{payload}.{sig[:-2]}xx") is None
    assert ss.verify_session(cookie)["role"] == "DOCTOR"


def test_demo_sign_in_can_be_disabled(client, monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_DEMO_SIGNIN", "0")
    assert client.post("/api/staff/demo-login", json={"role": "DOCTOR"}).status_code == 403


def test_unknown_role(client):
    assert client.post("/api/staff/demo-login", json={"role": "JANITOR"}).status_code == 400
