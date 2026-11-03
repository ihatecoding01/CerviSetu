"""ABDM/ABHA sandbox registration: consent gating, OTP security, Aadhaar never stored."""
import time

from fastapi.testclient import TestClient

from backend.core.database import global_db
from backend.dashboard.app import app
from backend.tools import abdm_registration as abdm

client = TestClient(app)
ALL_CONSENTS = {k: True for k in abdm.CONSENT_ITEMS}


def _aadhaar(prefix="23456789012"):
    for d in "0123456789":
        if abdm.verhoeff_valid(prefix + d):
            return prefix + d


def _request(**over):
    body = {"mode": "GENERATE", "identifier": _aadhaar(), "beneficiary_name": "Sunita Devi",
            "consents": ALL_CONSENTS, "mobile": "9876543210"}
    body.update(over)
    return client.post("/api/abdm/otp/request", json=body)


def test_generate_abha_happy_path_records_consents():
    res = _request()
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["mode"] == "SANDBOX_SIMULATED" and len(data["sandbox_otp"]) == 6
    v = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]}).json()
    assert v["verified"] and v["abha_created"] and v["patient_token"].startswith("PT-ABHA-")
    assert v["abha_card"]["abha_address"].endswith("@sbx")
    with global_db._get_conn() as conn:
        n = conn.execute("SELECT COUNT(*) FROM dpdp_consents WHERE patient_token = ?", (v["patient_token"],)).fetchone()[0]
    assert n == len(abdm.CONSENT_ITEMS)
    # a closed transaction cannot be replayed
    again = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]})
    assert again.status_code == 409


def test_aadhaar_is_never_stored_in_plaintext():
    aadhaar = _aadhaar("34567890123")
    data = _request(identifier=aadhaar).json()
    with global_db._get_conn() as conn:
        row = dict(conn.execute("SELECT * FROM abdm_otp_sessions WHERE txn_id = ?", (data["txn_id"],)).fetchone())
    assert aadhaar not in str(row) and data["sandbox_otp"] not in str(row)
    assert row["identifier_last4"] == aadhaar[-4:]


def test_every_consent_is_required():
    for key in abdm.CONSENT_ITEMS:
        res = _request(consents={**ALL_CONSENTS, key: False})
        assert res.status_code == 400 and res.json()["detail"]["code"] == "CONSENT_REQUIRED"


def test_invalid_aadhaar_checksum_rejected():
    good = _aadhaar()
    bad = good[:-1] + str((int(good[-1]) + 1) % 10)
    assert _request(identifier=bad).json()["detail"]["code"] == "INVALID_AADHAAR"


def test_wrong_otp_locks_after_max_attempts():
    data = _request().json()
    wrong = "000000" if data["sandbox_otp"] != "000000" else "111111"
    for _ in range(abdm.OTP_MAX_ATTEMPTS):
        assert client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": wrong}).status_code == 401
    locked = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]})
    assert locked.status_code == 409


def test_expired_otp_rejected(monkeypatch):
    data = _request().json()
    real = time.time
    monkeypatch.setattr(abdm.time, "time", lambda: real() + abdm.OTP_TTL_SECONDS + 1)
    res = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]})
    assert res.status_code == 410


def test_resend_respects_window():
    data = _request().json()
    assert client.post("/api/abdm/otp/resend", json={"txn_id": data["txn_id"]}).status_code == 429


def test_demographics_and_biometrics_not_faked():
    for method in ("DEMOGRAPHICS", "BIOMETRICS"):
        res = _request(method=method)
        assert res.status_code == 501 and res.json()["detail"]["code"] == "METHOD_UNAVAILABLE"


def _register(aadhaar, mobile="9876500011", name="Sunita Devi"):
    r = _request(identifier=aadhaar, mobile=mobile, beneficiary_name=name).json()
    return client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()


def test_aadhaar_is_not_a_login_credential():
    aadhaar = _aadhaar("45678901234")
    first = _register(aadhaar, mobile="9876500012")
    assert first["abha_created"] is True
    again = _request(identifier=aadhaar).json()
    res = client.post("/api/abdm/otp/verify", json={"txn_id": again["txn_id"], "otp": again["sandbox_otp"]})
    assert res.status_code == 409 and res.json()["detail"]["code"] == "ALREADY_REGISTERED"


def test_link_by_synthetic_abha_number_returns_same_patient():
    created = _register(_aadhaar("56789012345"), mobile="9876500013")
    number = created["abha_card"]["abha_number"].replace("-", "")
    r = _request(mode="LINK", identifier=number).json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()
    assert v["patient_token"] == created["patient_token"] and v["returning"] is True
    unknown = _request(mode="LINK", identifier="91000000000001").json()
    res = client.post("/api/abdm/otp/verify", json={"txn_id": unknown["txn_id"], "otp": unknown["sandbox_otp"]})
    assert res.status_code == 404


def test_abha_card_is_labelled_synthetic():
    card = _register(_aadhaar("67890123456"), mobile="9876500014")["abha_card"]
    assert "not issued by ABDM" in card["label"] and card["abha_address"].endswith("@sbx")
    assert "simulated" in card["id_verified_via"]


def test_mobile_otp_login_for_registered_patient():
    created = _register(_aadhaar("78901234567"), mobile="9876500015")
    r = client.post("/api/abdm/login/mobile/request", json={"mobile": "98765 00015"})
    assert r.status_code == 200 and "not secure production" in r.json()["auth_notice"]
    v = client.post("/api/abdm/otp/verify", json={"txn_id": r.json()["txn_id"], "otp": r.json()["sandbox_otp"]}).json()
    assert v["patient_token"] == created["patient_token"] and v["synthetic_patient"] is True


def test_mobile_otp_login_demo_patient_and_unknown_mobile():
    r = client.post("/api/abdm/login/mobile/request", json={"mobile": "9876543210"}).json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()
    assert v["patient_token"] == "PT-RURAL-7891" and v["synthetic_patient"] is False
    unknown = client.post("/api/abdm/login/mobile/request", json={"mobile": "9000000001"})
    assert unknown.status_code == 404 and unknown.json()["detail"]["code"] == "MOBILE_NOT_REGISTERED"


def test_sandbox_otp_refused_in_production(monkeypatch):
    monkeypatch.setattr(abdm, "APP_ENV", "production")
    res = client.post("/api/abdm/login/mobile/request", json={"mobile": "9876543210"})
    assert res.status_code == 503 and res.json()["detail"]["code"] == "SIMULATION_DISABLED"


def test_mobile_number_never_stored_plaintext():
    _register(_aadhaar("89012345678"), mobile="9876500016")
    with global_db._get_conn() as conn:
        dump = str([dict(r) for r in conn.execute("SELECT * FROM patient_mobile_links").fetchall()])
        dump += str([dict(r) for r in conn.execute("SELECT * FROM abdm_otp_sessions").fetchall()])
    assert "9876500016" not in dump


def test_link_abha_to_existing_cervisetu_patient():
    data = _request(mode="LINK", identifier="91123456789012", link_token="PT-RURAL-7891").json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]}).json()
    assert v["patient_token"] == "PT-RURAL-7891"
