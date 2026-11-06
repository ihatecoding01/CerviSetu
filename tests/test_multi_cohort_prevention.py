"""Tests for Multi-Cohort Prevention Engine:
- Cohort 1: Girls Under 14 (Primary Prevention, 2-Dose Standard Schedule, 14-Day Cadence Alerts)
- Cohort 2: Women 35–45 (Point-of-Care VIA/Pap Screening, AI Triaging & Dual-Track Care)
- Tertiary Specialist Review Portal
"""
import pytest
from fastapi.testclient import TestClient
from backend.dashboard.app import app
from backend.core.database import global_db

client = TestClient(app)


def test_cohort_1_adolescent_registration_and_eligibility():
    # 1. Valid registration (age 11 in 9–14 range)
    res = client.post("/api/prevention/adolescents", json={
        "full_name": "Divya Sharma",
        "age": 11,
        "dob": "2015-06-10",
        "guardian_name": "Suresh Sharma",
        "guardian_phone": "+91 98111 22334",
        "village": "Gram Pipra",
        "school_or_camp": "Mirzapur Middle School",
        "prior_vaccine_audit": "NONE"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    beneficiary = data["beneficiary"]
    assert beneficiary["full_name"] == "Divya Sharma"
    assert beneficiary["dose_count"] == 0
    assert beneficiary["status"] == "UNVACCINATED"
    beneficiary_id = beneficiary["beneficiary_id"]

    # 2. Age out of bounds (age 16) -> should fail
    bad_res = client.post("/api/prevention/adolescents", json={
        "full_name": "Rani Verma",
        "age": 16,
        "guardian_name": "Rajesh Verma",
        "guardian_phone": "+91 98222 33445",
        "village": "Rampur",
        "school_or_camp": "Rampur High School"
    })
    assert bad_res.status_code == 400
    assert "9 to 14 years" in bad_res.json()["detail"]


def test_cohort_1_dose_counting_and_14_day_cadence():
    # Register beneficiary
    reg = client.post("/api/prevention/adolescents", json={
        "full_name": "Roshni Patel",
        "age": 12,
        "guardian_name": "Manoj Patel",
        "guardian_phone": "+91 97333 44556",
        "village": "Kalyanpur",
        "school_or_camp": "Kalyanpur Girls Secondary"
    }).json()["beneficiary"]
    ben_id = reg["beneficiary_id"]

    # Administer Dose 1
    d1_res = client.post(f"/api/prevention/adolescents/{ben_id}/dose", json={
        "dose_number": 1,
        "batch_number": "CERV-2026-X1",
        "admin_site": "Left Deltoid",
        "center": "PHC Kalyanpur",
        "administered_date": "2026-05-01"
    })
    assert d1_res.status_code == 200
    b1 = d1_res.json()["beneficiary"]
    assert b1["dose_count"] == 1
    assert b1["status"] == "PARTIALLY_VACCINATED"
    assert b1["dose_2_due_date"] == "2026-10-28"  # exactly 180 days after 2026-05-01

    # Trigger 14-day pre-due alert (vial readiness check)
    pre_res = client.post(f"/api/prevention/adolescents/{ben_id}/cadence-alert", json={
        "alert_type": "14_DAY_PRE_DUE",
        "notes": "Verify Cervavac vial readiness for scheduled second dose."
    })
    assert pre_res.status_code == 200
    assert pre_res.json()["beneficiary"]["pre_due_alert_sent"] == 1

    # Trigger 14-day overdue alert (priority ASHA task)
    over_res = client.post(f"/api/prevention/adolescents/{ben_id}/cadence-alert", json={
        "alert_type": "14_DAY_OVERDUE",
        "notes": "Second dose overdue by 15 days. Field outreach initiated."
    })
    assert over_res.status_code == 200
    assert over_res.json()["beneficiary"]["overdue_alert_count"] >= 1

    # Administer Dose 2 (with AEFI reporting)
    d2_res = client.post(f"/api/prevention/adolescents/{ben_id}/dose", json={
        "dose_number": 2,
        "batch_number": "CERV-2026-X2",
        "admin_site": "Left Deltoid",
        "center": "PHC Kalyanpur",
        "administered_date": "2026-11-06",
        "aefi_reported": True,
        "aefi_notes": "Mild injection site tenderness resolved in 24 hours."
    })
    assert d2_res.status_code == 200
    b2 = d2_res.json()["beneficiary"]
    assert b2["dose_count"] == 2
    assert b2["status"] == "FULLY_IMMUNIZED"
    assert b2["aefi_reported"] == 1
    assert b2["abdm_logged"] == 1


def test_cohort_2_screening_normal_segregation():
    res = client.post("/api/prevention/screening/triage", json={
        "patient_name": "Geeta Devi",
        "age": 36,
        "screening_type": "VIA",
        "test_date": "2026-11-01",
        "findings_classification": "NORMAL_SQUAMOUS",
        "symptom_notes": "No abnormal lesions. Normal transformation zone."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["triage_track"] == "ROUTINE_3_5Y_RECALL"
    assert data["care_action_status"] == "RESOLVED"


def test_cohort_2_screening_benign_community_track_and_14_day_checkin():
    # 1. Ingest benign cervicitis case
    res = client.post("/api/prevention/screening/triage", json={
        "patient_name": "Sarita Singh",
        "age": 40,
        "screening_type": "COMBINED",
        "test_date": "2026-11-02",
        "findings_classification": "BENIGN_CERVICITIS",
        "symptom_notes": "Cervical inflammation, abnormal vaginal discharge.",
        "prescribed_local_therapy": "Metronidazole 400mg BD x 7d + Clotrimazole 1% gel"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["triage_track"] == "ASHA_COMMUNITY_MANAGEMENT"
    assert data["care_action_status"] == "14_DAY_CHECKIN_PENDING"
    case_id = data["case"]["case_id"]

    # 2. Log 14-day symptom resolution check-in
    chk_res = client.post("/api/prevention/screening/community-checkin", json={
        "case_id": case_id,
        "outcome": "SYMPTOMS_RESOLVED",
        "checkin_notes": "Patient reports discharge and pelvic discomfort completely resolved."
    })
    assert chk_res.status_code == 200
    assert chk_res.json()["case"]["care_action_status"] == "RESOLVED"


def test_cohort_2_screening_abnormal_tertiary_referral_and_specialist_review():
    # 1. Ingest abnormal VIA screening with sample image
    res = client.post("/api/prevention/screening/triage", json={
        "patient_name": "Laxmi Devi",
        "age": 44,
        "screening_type": "VIA",
        "test_date": "2026-11-03",
        "findings_classification": "ABNORMAL_VIA_POSITIVE",
        "uploaded_image_or_doc": "/static/samples/via_acetowhite_lesion.jpg",
        "symptom_notes": "Dense acetowhite lesion, contact bleeding observed.",
        "tertiary_facility": "Varanasi Regional Cancer Centre (Hub)"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["triage_track"] == "TERTIARY_SPECIALIST_REFERRAL"
    assert data["care_action_status"] == "REFERRED_TO_TERTIARY"
    case_id = data["case"]["case_id"]

    # 2. Check Specialist Queue
    q_res = client.get("/api/prevention/specialist/queue")
    assert q_res.status_code == 200
    queue = q_res.json()["queue"]
    assert any(c["case_id"] == case_id for c in queue)

    # 3. Submit Specialist Review
    rev_res = client.post("/api/prevention/specialist/review", json={
        "case_id": case_id,
        "oncologist_id": "DR-ANAND-GYN-ONC",
        "clinical_assessment": "High-grade acetowhite lesion extending into endocervical canal. Suspicious for CIN 3.",
        "treatment_plan": "Colposcopy-directed punch biopsy scheduled. Prescribed topical antiseptic."
    })
    assert rev_res.status_code == 200
    updated_case = rev_res.json()["case"]
    assert updated_case["care_action_status"] == "SPECIALIST_REVIEWED"
    assert "DR-ANAND-GYN-ONC" in updated_case["specialist_doctor_notes"]

