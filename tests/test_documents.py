"""Interactive documents: real provider response shape, source linking, lab flags and grounded answers."""
import httpx
from fastapi.testclient import TestClient

from backend.core import llm_client
from backend.dashboard.app import app
from backend.dashboard import routers  # noqa: F401
from backend.dashboard.routers import documents as d
from backend.tools.document_ocr import SarvamVisionOCRProvider

client = TestClient(app)
BLOCKS = [{"id": "b1", "page": 1, "text": "Diagnosis: Carcinoma cervix FIGO Stage IIB", "bbox": [0, 0, 1, .1]},
          {"id": "b2", "page": 1, "text": "Hb 9.2 g/dL ANC 1800 Platelets 150 Creatinine 0.9", "bbox": [0, .2, 1, .3]}]


def test_provider_reads_real_blocks_response():
    def handler(req):
        if req.url.path.endswith("/parse"):
            return httpx.Response(201, json={"job_id": "j"})
        if req.url.path.endswith("/status"):
            return httpx.Response(200, json={"status": "completed", "usage": {"pages_processed": 1}})
        return httpx.Response(200, json={"documents": [{"pages": [{"page_num": 1, "blocks": [
            {"block_id": "p1-b2", "text": "second", "reading_order": 2, "bbox_norm": [.1, .2, .3, .4]},
            {"block_id": "p1-b1", "text": "first", "reading_order": 1, "bbox_norm": [.1, .1, .3, .2]}]}]}]})
    out = SarvamVisionOCRProvider(api_key="k", transport=httpx.MockTransport(handler), sleep=lambda s: None).extract(b"x", "image/png")
    assert out["text"] == "first\nsecond" and out["blocks"][0]["id"] == "p1-b1" and out["blocks"][1]["bbox"] == [.1, .2, .3, .4]


def test_labs_flag_only_out_of_range():
    labs = {l["name"]: l for l in d.extract_labs(BLOCKS)}
    assert labs["Haemoglobin"]["abnormal"] is True and labs["Haemoglobin"]["block_id"] == "b2"
    assert labs["ANC"]["abnormal"] is False and labs["Creatinine"]["abnormal"] is False


def test_invented_value_is_marked_not_found():
    fields = d.link_fields([{"key": "figo_stage", "value": "FIGO Stage IIB", "block_id": "b2"},
                            {"key": "chemotherapy", "value": "Cisplatin 40", "block_id": "b1"},
                            {"key": "bogus", "value": "x", "block_id": "b1"}], BLOCKS)
    assert fields[0]["block_id"] == "b1" and fields[0]["found_in_document"] is True
    assert fields[1]["found_in_document"] is False and len(fields) == 2


def test_rule_fallback_links_source():
    keys = {f["key"]: f for f in d.rule_fields(BLOCKS)}
    assert keys["figo_stage"]["block_id"] == "b1"


class FakeAsk:
    def __init__(self, r): self.r = r
    def structured(self, *a, **k): return self.r


def test_answer_needs_support_in_document(monkeypatch):
    body = {"text": "Hb 9.2 g/dL", "question": "What is Hb?"}
    monkeypatch.setattr(llm_client, "global_llm", FakeAsk({"answer": "9.2", "quote": "Hb 9.2"}))
    assert client.post("/api/documents/ask", json=body).json()["found"] is True
    monkeypatch.setattr(llm_client, "global_llm", FakeAsk({"answer": "12", "quote": "Hb 12"}))
    assert client.post("/api/documents/ask", json=body).json()["found"] is False
    monkeypatch.setattr(llm_client, "global_llm", FakeAsk({"answer": "NOT_IN_DOCUMENT", "quote": ""}))
    assert client.post("/api/documents/ask", json=body).json()["answer"] is None


def test_rejects_non_document():
    assert client.post("/api/documents/extract", files={"file": ("a.txt", b"hello", "text/plain")}).status_code == 422


def test_groq_used_only_when_sarvam_fails(monkeypatch):
    client_obj = llm_client.SarvamClient(api_key="k") if hasattr(llm_client, "SarvamClient") else None
    if client_obj is None:
        client_obj = type(llm_client.global_llm)(api_key="k")
    client_obj.groq_key = "g"
    monkeypatch.setattr(llm_client, "LLM_DISABLED", False)
    monkeypatch.setattr(client_obj, "_structured_sarvam", lambda *a, **k: None)
    called = {}

    def fake_post(url, **kw):
        called["url"] = url
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok": 1}'}}]}, request=httpx.Request("POST", url))
    monkeypatch.setattr(llm_client.httpx, "post", fake_post)
    assert client_obj.structured("s", "u", {}, "n") == {"ok": 1} and "groq" in called["url"]
    monkeypatch.setattr(client_obj, "_structured_sarvam", lambda *a, **k: {"first": 1})
    called.clear()
    assert client_obj.structured("s", "u", {}, "n") == {"first": 1} and not called
