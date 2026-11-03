"""Direct unit tests for Prevention, HPV Vaccination, Screening, and Clinical Safety APIs."""
import asyncio
from backend.dashboard.routers.prevention import (
    log_hpv_vaccination,
    list_hpv_vaccinations,
    trigger_vaccine_outreach,
    record_screening_result,
    list_screenings,
    log_precancer_treatment,
    get_precancer_surveillance_list,
    HpvVaccinationRequest,
    ScreeningRequest,
    PrecancerTreatmentRequest,
    OutreachTriggerRequest,
)
from backend.dashboard.routers.clinical import (
    log_chemo_clearance,
    toggle_linac_downtime,
    get_linac_downtime_status,
    ChemoClearanceRequest,
    DowntimeToggleRequest,
)
from backend.dashboard.routers.logs import verify_audit_chain


def test_hpv_vaccination_lifecycle():
    # 1. Log HPV vaccination dose 1
    req = HpvVaccinationRequest(
        patient_token="PT-TEST-GIRL-01",
        patient_name="Ananya Kumari",
        age=13,
        dose_number=1,
        vaccine_brand="Cervavac",
        school_or_center="Govt Girls Inter College Mirzapur",
        status="COMPLETED"
    )
    res = asyncio.run(log_hpv_vaccination(req))
    assert res["status"] == "SUCCESS"
    assert res["vaccination"]["dose_number"] == 1
    assert res["vaccination"]["next_due_date"] is not None

    vac_id = res["vaccination"]["vaccine_id"]

    # 2. List vaccinations
    list_res = asyncio.run(list_hpv_vaccinations())
    all_vacs = list_res["vaccinations"]
    assert any(v["vaccine_id"] == vac_id for v in all_vacs)

    # 3. Trigger outreach
    outreach_res = asyncio.run(trigger_vaccine_outreach(OutreachTriggerRequest(vaccine_id=vac_id)))
    assert outreach_res["status"] == "SUCCESS"
    assert outreach_res["record"]["outreach_sent"] == 1


def test_screening_and_precancer_lifecycle():
    # 1. Log VIA Positive screening result
    screen_req = ScreeningRequest(
        patient_token="PT-TEST-WOMAN-02",
        patient_name="Rekha Devi",
        age=36,
        test_type="VIA",
        result="VIA_POSITIVE",
        notes="Acetowhite epithelium noted at 12 o'clock position"
    )
    screen_res = asyncio.run(record_screening_result(screen_req))
    assert screen_res["status"] == "SUCCESS"
    assert screen_res["recommended_pathway"] == "THERMAL_ABLATION"

    # 2. Complete thermal ablation precancer procedure
    ablation_req = PrecancerTreatmentRequest(
        patient_token="PT-TEST-WOMAN-02",
        patient_name="Rekha Devi",
        diagnosis="CIN_2",
        treatment_type="THERMAL_ABLATION",
        appointment_date="2026-09-01",
        completion_date="2026-09-01",
        margins_clear=1,
        surveillance_interval_months=6,
        notes="Thermal ablation 100C 60s completed without complications"
    )
    ablation_res = asyncio.run(log_precancer_treatment(ablation_req))
    assert ablation_res["status"] == "SUCCESS"
    assert ablation_res["precancer_episode"]["surveillance_status"] == "SCHEDULED"

    # 3. Verify surveillance list
    surv_res = asyncio.run(get_precancer_surveillance_list())
    assert len(surv_res["surveillance_list"]) >= 1


def test_chemotherapy_hold_safety_flag():
    # Log chemo hold for elevated creatinine
    req = ChemoClearanceRequest(
        patient_token="PT-RURAL-7891",
        cycle_number=3,
        status="HELD",
        dose_mg=0.0,
        hb=9.8,
        anc=1900,
        platelets=150,
        creatinine=1.45,
        egfr=46,
        doctor_id="DR-SHARMA-01",
        clinical_notes="Creatinine elevated to 1.45. Hold Cisplatin 48h and repeat RFT.",
        ebrt_must_continue=1
    )
    res = asyncio.run(log_chemo_clearance(req))
    assert res["status"] == "SUCCESS"
    assert res["ebrt_must_continue"] is True
    assert res["clearance"]["status"] == "HELD"


def test_linac_downtime_and_audit_chain_verification():
    # 1. Toggle LINAC downtime ON
    req_on = DowntimeToggleRequest(
        facility_name="Mirzapur Spoke Clinic",
        machine_id="LINAC-SPOKE-01",
        reason="Beam Steering Magnet Calibration"
    )
    down_on = asyncio.run(toggle_linac_downtime(req_on))
    assert down_on["is_active"] is True

    # Check status
    status_res = asyncio.run(get_linac_downtime_status("Mirzapur Spoke Clinic"))
    assert status_res["status"] == "MAINTENANCE_PAUSED"

    # Toggle LINAC downtime OFF
    req_off = DowntimeToggleRequest(facility_name="Mirzapur Spoke Clinic")
    down_off = asyncio.run(toggle_linac_downtime(req_off))
    assert down_off["is_active"] is False

    # 2. Live SHA-256 chain verification
    verify_res = asyncio.run(verify_audit_chain())
    assert verify_res["status"] == "SUCCESS"
    assert verify_res["is_valid"] is True
    assert verify_res["tamper_detected"] is False


if __name__ == "__main__":
    print("Testing HPV vaccination...")
    test_hpv_vaccination_lifecycle()
    print("Testing screening & precancer...")
    test_screening_and_precancer_lifecycle()
    print("Testing chemotherapy safety flag...")
    test_chemotherapy_hold_safety_flag()
    print("Testing LINAC downtime & audit chain...")
    test_linac_downtime_and_audit_chain_verification()
    print("ALL TESTS PASSED SUCCESSFULLY!")

