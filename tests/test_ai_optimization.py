"""Sarvam credit optimisation and document OCR: caching, on-demand summaries, usage tracking, OCR, voice/TTS.

Everything runs offline: fake clients, httpx.MockTransport and synthetic documents. No live Sarvam calls.
"""
import io
import json

import cv2
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend import config
from backend.core import ai_usage, llm_client
from backend.core.database import global_db
from backend.dashboard.app import app
from backend.tools import document_ocr
from backend.tools.ocr_tools import ClinicalEntityExtractorTool, LLMClinicalExtractor

client = TestClient(app)

SYNTHETIC_SLIP = [
    "Patient: Kamla Devi  Phone: 98765 43210",
    "Village: Rampur  District: Mumbai",
    "Carcinoma cervix FIGO stage IIB",
    "Biopsy: squamous cell carcinoma",
    "Plan: colposcopy guided biopsy",
]
OCR_TEXT = "\n".join(SYNTHETIC_SLIP)
ENTITIES = {
    "cancer_type": "CERVICAL", "figo_stage": "IIB", "biopsy_status": "POSITIVE", "histology": "SCC",
    "symptoms": [], "age": 45, "gender": "FEMALE", "screening_findings": [], "treatment_plan": "CCRT",
    "follow_up_days": 7,
}


class FakeLLM:
    model = "fake-model"
    enabled = True

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def structured(self, system, user, schema, name, **kwargs):
        self.calls.append((name, user))
        return self.responses.get(name)


class FakeOCR:
    name, model, configured = "fake_ocr", "fake-ocr-1", True

    def __init__(self, text=OCR_TEXT, error=None):
        self.text, self.error, self.calls = text, error, 0

    def extract(self, data, mime):
        self.calls += 1
        if self.error:
            raise document_ocr.OCRError(self.error)
        return {"text": self.text, "pages": 1}


def _png(blur=False, size=(900, 700), fmt="PNG"):
    img = np.full((size[1], size[0]), 255, np.uint8)
    for i, line in enumerate(SYNTHETIC_SLIP):
        cv2.putText(img, line, (30, 80 + i * 90), cv2.FONT_HERSHEY_SIMPLEX, 1.0, 0, 2)
    if blur:
        img = cv2.GaussianBlur(img, (61, 61), 25)
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, format=fmt)
    return buf.getvalue()


def _usage_rows():
    with global_db._get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ai_usage_log").fetchall()]


# ---------- extraction cache ----------

def test_identical_masked_input_hits_cache():
    fake = FakeLLM({"clinical_extraction": ENTITIES})
    rules = ClinicalEntityExtractorTool.extract_entities("note")
    first = LLMClinicalExtractor.enhance("masked note", rules, llm=fake)
    second = LLMClinicalExtractor.enhance("masked note", rules, llm=fake)
    assert len(fake.calls) == 1
    assert first["extraction_cache_hit"] is False and second["extraction_cache_hit"] is True
    assert second["suspected_stage"] == "Stage IIB"
    assert any(r["cache_hit"] == 1 for r in _usage_rows())


def test_changed_input_model_or_prompt_misses_cache(monkeypatch):
    fake = FakeLLM({"clinical_extraction": ENTITIES})
    rules = ClinicalEntityExtractorTool.extract_entities("note")
    LLMClinicalExtractor.enhance("note A", rules, llm=fake)
    LLMClinicalExtractor.enhance("note B", rules, llm=fake)
    assert len(fake.calls) == 2

    other_model = FakeLLM({"clinical_extraction": ENTITIES})
    other_model.model = "other-model"
    LLMClinicalExtractor.enhance("note A", rules, llm=other_model)
    assert len(other_model.calls) == 1

    monkeypatch.setattr(LLMClinicalExtractor, "PROMPT_VERSION", "extract-v999")
    LLMClinicalExtractor.enhance("note A", rules, llm=fake)
    assert len(fake.calls) == 3


def test_invalid_output_is_not_cached():
    rules = ClinicalEntityExtractorTool.extract_entities("note")
    bad = FakeLLM({"clinical_extraction": {"figo_stage": "9Z", "biopsy_status": "MAYBE"}})
    LLMClinicalExtractor.enhance("same", rules, llm=bad)
    LLMClinicalExtractor.enhance("same", rules, llm=bad)
    assert len(bad.calls) == 2


def test_cache_keys_and_store_contain_no_raw_pii():
    fake = FakeLLM({"clinical_extraction": ENTITIES})
    from backend.core.security import PIIShield
    masked, _ = PIIShield.mask_text(OCR_TEXT)
    LLMClinicalExtractor.enhance(masked, ClinicalEntityExtractorTool.extract_entities(masked), llm=fake)
    with global_db._get_conn() as conn:
        dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM ai_cache").fetchall()])
    for pii in ("Kamla", "98765", "Rampur"):
        assert pii not in dump
    assert all(len(r["cache_key"]) == 64 for r in json.loads(dump))


# ---------- on-demand summary ----------

def _intake_case():
    res = client.post("/api/run-case", data={"raw_text": "Carcinoma cervix stage IIB. Biopsy: SCC.",
                                             "patient_name": "Leela Devi"})
    assert res.status_code == 200
    return res.json()


def test_intake_does_not_generate_summary():
    body = _intake_case()
    synth = body["diagnostic_synthesis"]
    assert synth["ai_summary_status"] == "not_generated"
    assert synth["ai_generated"] is False and synth["ai_clinician_summary"] == ""
    assert not [r for r in _usage_rows() if r["feature"] == "clinical_summary"]


def test_summary_endpoint_disabled_ai_returns_clear_state():
    token = _intake_case()["patient_token"]
    res = client.post(f"/api/patient/{token}/ai-summary", json={"requested_by": "DR-01"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "AI_DISABLED" and body["ai_generated"] is False
    assert body["ai_clinician_summary"] == ""


def test_summary_endpoint_generates_draft_when_requested(monkeypatch):
    token = _intake_case()["patient_token"]
    draft = {"clinician_summary": "FIGO IIB SCC.", "patient_message_hindi": "कृपया आएं।",
             "patient_message_english": "Please come."}
    fake = FakeLLM({"clinical_summary": draft})
    monkeypatch.setattr(llm_client, "global_llm", fake)
    body = client.post(f"/api/patient/{token}/ai-summary", json={"requested_by": "DR-01"}).json()
    assert body["status"] == "GENERATED" and len(fake.calls) == 1
    assert body["requires_clinician_approval"] is True and body["patient_message_sent"] is False
    assert "Leela" not in fake.calls[0][1]

    again = client.post(f"/api/patient/{token}/ai-summary", json={"requested_by": "DR-01"}).json()
    assert again["status"] == "CACHED" and len(fake.calls) == 1
    assert client.post("/api/patient/PT-NONE/ai-summary", json={"requested_by": "DR-01"}).status_code == 404


# ---------- usage tracking via the real client (mocked HTTP) ----------

def _enable_client(monkeypatch):
    monkeypatch.setattr(llm_client, "LLM_DISABLED", False)
    return llm_client.SarvamLLMClient(api_key="test-key-not-real")


def test_usage_recorded_for_success_and_failure(monkeypatch):
    c = _enable_client(monkeypatch)

    def ok(url, **kw):
        assert kw["json"]["max_tokens"] == 300
        assert kw["json"]["response_format"] == {"type": "json_object"}
        return httpx.Response(200, request=httpx.Request("POST", url), json={
            "choices": [{"finish_reason": "stop", "message": {"content": '{"a": 1}'}}],
            "usage": {"prompt_tokens": 11, "completion_tokens": 5}})
    monkeypatch.setattr(llm_client.httpx, "post", ok)
    assert c.structured("s", "u", {}, "feature_x", max_tokens=300) == {"a": 1}

    def truncated(url, **kw):
        return httpx.Response(200, request=httpx.Request("POST", url), json={
            "choices": [{"finish_reason": "length", "message": {"content": '{"a":'}}]})
    monkeypatch.setattr(llm_client.httpx, "post", truncated)
    assert c.structured("s", "u", {}, "feature_x") is None

    def rate_limited(url, **kw):
        return httpx.Response(429, request=httpx.Request("POST", url))
    monkeypatch.setattr(llm_client.httpx, "post", rate_limited)
    assert c.structured("s", "u", {}, "feature_x") is None

    rows = [r for r in _usage_rows() if r["feature"] == "feature_x"]
    assert [r["success"] for r in rows] == [1, 0, 0]
    assert rows[0]["input_tokens"] == 11 and rows[0]["output_tokens"] == 5
    assert rows[1]["error_category"] == "TOKEN_LIMIT" and rows[1]["input_tokens"] is None
    assert rows[2]["error_category"] == "RATE_LIMIT"
    dump = json.dumps(rows)
    assert "test-key-not-real" not in dump and '"u"' not in dump

    summary = client.get("/api/dev/ai-usage").json()
    assert any(f["feature"] == "feature_x" and f["failed"] == 2 for f in summary["features"])


# ---------- OCR: validation and quality ----------

def test_validation_rejects_bad_files():
    for data, code in [
        (b"", "EMPTY_FILE"),
        (b"MZ\x90\x00 not a document", "UNSUPPORTED_TYPE"),
        (b"\x89PNG\r\n\x1a\n" + b"garbage" * 20, "CORRUPT_FILE"),
        (b"%PDF-1.4 truncated", "CORRUPT_FILE"),
        (b"%PDF-1.4\n" + b"<< /Type /Page >>\n" * 3 + b"%%EOF", "TOO_MANY_PAGES"),
    ]:
        with pytest.raises(document_ocr.DocumentRejected) as e:
            document_ocr.validate_upload(data)
        assert e.value.code == code
    with pytest.raises(document_ocr.DocumentRejected) as e:
        document_ocr.validate_upload(_png(), max_bytes=1000)
    assert e.value.code == "FILE_TOO_LARGE"


def test_quality_gate_blocks_blurry_image_before_provider():
    fake = FakeOCR()
    out = document_ocr.process_document(_png(blur=True), provider=fake)
    assert out["status"] == "QUALITY_REJECTED" and fake.calls == 0 and out["text"] == ""


def test_sharp_image_reaches_provider_and_cache_avoids_repeat():
    fake = FakeOCR()
    first = document_ocr.process_document(_png(), provider=fake)
    assert first["status"] == "COMPLETED" and first["quality"]["status"] in ("PASS", "WARN")
    second = document_ocr.process_document(_png(), provider=fake)
    assert fake.calls == 1 and second["cache_hit"] is True
    assert "Kamla" not in second["text"]  # cache stores masked text only

    other = FakeOCR()
    other.model = "fake-ocr-2"  # provider/config change invalidates the cache
    document_ocr.process_document(_png(), provider=other)
    assert other.calls == 1


def test_ocr_disabled_by_default_and_failure_is_honest():
    assert document_ocr.process_document(_png())["status"] == "OCR_DISABLED"
    failed = document_ocr.process_document(_png(), provider=FakeOCR(error="RATE_LIMIT"))
    assert failed["status"] == "OCR_FAILED" and failed["error"] == "RATE_LIMIT" and failed["text"] == ""


def test_webp_is_accepted_and_converted():
    fake = FakeOCR()
    assert document_ocr.process_document(_png(fmt="WEBP"), provider=fake)["status"] == "COMPLETED"


# ---------- OCR: intake integration ----------

def _run_case(monkeypatch, provider, text="", llm=None, doc=None):
    monkeypatch.setattr(document_ocr, "get_provider", lambda: provider)
    if llm:
        monkeypatch.setattr(llm_client, "global_llm", llm)
    return client.post("/api/run-case", data={"raw_text": text, "patient_name": "Sita Kumari"},
                       files={"image_file": ("Kamla_Devi_slip.png", doc or _png(), "image/png")})


def test_ocr_text_is_masked_and_reuses_single_extraction_call(monkeypatch):
    llm = FakeLLM({"clinical_extraction": ENTITIES})
    res = _run_case(monkeypatch, FakeOCR(), llm=llm)
    assert res.status_code == 200
    body = res.json()
    assert body["document_processing"]["status"] == "COMPLETED"
    assert body["intake_sources"]["combination"] == "OCR_ONLY"
    assert [c[0] for c in llm.calls] == ["clinical_extraction"]  # one LLM call, no summary
    sent = llm.calls[0][1]
    for pii in ("Kamla", "98765", "Rampur", "Sita"):
        assert pii not in sent
    assert "IIB" in sent
    assert "Kamla" not in body["document_processing"]["ocr_text_masked"]
    assert "Kamla_Devi_slip" not in res.text and "uploads" not in res.text


def test_typed_text_kept_first_and_ocr_failure_falls_back(monkeypatch):
    llm = FakeLLM({})
    res = _run_case(monkeypatch, FakeOCR(), text="Clinician note: stage IIIB", llm=llm)
    assert res.json()["intake_sources"]["combination"] == "TYPED_AND_OCR"
    assert llm.calls[0][1].index("stage IIIB") < llm.calls[0][1].index("OCR")
    assert res.json()["clinical_intake"]["estimated_stage"] == "Stage IIIB"

    # A different document (the identical one above is now cached, which correctly skips the provider)
    failed = _run_case(monkeypatch, FakeOCR(error="TIMEOUT"), text="Carcinoma cervix stage IIB.", doc=_png(size=(920, 700)))
    assert failed.status_code == 200
    assert failed.json()["document_processing"]["status"] == "OCR_FAILED"
    assert failed.json()["intake_sources"]["document_ocr"] is False

    no_text = _run_case(monkeypatch, FakeOCR(error="TIMEOUT"), doc=_png(size=(940, 700)))
    assert no_text.status_code == 422 and no_text.json()["detail"]["code"] == "OCR_FAILED"


def test_invalid_upload_rejected_and_typed_only_still_works(monkeypatch):
    bad = _run_case(monkeypatch, FakeOCR(), text="note", doc=b"not an image")
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "UNSUPPORTED_TYPE"
    typed = client.post("/api/run-case", data={"raw_text": "Carcinoma cervix stage IIB."})
    assert typed.status_code == 200 and typed.json()["document_processing"] is None
    assert client.post("/api/run-case", data={}).status_code == 422


# ---------- Sarvam Vision provider REST flow (mocked) ----------

def test_sarvam_vision_provider_flow(monkeypatch):
    monkeypatch.setattr(config, "LLM_DISABLED", False)
    seen = []

    def handler(request: httpx.Request):
        seen.append((request.method, request.url.path))
        assert request.headers["api-subscription-key"] == "test-key"
        if request.url.path.endswith("/job/parse"):
            assert b"Kamla_Devi" not in request.content  # generic filename only
            return httpx.Response(201, json={"job_id": "J1", "status": "pending"})
        if request.url.path.endswith("/status"):
            state = "running" if len([s for s in seen if s[1].endswith("/status")]) == 1 else "completed"
            return httpx.Response(200, json={"job_id": "J1", "status": state, "usage": {"pages_processed": 1}})
        return httpx.Response(200, json={"status": "completed", "documents": [
            {"pages": [{"page_number": 1, "content": "<p>Carcinoma cervix</p><p>FIGO IIB &amp; SCC</p>"}]}]})

    p = document_ocr.SarvamVisionOCRProvider(api_key="test-key", poll_interval=0, sleep=lambda s: None,
                                            transport=httpx.MockTransport(handler))
    out = p.extract(_png(), "image/png")
    assert out["text"] == "Carcinoma cervix\nFIGO IIB & SCC"
    assert [s[1] for s in seen] == ["/doc-ai/v1/job/parse", "/doc-ai/v1/job/J1/status",
                                    "/doc-ai/v1/job/J1/status", "/doc-ai/v1/job/J1/results"]
    row = [r for r in _usage_rows() if r["feature"] == "document_ocr"][-1]
    assert row["success"] == 1 and row["pages"] == 1

    failing = document_ocr.SarvamVisionOCRProvider(
        api_key="test-key", sleep=lambda s: None,
        transport=httpx.MockTransport(lambda r: httpx.Response(402, json={"title": "billing"})))
    with pytest.raises(document_ocr.OCRError) as e:
        failing.extract(_png(), "image/png")
    assert e.value.category == "BILLING"


def test_vision_provider_not_configured_when_ai_disabled():
    assert document_ocr.SarvamVisionOCRProvider(api_key="k").configured is False


# ---------- voice and TTS ----------

class FakeVoice(FakeLLM):
    def __init__(self, transcript, responses=None):
        super().__init__(responses)
        self.transcript = transcript

    def transcribe(self, audio, filename, language_code="unknown"):
        return {"transcript": self.transcript, "language_code": "hi-IN"}


def _voice(monkeypatch, fake, audio=b"RIFFfake", ctype="audio/wav"):
    monkeypatch.setattr(llm_client, "global_llm", fake)
    return client.post("/api/patient/PT-VOICE-OPT/voice-symptoms", files={"audio": ("v.wav", audio, ctype)})








def test_ai_off_switch_disables_stt_and_tts():
    real = llm_client.SarvamLLMClient(api_key="k")
    assert real.transcribe(b"audio", "v") is None
    assert real.synthesize("नमस्ते", "hi-IN", config.SARVAM_TTS_MODEL) == {"error": "AI_DISABLED"}
    res = client.post("/api/showcase/synthesize-speech", json={"text": "नमस्ते", "language": "HINDI"}).json()
    assert res["status"] == "FALLBACK" and res["sarvam_audio"] is False and res["reason"] == "AI_DISABLED"
    assert not _usage_rows()


def test_tts_rejects_unsupported_model_and_speaker():
    assert client.post("/api/showcase/synthesize-speech",
                       json={"text": "hi", "language": "HINDI", "model": "bulbul:v99"}).status_code == 422
    assert client.post("/api/showcase/synthesize-speech",
                       json={"text": "hi", "language": "HINDI", "speaker": "ritu_hi_medical"}).status_code == 422
    assert client.post("/api/showcase/synthesize-speech",
                       json={"text": "hi", "language": "KLINGON"}).status_code == 422


def test_tts_request_shape_matches_sdk(monkeypatch):
    c = _enable_client(monkeypatch)

    def handler(url, **kw):
        assert kw["json"] == {"text": "नमस्ते", "language_code": "hi-IN", "model": "bulbul:v4-flash"}
        return httpx.Response(200, request=httpx.Request("POST", url), json={"audios": ["UklGRg=="]})
    monkeypatch.setattr(llm_client.httpx, "post", handler)
    assert c.synthesize("नमस्ते", "hi-IN", "bulbul:v4-flash") == {"audio_base64": "UklGRg=="}
