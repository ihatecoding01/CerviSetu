"""Sarvam AI chat-completions client used by the intake and diagnostic agents.

Every call returns None on any failure (no key, network error, bad JSON) so callers
can fall back to the deterministic rule-based pipeline. Only de-identified text is sent.
"""
import json
import logging
from typing import Any, Dict, Optional

import httpx

from backend.config import LLM_DISABLED, SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_LLM_MODEL

logger = logging.getLogger(__name__)


class SarvamLLMClient:
    """Thin wrapper over Sarvam /v1/chat/completions with JSON-schema structured outputs."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, timeout: float = 25.0):
        self.api_key = api_key if api_key is not None else SARVAM_API_KEY
        self.model = model or SARVAM_LLM_MODEL
        self.timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self.api_key) and not LLM_DISABLED

    def structured(self, system: str, user: str, schema: Dict[str, Any], name: str, strict: bool = True) -> Optional[Dict[str, Any]]:
        """Ask the model for a JSON object matching `schema`; None if unavailable or invalid.

        strict=False uses plain JSON mode with the schema in the prompt; sarvam-105b can loop on
        whitespace under strict schemas for some short enum/number fields.
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
            "max_tokens": 1500,
            # null disables reasoning: faster and the whole token budget goes to the answer
            "reasoning_effort": None,
            "response_format": response_format,
        }

        try:
            resp = httpx.post(
                f"{SARVAM_BASE_URL}/v1/chat/completions",
                headers={"api-subscription-key": self.api_key},
                json=body,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content) if content else None
        except Exception as e:
            logger.warning("Sarvam LLM call '%s' failed, using rule-based fallback: %s", name, e)
            return None

    def transcribe(self, audio: bytes, filename: str, language_code: str = "unknown") -> Optional[Dict[str, Any]]:
        """Sarvam saaras speech-to-text (short clips < 30s); returns {transcript, language_code} or None."""
        if not self.enabled or not audio:
            return None
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
            return {"transcript": body.get("transcript", ""), "language_code": body.get("language_code")}
        except Exception as e:
            logger.warning("Sarvam speech-to-text failed: %s", e)
            return None


global_llm = SarvamLLMClient()
