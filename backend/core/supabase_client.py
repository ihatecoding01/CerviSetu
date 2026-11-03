"""Supabase REST & PostgREST Client Adapter for CerviSetu Production Database."""
import os
import logging
from typing import Any, Dict, List, Optional
import httpx

from backend.config import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
)

logger = logging.getLogger("cervisetu.supabase")


class SupabaseClient:
    """Lightweight, production-grade PostgREST client for Supabase."""

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
    ):
        self.base_url = (url or SUPABASE_URL or "").rstrip("/")
        # Prefer service role key for backend operations (bypasses RLS), fallback to anon key
        self.api_key = key or SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or ""
        self.is_configured = bool(self.base_url and self.api_key)

    def _get_headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def ping(self) -> bool:
        """Check if Supabase endpoint is reachable and authenticated."""
        if not self.is_configured:
            return False
        try:
            with httpx.Client(timeout=4.0) as client:
                res = client.get(
                    f"{self.base_url}/rest/v1/",
                    headers=self._get_headers(),
                )
                return res.status_code in [200, 404]
        except Exception as exc:
            logger.warning(f"Supabase ping check failed: {exc}")
            return False

    def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, str]] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Query rows from a Supabase table."""
        if not self.is_configured:
            return []
        
        params: Dict[str, Any] = {"select": columns, "limit": limit}
        if filters:
            params.update(filters)

        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(
                    f"{self.base_url}/rest/v1/{table}",
                    headers=self._get_headers(),
                    params=params,
                )
                if res.status_code == 200:
                    return res.json()
                logger.error(f"Supabase select error on {table}: {res.status_code} {res.text}")
                return []
        except Exception as exc:
            logger.error(f"Supabase select request failed on {table}: {exc}")
            return []

    def insert(
        self,
        table: str,
        data: Dict[str, Any] | List[Dict[str, Any]],
        upsert: bool = False,
    ) -> Optional[List[Dict[str, Any]]]:
        """Insert or upsert rows into a Supabase table."""
        if not self.is_configured:
            return None

        prefer = "return=representation"
        if upsert:
            prefer += ",resolution=merge-duplicates"

        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.post(
                    f"{self.base_url}/rest/v1/{table}",
                    headers=self._get_headers(prefer=prefer),
                    json=data,
                )
                if res.status_code in [200, 201]:
                    return res.json()
                logger.error(f"Supabase insert error on {table}: {res.status_code} {res.text}")
                return None
        except Exception as exc:
            logger.error(f"Supabase insert request failed on {table}: {exc}")
            return None

    def update(
        self,
        table: str,
        data: Dict[str, Any],
        filters: Dict[str, str],
    ) -> Optional[List[Dict[str, Any]]]:
        """Update rows matching filters in a Supabase table."""
        if not self.is_configured:
            return None

        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.patch(
                    f"{self.base_url}/rest/v1/{table}",
                    headers=self._get_headers(prefer="return=representation"),
                    params=filters,
                    json=data,
                )
                if res.status_code in [200, 204]:
                    return res.json() if res.text else []
                logger.error(f"Supabase update error on {table}: {res.status_code} {res.text}")
                return None
        except Exception as exc:
            logger.error(f"Supabase update request failed on {table}: {exc}")
            return None


# Global singleton instance
global_supabase = SupabaseClient()

