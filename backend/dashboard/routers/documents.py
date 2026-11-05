"""Interactive clinical documents: read an uploaded slip or report, link every extracted value back to
where it appears, flag out-of-range labs and answer questions from the document only.

Personal details are masked before text is returned or sent to the language model. Nothing is stored here
and nothing reaches the record until the clinician uses it in intake. Decision support only.
"""
import json
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.core.security import PIIShield
from backend.tools.document_ocr import DocumentRejected, process_document

router = APIRouter(prefix="/api/documents", tags=["Interactive Clinical Documents"])

FIELD_LABELS = {
    "diagnosis": "Diagnosis", "figo_stage": "FIGO stage", "biopsy": "Biopsy / histology",
    "ebrt_plan": "EBRT plan", "chemotherapy": "Chemotherapy", "brachytherapy": "Brachytherapy / referral",
    "document_date": "Document date", "follow_up": "Follow-up or deadline",
}
FIELD_SCHEMA = {"type": "object", "properties": {"fields": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string", "enum": list(FIELD_LABELS)}, "value": {"type": "string"},
    "block_id": {"type": "string"}}, "required": ["key", "value", "block_id"]}}}, "required": ["fields"]}
FIELD_PROMPT = (
    "Extract clinical facts from an OCR-read oncology document. Text blocks are given as [block_id] text. Use only "
    "what is written; never infer or complete missing values. Copy each value as written, and give the block_id it "
    "came from. Omit fields that are absent. Reply with one JSON object matching this schema: " + json.dumps(FIELD_SCHEMA)
)
ASK_SCHEMA = {"type": "object", "properties": {"answer": {"type": "string"}, "quote": {"type": "string"}},
              "required": ["answer", "quote"]}
ASK_PROMPT = (
    "Answer the clinician's question using only the document text. Give the exact supporting words from the document "
    "in quote. If the document does not contain the answer, set answer to NOT_IN_DOCUMENT and quote to an empty string. "
    "Reply with one JSON object matching this schema: " + json.dumps(ASK_SCHEMA)
)

# name, pattern, unit, abnormal test, what the flag means (CCRT safety thresholds used elsewhere in the encounter)
_NUM = r"[:=\-\s]*(\d+(?:[.,]\d+)?)"
LAB_RULES = [
    ("Haemoglobin", r"\b(?:hb|hgb|ha?emoglobin)\b" + _NUM, "g/dL", lambda v: v < 10, "Low: below 10 g/dL, review before chemoradiation continues"),
    ("ANC", r"\b(?:anc|neutrophils?)\b" + _NUM, "/uL", lambda v: v < 1500, "Low: below 1500/uL, review before cisplatin"),
    ("Platelets", r"\b(?:platelets?|plt)\b" + _NUM, "x10^3/uL", lambda v: v < 100, "Low: below 100 x10^3/uL, review before cisplatin"),
    ("Creatinine", r"\b(?:creatinine|s\.?\s?cr)\b" + _NUM, "mg/dL", lambda v: v > 1.5, "High: above 1.5 mg/dL, review before cisplatin"),
]


_CONTACT = re.compile(r"(?i)\b(phone|mobile|mob|contact|ph)\b[\s:.\-]*\+?\d[\d\s\-]{5,}\d")


def _mask(text: str) -> str:
    """Standard masking, plus labelled contact numbers OCR misread into an unusual length."""
    return _CONTACT.sub(r"\1: [REDACTED_PHONE]", PIIShield.mask_text(text)[0])


def extract_labs(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    labs = []
    for name, pattern, unit, abnormal, note in LAB_RULES:
        for block in blocks:
            match = re.search(pattern, block["text"], re.IGNORECASE)
            if match:
                value = float(match.group(1).replace(",", ""))
                flagged = abnormal(value)
                labs.append({"name": name, "value": value, "unit": unit, "abnormal": flagged, "note": note if flagged else "In range",
                             "block_id": block["id"]})
                break
    return labs


def _norm(text: str) -> str:
    return re.sub(r"[^\w]+", " ", text).strip().lower()


def link_fields(raw: Any, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep known fields, and mark a value as found only if its words really appear in the document."""
    by_id = {b["id"]: b for b in blocks}
    fields, seen = [], set()
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict) or item.get("key") not in FIELD_LABELS or item["key"] in seen:
            continue
        value = str(item.get("value") or "").strip()[:300]
        if not value:
            continue
        block = by_id.get(item.get("block_id"))
        if not block or _norm(value) not in _norm(block["text"]):
            block = next((b for b in blocks if _norm(value) in _norm(b["text"])), None)
        seen.add(item["key"])
        fields.append({"key": item["key"], "label": FIELD_LABELS[item["key"]], "value": value,
                       "block_id": block["id"] if block else None, "found_in_document": bool(block)})
    return fields


def rule_fields(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fallback when the language model is unavailable: simple labelled patterns, still linked to their source."""
    patterns = {"figo_stage": r"figo\s*(?:stage)?\s*[ivx]+[abc]?\d?", "diagnosis": r"carcinoma[^,.\n]*", "ebrt_plan": r"ebrt[^.\n]*",
                "chemotherapy": r"cisplatin[^,.\n]*", "brachytherapy": r"[^.\n]*brachy[^.\n]*", "biopsy": r"biopsy[^.\n]*"}
    found = []
    for key, pattern in patterns.items():
        for block in blocks:
            match = re.search(pattern, block["text"], re.IGNORECASE)
            if match:
                found.append({"key": key, "value": match.group(0).strip(), "block_id": block["id"]})
                break
    return link_fields(found, blocks)


@router.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    from backend.core.llm_client import global_llm

    data = await file.read()
    try:
        doc = process_document(data)
    except DocumentRejected as e:
        raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})

    response: Dict[str, Any] = {"status": doc["status"], "quality": doc.get("quality"), "pages": doc.get("pages"),
                                "file_type": doc.get("file_type"), "partial": doc.get("partial", False),
                                "error": doc.get("error"), "decision_support_only": True}
    if doc["status"] != "COMPLETED":
        return response

    masked_text = _mask(doc["text"])
    blocks = [{**b, "text": _mask(b["text"])} for b in doc.get("blocks") or []]
    if not blocks:  # Provider gave no layout: one block per line, without positions
        blocks = [{"id": f"line-{i}", "page": 1, "text": line, "bbox": None}
                  for i, line in enumerate(l for l in masked_text.splitlines() if l.strip())]
    prompt_text = "\n".join(f"[{b['id']}] {b['text']}" for b in blocks)[:12000]
    raw = global_llm.structured(FIELD_PROMPT, prompt_text, FIELD_SCHEMA, "document_fields", max_tokens=900)
    fields = link_fields((raw or {}).get("fields"), blocks) if raw else rule_fields(blocks)
    return {**response, "text": masked_text, "blocks": blocks, "fields": fields, "labs": extract_labs(blocks),
            "fields_source": "AI" if raw else "RULES"}


class AskRequest(BaseModel):
    text: str = Field(..., max_length=20000)
    question: str = Field(..., max_length=500)


@router.post("/ask")
async def ask_document(req: AskRequest):
    from backend.core.llm_client import global_llm

    text = PIIShield.mask_text(req.text)[0]
    question = PIIShield.mask_text(req.question)[0]
    raw: Optional[Dict[str, Any]] = global_llm.structured(ASK_PROMPT, f"Document:\n{text}\n\nQuestion: {question}", ASK_SCHEMA,
                                                          "document_ask", max_tokens=400)
    if not raw:
        raise HTTPException(status_code=503, detail="Document questions are unavailable right now.")
    answer, quote = str(raw.get("answer") or "").strip(), str(raw.get("quote") or "").strip()
    # An answer with no support in the document is never shown as fact
    if answer == "NOT_IN_DOCUMENT" or not quote or _norm(quote) not in _norm(text):
        return {"found": False, "answer": None, "quote": None}
    return {"found": True, "answer": answer[:800], "quote": quote[:500]}
