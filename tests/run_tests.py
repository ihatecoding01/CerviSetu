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
    evaluate_who_protocol,
    schedule_who_protocol_action,
    register_adolescent_beneficiary,
    list_adolescent_beneficiaries,
    record_adolescent_dose,
    trigger_adolescent_cadence_alert,
    record_screening_triage,
    list_screening_cases,
    log_community_checkin,
    get_specialist_queue,
    submit_specialist_review,
    HpvVaccinationRequest,
    ScreeningRequest,
    PrecancerTreatmentRequest,
    OutreachTriggerRequest,
    ProtocolEvaluateRequest,
    ProtocolScheduleRequest,
    AdolescentRegisterRequest,
    AdolescentDoseRequest,
    AdolescentAlertRequest,
    ScreeningTriageRequest,
    CommunityCheckinRequest,
    SpecialistReviewRequest,
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

    print("\n--- 3. Testing Audit Chain Cryptographic Verification ---")
    verify_res = run_coro(verify_audit_chain())
    assert verify_res["status"] == "SUCCESS"
    assert verify_res["is_valid"] is True
    print(f"Audit ledger chain verified: blocks={verify_res['total_blocks_verified']}, valid={verify_res['is_valid']}")

    print("\n--- 4. Testing Multi-Cohort Prevention Engine ---")
    # Cohort 1: Girl age 11 registration, dose tracking & 14-day cadence
    reg_girl = run_coro(register_adolescent_beneficiary(AdolescentRegisterRequest(
        full_name="Komal Yadav",
        age=11,
        dob="2015-05-10",
        guardian_name="Harish Yadav",
        guardian_phone="+91 94150 11990",
        village="Gram Pipra",
        school_or_camp="Mirzapur Middle School"
    )))
    assert reg_girl["status"] == "SUCCESS"
    assert reg_girl["beneficiary"]["dose_count"] == 0
    assert reg_girl["beneficiary"]["status"] == "UNVACCINATED"
    ben_id = reg_girl["beneficiary"]["beneficiary_id"]
    print(f"Cohort 1 Beneficiary registered: {ben_id} (Dose 0/2 UNVACCINATED)")

    # Dose 1 Administration -> T0 + 180 days calculated
    d1 = run_coro(record_adolescent_dose(ben_id, AdolescentDoseRequest(
        dose_number=1,
        batch_number="CERV-2026-T1",
        admin_site="Left Deltoid",
        center="PHC Mirzapur",
        administered_date="2026-05-01"
    )))
    assert d1["status"] == "SUCCESS"
    assert d1["beneficiary"]["dose_count"] == 1
    assert d1["beneficiary"]["status"] == "PARTIALLY_VACCINATED"
    assert d1["beneficiary"]["dose_2_due_date"] == "2026-10-28"
    print(f"Cohort 1 Dose 1 logged: 1/2 PARTIAL (Dose 2 due: {d1['beneficiary']['dose_2_due_date']})")

    # 14-Day Pre-Due Alert
    alert_pre = run_coro(trigger_adolescent_cadence_alert(ben_id, AdolescentAlertRequest(
        alert_type="14_DAY_PRE_DUE",
        notes="Prompt ASHA to verify vaccine vial availability."
    )))
    assert alert_pre["status"] == "SUCCESS"
    assert alert_pre["beneficiary"]["pre_due_alert_sent"] == 1
    print("Cohort 1: 14-day pre-due alert dispatched (Parent notice + ASHA vial check)")

    # 14-Day Overdue Escalation
    alert_over = run_coro(trigger_adolescent_cadence_alert(ben_id, AdolescentAlertRequest(
        alert_type="14_DAY_OVERDUE",
        notes="Second dose overdue >14 days. Home visit required."
    )))
    assert alert_over["status"] == "SUCCESS"
    assert alert_over["beneficiary"]["overdue_alert_count"] >= 1
    print("Cohort 1: 14-day overdue escalation triggered (Priority ASHA task + Voice ping)")

    # Dose 2 Administration (AEFI reported)
    d2 = run_coro(record_adolescent_dose(ben_id, AdolescentDoseRequest(
        dose_number=2,
        batch_number="CERV-2026-T2",
        admin_site="Left Deltoid",
        center="PHC Mirzapur",
        administered_date="2026-11-06",
        aefi_reported=True,
        aefi_notes="Resolved mild tenderness"
    )))
    assert d2["status"] == "SUCCESS"
    assert d2["beneficiary"]["dose_count"] == 2
    assert d2["beneficiary"]["status"] == "FULLY_IMMUNIZED"
    assert d2["beneficiary"]["abdm_logged"] == 1
    print("Cohort 1 Dose 2 logged: 2/2 FULLY IMMUNIZED + ABDM synced")

    # Cohort 2: Women 35-45 AI Screening & Dual-Track Care
    # Normal -> Routine 3-5y Recall
    scr_norm = run_coro(record_screening_triage(ScreeningTriageRequest(
        patient_name="Neelam Devi",
        age=37,
        screening_type="VIA",
        findings_classification="NORMAL"
    )))
    assert scr_norm["triage_track"] == "ROUTINE_3_5Y_RECALL"
    assert scr_norm["care_action_status"] == "RESOLVED"
    print("Cohort 2 Normal screening: routed to ROUTINE_3_5Y_RECALL")

    # Benign Symptomatic -> ASHA Community Management + 14-day check-in
    scr_ben = run_coro(record_screening_triage(ScreeningTriageRequest(
        patient_name="Urmila Singh",
        age=42,
        screening_type="COMBINED",
        test_date="2026-11-01",
        findings_classification="BENIGN_CERVICITIS",
        prescribed_local_therapy="Metronidazole 400mg BD x 7d + Clotrimazole 1% gel"
    )))
    assert scr_ben["triage_track"] == "ASHA_COMMUNITY_MANAGEMENT"
    assert scr_ben["care_action_status"] == "14_DAY_CHECKIN_PENDING"
    cid_ben = scr_ben["case"]["case_id"]
    print("Cohort 2 Benign screening: routed to ASHA_COMMUNITY_MANAGEMENT with 14-day check-in")

    # ASHA 14-Day Check-in Log
    chk_res = run_coro(log_community_checkin(CommunityCheckinRequest(
        case_id=cid_ben,
        outcome="SYMPTOMS_RESOLVED",
        checkin_notes="Symptoms fully resolved"
    )))
    assert chk_res["status"] == "SUCCESS"
    assert chk_res["case"]["care_action_status"] == "RESOLVED"
    print("Cohort 2 ASHA 14-day check-in: symptoms resolved -> marked RESOLVED")

    # Abnormal Suspicious -> Tertiary Referral & Specialist Review
    scr_abn = run_coro(record_screening_triage(ScreeningTriageRequest(
        patient_name="Manju Devi",
        age=44,
        screening_type="VIA",
        test_date="2026-11-02",
        findings_classification="ABNORMAL_VIA_POSITIVE",
        uploaded_image_or_doc="/static/samples/via_acetowhite_lesion.jpg",
        symptom_notes="Dense acetowhite lesion, contact bleeding observed."
    )))
    assert scr_abn["triage_track"] == "TERTIARY_SPECIALIST_REFERRAL"
    assert scr_abn["care_action_status"] == "REFERRED_TO_TERTIARY"
    cid_abn = scr_abn["case"]["case_id"]
    print("Cohort 2 Abnormal screening: routed to TERTIARY_SPECIALIST_REFERRAL")

    # Specialist Review
    spec_q = run_coro(get_specialist_queue())
    assert any(c["case_id"] == cid_abn for c in spec_q["queue"])
    spec_rev = run_coro(submit_specialist_review(SpecialistReviewRequest(
        case_id=cid_abn,
        oncologist_id="DR-SHARMA-ONCOLOGIST",
        clinical_assessment="Suspicious high-grade CIN 3 lesion",
        treatment_plan="Immediate colposcopy biopsy scheduled"
    )))
    assert spec_rev["status"] == "SUCCESS"
    assert spec_rev["case"]["care_action_status"] == "SPECIALIST_REVIEWED"
    print("Tertiary Specialist Review completed and signed off")

    print("\n--- 5. Testing WHO 90-70-90 Prevention & Screening Protocol Engine ---")
    # A. Girl age 14 unvaccinated -> must schedule vaccination
    eval_girl_unvac = run_coro(evaluate_who_protocol(ProtocolEvaluateRequest(
        patient_name="Ananya Kumari",
        age=14,
        gender="FEMALE",
        hpv_vaccinated=False
    )))
    assert eval_girl_unvac["status"] == "SUCCESS"
    assert eval_girl_unvac["is_girl_13_15"] is True
    assert eval_girl_unvac["recommendation"] == "SCHEDULE_VACCINATION"
    assert eval_girl_unvac["target_pillar"] == "90_VACCINATE"
    print("Girl age 14 (unvaccinated): correctly evaluated -> SCHEDULE_VACCINATION")

    # Schedule vaccination for the girl
    sched_vac = run_coro(schedule_who_protocol_action(ProtocolScheduleRequest(
        patient_name="Ananya Kumari",
        age=14,
        gender="FEMALE",
        action_type="SCHEDULE_VACCINATION",
        vaccine_brand="Cervavac",
        dose_number=1,
        center="Primary Health Centre Mirzapur"
    )))
    assert sched_vac["status"] == "SUCCESS"
    assert sched_vac["action_type"] == "SCHEDULE_VACCINATION"
    assert sched_vac["record"]["status"] == "SCHEDULED"
    assert sched_vac["record"]["vaccine_brand"] == "Cervavac"
    print(f"Girl age 14 vaccination scheduled: {sched_vac['record']['vaccine_id']} at {sched_vac['appointment_date']}")

    # B. Girl age 13 vaccinated -> continue
    eval_girl_vac = run_coro(evaluate_who_protocol(ProtocolEvaluateRequest(
        patient_name="Priya Sharma",
        age=13,
        gender="FEMALE",
        hpv_vaccinated=True
    )))
    assert eval_girl_vac["status"] == "SUCCESS"
    assert eval_girl_vac["recommendation"] == "CONTINUE"
    assert eval_girl_vac["protocol_status"] == "VACCINATED_PROTECTED"
    print("Girl age 13 (vaccinated): correctly evaluated -> CONTINUE (VACCINATED_PROTECTED)")

    # C. Woman age 38 unscreened -> must schedule screening
    eval_woman_unscreened = run_coro(evaluate_who_protocol(ProtocolEvaluateRequest(
        patient_name="Sunita Devi",
        age=38,
        gender="FEMALE",
        screened=False
    )))
    assert eval_woman_unscreened["status"] == "SUCCESS"
    assert eval_woman_unscreened["is_woman_35_45"] is True
    assert eval_woman_unscreened["recommendation"] == "SCHEDULE_SCREENING"
    assert eval_woman_unscreened["target_pillar"] == "70_SCREEN"
    print("Woman age 38 (unscreened): correctly evaluated -> SCHEDULE_SCREENING")

    # Schedule high-performance test for the woman
    sched_screen = run_coro(schedule_who_protocol_action(ProtocolScheduleRequest(
        patient_name="Sunita Devi",
        age=38,
        gender="FEMALE",
        action_type="SCHEDULE_SCREENING",
        test_type="HPV_DNA",
        center="Mirzapur District Spoke Clinic"
    )))
    assert sched_screen["status"] == "SUCCESS"
    assert sched_screen["action_type"] == "SCHEDULE_SCREENING"
    assert sched_screen["record"]["test_type"] == "HPV_DNA"
    assert "SCHEDULED" in sched_screen["record"]["clinical_staging"]
    print(f"Woman age 38 screening scheduled: {sched_screen['record']['screening_id']} at {sched_screen['appointment_date']}")

    # D. Woman age 42 screened -> continue
    eval_woman_screened = run_coro(evaluate_who_protocol(ProtocolEvaluateRequest(
        patient_name="Meera Devi",
        age=42,
        gender="FEMALE",
        screened=True
    )))
    assert eval_woman_screened["status"] == "SUCCESS"
    assert eval_woman_screened["recommendation"] == "CONTINUE"
    assert eval_woman_screened["protocol_status"] == "SCREENED_PROTECTED"
    print("Woman age 42 (screened): correctly evaluated -> CONTINUE (SCREENED_PROTECTED)")

    print("\n>>> ALL TESTS PASSED! <<<")


if __name__ == "__main__":
    main()
