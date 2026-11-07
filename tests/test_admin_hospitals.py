"""Administrator hospital directory: access control, validation, editing and audit."""
import pytest
from fastapi.testclient import TestClient

from backend.core import staff_session as ss
from backend.dashboard.app import app

NAME = "Test Hospital Directory"
BODY = {"name": NAME, "hospital_type": "TERTIARY_HOSPITAL", "area": "Test Area", "address": "1 Test Road",
        "phone": "+91 22 0000 0000", "services": ["MRI_PELVIS", "COLPOSCOPY"]}


def _clean():
    with ss.global_db._get_conn() as conn:
        conn.execute("DELETE FROM admin_hospitals WHERE name LIKE 'Test Hospital%'")
        conn.commit()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    _clean()
    yield TestClient(app)
    _clean()


def _sign_in(client, role):
    assert client.post("/api/staff/demo-login", json={"role": role}).status_code == 200


def test_needs_sign_in(client):
    assert client.get("/api/admin/hospitals").status_code == 401


@pytest.mark.parametrize("role", ["DOCTOR", "NURSE", "ASHA"])
def test_only_admin_allowed(client, role):
    _sign_in(client, role)
    assert client.get("/api/admin/hospitals").status_code == 403
    assert client.post("/api/admin/hospitals", json=BODY).status_code == 403


def test_add_edit_and_deactivate(client):
    _sign_in(client, "ADMIN")
    made = client.post("/api/admin/hospitals", json=BODY)
    assert made.status_code == 201, made.text
    hospital = made.json()
    assert hospital["active"] is True
    assert hospital["services"] == ["COLPOSCOPY", "MRI_PELVIS"]
    assert hospital["created_by"] == "AD-4001"

    edited = client.put(f"/api/admin/hospitals/{hospital['hospital_id']}", json={**BODY, "services": ["HISTOPATHOLOGY"]})
    assert edited.json()["services"] == ["HISTOPATHOLOGY"]

    off = client.post(f"/api/admin/hospitals/{hospital['hospital_id']}/status", json={"active": False})
    assert off.json()["active"] is False
    listed = [h for h in client.get("/api/admin/hospitals").json()["hospitals"] if h["name"] == NAME]
    assert len(listed) == 1 and listed[0]["active"] is False

    _sign_in(client, "DOCTOR")
    actions = [e["action"] for e in client.get("/api/audit-logs").json()["audit_logs"]]
    assert {"ADMIN_HOSPITAL_ADDED", "ADMIN_HOSPITAL_UPDATED", "ADMIN_HOSPITAL_DEACTIVATED"} <= set(actions)


@pytest.mark.parametrize("change", [
    {"name": " "}, {"area": ""}, {"services": []}, {"services": ["DIAGNOSIS"]},
    {"phone": "call me"}, {"hospital_type": "CLINIC"},
])
def test_rejects_invalid(client, change):
    _sign_in(client, "ADMIN")
    assert client.post("/api/admin/hospitals", json={**BODY, **change}).status_code == 422


def test_rejects_duplicate_and_missing(client):
    _sign_in(client, "ADMIN")
    assert client.post("/api/admin/hospitals", json=BODY).status_code == 201
    assert client.post("/api/admin/hospitals", json={**BODY, "name": NAME.upper()}).status_code == 409
    assert client.put("/api/admin/hospitals/HOSP-NONE", json=BODY).status_code == 404


@pytest.mark.parametrize("method,path", [
    ("get", "/api/prevention/vaccinations"), ("get", "/api/vault/inspect/PT-X"), ("get", "/api/fhir/patient/PT-X"),
    ("post", "/api/genie/ask"),
])
def test_admin_is_kept_out_of_clinical_and_field_work(client, method, path):
    _sign_in(client, "ADMIN")
    assert getattr(client, method)(path).status_code == 403
