"""Find Your Centre: the referral decides the destination, directory data only, and no patient location reaches the server."""
import pytest
from fastapi.testclient import TestClient

from backend.core import patient_session as ps
from backend.core.database import global_db
from backend.dashboard.app import app
from backend.tools import care_locations, referral_pathway as rp

PREFIX = "Test Centre"


def _hospital(name, lat=None, lng=None, active=1):
    with global_db._get_conn() as conn:
        conn.execute("""INSERT INTO admin_hospitals (hospital_id, name, hospital_type, area, services, created_by, latitude, longitude, active)
                        VALUES (?, ?, 'TERTIARY_HOSPITAL', 'Area', 'COLPOSCOPY', 'TEST', ?, ?, ?)""", (f"H-{name}", name, lat, lng, active))
        conn.commit()


@pytest.fixture(autouse=True)
def clean():
    def wipe():
        with global_db._get_conn() as conn:
            conn.execute("DELETE FROM admin_hospitals WHERE name LIKE ?", (f"{PREFIX}%",))
            conn.commit()
    wipe()
    yield
    wipe()


def test_assigned_comes_from_referral_even_when_another_is_closer():
    _hospital(f"{PREFIX} Assigned", 19.1, 72.9)
    _hospital(f"{PREFIX} Closer", 19.0, 72.8)
    out = care_locations.centres_for({"hospital": f"{PREFIX} Assigned"})
    assert out["assigned_status"] == "READY" and out["assigned"]["name"] == f"{PREFIX} Assigned"
    names = [c["name"] for c in out["nearby"]]
    assert f"{PREFIX} Closer" in names and f"{PREFIX} Assigned" not in names


def test_missing_coordinates_are_reported_not_invented():
    _hospital(f"{PREFIX} NoPin")
    out = care_locations.centres_for({"hospital": f"{PREFIX} NoPin"})
    assert out["assigned_status"] == "LOCATION_MISSING"
    assert out["assigned"]["latitude"] is None and out["assigned"]["longitude"] is None


def test_centre_without_coordinates_is_not_listed_as_nearby():
    _hospital(f"{PREFIX} NoPin")
    assert f"{PREFIX} NoPin" not in [c["name"] for c in care_locations.centres_for(None)["nearby"]]


def test_inactive_or_unknown_destination_is_not_replaced():
    _hospital(f"{PREFIX} Closed", 19.1, 72.9, active=0)
    _hospital(f"{PREFIX} Open", 19.0, 72.8)
    out = care_locations.centres_for({"hospital": f"{PREFIX} Closed"})
    assert out["assigned_status"] == "NOT_IN_DIRECTORY" and out["assigned"] is None
    assert out["assigned_name"] == f"{PREFIX} Closed"
    assert f"{PREFIX} Closed" not in [c["name"] for c in out["nearby"]]


def test_no_referral():
    assert care_locations.centres_for(None)["assigned_status"] == "NO_REFERRAL"


def test_routing_is_off_in_production_until_configured(monkeypatch):
    monkeypatch.delenv("CERVISETU_ROUTING_URL", raising=False)
    monkeypatch.setenv("CERVISETU_ENV", "production")
    assert care_locations.map_config()["routing_url"] == ""
    monkeypatch.setenv("CERVISETU_ROUTING_URL", "https://routes.example")
    assert care_locations.map_config()["routing_url"] == "https://routes.example"


def test_needs_session_and_own_record_only():
    assert TestClient(app).get("/api/portal/PT-NO-REFERRAL/centres").status_code == 401
    client = TestClient(app)
    client.cookies.set(ps.COOKIE_NAME, ps.issue_session("PT-SOMEONE-ELSE"))
    assert client.get("/api/portal/PT-NO-REFERRAL/centres").status_code == 403


def test_own_session_gets_directory_only_and_location_is_ignored():
    client = TestClient(app)
    client.cookies.set(ps.COOKIE_NAME, ps.issue_session("PT-NO-REFERRAL"))
    before = rp.get_for_patient("PT-NO-REFERRAL")
    res = client.get("/api/portal/PT-NO-REFERRAL/centres", params={"lat": 19.1, "lng": 72.9})
    assert res.status_code == 200
    assert "19.1" not in res.text.split('"map"')[-1] and set(res.json()) == {"assigned_name", "assigned_status", "assigned", "nearby", "map"}
    assert rp.get_for_patient("PT-NO-REFERRAL") == before


def test_no_api_route_accepts_a_patient_location():
    for route in app.routes:
        path = getattr(route, "path", "")
        if path.startswith("/api/portal") and "centres" in path:
            assert getattr(route, "methods", set()) == {"GET"}
    assert not any(c in ("latitude", "longitude") for c in rp.PATIENT_FIELDS + rp.ASHA_FIELDS + rp.HOSPITAL_FIELDS)
    with global_db._get_conn() as conn:
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(referrals)").fetchall()}
    assert not columns & {"latitude", "longitude", "patient_location"}


def _admin(monkeypatch):
    from backend.core import staff_session as ss  # noqa: F401
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    client = TestClient(app)
    assert client.post("/api/staff/demo-login", json={"role": "ADMIN"}).status_code == 200
    return client


BODY = {"name": f"{PREFIX} Admin", "hospital_type": "TERTIARY_HOSPITAL", "area": "A", "services": ["COLPOSCOPY"]}


@pytest.mark.parametrize("extra", [{"latitude": 19.0}, {"latitude": 1.0, "longitude": 72.0, "location_source": "x"}, {"latitude": 19.0, "longitude": 72.0}])
def test_admin_rejects_partial_outside_or_unsourced_coordinates(monkeypatch, extra):
    assert _admin(monkeypatch).post("/api/admin/hospitals", json={**BODY, "area": "Area", **extra}).status_code == 422


def test_admin_saves_sourced_coordinates(monkeypatch):
    res = _admin(monkeypatch).post("/api/admin/hospitals", json={**BODY, "area": "Area", "latitude": 19.0, "longitude": 72.8, "location_source": "Checked on site"})
    assert res.status_code == 201, res.text
    assert res.json()["latitude"] == 19.0 and res.json()["location_source"] == "Checked on site"
