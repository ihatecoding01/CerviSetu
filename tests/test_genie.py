"""Ask Genie: role-protected, grounded in live data, and works without the AI."""
from fastapi.testclient import TestClient

from backend.core.staff_session import required_roles
from backend.dashboard.app import app
from backend.dashboard.routers import genie


def test_genie_is_staff_only():
    assert set(required_roles("POST", "/api/genie/ask")) == {"DOCTOR", "NURSE", "ASHA", "ADMIN"}


def test_fallback_answers_from_live_data(monkeypatch):
    monkeypatch.setattr(genie.global_llm, "structured", lambda *a, **k: None)
    r = TestClient(app).post("/api/genie/ask", json={"question": "Where do I upload a lab report?"})
    assert r.status_code == 200
    assert r.json()["source"] == "LIVE_DATA" and r.json()["open_tab"] == "intake-tab"


def test_invented_patients_and_tabs_are_dropped(monkeypatch):
    monkeypatch.setattr(genie.global_llm, "structured",
                        lambda *a, **k: {"answer": "ok", "patients": ["PT-INVENTED"], "open_tab": "nope"})
    body = TestClient(app).post("/api/genie/ask", json={"question": "who?"}).json()
    assert body["patients"] == [] and body["open_tab"] is None


def test_empty_question_rejected():
    assert TestClient(app).post("/api/genie/ask", json={"question": "  "}).status_code == 422


def test_near_empty_speech_gets_no_ai_draft(monkeypatch):
    from backend.core.llm_client import global_llm
    def boom(*a, **k):
        raise AssertionError("AI must not draft from nearly nothing")
    monkeypatch.setattr(global_llm, "structured", boom)
    r = TestClient(app).post("/api/encounter/PT-X/voice-consult", data={"text": "Patient."})
    assert r.status_code == 200 and r.json()["draft"]["source"] == "TRANSCRIPT_ONLY"


def test_internal_labels_are_hidden():
    assert genie._plain("From the LIVE DATA, see Clinical Intake (intake-tab).") == "From today's records, see Clinical Intake."
