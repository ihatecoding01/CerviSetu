"""Clinician voice consultation: draft, commands, encrypted audio and real purge (fake Sarvam, no network)."""
import io
import wave

from fastapi.testclient import TestClient

from backend.core import llm_client
from backend.dashboard.app import app
from backend.dashboard.routers import encounter_voice as ev

client = TestClient(app)
TOKEN = "PT-CONSULT-TEST"


class Fake:
    def __init__(self, draft=None):
        self.draft, self.clips = draft, 0

    def transcribe(self, audio, filename, language_code="unknown"):
        self.clips += 1
        return {"transcript": "Bleeding after contact, colposcopy done today.", "language_code": "en-IN"}

    def structured(self, system, user, schema, name, **kwargs):
        return self.draft


def _wav(seconds):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes(b"\0\0" * 16000 * seconds)
    return buf.getvalue()


def _post(monkeypatch, fake, seconds=2):
    monkeypatch.setattr(llm_client, "global_llm", fake)
    return client.post(f"/api/encounter/{TOKEN}/voice-consult",
                       files={"audio": ("c.wav", _wav(seconds), "audio/wav")})


def test_draft_and_command_are_suggestions(monkeypatch):
    res = _post(monkeypatch, Fake({"chief_complaints": "Bleeding", "clinical_history": "VIA positive", "working_impression": "Await histopathology",
                                   "differentials": ["Cervicitis"], "medications": [{"name": "ORS"}]})).json()
    assert res["draft"]["source"] == "AI_DRAFT"
    assert res["draft"]["medications"][0]["name"] == "ORS"
    assert [c["command"] for c in res["commands"]] == ["RECORD_COLPOSCOPY"]
    assert res["decision_support_only"] is True


def test_no_ai_keeps_transcript(monkeypatch):
    res = _post(monkeypatch, Fake(None)).json()
    assert res["draft"]["source"] == "TRANSCRIPT_ONLY" and "Bleeding" in res["draft"]["chief_complaints"]


def test_long_recording_is_split(monkeypatch):
    fake = Fake(None)
    assert _post(monkeypatch, fake, seconds=60).status_code == 200
    assert fake.clips == 3


def test_audio_replay_then_real_purge(monkeypatch):
    res = _post(monkeypatch, Fake(None)).json()
    url = f"/api/encounter/{TOKEN}/consult-audio/{res['audio_id']}"
    assert client.get(url).content[:4] == b"RIFF"
    with ev.global_db._get_conn() as conn:
        stored = conn.execute("SELECT ciphertext FROM encounter_audio WHERE audio_id = ?", (res["audio_id"],)).fetchone()
    assert b"RIFF" not in bytes(stored["ciphertext"])[:8]
    assert client.post(f"/api/patient/{TOKEN}/purge-audio-cache").json()["recordings_deleted"] >= 1
    assert client.get(url).status_code == 404


def test_typed_notes_and_empty_input(monkeypatch):
    monkeypatch.setattr(llm_client, "global_llm", Fake(None))
    assert client.post(f"/api/encounter/{TOKEN}/voice-consult", data={"text": "Please record the biopsy"}).json()["commands"][0]["command"] == "RECORD_BIOPSY"
    assert client.post(f"/api/encounter/{TOKEN}/voice-consult", data={"text": " "}).status_code == 422
