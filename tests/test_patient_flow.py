"""Integration tests for CerviSetu Patient Flow endpoints."""
import pytest
from fastapi.testclient import TestClient
from backend.dashboard.app import app

client = TestClient(app)


def test_search_facilities():
    """Verify district facility hub-and-spoke pairing."""
    res = client.get("/api/facilities/search?district=Mirzapur")
    assert res.status_code == 200
    data = res.json()
    assert len(data["facilities"]) == 2
    types = [f["facility_type"] for f in data["facilities"]]
    assert "REGIONAL_EBRT_SPOKE" in types
    assert "CENTRAL_BRACHY_HUB" in types
    assert all(f["pmjay_empanelled"] is True for f in data["facilities"])


def test_patient_healing_clock_and_advance():
    """Unknown patients get a not-started clock (no fabricated progress); the legacy demo advance still works."""
    import secrets
    token = f"PT-ADV-{secrets.token_hex(3)}"

    # 1. Fetch initial healing clock
    res = client.get(f"/api/patient/{token}/healing-clock")
    assert res.status_code == 200
    clock = res.json()["clock"]
    assert clock["patient_token"] == token
    assert clock["total_steps_completed"] == 0
    assert clock["projected_finish_days"] is None
    assert clock["clock_status"] == "NO_PLAN"

    # 2. Advance to Fraction 15 (Day 21 milestone)
    res_adv = client.post("/api/patient/demo/advance-fraction-15", json={
        "patient_token": token,
        "target_step": 15
    })
    assert res_adv.status_code == 200
    adv_data = res_adv.json()
    assert adv_data["clock"]["total_steps_completed"] == 15
    assert adv_data["hub_request_dispatched"] is True
    assert adv_data["pass_status"]["slot_confirmed_by_doctor"] == 0
    after = client.get(f"/api/patient/{token}/healing-clock").json()["clock"]
    assert after["clock_source"] == "LEGACY_DEMO" and after["total_steps_completed"] == 15


def test_hub_slot_confirmation_and_pass_issuance():
    """Verify Step 2B: Hub oncologist confirms OT slot, unlocking bus voucher and dharamshala pass."""
    import secrets
    token = f"PT-CONF-{secrets.token_hex(3)}"

    # Confirm slot
    res = client.post("/api/patient/demo/hub-confirm-slot", json={
        "patient_token": token,
        "confirmed_day": "Day 41",
        "doctor_id": "DR-ONCO-HUB-01"
    })
    assert res.status_code == 200
    pass_data = res.json()["pass_data"]
    assert pass_data["slot_confirmed_by_doctor"] == 1
    assert pass_data["hub_ot_slot_date"] == "Day 41"
    assert "UP-RTC-" in pass_data["bus_voucher_code"]
    assert "DHM-ROOM-" in pass_data["dharamshala_room_code"]

    # Retrieve passes
    res_get = client.get(f"/api/patient/{token}/passes")
    assert res_get.status_code == 200
    assert res_get.json()["pass"]["slot_confirmed_by_doctor"] == 1


def test_soundboard_audio_tracks():
    """Verify reviewed Indic voice audio copy and tracks."""
    res = client.get("/api/patient/soundboard/audio")
    assert res.status_code == 200
    tracks = res.json()["tracks"]
    assert len(tracks) == 3
    track_ids = [t["id"] for t in tracks]
    assert "welcome_healing_clock" in track_ids
    assert "cisplatin_hydration" in track_ids
    assert "brachy_reassurance" in track_ids
