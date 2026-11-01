"""Tests for Multi-Role User Logging (Patients, Doctors, Nurses/Healthcare Workers)."""
import pytest
from fastapi.testclient import TestClient
from backend.dashboard.app import app
from backend.core.security import global_audit, UserRole
from backend.core.database import global_db

client = TestClient(app)


def test_doctor_sign_off_logging():
    """Verify Doctor sign-off is logged, role-attributed, and cryptographically chained."""
    res = client.post("/api/logs/doctor/sign-off", json={
        "doctor_id": "DR-ONCO-101",
        "patient_token": "PT-TEST-DOC01",
        "case_id": "CASE-9901",
        "action_type": "DOCTOR_OCR_INTAKE_SIGN",
        "notes": "Verified stage IIB cervical carcinoma; CBC/RFT adequate for Cisplatin cycle 1.",
        "ncg_verified": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert "log_id" in data
    block = data["block"]
    assert block["user_role"] == UserRole.DOCTOR
    assert block["action"] == "DOCTOR_OCR_INTAKE_SIGN"
    assert block["actor"] == "DR-ONCO-101"
    assert block["patient_token"] == "PT-TEST-DOC01"
    assert block["channel"] == "WEB_CAREUI"
    assert block["current_hash"] is not None


def test_doctor_triage_logging():
    """Verify Doctor triage of Grade 2+ toxicity alert."""
    res = client.post("/api/logs/doctor/triage", json={
        "doctor_id": "DR-SPOKE-02",
        "patient_token": "PT-TEST-DOC02",
        "toxicity_grade": 2,
        "symptom": "Diarrhea",
        "intervention": "Prescribed ORS + Loperamide; advised hydration protocol."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["block"]["severity"] == "WARNING"
    assert data["block"]["user_role"] == UserRole.DOCTOR


def test_nurse_fraction_and_slip_upload_logging():
    """Verify Nurse/Healthcare Worker logging of fraction completion and slip upload."""
    # 1. Nurse slip upload with Laplacian sharpness
    res_slip = client.post("/api/logs/nurse/slip-upload", json={
        "nurse_id": "NURSE-SPOKE-01",
        "patient_token": "PT-TEST-NURSE01",
        "document_type": "CBC_RFT_LAB",
        "laplacian_score": 94.5,
        "is_legible": True
    })
    assert res_slip.status_code == 200
    data_slip = res_slip.json()
    assert data_slip["block"]["user_role"] == UserRole.NURSE_HEALTHCARE_WORKER
    assert data_slip["block"]["action"] == "NURSE_PAPER_SLIP_UPLOAD"

    # 2. Nurse fraction log (e.g. Fraction 15, Day 21 milestone)
    res_frac = client.post("/api/logs/nurse/fraction", json={
        "nurse_id": "NURSE-SPOKE-01",
        "patient_token": "PT-TEST-NURSE01",
        "fraction_number": 15,
        "machine_id": "LINAC-VARANASI-01",
        "dose_gy": 2.0
    })
    assert res_frac.status_code == 200
    data_frac = res_frac.json()
    assert data_frac["block"]["user_role"] == UserRole.NURSE_HEALTHCARE_WORKER
    assert data_frac["block"]["action"] == "NURSE_EBRT_FRACTION_LOG"


def test_asha_home_visit_logging():
    """Verify ASHA field worker home visit report logging."""
    res = client.post("/api/logs/asha/home-visit", json={
        "asha_id": "ASHA-KALYANPUR-04",
        "patient_token": "PT-TEST-ASHA01",
        "delay_root_cause": "TRAVEL_COST",
        "patient_contacted": True,
        "field_notes": "Visited home; patient lacked bus fare for 47-mile spoke visit. Issued transport pass."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["block"]["user_role"] == UserRole.NURSE_HEALTHCARE_WORKER
    assert data["block"]["channel"] == "ASHA_PWA"


def test_patient_symptom_checkin_logging():
    """Verify Patient logging of symptom reports via vernacular WhatsApp/IVR."""
    res = client.post("/api/logs/patient/symptom-checkin", json={
        "patient_token": "PT-TEST-PAT01",
        "symptoms": ["burning", "loose motions"],
        "severity_grade": 1,
        "channel": "WHATSAPP",
        "voice_note_received": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["block"]["user_role"] == UserRole.PATIENT
    assert data["block"]["action"] == "PATIENT_SYMPTOM_CHECKIN"
    assert data["block"]["channel"] == "WHATSAPP"


def test_generic_user_log_event_and_validation():
    """Test generic endpoint POST /api/logs/event and validation."""
    # Valid call
    res = client.post("/api/logs/event", json={
        "user_role": UserRole.PATIENT,
        "actor_id": "PT-TEST-PAT02",
        "patient_token": "PT-TEST-PAT02",
        "action_type": "PATIENT_HEALING_CLOCK_VIEW",
        "channel": "WEB_CAREUI",
        "severity": "INFO",
        "payload": {"step_viewed": 12, "progress_pct": 41.4}
    })
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"

    # Invalid user_role rejection
    res_bad = client.post("/api/logs/event", json={
        "user_role": "INVALID_ROLE",
        "actor_id": "HACKER",
        "patient_token": "PT-XYZ",
        "action_type": "UNKNOWN"
    })
    assert res_bad.status_code == 400


def test_user_logs_filtering_and_summary():
    """Test retrieving filtered logs by role and aggregated summary with chain verification."""
    # 1. Filter by DOCTOR
    res_doc = client.get("/api/logs/events?user_role=DOCTOR")
    assert res_doc.status_code == 200
    docs = res_doc.json()["logs"]
    assert all(d["user_role"] == "DOCTOR" for d in docs)

    # 2. Filter by NURSE_HEALTHCARE_WORKER
    res_nurse = client.get("/api/logs/events?user_role=NURSE_HEALTHCARE_WORKER")
    assert res_nurse.status_code == 200
    nurses = res_nurse.json()["logs"]
    assert all(d["user_role"] == "NURSE_HEALTHCARE_WORKER" for d in nurses)

    # 3. Filter by PATIENT
    res_pat = client.get("/api/logs/events?user_role=PATIENT")
    assert res_pat.status_code == 200
    pats = res_pat.json()["logs"]
    assert all(d["user_role"] == "PATIENT" for d in pats)

    # 4. Summary & Cryptographic chain verification
    res_sum = client.get("/api/logs/summary")
    assert res_sum.status_code == 200
    sum_data = res_sum.json()
    assert sum_data["chain_integrity"]["is_valid"] is True
    assert sum_data["chain_integrity"]["total_blocks_verified"] > 0
    assert sum_data["ledger_role_counts"]["DOCTOR"] > 0
    assert sum_data["ledger_role_counts"]["NURSE_HEALTHCARE_WORKER"] > 0
    assert sum_data["ledger_role_counts"]["PATIENT"] > 0

