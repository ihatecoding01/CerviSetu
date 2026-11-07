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
from backend.dashboard.routers.logs import verify_audit_chain


def test_hpv_vaccination_lifecycle():
    # 1. Log HPV vaccination dose 1
    req = HpvVaccinationRequest(
        patient_token="PT-TEST-GIRL-01",
        patient_name="Ananya Kumari",
        age=13,
        dose_number=1,
        vaccine_brand="Cervavac",
        school_or_center="Parel Municipal School",
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
    assert screen_res["recommended_pathway"] == "COLPOSCOPY_GUIDED_BIOPSY"

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






if __name__ == "__main__":
    print("Testing HPV vaccination...")
    test_hpv_vaccination_lifecycle()
    print("Testing screening & precancer...")
    test_screening_and_precancer_lifecycle()
    print("ALL TESTS PASSED SUCCESSFULLY!")

