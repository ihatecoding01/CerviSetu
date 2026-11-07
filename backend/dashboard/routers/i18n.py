"""Translates on-screen text that the built-in dictionaries cannot know in advance: patient and staff names,
hospitals, health posts, findings and sentences built around them. Results are cached on disk per language,
so each distinct string is sent to the language model once."""
import json
import os
import threading
from typing import List

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.core.llm_client import global_llm

router = APIRouter(prefix="/api/i18n", tags=["i18n"])

LANGS = {"hi": "Hindi", "bho": "Bhojpuri", "bn": "Bengali", "mr": "Marathi", "ta": "Tamil", "te": "Telugu"}
MAX_TEXTS, MAX_LEN, BATCH = 60, 400, 15
_lock = threading.Lock()
_cache: dict = {}


def _path(lang: str) -> str:
    base = os.environ.get("CERVISETU_DATA_DIR") or "data"
    os.makedirs(os.path.join(base, "i18n_cache"), exist_ok=True)
    return os.path.join(base, "i18n_cache", f"{lang}.json")


def _load(lang: str) -> dict:
    if lang not in _cache:
        try:
            with open(_path(lang), encoding="utf-8") as f:
                _cache[lang] = json.load(f)
        except (OSError, ValueError):
            _cache[lang] = {}
    return _cache[lang]


def _save(lang: str) -> None:
    tmp = _path(lang) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(_cache[lang], f, ensure_ascii=False)
    os.replace(tmp, _path(lang))


SYSTEM = (
    "You translate on-screen text from a cervical cancer referral app used in India into natural, simple, respectful {lang} "
    "in its native script. Translate each string as a whole sentence so it reads naturally, not word by word. "
    "Write people's names, hospital names, places and health posts in {lang} script (transliterate, do not translate their meaning). "
    "Keep unchanged: codes such as PT-CASE-NISHI or PT-2BE494C0, staff IDs, numbers, dates, and medical acronyms "
    "(HPV, VIA, VILI, HSIL, LSIL, CIN, ASHA, ABHA, OTP, MRI). Do not add, remove or soften any meaning. "
    "Return exactly one translation per input string, in the same order."
)


def _translate(lang: str, texts: List[str]) -> dict:
    out = {}
    schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "string"}}}, "required": ["items"]}
    for i in range(0, len(texts), BATCH):
        batch = texts[i:i + BATCH]
        res = global_llm.structured(system=SYSTEM.format(lang=LANGS[lang]), user=json.dumps({"strings": batch}, ensure_ascii=False),
                                    schema=schema, name="ui_translations", max_tokens=6000)
        items = (res or {}).get("items") or []
        if len(items) != len(batch):
            continue
        for src, tr in zip(batch, items):
            tr = (tr or "").strip().replace("\n", " ")
            if tr:
                out[src] = tr
    return out


class TranslateRequest(BaseModel):
    lang: str
    texts: List[str] = Field(default_factory=list)


@router.post("/translate")
def translate(req: TranslateRequest):
    if req.lang not in LANGS:
        return JSONResponse({"detail": "Unsupported language."}, status_code=400)
    texts = list(dict.fromkeys(t.strip() for t in req.texts if t and t.strip() and len(t) <= MAX_LEN))[:MAX_TEXTS]
    with _lock:
        cache = _load(req.lang)
        todo = [t for t in texts if t not in cache]
    if todo:
        fresh = _translate(req.lang, todo)
        if fresh:
            with _lock:
                _load(req.lang).update(fresh)
                _save(req.lang)
    with _lock:
        cache = _load(req.lang)
        return {"translations": {t: cache[t] for t in texts if t in cache}}
