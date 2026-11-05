"""Tests for CerviSetu Interactive Showcase & Developer APIs."""
from backend.dashboard.routers.showcase import (
    parse_prescription_showcase,
    get_voice_script,
    execute_graph_trace,
    calculate_district_impact,
    register_district_pilot,
    PrescriptionParseRequest,
    VoiceScriptRequest,
    GraphTraceRequest,
    DistrictImpactRequest,
    PilotRegisterRequest,
)


def test_prescription_parser_showcase():
    req = PrescriptionParseRequest(sample_id="sample_cervical_01")
    res = parse_prescription_showcase(req)

    assert res["cancer_type"] == "CERVICAL"
    assert res["stage"] == "Stage II" or "II" in res["stage"]
    assert len(res["bounding_boxes"]) >= 4
    assert res["fractions_planned"]["curative_window_days"] == 56
    assert "elapsed_ms" in res
    assert res["pii_shielded"]["vault_token"].startswith("PT-ANON")


def test_voice_script_dialects():
    for dialect in ["HINDI", "BHOJPURI", "BENGALI", "MARATHI", "TAMIL", "TELUGU"]:
        req = VoiceScriptRequest(language=dialect, fraction_number=18)
        res = get_voice_script(req)

        assert res["status"] == "SUCCESS"
        assert res["voice_locale"] is not None
        assert len(res["script"]) > 20
        assert len(res["transliteration"]) > 20
        assert res["ivr_parameters"]["dtmf_key_confirm"] == "1"


def test_graph_trace_reports_real_runs_only(monkeypatch):
    from backend.core import run_trace

    monkeypatch.setattr(run_trace, "latest_trace", lambda: None)
    empty = execute_graph_trace(GraphTraceRequest(simulated_days_overdue=4))
    assert empty["source"] == "NO_RUN_YET" and empty["total_latency_ms"] == 0
    assert all(n["latency_ms"] == 0 for n in empty["nodes"])

    real = {"trace_id": "RUN-1", "recorded_at": "now", "total_latency_ms": 12.5, "patient_token": "PT-1",
            "nodes": [{"node": "tracker", "name": "T", "role": "", "latency_ms": 12.5, "status": "COMPLETED", "summary": "Done."}]}
    monkeypatch.setattr(run_trace, "latest_trace", lambda: real)
    res = execute_graph_trace(GraphTraceRequest(simulated_days_overdue=3))
    assert res["source"] == "LATEST_REAL_RUN" and res["total_latency_ms"] == 12.5
    assert "TIER_3_ASHA" in res["nodes"][-1]["summary"]
    assert len(res["ledger_block"]["sha256"]) == 64


def test_district_impact_formula():
    req = DistrictImpactRequest(
        district_population=2000000,
        annual_cervical_cases=200,
        spoke_clinics_count=5,
        avg_travel_distance_km=70.0,
    )
    res = calculate_district_impact(req)

    assert res["biological_metrics"]["days_saved_per_patient"] == 24
    assert res["biological_metrics"]["estimated_lives_saved_annually"] > 0
    assert res["social_metrics"]["total_travel_km_spared"] > 100000
    assert res["social_metrics"]["estimated_out_of_pocket_savings_inr"] > 1000000


def test_pilot_lead_registration():
    req = PilotRegisterRequest(
        email="district_oncology_officer@bihar.gov.in",
        district="Muzaffarpur",
        facility_type="DISTRICT_HOSPITAL",
        contact_name="Dr. Rajesh Kumar",
        phone="+919876543210",
    )
    res = register_district_pilot(req)

    assert res["status"] == "SUCCESS"
    assert res["lead_id"].startswith("LEAD-")
    assert res["district"] == "Muzaffarpur"
