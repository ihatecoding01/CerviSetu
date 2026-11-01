"""Integration tests for FastAPI endpoints."""
from fastapi.testclient import TestClient
from backend.dashboard.app import app

client = TestClient(app)


def test_api_run_case_endpoint():
    response = client.post(
        "/api/run-case",
        data={
            "raw_text": "Patient with 2cm lung nodule. Hemoptysis for 2 weeks. Suspected Stage II Lung Cancer. Follow up in 7 days.",
            "patient_name": "Devendra Singh",
            "phone": "+91 9876543210",
            "village": "Rampur",
            "district": "Varanasi",
            "days_overdue": 0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["patient_token"].startswith("PT-ANON")
    assert data["intake_status"] == "COMPLETED"
    assert data["clinical_intake"]["suspected_cancer_type"] == "LUNG"


def test_api_simulate_escalation_endpoint():
    response = client.post(
        "/api/simulate-escalation",
        json={
            "patient_token": "PT-ANON-API-TEST",
            "days_overdue": 8,
            "cancer_type": "ORAL",
            "stage": "Stage III",
            "biopsy_status": "POSITIVE"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["active_tier"] == "TIER_4_AUTHORITY_ESCALATION"
    assert data["authority_dossier"] is not None


def test_api_audit_logs_endpoint():
    response = client.get("/api/audit-logs?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "audit_logs" in data


def test_api_facilities_search():
    response = client.get("/api/facilities/search?district=Varanasi")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "Varanasi"
    assert len(data["facilities"]) >= 2


def test_spa_static_and_fallback_routes():
    # Root returns index.html
    root_res = client.get("/")
    assert root_res.status_code == 200
    assert "text/html" in root_res.headers.get("content-type", "")

    # SPA subroutes (/staff, /patient/PT-SAMPLE, /demo) return index.html fallback
    staff_res = client.get("/staff")
    assert staff_res.status_code == 200
    assert "text/html" in staff_res.headers.get("content-type", "")

    patient_res = client.get("/patient/PT-DEMO-01")
    assert patient_res.status_code == 200
    assert "text/html" in patient_res.headers.get("content-type", "")

    demo_res = client.get("/demo")
    assert demo_res.status_code == 200
    assert "text/html" in demo_res.headers.get("content-type", "")

    # Unknown /api route returns 404 JSON instead of HTML fallback
    api_404 = client.get("/api/nonexistent-route-endpoint")
    assert api_404.status_code == 404
    assert api_404.json()["detail"] == "API route not found"

