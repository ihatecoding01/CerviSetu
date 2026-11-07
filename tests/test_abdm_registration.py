"""ABDM/ABHA sandbox registration: consent gating, OTP security, Aadhaar never stored."""
import json
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
    assert v["patient_token"] == created["patient_token"] 


def test_mobile_otp_login_demo_patient_and_unknown_mobile():
    r = client.post("/api/abdm/login/mobile/request", json={"mobile": "9876543210"}).json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": r["txn_id"], "otp": r["sandbox_otp"]}).json()
    assert v["patient_token"] == "PT-CASE-NISHI" and v["synthetic_patient"] is False
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
    data = _request(mode="LINK", identifier="91123456789012", link_token="PT-CASE-NISHI").json()
    v = client.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]}).json()
    assert v["patient_token"] == "PT-CASE-NISHI"


# --- unique ABHA allocation + OTP consumed only after persistence ---

import random

_rng = random.Random(20261103)


def _random_aadhaar():
    while True:
        a = _aadhaar(str(_rng.randint(2, 9)) + "".join(str(_rng.randint(0, 9)) for _ in range(10)))
        if a:
            return a


def _status(txn_id):
    with global_db._get_conn() as conn:
        return conn.execute("SELECT status FROM abdm_otp_sessions WHERE txn_id = ?", (txn_id,)).fetchone()[0]


def _verify(data, c=client):
    return c.post("/api/abdm/otp/verify", json={"txn_id": data["txn_id"], "otp": data["sandbox_otp"]})


def _sequence(monkeypatch, values):
    """Force secrets.randbelow inside verify to return the given values, in order."""
    queue, real = list(values), random.SystemRandom().randrange
    monkeypatch.setattr(abdm.secrets, "randbelow", lambda n: queue.pop(0) % n if queue else real(n))


def test_same_name_registered_hundreds_of_times_without_500():
    addresses = set()
    for _ in range(300):
        data = _request(identifier=_random_aadhaar(), beneficiary_name="Repeat Name", mobile=None).json()
        res = _verify(data)
        assert res.status_code == 200, res.text
        addresses.add(res.json()["abha_card"]["abha_address"])
    assert len(addresses) == 300 and all(a.startswith("repeatname.") for a in addresses)


def test_forced_collision_retries_to_a_unique_value(monkeypatch):
    first = _request(identifier=_random_aadhaar(), beneficiary_name="Collide Case", mobile=None).json()
    _sequence(monkeypatch, [111, 4242])
    taken = _verify(first).json()["abha_card"]
    assert taken["abha_address"] == "collidecase.4242@sbx"

    second = _request(identifier=_random_aadhaar(), beneficiary_name="Collide Case", mobile=None).json()
    # same number + address first, then a fresh pair
    _sequence(monkeypatch, [111, 4242, 222, 4343])
    card = _verify(second).json()["abha_card"]
    assert card["abha_address"] == "collidecase.4343@sbx" and card["abha_number"] != taken["abha_number"]


def test_insert_race_on_unique_constraint_is_retried(monkeypatch):
    first = _request(identifier=_random_aadhaar(), beneficiary_name="Race Case", mobile=None).json()
    _sequence(monkeypatch, [333, 1111])
    assert _verify(first).status_code == 200
    # pre-check blind (another writer won between check and insert): the UNIQUE constraint must be retried
    real_find = abdm._find_abha
    monkeypatch.setattr(abdm, "_find_abha",
                        lambda col, v: None if col in ("abha_number_hash", "abha_address_hash") else real_find(col, v))
    second = _request(identifier=_random_aadhaar(), beneficiary_name="Race Case", mobile=None).json()
    _sequence(monkeypatch, [333, 1111, 444, 2222])
    res = _verify(second)
    assert res.status_code == 200, res.text
    assert res.json()["abha_card"]["abha_address"] == "racecase.2222@sbx"


def test_retry_exhaustion_is_controlled_and_keeps_otp(monkeypatch):
    first = _request(identifier=_random_aadhaar(), beneficiary_name="Exhaust Case", mobile=None).json()
    _sequence(monkeypatch, [555, 7777])
    assert _verify(first).status_code == 200

    second = _request(identifier=_random_aadhaar(), beneficiary_name="Exhaust Case", mobile=None).json()
    monkeypatch.setattr(abdm.secrets, "randbelow", lambda n: 555 if n == 10**12 else 7777)
    res = _verify(second)
    assert res.status_code == 503 and res.json()["detail"]["code"] == "ABHA_ID_UNAVAILABLE"
    assert _status(second["txn_id"]) == "PENDING"
    monkeypatch.undo()
    assert _verify(second).status_code == 200




def test_success_consumes_otp_exactly_once():
    data = _request(identifier=_random_aadhaar(), beneficiary_name="Once Only", mobile=None).json()
    assert _verify(data).status_code == 200
    assert _status(data["txn_id"]) == "VERIFIED"
    again = _verify(data)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "TRANSACTION_CLOSED"


# --- concurrency + failure at every persistence boundary ---

import threading
from datetime import date, timedelta

import pytest

from backend.core.security import global_audit, global_vault


def _fresh(name="Boundary Case"):
    mobile = "7" + "".join(str(_rng.randint(0, 9)) for _ in range(9))
    data = _request(identifier=_random_aadhaar(), beneficiary_name=name, mobile=mobile).json()
    return data, mobile


def _rows_for(txn_id):
    with global_db._get_conn() as conn:
        ident = conn.execute("SELECT identifier_hash FROM abdm_otp_sessions WHERE txn_id = ?", (txn_id,)).fetchone()[0]
        return [dict(r) for r in conn.execute("SELECT * FROM synthetic_abha_ids WHERE identity_hash = ?", (ident,))]




def _staged_gone(txn_id):
    try:
        global_vault.retrieve_pii(abdm._staged_key(txn_id))
        return False
    except Exception:
        return True




def test_many_simultaneous_verifies_yield_exactly_one_success():
    data, mobile = _fresh("Stampede Case")
    barrier, wins, codes = threading.Barrier(8), [], []

    def go():
        barrier.wait()
        try:
            wins.append(abdm.verify_otp(data["txn_id"], data["sandbox_otp"]))
        except abdm.RegistrationError as e:
            codes.append(e.code)

    threads = [threading.Thread(target=go) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    assert len(wins) == 1 and len(codes) == 7
    assert set(codes) <= {"VERIFY_IN_PROGRESS", "TRANSACTION_CLOSED"}


def test_simultaneous_mobile_login_consumes_once():
    data = client.post("/api/abdm/login/mobile/request", json={"mobile": "9876543210"}).json()
    lease = abdm._claim(data["txn_id"])  # another verify holds the lease
    with pytest.raises(abdm.RegistrationError) as busy:
        abdm.verify_otp(data["txn_id"], data["sandbox_otp"])
    assert busy.value.code == "VERIFY_IN_PROGRESS" and _status(data["txn_id"]) == "PENDING"
    abdm._release(data["txn_id"], lease)
    assert abdm.verify_otp(data["txn_id"], data["sandbox_otp"])["patient_token"] == "PT-CASE-NISHI"


def test_crashed_lease_holder_expires_and_same_otp_retries(monkeypatch):
    data, mobile = _fresh("Crash Case")
    abdm._claim(data["txn_id"])  # holder dies without releasing
    with pytest.raises(abdm.RegistrationError):
        abdm.verify_otp(data["txn_id"], data["sandbox_otp"])
    real = time.time
    monkeypatch.setattr(abdm.time, "time", lambda: real() + abdm.VERIFY_LEASE_SECONDS + 1)
    token = abdm.verify_otp(data["txn_id"], data["sandbox_otp"])["patient_token"]


def _fail_once(monkeypatch, owner, name, after_calls=0, after_write=False):
    """Crash on call number after_calls+1 of owner.name; after_write=True lets that call land first."""
    real, calls = getattr(owner, name), []

    def wrapper(*a, **kw):
        calls.append(1)
        if len(calls) == after_calls + 1:
            if after_write:
                real(*a, **kw)
            raise RuntimeError(f"simulated crash in {name}")
        return real(*a, **kw)

    monkeypatch.setattr(owner, name, wrapper)


BOUNDARIES = [
    ("token assigned, before vault", lambda: (global_vault, "store_pii", 0)),
    ("vault written, before ABHA row", lambda: (global_vault, "store_pii", 0, True)),
    ("ABHA row written, before mobile link", lambda: (abdm, "_link_mobile", 0)),
    ("mobile linked, before journey", lambda: (abdm, "_link_mobile", 0, True)),
    ("mid consents", lambda: (abdm.global_db, "record_dpdp_consent", 2)),
    ("before audit", lambda: (global_audit, "record_event", 0)),
    ("audit written, before consume", lambda: (global_audit, "record_event", 0, True)),
    ("everything written, before consume", lambda: (abdm, "_consume_otp", 0)),
]


@pytest.mark.parametrize("label,target", BOUNDARIES, ids=[b[0] for b in BOUNDARIES])
def test_failure_at_each_boundary_keeps_otp_and_retry_converges(monkeypatch, label, target):
    data, mobile = _fresh()
    _fail_once(monkeypatch, *target())
    with pytest.raises(RuntimeError):
        abdm.verify_otp(data["txn_id"], data["sandbox_otp"])
    assert _status(data["txn_id"]) == "PENDING"
    assert len(_rows_for(data["txn_id"])) <= 1
    monkeypatch.undo()
    token = abdm.verify_otp(data["txn_id"], data["sandbox_otp"])["patient_token"]  # same OTP, lease was released


def test_exhaustion_retry_reuses_the_assigned_token(monkeypatch):
    seed = _request(identifier=_random_aadhaar(), beneficiary_name="Reuse Case", mobile=None).json()
    _sequence(monkeypatch, [777, 8888])
    assert _verify(seed).status_code == 200
    data = _request(identifier=_random_aadhaar(), beneficiary_name="Reuse Case", mobile=None).json()
    monkeypatch.setattr(abdm.secrets, "randbelow", lambda n: 777 if n == 10**12 else 8888)
    assert _verify(data).status_code == 503
    assigned = json.loads(abdm._session(data["txn_id"])["pending_json"])["assigned_token"]
    monkeypatch.undo()
    res = _verify(data).json()
    # the orphan vault profile written during the failed attempts is overwritten, not duplicated
    assert res["patient_token"] == assigned and res["abha_card"]["abha_address"] != "reusecase.8888@sbx"


# --- lease takeover fencing + vault isolation between transactions ---



def test_losing_aadhaar_transaction_cannot_touch_winner_profile(monkeypatch):
    aadhaar = _random_aadhaar()
    a = _request(identifier=aadhaar, beneficiary_name="Winner Name", mobile=None).json()
    b = _request(identifier=aadhaar, beneficiary_name="Loser Name", mobile=None).json()
    winner = _verify(a).json()["patient_token"]
    before = global_vault.retrieve_pii(f"{winner}::ABHA")
    # B raced past the identity pre-check: the UNIQUE constraint must stop it
    real_find = abdm._find_abha
    monkeypatch.setattr(abdm, "_find_abha", lambda col, v: None if col == "identity_hash" else real_find(col, v))
    res = _verify(b)
    assert res.status_code == 409 and res.json()["detail"]["code"] == "ALREADY_REGISTERED"
    assert global_vault.retrieve_pii(f"{winner}::ABHA") == before
    loser_token = json.loads(abdm._session(b["txn_id"])["pending_json"])["assigned_token"]
    assert loser_token != winner and f"{loser_token}::ABHA" not in global_vault.list_tokens()
    assert not _staged_gone(b["txn_id"])  # orphan stays under B's private key only (documented gap)


def test_token_clash_with_another_patient_never_overwrites_profile(monkeypatch):
    first = _request(identifier=_random_aadhaar(), beneficiary_name="Owner Name", mobile=None).json()
    owner = _verify(first).json()["patient_token"]
    before = global_vault.retrieve_pii(f"{owner}::ABHA")
    data = _request(identifier=_random_aadhaar(), beneficiary_name="Intruder Name", mobile=None).json()
    monkeypatch.setattr(abdm, "_new_patient_token", lambda: owner)  # simulate two txns drawing one token
    res = _verify(data)
    assert res.status_code == 503 and res.json()["detail"]["code"] == "ABHA_ID_UNAVAILABLE"
    assert global_vault.retrieve_pii(f"{owner}::ABHA") == before
    assert _status(data["txn_id"]) == "PENDING"
