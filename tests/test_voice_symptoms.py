"""Tests for voice symptom reporting with a fake Sarvam client (no network)."""
from fastapi.testclient import TestClient

from backend.core import llm_client
from backend.dashboard.app import app

client = TestClient(app)


class FakeSarvam:
    def __init__(self, transcript, triage):
        self._transcript, self._triage = transcript, triage

    def transcribe(self, audio, filename, language_code="unknown"):
        return {"transcript": self._transcript, "language_code": "hi-IN"} if self._transcript else None

    def structured(self, system, user, schema, name, **kwargs):
        return self._triage


def _post(monkeypatch, fake):
    monkeypatch.setattr(llm_client, "global_llm", fake)
    return client.post("/api/patient/PT-VOICE-TEST/voice-symptoms",
                       files={"audio": ("v.wav", b"RIFFfake", "audio/wav")}, data={"clock_day": "12"})


def test_severe_voice_report_raises_ward_alert(monkeypatch):
    res = _post(monkeypatch, FakeSarvam("bahut dast", {"symptom_category": "DIARRHEA", "grade": 3, "english_summary": "severe"}))
    assert res.status_code == 200
    assert res.json()["checkin"]["is_ward_alert"] is True


def test_invalid_grade_goes_to_nurse_review(monkeypatch):
    res = _post(monkeypatch, FakeSarvam("kuch", {"symptom_category": "OTHER", "grade": 9, "english_summary": "?"}))
    assert res.json()["triage"]["grade"] == 2


def test_transcription_failure_returns_503(monkeypatch):
    assert _post(monkeypatch, FakeSarvam("", None)).status_code == 503


def test_symptom_checkin_route_no_longer_crashes():
    res = client.post("/api/patient/PT-VOICE-TEST/symptoms",
                      json={"clock_day": 5, "symptom_category": "NAUSEA_VOMITING", "reported_severity_grade": 1})
    assert res.status_code == 200
