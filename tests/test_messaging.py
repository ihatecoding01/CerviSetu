"""Messaging must log the truth and never reach anyone outside live mode and the allow-list."""
import httpx
from fastapi.testclient import TestClient

from backend.dashboard.app import app
from backend.tools import messaging as m
from backend.tools.tracker_tools import MultiChannelReminderTool

client = TestClient(app)
OK = httpx.MockTransport(lambda r: httpx.Response(201, json={"sid": "SM1"}))


def _live(monkeypatch, allowed="+919000000001"):
    monkeypatch.setenv("CERVISETU_MESSAGING_MODE", "twilio")
    monkeypatch.setenv("CERVISETU_MESSAGING_ALLOWED_NUMBERS", allowed)
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"):
        monkeypatch.setenv(k, "x")


def test_default_is_simulated_and_sends_nothing(monkeypatch):
    monkeypatch.delenv("CERVISETU_MESSAGING_MODE", raising=False)
    def boom(r):
        raise AssertionError("network used")
    assert m.send("SMS", "hi", "9000000001", live=True, transport=httpx.MockTransport(boom))["status"] == m.SIMULATED


def test_live_only_reaches_allowed_numbers(monkeypatch):
    _live(monkeypatch)
    assert m.send("SMS", "hi", "9000000001", live=True, transport=OK)["status"] == m.SENT
    assert m.send("SMS", "hi", "9000000002", live=True, transport=OK)["status"] == m.BLOCKED
    assert m.send("SMS", "hi", None, live=True, transport=OK)["status"] == m.NO_NUMBER


def test_simulation_flag_never_goes_live(monkeypatch):
    _live(monkeypatch)
    assert m.send("SMS", "hi", "9000000001", live=False, transport=OK)["status"] == m.SIMULATED
    assert MultiChannelReminderTool.dispatch_tier_1_sms("PT-SIM").status == m.SIMULATED
    assert MultiChannelReminderTool.dispatch_tier_2_ivr("PT-SIM").status == m.SIMULATED


def test_failure_is_recorded_as_failure(monkeypatch):
    _live(monkeypatch)
    bad = httpx.MockTransport(lambda r: httpx.Response(400, json={}))
    res = m.send("VOICE", "hi", "9000000001", live=True, transport=bad)
    assert res["status"] == m.FAILED and res["error"] == "HTTP_400"


def test_duplicate_same_day_is_not_resent(monkeypatch):
    _live(monkeypatch)
    key = "dup-test-" + m.secrets.token_hex(4)
    assert m.send("SMS", "hi", "9000000001", live=True, dedupe=key, transport=OK)["status"] == m.SENT
    assert m.send("SMS", "hi", "9000000001", live=True, dedupe=key, transport=OK)["status"] == m.DUPLICATE


def test_log_hides_full_number_and_provider_update_needs_signature(monkeypatch):
    monkeypatch.delenv("CERVISETU_MESSAGING_MODE", raising=False)
    client.post("/api/messages/test", json={"channel": "SMS", "phone": "9000000001"})
    log = client.get("/api/messages").json()
    assert log["mode"] == "simulated" and log["messages"][0]["phone_last4"] == "0001"
    assert "9000000001" not in str(log["messages"][0])
    assert client.post("/api/messages/provider-status", data={"MessageSid": "SM1", "MessageStatus": "delivered"}).status_code == 403
    assert client.post("/api/messages/test", json={"channel": "FAX", "phone": "1"}).status_code == 422
