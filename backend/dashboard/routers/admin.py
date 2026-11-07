"""Administrator hospital directory: which hospital offers which cervical cancer services."""
import re
import secrets
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.core import staff_session as ss
from backend.core.database import global_db
from backend.core.security import UserRole, global_audit

router = APIRouter(prefix="/api/admin", tags=["Administration"])

HOSPITAL_TYPES = ("URBAN_HEALTH_CENTRE", "PERIPHERAL_HOSPITAL", "TERTIARY_HOSPITAL")
SERVICES = (
    "VIA_SCREENING", "HPV_DNA_TEST", "COLPOSCOPY", "CERVICAL_BIOPSY", "HISTOPATHOLOGY", "MRI_PELVIS",
    "PRECANCER_TREATMENT", "GYNAE_ONCOLOGY_OPD", "CANCER_SURGERY", "CHEMOTHERAPY", "RADIOTHERAPY",
)


def _init() -> None:
    with global_db._get_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS admin_hospitals (
            hospital_id TEXT PRIMARY KEY, name TEXT NOT NULL, hospital_type TEXT NOT NULL, area TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', services TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        have = {r["name"] for r in conn.execute("PRAGMA table_info(admin_hospitals)").fetchall()}
        for column, kind in (("latitude", "REAL"), ("longitude", "REAL"), ("location_source", "TEXT NOT NULL DEFAULT ''")):
            if column not in have:
                conn.execute(f"ALTER TABLE admin_hospitals ADD COLUMN {column} {kind}")
        conn.commit()


_init()


class HospitalIn(BaseModel):
    name: str = Field(..., max_length=120)
    hospital_type: Literal["URBAN_HEALTH_CENTRE", "PERIPHERAL_HOSPITAL", "TERTIARY_HOSPITAL"]
    area: str = Field(..., max_length=80)
    address: str = Field("", max_length=240)
    phone: str = Field("", max_length=20)
    services: List[str] = Field(..., min_length=1)
    # Coordinates are optional, inside India, and always say where they came from.
    latitude: Optional[float] = Field(None, ge=6, le=38)
    longitude: Optional[float] = Field(None, ge=68, le=98)
    location_source: str = Field("", max_length=120)

    @model_validator(mode="after")
    def _location(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Enter both latitude and longitude, or neither.")
        if self.latitude is not None and not self.location_source.strip():
            raise ValueError("Say where these coordinates came from.")
        if self.latitude is None:
            self.location_source = ""
        return self

    @field_validator("name", "area")
    @classmethod
    def _required_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter at least 2 characters.")
        return value

    @field_validator("address")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        value = value.strip()
        if value and not re.fullmatch(r"\+?[0-9][0-9 -]{5,18}", value):
            raise ValueError("Enter a valid phone number.")
        return value

    @field_validator("services")
    @classmethod
    def _services(cls, value: List[str]) -> List[str]:
        unknown = set(value) - set(SERVICES)
        if unknown:
            raise ValueError(f"Unknown services: {', '.join(sorted(unknown))}")
        return [s for s in SERVICES if s in value]


class HospitalStatus(BaseModel):
    active: bool


def _row(row) -> dict:
    data = dict(row)
    data["services"] = [s for s in data["services"].split(",") if s]
    data["active"] = bool(data["active"])
    return data


def _get(hospital_id: str) -> Optional[dict]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT * FROM admin_hospitals WHERE hospital_id = ?", (hospital_id,)).fetchone()
    return _row(row) if row else None


def _require(hospital_id: str) -> dict:
    hospital = _get(hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")
    return hospital


def _reject_duplicate(req: HospitalIn, ignore_id: str = "") -> None:
    with global_db._get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM admin_hospitals WHERE lower(name) = lower(?) AND lower(area) = lower(?) AND hospital_id != ?",
            (req.name, req.area, ignore_id),
        ).fetchone()
    if row:
        raise HTTPException(status_code=409, detail="This hospital is already listed in this area.")


def _actor(request: Request) -> str:
    staff = getattr(request.state, "staff", None) or {}
    return staff.get("staff_id", "ADMIN")


def _audit(action: str, request: Request, hospital: dict) -> None:
    global_audit.record_event(
        action=action, actor=_actor(request), patient_token="HOSPITAL_DIRECTORY", user_role=UserRole.SYSTEM,
        details={"hospital_id": hospital["hospital_id"], "name": hospital["name"], "active": hospital["active"],
                 "services": hospital["services"]},
    )


@router.get("/hospitals")
async def list_hospitals():
    with global_db._get_conn() as conn:
        rows = conn.execute("SELECT * FROM admin_hospitals ORDER BY active DESC, lower(name)").fetchall()
    return {"hospitals": [_row(r) for r in rows]}


@router.post("/hospitals", status_code=201)
async def add_hospital(req: HospitalIn, request: Request):
    _reject_duplicate(req)
    hospital_id = f"HOSP-{secrets.token_hex(4).upper()}"
    with global_db._get_conn() as conn:
        conn.execute(
            """INSERT INTO admin_hospitals (hospital_id, name, hospital_type, area, address, phone, services, created_by, latitude, longitude, location_source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (hospital_id, req.name, req.hospital_type, req.area, req.address, req.phone,
             ",".join(req.services), _actor(request), req.latitude, req.longitude, req.location_source.strip()),
        )
        conn.commit()
    hospital = _require(hospital_id)
    _audit("ADMIN_HOSPITAL_ADDED", request, hospital)
    return hospital


@router.put("/hospitals/{hospital_id}")
async def update_hospital(hospital_id: str, req: HospitalIn, request: Request):
    _require(hospital_id)
    _reject_duplicate(req, hospital_id)
    with global_db._get_conn() as conn:
        conn.execute(
            """UPDATE admin_hospitals SET name = ?, hospital_type = ?, area = ?, address = ?, phone = ?, services = ?, latitude = ?, longitude = ?, location_source = ?,
               updated_at = CURRENT_TIMESTAMP WHERE hospital_id = ?""",
            (req.name, req.hospital_type, req.area, req.address, req.phone, ",".join(req.services), req.latitude, req.longitude, req.location_source.strip(), hospital_id),
        )
        conn.commit()
    hospital = _require(hospital_id)
    _audit("ADMIN_HOSPITAL_UPDATED", request, hospital)
    return hospital


@router.post("/hospitals/{hospital_id}/status")
async def set_hospital_status(hospital_id: str, req: HospitalStatus, request: Request):
    _require(hospital_id)
    with global_db._get_conn() as conn:
        conn.execute("UPDATE admin_hospitals SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE hospital_id = ?",
                     (int(req.active), hospital_id))
        conn.commit()
    hospital = _require(hospital_id)
    _audit("ADMIN_HOSPITAL_ACTIVATED" if req.active else "ADMIN_HOSPITAL_DEACTIVATED", request, hospital)
    return hospital


class HealthPostIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    area: str = Field(..., min_length=2, max_length=80)
    hospital: str = Field(..., min_length=2, max_length=120)


class RouteIn(BaseModel):
    hospital: str = Field(..., min_length=2, max_length=120)


class StaffIn(BaseModel):
    staff_id: str = Field(..., pattern=r"^[A-Z]{2}-[0-9]{3,6}$")
    name: str = Field(..., min_length=2, max_length=120)
    role: Literal["DOCTOR", "NURSE", "ASHA", "HOSPITAL", "ADMIN"]
    health_post: Optional[str] = None
    hospital: Optional[str] = None
    pin: Optional[str] = Field(None, pattern=r"^[0-9]{6,12}$")


class StaffUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    role: Literal["DOCTOR", "NURSE", "ASHA", "HOSPITAL", "ADMIN"]
    health_post: Optional[str] = None
    hospital: Optional[str] = None
    pin: Optional[str] = Field(None, pattern=r"^[0-9]{6,12}$")


class ActiveIn(BaseModel):
    active: bool


def _directory_audit(action: str, request: Request, **details) -> None:
    global_audit.record_event(action=action, actor=_actor(request), patient_token="HOSPITAL_DIRECTORY",
                              user_role=UserRole.SYSTEM, details=details)


def _active_hospital(name: str) -> None:
    with global_db._get_conn() as conn:
        if not conn.execute("SELECT 1 FROM admin_hospitals WHERE name = ? AND active = 1", (name,)).fetchone():
            raise HTTPException(status_code=422, detail="Choose an active hospital from the directory.")


def _post_exists(name: str) -> None:
    with global_db._get_conn() as conn:
        if not conn.execute("SELECT 1 FROM health_posts WHERE name = ?", (name,)).fetchone():
            raise HTTPException(status_code=404, detail="Health post not found.")


@router.get("/health-posts")
async def list_posts():
    with global_db._get_conn() as conn:
        rows = conn.execute("""SELECT p.name, p.area, p.active, r.hospital FROM health_posts p
                               LEFT JOIN referral_routes r ON r.health_post = p.name ORDER BY p.name""").fetchall()
    return {"health_posts": [{**dict(r), "active": bool(r["active"])} for r in rows]}


@router.post("/health-posts", status_code=201)
async def add_post(req: HealthPostIn, request: Request):
    _active_hospital(req.hospital)
    with global_db._get_conn() as conn:
        if conn.execute("SELECT 1 FROM health_posts WHERE lower(name) = lower(?)", (req.name,)).fetchone():
            raise HTTPException(status_code=409, detail="This health post already exists.")
        conn.execute("INSERT INTO health_posts (name, area) VALUES (?, ?)", (req.name, req.area))
        conn.execute("INSERT OR REPLACE INTO referral_routes (health_post, hospital, updated_by) VALUES (?, ?, ?)", (req.name, req.hospital, _actor(request)))
        conn.commit()
    _directory_audit("ADMIN_HEALTH_POST_ADDED", request, name=req.name, hospital=req.hospital)
    return {"name": req.name, "area": req.area, "hospital": req.hospital, "active": True}


@router.post("/health-posts/{name}/status")
async def post_status(name: str, req: ActiveIn, request: Request):
    _post_exists(name)
    with global_db._get_conn() as conn:
        conn.execute("UPDATE health_posts SET active = ? WHERE name = ?", (int(req.active), name))
        conn.commit()
    _directory_audit("ADMIN_HEALTH_POST_ACTIVATED" if req.active else "ADMIN_HEALTH_POST_DEACTIVATED", request, name=name)
    return {"name": name, "active": req.active}


@router.put("/routes/{name}")
async def set_route(name: str, req: RouteIn, request: Request):
    """New referrals use this route. Existing referrals keep the hospital saved on them."""
    _post_exists(name)
    _active_hospital(req.hospital)
    with global_db._get_conn() as conn:
        old = conn.execute("SELECT hospital FROM referral_routes WHERE health_post = ?", (name,)).fetchone()
        conn.execute("INSERT OR REPLACE INTO referral_routes (health_post, hospital, updated_by) VALUES (?, ?, ?)", (name, req.hospital, _actor(request)))
        conn.commit()
    _directory_audit("ADMIN_ROUTE_CHANGED", request, health_post=name, from_hospital=old["hospital"] if old else None, to_hospital=req.hospital)
    return {"health_post": name, "hospital": req.hospital}


def _check_assignment(role: str, health_post: Optional[str], hospital: Optional[str]) -> None:
    if role in ("NURSE", "ASHA"):
        if not health_post:
            raise HTTPException(status_code=422, detail="Choose a health post for this account.")
        _post_exists(health_post)
    if role == "HOSPITAL":
        if not hospital:
            raise HTTPException(status_code=422, detail="Choose a hospital for this account.")
        _active_hospital(hospital)


def _assignment(role: str, health_post: Optional[str], hospital: Optional[str]):
    return (health_post if role in ("NURSE", "ASHA") else None, hospital if role == "HOSPITAL" else None)


@router.get("/staff")
async def list_staff():
    return {"staff": ss.list_accounts()}


@router.post("/staff", status_code=201)
async def add_staff(req: StaffIn, request: Request):
    if not req.pin:
        raise HTTPException(status_code=422, detail="Set a PIN of 6 to 12 digits.")
    if any(a["staff_id"] == req.staff_id for a in ss.list_accounts()):
        raise HTTPException(status_code=409, detail="This staff ID already exists.")
    _check_assignment(req.role, req.health_post, req.hospital)
    post, hospital = _assignment(req.role, req.health_post, req.hospital)
    ss.save_account(req.staff_id, req.name, req.role, post, hospital, req.pin)
    _directory_audit("ADMIN_STAFF_ADDED", request, staff_id=req.staff_id, role=req.role, health_post=post, hospital=hospital)
    return next(a for a in ss.list_accounts() if a["staff_id"] == req.staff_id)


@router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, req: StaffUpdate, request: Request):
    if not any(a["staff_id"] == staff_id for a in ss.list_accounts()):
        raise HTTPException(status_code=404, detail="Staff account not found.")
    _check_assignment(req.role, req.health_post, req.hospital)
    post, hospital = _assignment(req.role, req.health_post, req.hospital)
    ss.save_account(staff_id, req.name, req.role, post, hospital, req.pin)
    _directory_audit("ADMIN_STAFF_UPDATED", request, staff_id=staff_id, role=req.role, health_post=post, hospital=hospital, pin_changed=bool(req.pin))
    return next(a for a in ss.list_accounts() if a["staff_id"] == staff_id)


@router.post("/staff/{staff_id}/status")
async def staff_status(staff_id: str, req: ActiveIn, request: Request):
    if staff_id == _actor(request) and not req.active:
        raise HTTPException(status_code=409, detail="You cannot deactivate your own account.")
    if not ss.set_account_active(staff_id, req.active):
        raise HTTPException(status_code=404, detail="Staff account not found.")
    _directory_audit("ADMIN_STAFF_ACTIVATED" if req.active else "ADMIN_STAFF_DEACTIVATED", request, staff_id=staff_id)
    return {"staff_id": staff_id, "active": req.active}


@router.get("/dashboard")
async def dashboard():
    """Counts only. No patient names, codes or clinical details."""
    from backend.tools.referral_pathway import aggregate_counts
    return aggregate_counts()


@router.get("/my-actions")
async def my_actions(request: Request):
    actor = _actor(request)
    events = [e for e in global_audit.get_events(limit=500) if e.get("actor") == actor][:100]
    return {"actions": [{"timestamp": e.get("timestamp"), "action": e.get("action"), "details": e.get("details")} for e in events]}
