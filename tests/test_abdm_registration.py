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


def test_link_existing_abha_returns_same_patient():
    aadhaar = _aadhaar("45678901234")
    first = _request(identifier=aadhaar).json()
    created = client.post("/api/abdm/otp/verify", json={"txn_id": first["txn_id"], "otp": first["sandbox_otp"]}).json()
    abha_number = created["abha_card"]["abha_number"].replace("-", "")
    # LINK by ABHA number is a different identifier, so an unknown ABHA without a link target is refused
    unk = _request(mode="LINK", identifier=abha_number).json()
    res = client.post("/api/abdm/otp/verify", json={"txn_id": unk["txn_id"], "otp": unk["sandbox_otp"]})
    assert res.status_code == 404
    # Re-verifying the same Aadhaar returns the existing ABHA instead of creating a duplicate
    again = _request(identifier=aadhaar).json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": again["txn_id"], "otp": again["sandbox_otp"]}).json()
    assert v["patient_token"] == created["patient_token"] and v["abha_created"] is False


def test_link_abha_to_existing_cervisetu_patient():
    data = _request(mode="LINK", identifier="91123456789012", link_token="PT-RURAL-7891").json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]}).json()
    assert v["patient_token"] == "PT-RURAL-7891"
