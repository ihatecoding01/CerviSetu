import sys
import os

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

sys.path.insert(0, os.path.abspath("."))

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


def run_coro(coro):
    """Executes a coroutine that has no nested I/O waits without triggering Windows 3.14 proactor hang."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value


def main():
    print("--- 1. Testing HPV Vaccination ---")
    vac_req = HpvVaccinationRequest(
        patient_token="PT-TEST-GIRL-01",
        patient_name="Ananya Kumari",
        age=13,
        dose_number=1,
        vaccine_brand="Cervavac",
        school_or_center="Govt Girls Inter College Mirzapur",
        status="COMPLETED"
    )
    res = run_coro(log_hpv_vaccination(vac_req))
    assert res["status"] == "SUCCESS", res
    vac_id = res["vaccination"]["vaccine_id"]
    print(f"Logged vaccination: {vac_id}")

    list_res = run_coro(list_hpv_vaccinations())
    assert any(v["vaccine_id"] == vac_id for v in list_res["vaccinations"])
    print(f"Listed vaccinations count: {len(list_res['vaccinations'])}")

    outreach_res = run_coro(trigger_vaccine_outreach(OutreachTriggerRequest(vaccine_id=vac_id)))
    assert outreach_res["status"] == "SUCCESS"
    print("Triggered outreach successfully")

    print("\n--- 2. Testing Screening & Precancer ---")
    screen_req = ScreeningRequest(
        patient_token="PT-TEST-WOMAN-02",
        patient_name="Rekha Devi",
        age=36,
        test_type="VIA",
        result="VIA_POSITIVE",
        notes="Acetowhite epithelium noted at 12 o'clock position"
    )
    screen_res = run_coro(record_screening_result(screen_req))
    assert screen_res["status"] == "SUCCESS"
    assert screen_res["recommended_pathway"] == "THERMAL_ABLATION"
    print(f"Screening recorded: pathway={screen_res['recommended_pathway']}")

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
    ablation_res = run_coro(log_precancer_treatment(ablation_req))
    assert ablation_res["status"] == "SUCCESS"
    print(f"Precancer treatment recorded: {ablation_res['precancer_episode']['precancer_id']}")

    surv_res = run_coro(get_precancer_surveillance_list())
    assert len(surv_res["surveillance_list"]) >= 1
    print(f"Surveillance list count: {len(surv_res['surveillance_list'])}")

    print("\n--- 3. Testing Chemo Safety Hold ---")
    chemo_req = ChemoClearanceRequest(
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
    chemo_res = run_coro(log_chemo_clearance(chemo_req))
    assert chemo_res["status"] == "SUCCESS"
    assert chemo_res["ebrt_must_continue"] is True
    print(f"Chemo hold logged: ebrt_must_continue={chemo_res['ebrt_must_continue']}")

    print("\n--- 4. Testing LINAC Downtime & Chain Verification ---")
    req_on = DowntimeToggleRequest(
        facility_name="Mirzapur Spoke Clinic",
        machine_id="LINAC-SPOKE-01",
        reason="Beam Steering Magnet Calibration"
    )
    down_on = run_coro(toggle_linac_downtime(req_on))
    assert down_on["is_active"] is True
    print("LINAC Downtime activated")

    status_res = run_coro(get_linac_downtime_status("Mirzapur Spoke Clinic"))
    assert status_res["status"] == "MAINTENANCE_PAUSED"

    req_off = DowntimeToggleRequest(facility_name="Mirzapur Spoke Clinic")
    down_off = run_coro(toggle_linac_downtime(req_off))
    assert down_off["is_active"] is False
    print("LINAC Downtime resumed")

    verify_res = run_coro(verify_audit_chain())
    assert verify_res["status"] == "SUCCESS"
    assert verify_res["is_valid"] is True
    print(f"Audit ledger chain verified: blocks={verify_res['total_blocks_verified']}, valid={verify_res['is_valid']}")

    print("\n>>> ALL TESTS PASSED! <<<")


if __name__ == "__main__":
    main()
