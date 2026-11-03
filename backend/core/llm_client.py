"""Sarvam AI client used by intake extraction, on-demand summaries, voice triage, speech and TTS.

Every call returns None on any failure (no key, AI disabled, network error, token cap, bad JSON) so
callers fall back to the deterministic pipeline. Chat calls receive only de-identified text.
Each provider request is recorded in the usage log (metadata only, see backend/core/ai_usage.py).
"""
import json
import logging
import time
from typing import Any, Dict, Optional

import httpx

from backend.config import LLM_DISABLED, SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_LLM_MODEL
from backend.core.ai_usage import record_usage

logger = logging.getLogger(__name__)


def _error_category(exc: Exception) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "TIMEOUT"
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return {401: "AUTH", 403: "AUTH", 402: "BILLING", 429: "RATE_LIMIT"}.get(code, f"HTTP_{code // 100}XX")
    if isinstance(exc, httpx.HTTPError):
        return "NETWORK"
    if isinstance(exc, (json.JSONDecodeError, KeyError, IndexError, TypeError)):
        return "INVALID_RESPONSE"
    return "UNKNOWN"


class SarvamLLMClient:
    """Thin wrapper over Sarvam REST endpoints. No automatic retries: one request per call."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, timeout: float = 25.0):
        self.api_key = api_key if api_key is not None else SARVAM_API_KEY
        self.model = model or SARVAM_LLM_MODEL
        self.timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self.api_key) and not LLM_DISABLED

    def structured(
        self, system: str, user: str, schema: Dict[str, Any], name: str,
        strict: bool = False, max_tokens: int = 800,
    ) -> Optional[Dict[str, Any]]:
        """Ask the model for a JSON object matching `schema`; None if unavailable, truncated or invalid.

        Defaults to plain JSON mode with the schema in the prompt: strict json_schema mode was observed to
        loop on whitespace until the token cap. Callers still validate every field themselves.
        """
        if not self.enabled:
            return None

        if strict:
            response_format = {"type": "json_schema", "json_schema": {"name": name, "schema": schema, "strict": True}}
        else:
            response_format = {"type": "json_object"}
            system = f"{system}\nReply with JSON only, matching this JSON schema: {json.dumps(schema)}"

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
            "max_tokens": max_tokens,
            # null disables reasoning: faster and the whole token budget goes to the answer
            "reasoning_effort": None,
            "response_format": response_format,
        }

        started = time.monotonic()
        usage: Dict[str, Any] = {}
        try:
            resp = httpx.post(
                f"{SARVAM_BASE_URL}/v1/chat/completions",
                headers={"api-subscription-key": self.api_key},
                json=body,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            usage = data.get("usage") or {}
            choice = data["choices"][0]
            if choice.get("finish_reason") == "length":
                raise ValueError("TOKEN_LIMIT")
            content = choice["message"]["content"]
            result = json.loads(content) if content else None
            if not isinstance(result, dict):
                raise ValueError("INVALID_JSON")
            self._log_chat(name, True, started, usage)
            return result
        except ValueError as e:
            category = str(e) if str(e) in ("TOKEN_LIMIT", "INVALID_JSON") else "INVALID_JSON"
            self._log_chat(name, False, started, usage, category)
        except Exception as e:
            self._log_chat(name, False, started, usage, _error_category(e))
        logger.warning("Sarvam LLM call '%s' failed; using fallback", name)
        return None

    def _log_chat(self, feature: str, ok: bool, started: float, usage: Dict[str, Any], error: Optional[str] = None):
        record_usage(
            feature, "chat/completions", self.model, ok,
            duration_ms=int((time.monotonic() - started) * 1000),
            input_tokens=usage.get("prompt_tokens"), output_tokens=usage.get("completion_tokens"),
            error_category=error,
        )

    def transcribe(self, audio: bytes, filename: str, language_code: str = "unknown") -> Optional[Dict[str, Any]]:
        """Sarvam saaras speech-to-text (short clips < 30s); returns {transcript, language_code} or None."""
        if not self.enabled or not audio:
            return None
        started = time.monotonic()
        try:
            resp = httpx.post(
                f"{SARVAM_BASE_URL}/speech-to-text",
                headers={"api-subscription-key": self.api_key},
                files={"file": (filename, audio)},
                data={"model": "saaras:v4", "language_code": language_code},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            body = resp.json()
            record_usage("voice_speech_to_text", "speech-to-text", "saaras:v4", True,
                         duration_ms=int((time.monotonic() - started) * 1000))
            return {"transcript": body.get("transcript", ""), "language_code": body.get("language_code")}
        except Exception as e:
            record_usage("voice_speech_to_text", "speech-to-text", "saaras:v4", False,
                         duration_ms=int((time.monotonic() - started) * 1000), error_category=_error_category(e))
            logger.warning("Sarvam speech-to-text failed (%s)", _error_category(e))
            return None

    def synthesize(self, text: str, language_code: str, model: str, speaker: Optional[str] = None) -> Dict[str, Any]:
        """Sarvam text-to-speech. Returns {"audio_base64"} or {"error": category}; never fakes audio."""
        if not self.enabled:
            return {"error": "AI_DISABLED"}
        payload: Dict[str, Any] = {"text": text, "language_code": language_code, "model": model}
        if speaker:
            payload["speaker"] = speaker
        started = time.monotonic()
        try:
            resp = httpx.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers={"api-subscription-key": self.api_key},
                json=payload,
                timeout=15.0,
            )
            resp.raise_for_status()
            audio = resp.json()["audios"][0]
            record_usage("tts_voice_studio", "text-to-speech", model, True,
                         duration_ms=int((time.monotonic() - started) * 1000), characters=len(text))
            return {"audio_base64": audio}
        except Exception as e:
            category = _error_category(e)
            record_usage("tts_voice_studio", "text-to-speech", model, False,
                         duration_ms=int((time.monotonic() - started) * 1000), characters=len(text),
                         error_category=category)
            logger.warning("Sarvam text-to-speech failed (%s)", category)
            return {"error": category}


global_llm = SarvamLLMClient()
