"""Public hospital search: the hospitals the administrator has listed."""
from typing import Optional

from fastapi import APIRouter

from backend.core.database import global_db

router = APIRouter(prefix="/api/facilities", tags=["Hospital Directory"])


@router.get("/search")
async def search_facilities(q: Optional[str] = ""):
    like = f"%{(q or '').strip().lower()}%"
    with global_db._get_conn() as conn:
        rows = conn.execute(
            """SELECT name, hospital_type, area, address, phone, services FROM admin_hospitals
               WHERE active = 1 AND (lower(name) LIKE ? OR lower(area) LIKE ?) ORDER BY lower(name) LIMIT 20""",
            (like, like),
        ).fetchall()
    return {"query": q, "facilities": [{**dict(r), "services": [s for s in r["services"].split(",") if s]} for r in rows]}
