"""Patient-portal session security: sessions are signed, short-lived and bound to one patient token."""
import time

from fastapi.testclient import TestClient

from backend.core import patient_session
from backend.dashboard.app import app
from backend.tools import abdm_registration as abdm

ALL_CONSENTS = {k: True for k in abdm.CONSENT_ITEMS}


def _aadhaar(prefix):
    return next(prefix + d for d in "0123456789" if abdm.verhoeff_valid(prefix + d))


def _register(client, prefix, mobile, name="Test Patient"):
    r = client.post("/api/abdm/otp/request", json={
        "mode": "GENERATE", "identifier": _aadhaar(prefix), "beneficiary_name": name,
        "consents": ALL_CONSENTS, "mobile": mobile}).json()
    return client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()


def test_no_session_denied():
    client = TestClient(app)
    token = _register(TestClient(app), "21345098761", "9811100001")["patient_token"]
    assert client.get(f"/api/portal/{token}/overview").status_code == 401
    assert client.get(f"/api/portal/{token}/overview").status_code == 401
    assert client.get("/api/portal/session").json() == {"authenticated": False, "patient_token": None}


def test_otp_issues_session_bound_to_patient_and_cross_patient_denied():
    a, b = TestClient(app), TestClient(app)
    token_a = _register(a, "23456109872", "9811100002", "Patient A")["patient_token"]
    token_b = _register(b, "34567210983", "9811100003", "Patient B")["patient_token"]
    assert a.get("/api/portal/session").json()["patient_token"] == token_a
    ov = a.get(f"/api/portal/{token_a}/overview")
    assert ov.status_code == 200 and ov.json()["display_name"] == "Patient A"
    # Patient A's session cannot read Patient B
    assert a.get(f"/api/portal/{token_b}/overview").status_code == 403
    assert a.get(f"/api/portal/{token_b}/overview").status_code == 403
    assert b.get(f"/api/portal/{token_b}/overview").json()["display_name"] == "Patient B"


def test_session_cookie_is_httponly_and_samesite():
    client = TestClient(app)
    r = client.post("/api/abdm/otp/request", json={
        "mode": "GENERATE", "identifier": _aadhaar("45678321094"), "beneficiary_name": "Cookie Test",
        "consents": ALL_CONSENTS, "mobile": "9811100004"}).json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]})
    header = v.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=strict" in header and "path=/api" in header


def test_expired_session_denied(monkeypatch):
    client = TestClient(app)
    token = _register(client, "56789432105", "9811100005")["patient_token"]
    real = time.time
    monkeypatch.setattr(patient_session.time, "time", lambda: real() + patient_session.SESSION_TTL_SECONDS + 5)
    assert client.get(f"/api/portal/{token}/overview").status_code == 401


def test_invalid_signature_denied():
    client = TestClient(app)
    token = _register(client, "67890543216", "9811100006")["patient_token"]
    cookie = client.cookies.get(patient_session.COOKIE_NAME)
    payload, sig = cookie.rsplit(".", 1)
    forged = TestClient(app)
    forged.cookies.set(patient_session.COOKIE_NAME, f"{payload}.{'A' + sig[1:] if sig[0] != 'A' else 'B' + sig[1:]}", path="/api")
    assert forged.get(f"/api/portal/{token}/overview").status_code == 401
    # Re-signing a different token into the payload without the key is also rejected
    assert patient_session.verify_session("e30." + sig) is None


def test_logout_revokes_session():
    client = TestClient(app)
    token = _register(client, "78901654327", "9811100007")["patient_token"]
    cookie = client.cookies.get(patient_session.COOKIE_NAME)
    client.post("/api/portal/logout")
    replay = TestClient(app)
    replay.cookies.set(patient_session.COOKIE_NAME, cookie, path="/api")
    assert replay.get(f"/api/portal/{token}/overview").status_code == 401


def test_abha_link_and_mobile_otp_resolve_to_same_patient():
    reg = _register(TestClient(app), "89012765438", "9811100008")
    number = reg["abha_card"]["abha_number"].replace("-", "")
    link = TestClient(app)
    r = link.post("/api/abdm/otp/request", json={"mode": "LINK", "identifier": number, "beneficiary_name": "Test Patient",
                                                 "consents": ALL_CONSENTS}).json()
    via_abha = link.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()
    mob = TestClient(app)
    m = mob.post("/api/abdm/login/mobile/request", json={"mobile": "9811100008"}).json()
    via_mobile = mob.post("/api/abdm/otp/verify", json={"txn_id": m["txn_id"], "otp": m["sandbox_otp"]}).json()
    assert reg["patient_token"] == via_abha["patient_token"] == via_mobile["patient_token"]
    assert link.get("/api/portal/session").json()["patient_token"] == mob.get("/api/portal/session").json()["patient_token"]






