"""Facilities and Regional Hub-Spoke directory router."""
from typing import Optional
from fastapi import APIRouter
from backend.core.database import global_db

router = APIRouter(prefix="/api/facilities", tags=["Facilities & Hub-Spoke Directory"])


@router.get("/search")
async def search_facilities(district: Optional[str] = "Mirzapur"):
    """Search and pair Regional Spoke and Central Hub oncology centers by district."""
    results = global_db.search_facilities(district or "Mirzapur")
    return {"query": district, "facilities": results}
