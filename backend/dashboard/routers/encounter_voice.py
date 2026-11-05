"""Clinician voice consultation: speech (or typed notes) -> masked transcript -> reviewable diagnostic draft.

The draft is decision support only. Nothing is written to the record until the clinician applies it, and
spoken commands are returned as suggestions that must be confirmed on screen. Consultation audio is kept
encrypted for replay only until discharge, or until the retention limit, whichever comes first.
"""
import hashlib
import io
import json
import os
import re
import secrets
import time
import wave
from typing import Any, Dict, List, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from backend.config import VAULT_SECRET_KEY
from backend.core.database import global_db
from backend.core.security import PIIShield, UserRole, global_audit

router = APIRouter(prefix="/api/encounter", tags=["Clinician Voice Consultation"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
STT_CHUNK_SECONDS = 25  # The speech-to-text API takes short clips, so longer recordings are split
RETENTION_SECONDS = int(os.getenv("CERVISETU_CONSULT_AUDIO_RETENTION_HOURS", "72")) * 3600
_AES = AESGCM(hashlib.sha256(VAULT_SECRET_KEY.encode() + b"cervisetu-consult-audio-v1").digest())

DRAFT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "chief_complaints": {"type": "string"},
        "clinical_history": {"type": "string"},
        "working_impression": {"type": "string"},
        "toxicity_grade": {"type": "integer", "description": "Estimated highest CTCAE grade, 0-4"},
        "differentials": {"type": "array", "items": {"type": "string"}},
        "red_flags": {"type": "array", "items": {"type": "string"}},
        "next_steps": {"type": "array", "items": {"type": "string"}},
        "medications": {"type": "array", "items": {"type": "object", "properties": {
            "name": {"type": "string"}, "dosage": {"type": "string"}, "frequency": {"type": "string"},
            "duration": {"type": "string"}, "instructions": {"type": "string"}}}},
    },
    "required": ["chief_complaints", "clinical_history", "working_impression"],
}

DRAFT_PROMPT = (
    "You assist an oncologist treating cervical cancer with concurrent chemoradiation. From the consultation "
    "transcript (it may be in an Indian language) and chart context, draft an English note. Use only what the "
    "transcript and context state; never invent findings, doses or history. List medications only if actually "
    "prescribed in the transcript. toxicity_grade is your CTCAE v5 estimate from the described symptoms (for example "
    "diarrhoea: under 4 stools a day over baseline is grade 1, 4 to 6 is grade 2, 7 or more is grade 3); omit it if "
    "no toxicity is described. red_flags lists only concerning findings that are present, never reassuring negatives "
    "or plans. Treat a lab as abnormal only beyond these limits: ANC under 1500/uL, platelets under 100 x10^3/uL, "
    "haemoglobin under 10 g/dL, creatinine over 1.5 mg/dL; normal labs are never red flags. working_impression, differentials, red_flags and next_steps are suggestions "
    "for the clinician to review. Reply with one JSON object matching this schema: " + json.dumps(DRAFT_SCHEMA)
)

# Spoken commands, English and common Hindi/Hinglish. Matched deterministically, never auto-executed.
COMMAND_RULES = [
    ("CHEMO_HOLD", "Hold this week's chemotherapy", r"\b(hold|stop|withhold)\b.{0,20}\b(chemo|cisplatin)|\b(chemo|cisplatin)\b.{0,20}\b(hold|stop|withhold|rok)|कीमो.{0,15}(रोक|बंद)"),
    ("CHEMO_REDUCE", "Reduce the chemotherapy dose", r"\breduce\b.{0,20}\b(chemo|cisplatin|dose)|\b(chemo|cisplatin)\b.{0,20}\breduce|कीमो.{0,15}(कम)"),
    ("CHEMO_APPROVE", "Approve this week's chemotherapy", r"\b(approve|clear|give)\b.{0,20}\b(chemo|cisplatin)|\b(chemo|cisplatin)\b.{0,20}\b(approve|cleared)|कीमो.{0,15}(दे दो|मंज़ूर|मंजूर)"),
    ("LOG_FRACTION", "Log today's EBRT fraction as delivered", r"\b(log|mark|record)\b.{0,25}\bfraction\b|\bfraction\b.{0,20}\b(delivered|given|done)"),
]


def _init_table():
    with global_db._get_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS encounter_audio (
            audio_id TEXT PRIMARY KEY, patient_token TEXT NOT NULL, content_type TEXT NOT NULL,
            nonce BLOB NOT NULL, ciphertext BLOB NOT NULL, expires_at REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        conn.commit()


_init_table()


def _purge_expired(conn) -> None:
    conn.execute("DELETE FROM encounter_audio WHERE expires_at < ?", (time.time(),))


def _store_audio(token: str, data: bytes, content_type: str) -> str:
    audio_id = secrets.token_urlsafe(12)
    nonce = os.urandom(12)
    with global_db._get_conn() as conn:
        _purge_expired(conn)
        conn.execute("""INSERT INTO encounter_audio (audio_id, patient_token, content_type, nonce, ciphertext, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                     (audio_id, token, content_type, nonce, _AES.encrypt(nonce, data, token.encode()),
                      time.time() + RETENTION_SECONDS))
        conn.commit()
    return audio_id


def purge_audio(token: str) -> int:
    """Delete all stored consultation audio for a patient; returns how many recordings were removed."""
    with global_db._get_conn() as conn:
        count = conn.execute("DELETE FROM encounter_audio WHERE patient_token = ?", (token,)).rowcount
        conn.commit()
    return count


def _split_wav(data: bytes) -> List[bytes]:
    """Split a WAV into short clips. Anything that is not a readable WAV is sent as a single clip."""
    try:
        with wave.open(io.BytesIO(data)) as src:
            params = src.getparams()
            per_chunk = params.framerate * STT_CHUNK_SECONDS
            clips = []
            while True:
                frames = src.readframes(per_chunk)
                if not frames:
                    return clips or [data]
                buf = io.BytesIO()
                with wave.open(buf, "wb") as out:
                    out.setparams(params)
                    out.writeframes(frames)
                clips.append(buf.getvalue())
    except (wave.Error, EOFError):
        return [data]


def detect_commands(text: str) -> List[Dict[str, str]]:
    lowered = text.lower()
    return [{"command": c, "label": label} for c, label, rx in COMMAND_RULES if re.search(rx, lowered)]


def _strings(value: Any, limit: int = 8) -> List[str]:
    return [str(v)[:300] for v in value if str(v).strip()][:limit] if isinstance(value, list) else []


def _clean_draft(raw: Optional[Dict[str, Any]], transcript: str) -> Dict[str, Any]:
    if not raw:
        # AI unavailable: still useful, the clinician gets the transcript to edit
        return {"source": "TRANSCRIPT_ONLY", "chief_complaints": transcript[:2000], "clinical_history": "",
                "working_impression": "", "toxicity_grade": None, "differentials": [], "red_flags": [],
                "next_steps": [], "medications": []}
    grade = raw.get("toxicity_grade")
    meds = []
    for m in raw.get("medications") or []:
        if isinstance(m, dict) and str(m.get("name") or "").strip():
            meds.append({k: str(m.get(k) or "")[:200] for k in ("name", "dosage", "frequency", "duration", "instructions")})
    return {"source": "AI_DRAFT", "chief_complaints": str(raw.get("chief_complaints") or "")[:2000],
            "clinical_history": str(raw.get("clinical_history") or "")[:3000],
            "working_impression": str(raw.get("working_impression") or "")[:600],
            "toxicity_grade": grade if isinstance(grade, int) and 0 <= grade <= 4 else None,
            "differentials": _strings(raw.get("differentials")), "red_flags": _strings(raw.get("red_flags")),
            "next_steps": _strings(raw.get("next_steps")), "medications": meds[:10]}


@router.post("/{token}/voice-consult")
async def voice_consult(
    token: str,
    audio: Optional[UploadFile] = File(None),
    text: str = Form(""),
    language_code: str = Form("unknown"),
    context: str = Form(""),
):
    """Turn a recorded consultation (or typed notes) into a draft note, diagnostic support and suggested commands."""
    from backend.core.llm_client import global_llm

    audio_id = None
    detected = None
    if audio is not None:
        data = await audio.read()
        if not data:
            raise HTTPException(status_code=422, detail="Empty audio upload")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Recording too large; keep it under 5 minutes.")
        parts = []
        for clip in _split_wav(data):
            stt = global_llm.transcribe(clip, audio.filename or "consult.wav", language_code)
            if not stt:
                raise HTTPException(status_code=503, detail="Voice transcription is unavailable right now; please type your notes.")
            detected = detected or stt.get("language_code")
            parts.append(stt["transcript"].strip())
        transcript = " ".join(p for p in parts if p)
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech was detected in the recording. Please try again.")
        audio_id = _store_audio(token, data, audio.content_type or "audio/wav")
    else:
        transcript = text.strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="Record audio or type notes first.")

    masked, _ = PIIShield.mask_text(transcript)
    context_masked, _ = PIIShield.mask_text(context[:1500])
    raw = global_llm.structured(DRAFT_PROMPT, f"Chart context: {context_masked}\n\nTranscript: {masked}", DRAFT_SCHEMA,
                                "voice_consult", max_tokens=1200)
    global_audit.record_user_event(
        user_role=UserRole.DOCTOR, action="VOICE_CONSULT_DRAFTED", actor_id="ENCOUNTER_WORKSPACE", patient_token=token,
        details={"input": "AUDIO" if audio_id else "TEXT", "audio_retained": bool(audio_id)}, severity="INFO",
        channel="WEB_CAREUI",
    )
    return {"transcript": masked, "transcript_is_masked": True, "detected_language": detected,
            "draft": _clean_draft(raw, masked), "commands": detect_commands(masked), "audio_id": audio_id,
            "decision_support_only": True}


@router.get("/{token}/consult-audio")
async def list_consult_audio(token: str):
    with global_db._get_conn() as conn:
        _purge_expired(conn)
        conn.commit()
        rows = conn.execute("SELECT audio_id, created_at, expires_at FROM encounter_audio WHERE patient_token = ? ORDER BY created_at",
                            (token,)).fetchall()
    return {"recordings": [dict(r) for r in rows]}


@router.get("/{token}/consult-audio/{audio_id}")
async def play_consult_audio(token: str, audio_id: str):
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT content_type, nonce, ciphertext, expires_at FROM encounter_audio WHERE audio_id = ? AND patient_token = ?",
                           (audio_id, token)).fetchone()
    if not row or row["expires_at"] < time.time():
        raise HTTPException(status_code=404, detail="Recording not found or already purged")
    return Response(_AES.decrypt(row["nonce"], row["ciphertext"], token.encode()), media_type=row["content_type"],
                    headers={"Cache-Control": "no-store"})
