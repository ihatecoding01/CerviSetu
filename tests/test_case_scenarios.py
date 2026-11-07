"""The doctors' five teaching cases, each walked through the whole pathway with real role sessions."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.core import patient_session
from backend.dashboard.app import app
from backend.tools import referral_pathway as rp
from backend.tools.teaching_cases import BY_TOKEN, CASES

REFERRED = [c for c in CASES if c["refer"]]
HOSPITALS = {"Bindu Gupta": "Cooper Hospital", "Nishi Paul": "KEM Hospital", "Radha Singh": "Siddharth Hospital", "Rita Naidu": "Sir JJ Hospital"}
ids = lambda c: c["key"]  # noqa: E731


@pytest.fixture
def doctor(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    c = TestClient(app)
    assert c.post("/api/staff/demo-login", json={"role": "DOCTOR"}).status_code == 200
    return c


def _intake(case, **extra):
    return rp.create({"patient_name": case["name"], "age": case["age"], "area": case["area"], "health_post": case["post"], "screening_finding": case["finding"],
                      "red_flags": case["red_flags"], "refer": case["refer"], "urgent": case["urgent"], "message_consent": "GRANTED", "form": case["form"], **extra}, "NURSE")


def test_sheet_has_all_five_cases():
    assert [c["name"] for c in CASES] == ["Sarita Jaiswal", "Bindu Gupta", "Nishi Paul", "Radha Singh", "Rita Naidu"]
    assert [c["histopathology"] for c in CASES] == ["", "CIN 1", "CIN 2", "CIS", "Invasive cancer"]


@pytest.mark.parametrize("case", CASES, ids=ids)
def test_each_case_has_its_via_image(case):
    assert list((Path(rp.__file__).parents[1] / "seed_assets" / "via").glob(f"{case['key']}.*"))


def test_sarita_normal_screen_is_not_referred_or_followed():
    case = BY_TOKEN["PT-CASE-SARITA"]
    row = _intake(case)
    assert row["status"] == rp.ROUTINE and row["hospital"] is None and row["following"] is False
    with pytest.raises(rp.ReferralError):
        rp.send_reminder(row["referral_id"], "T")


@pytest.mark.parametrize("case", REFERRED, ids=ids)
def test_abnormal_case_goes_to_the_route_hospital_and_is_followed(case):
    row = _intake(case)
    assert row["hospital"] == HOSPITALS[case["name"]] and row["following"] is True and bool(row["urgent"]) == case["urgent"]


@pytest.mark.parametrize("case", REFERRED, ids=ids)
def test_full_record_from_arrival_to_treatment_plan(case, doctor):
    row = _intake(case)
    rid = row["referral_id"]
    assert doctor.post(f"/api/referrals/{rid}/arrival").status_code == 200
    body = {"colposcopy": case["colposcopy"]["impression"], "colposcopy_findings": case["colposcopy"], "biopsy": case["biopsy"],
            "histopathology": case["histopathology"], "mri": case.get("mri"), "final_diagnosis": case["final_diagnosis"], "treatment_plan": case["plan"]}
    res = doctor.post(f"/api/referrals/{rid}/clinical", json=body)
    assert res.status_code == 200
    saved = res.json()
    assert saved["final_diagnosis"] == case["final_diagnosis"] and saved["treatment_plan"] == case["plan"]
    assert saved["following"] is False and saved["form"]["via_findings"] == case["form"]["via_findings"]
    assert saved["colposcopy_findings"]["impression"] == case["colposcopy"]["impression"]


@pytest.mark.parametrize("case", REFERRED, ids=ids)
def test_diagnosis_waits_for_histopathology(case, doctor):
    rid = _intake(case)["referral_id"]
    doctor.post(f"/api/referrals/{rid}/arrival")
    for histology in ("", "Pending"):
        res = doctor.post(f"/api/referrals/{rid}/clinical", json={"histopathology": histology, "biopsy": "Pending", "final_diagnosis": case["final_diagnosis"]})
        assert res.status_code == 422


@pytest.mark.parametrize("case", REFERRED, ids=ids)
def test_nothing_clinical_is_invented_from_the_screen(case):
    row = _intake(case)
    assert not (row["final_diagnosis"] or row["histopathology"] or row["treatment_plan"] or row["biopsy"] or row["colposcopy"])


def test_blank_form_fields_stay_blank():
    case = BY_TOKEN["PT-CASE-BINDU"]
    row = _intake(case)
    assert "family_cancer_history" not in row["form"] and "hpv_dna" not in row["form"]


@pytest.mark.parametrize("case", REFERRED, ids=ids)
def test_patient_never_gets_findings_in_her_view(case):
    row = _intake(case)
    c = TestClient(app)
    c.cookies.set(patient_session.COOKIE_NAME, patient_session.issue_session(row["patient_token"]))
    data = c.get(f"/api/portal/{row['patient_token']}/overview").json()["referral"]
    assert data["hospital"] == HOSPITALS[case["name"]]
    text = str(data)
    assert case["form"]["via_findings"] not in text and "HSIL" not in text and "form" not in data


def test_rita_red_flags_are_urgent_and_visible_to_hospital(monkeypatch):
    monkeypatch.setenv("CERVISETU_STAFF_AUTH", "1")
    row = _intake(BY_TOKEN["PT-CASE-RITA"])
    desk = rp.view_for({"role": "HOSPITAL", "hospital": row["hospital"], "staff_id": "H"}, row)
    assert desk["urgent"] and "contact bleeding" in desk["red_flags"]


def test_via_image_needs_consent_and_opens_only_inline_for_images(doctor):
    row = _intake(BY_TOKEN["PT-CASE-NISHI"])
    url = f"/api/referrals/{row['referral_id']}/files"
    image = next((Path(rp.__file__).parents[1] / "seed_assets" / "via").glob("nishi.*"))
    assert doctor.post(url, data={"kind": "VIA_IMAGE"}, files={"file": (image.name, image.read_bytes(), "image/jpeg")}).status_code == 422
    made = doctor.post(url, data={"kind": "VIA_IMAGE", "photo_consent": "true"}, files={"file": (image.name, image.read_bytes(), "image/jpeg")})
    assert made.status_code == 201
    assert doctor.get(f"{url}/{made.json()['file_id']}?inline=1").headers["content-disposition"].startswith("inline")
    assert TestClient(app).get(f"{url}/{made.json()['file_id']}?inline=1").status_code == 401


def test_seed_loads_cases_with_images_without_duplicates():
    rp.seed()
    rp.seed()
    for case in CASES:
        row = rp.get_for_patient(case["token"])
        assert row["fictional"] and row["form"]["via_findings"] == case["form"]["via_findings"]
        assert [f["kind"] for f in rp.list_files(row["referral_id"])].count("VIA_IMAGE") == 1
    assert "MRI" in rp.get_for_patient("PT-CASE-RITA")["treatment_plan"]
