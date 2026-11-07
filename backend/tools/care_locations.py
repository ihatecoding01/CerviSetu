"""Where a patient's care is: her assigned centre and the listed centres around it.

Directory data only. This module never receives a patient's location: distances are worked out in her browser.
It must not choose or change a referral destination; the referral record decides that.
"""
import os
from typing import Any, Dict, List, Optional

from backend.core.database import global_db

OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
OSM_GEOCODER = "https://nominatim.openstreetmap.org/search"


def map_config() -> Dict[str, str]:
    """Providers are set by deployment. Route-based travel time stays off until a routing service is configured."""
    return {"tile_url": os.getenv("CERVISETU_MAP_TILE_URL", OSM_TILES), "geocoder_url": os.getenv("CERVISETU_GEOCODER_URL", OSM_GEOCODER),
            "routing_url": os.getenv("CERVISETU_ROUTING_URL", "")}


def _centre(row: Any) -> Dict[str, Any]:
    has_location = row["latitude"] is not None and row["longitude"] is not None
    return {"name": row["name"], "area": row["area"], "address": row["address"], "phone": row["phone"], "hospital_type": row["hospital_type"],
            "services": [s for s in row["services"].split(",") if s],
            "latitude": row["latitude"] if has_location else None, "longitude": row["longitude"] if has_location else None, "has_location": has_location}


def centres_for(referral: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    assigned_name = (referral or {}).get("hospital")
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM admin_hospitals WHERE active = 1 ORDER BY lower(name)").fetchall()
    assigned: Optional[Dict[str, Any]] = None
    nearby: List[Dict[str, Any]] = []
    for row in rows:
        if row["name"] == assigned_name:
            assigned = _centre(row)
        elif row["latitude"] is not None and row["longitude"] is not None:
            nearby.append(_centre(row))
    if not assigned_name:
        status = "NO_REFERRAL"
    elif not assigned:
        status = "NOT_IN_DIRECTORY"
    else:
        status = "READY" if assigned["has_location"] else "LOCATION_MISSING"
    return {"assigned_name": assigned_name, "assigned_status": status, "assigned": assigned, "nearby": nearby, "map": map_config()}
