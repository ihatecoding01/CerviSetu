"""Result cache and usage log for external AI (Sarvam) calls.

Cache keys are SHA-256 hashes of versioned, already de-identified inputs (or document bytes for OCR),
so no raw text or PII is ever stored in a key. Callers cache only results that passed validation.

The usage log records metadata only: feature, API, model, timing, outcome and whatever usage counters
the provider returned. It never stores prompts, transcripts, audio, OCR text or API keys. Counters the
provider did not return stay NULL ("unknown"); nothing is estimated.
"""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from backend.core.database import global_db

CACHE_TTL_DAYS = float(os.getenv("CERVISETU_AI_CACHE_TTL_DAYS", "30"))


def cache_key(feature: str, **parts: Any) -> str:
    """Stable hash of the feature plus every input that changes the result (model, prompt/schema version...)."""
    payload = json.dumps({"feature": feature, **parts}, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def cache_get(key: str) -> Optional[Any]:
    now = datetime.now(timezone.utc).isoformat()
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT value_json, expires_at FROM ai_cache WHERE cache_key = ?", (key,)).fetchone()
        if not row:
            return None
        if row["expires_at"] <= now:
            conn.execute("DELETE FROM ai_cache WHERE cache_key = ?", (key,))
            conn.commit()
            return None
        return json.loads(row["value_json"])


def cache_put(key: str, feature: str, value: Any, ttl_days: float = CACHE_TTL_DAYS) -> None:
    expires = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
    with global_db._get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ai_cache (cache_key, feature, value_json, expires_at) VALUES (?, ?, ?, ?)",
            (key, feature, json.dumps(value, ensure_ascii=False), expires),
        )
        conn.commit()


def record_usage(
    feature: str,
    api: str,
    model: Optional[str],
    success: bool,
    *,
    cache_hit: bool = False,
    duration_ms: Optional[int] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    audio_seconds: Optional[float] = None,
    characters: Optional[int] = None,
    pages: Optional[int] = None,
    error_category: Optional[str] = None,
) -> None:
    """Log one provider request (or cache hit). Never raises: tracking must not break a clinical flow."""
    try:
        with global_db._get_conn() as conn:
            conn.execute("""
                INSERT INTO ai_usage_log
                (feature, api, model, requested_at, success, cache_hit, duration_ms, input_tokens, output_tokens,
                 audio_seconds, characters, pages, error_category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (feature, api, model, datetime.now(timezone.utc).isoformat(), int(success), int(cache_hit),
                  duration_ms, input_tokens, output_tokens, audio_seconds, characters, pages, error_category))
            conn.commit()
    except Exception:
        pass


def usage_summary() -> Dict[str, Any]:
    """Per-feature totals. Token/page sums cover only requests where the provider reported them."""
    with global_db._get_conn() as conn:
        rows = conn.execute("""
            SELECT feature, api, model,
                   SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS provider_requests,
                   SUM(CASE WHEN cache_hit = 0 AND success = 1 THEN 1 ELSE 0 END) AS succeeded,
                   SUM(CASE WHEN cache_hit = 0 AND success = 0 THEN 1 ELSE 0 END) AS failed,
                   SUM(cache_hit) AS cache_hits,
                   SUM(input_tokens) AS input_tokens,
                   SUM(output_tokens) AS output_tokens,
                   SUM(CASE WHEN cache_hit = 0 AND input_tokens IS NULL THEN 1 ELSE 0 END) AS requests_without_token_usage,
                   SUM(pages) AS pages,
                   SUM(characters) AS characters,
                   AVG(CASE WHEN cache_hit = 0 THEN duration_ms END) AS avg_duration_ms
            FROM ai_usage_log GROUP BY feature, api, model ORDER BY feature
        """).fetchall()
        errors = conn.execute("""
            SELECT feature, error_category, COUNT(*) AS n FROM ai_usage_log
            WHERE error_category IS NOT NULL GROUP BY feature, error_category
        """).fetchall()
    return {
        "features": [dict(r) for r in rows],
        "errors": [dict(r) for r in errors],
        "note": "NULL token/page/character totals mean the provider did not report usage; values are not estimated.",
    }
