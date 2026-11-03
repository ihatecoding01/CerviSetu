"""Tests for expanded ClinicalDatabase schema, prevention CRUD, and seed cohort."""
from pathlib import Path
from backend.core.database import ClinicalDatabase


def test_schema_initialization_and_seed_cohort(tmp_path: Path):
    db_file = tmp_path / "test_cervisetu.db"
    db = ClinicalDatabase(db_path=db_file)

    # 1. Verify seed cohort cases exist
    vaccinations = db.get_hpv_vaccinations()
    assert len(vaccinations) >= 2
    priya_dose1 = next(v for v in vaccinations if v["vaccine_id"] == "VAC-101-01")
    assert priya_dose1["patient_name"] == "Priya Sharma"
    assert priya_dose1["dose_number"] == 1
    assert priya_dose1["vaccine_brand"] == "Cervavac"

    screenings = db.get_screening_records("PT-PREC-202")
    assert len(screenings) >= 1
    assert screenings[0]["result"] == "VIA_POSITIVE"
    assert screenings[0]["triage_action"] == "THERMAL_ABLATION"

    surveillance = db.get_precancer_surveillance_list()
    assert len(surveillance) >= 1
    assert surveillance[0]["diagnosis"] == "CIN_2"
    assert surveillance[0]["treatment_type"] == "THERMAL_ABLATION"

    cases = db.get_all_cases()
    assert len(cases) >= 4

    # 2. Test Chemo Clearance CRUD
    chemo = db.save_chemo_clearance(
        clearance_id="CHEMO-TEST-01",
        patient_token="PT-RURAL-7891",
        cycle_number=4,
        status="APPROVED",
        dose_mg=65.0,
        hb=10.6,
        anc=2300,
        platelets=190,
        creatinine=0.81,
        egfr=85,
        doctor_id="DR-TEST",
        clinical_notes="Good tolerance",
        ebrt_must_continue=1
    )
    assert chemo["status"] == "APPROVED"
    assert chemo["ebrt_must_continue"] == 1

    cleared = db.get_chemo_clearances("PT-RURAL-7891")
    assert any(c["clearance_id"] == "CHEMO-TEST-01" for c in cleared)

    # 3. Test ASHA Field Ticket CRUD
    tickets = db.get_active_asha_tickets()
    assert any(t["ticket_id"] == "TICK-1102-01" for t in tickets)

    updated_ticket = db.update_asha_ticket_outcome(
        ticket_id="TICK-1102-01",
        outcome="RESOLVED_PATIENT_TRAVELING_TOMORROW",
        root_cause="FEAR_OF_PROCEDURE",
        arrival_watch_hours=24
    )
    assert updated_ticket["field_outcome"] == "RESOLVED_PATIENT_TRAVELING_TOMORROW"
    assert updated_ticket["is_resolved"] == 1

    # 4. Test LINAC Downtime Toggle
    status_initial = db.get_linac_downtime_status()
    assert status_initial["is_active"] is False

    toggle_on = db.toggle_linac_downtime(reason="Collimator Maintenance")
    assert toggle_on["is_active"] is True
    assert db.is_linac_downtime_active() is True

    toggle_off = db.toggle_linac_downtime()
    assert toggle_off["is_active"] is False
    assert db.is_linac_downtime_active() is False

    # 5. Test Precancer Treatment Completion
    completed = db.complete_precancer_treatment("PREC-202", completion_date="2026-08-16", margins_clear=1)
    assert completed["completion_date"] == "2026-08-16"
    assert completed["margins_clear"] == 1

