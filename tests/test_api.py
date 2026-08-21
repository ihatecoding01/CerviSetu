"""Integration tests for FastAPI endpoints."""
from fastapi.testclient import TestClient
from src.dashboard.app import app

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
