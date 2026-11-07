"""Regression tests for PII masking, FIGO staging, biopsy detection and confidence labelling."""
from backend.core.security import PIIShield
from backend.tools.ocr_tools import ClinicalEntityExtractorTool
from backend.graph.workflow import clinical_graph


INTAKE_TEXT = (
    "Patient: Test Patient\n"
    "Phone: +91 98765 43210\n"
    "Village: Testgaon, District: Mumbai\n\n"
    "35F irregular bleeding, VIA positive, HPV positive, biopsy squamous cell carcinoma cervix stage IIB"
)


def test_phone_with_space_is_masked():
    masked, extracted = PIIShield.mask_text(INTAKE_TEXT)
    assert "98765 43210" not in masked
    assert "[REDACTED_PHONE]" in masked
    assert extracted["phones"]


def test_name_mask_does_not_cross_lines():
    masked, _ = PIIShield.mask_text(INTAKE_TEXT)
    assert "Test Patient" not in masked
    assert "Phone:" in masked


def test_name_mask_ignores_lowercase_clinical_words():
    masked, _ = PIIShield.mask_text("Patient with cervical lesion and post-coital bleeding.")
    assert masked == "Patient with cervical lesion and post-coital bleeding."


def test_village_is_masked_district_kept():
    masked, extracted = PIIShield.mask_text(INTAKE_TEXT)
    assert "Testgaon" not in masked
    assert "Village: [REDACTED_LOCATION]" in masked
    assert "District: Mumbai" in masked
    assert extracted["locations"] == ["Testgaon"]


def test_figo_sub_stages_detected():
    cases = {
        "stage IIB": "Stage IIB",
        "FIGO stage IIIA": "Stage IIIA",
        "stage IB3": "Stage IB3",
        "stage 2b": "Stage IIB",
        "Stage IV": "Stage IV",
    }
    for text, expected in cases.items():
        entities = ClinicalEntityExtractorTool.extract_entities(f"Carcinoma cervix {text}.")
        assert entities["suspected_stage"] == expected, text


def test_biopsy_reported_as_carcinoma_is_positive():
    entities = ClinicalEntityExtractorTool.extract_entities("Biopsy: squamous cell carcinoma cervix.")
    assert entities["biopsy_status"] == "POSITIVE"


def test_suspected_carcinoma_with_biopsy_advised_stays_pending():
    entities = ClinicalEntityExtractorTool.extract_entities(
        "Suspected Stage III squamous cell carcinoma. Biopsy advised."
    )
    assert entities["biopsy_status"] == "PENDING"


def test_invasive_cervical_case_is_urgent_and_consistent():
    result = clinical_graph.invoke(
        {"raw_text": INTAKE_TEXT, "days_overdue": 0},
        config={"configurable": {"thread_id": "bugfix-regression"}},
    )
    synthesis = result["diagnostic_synthesis"]
    assert result["clinical_intake"]["estimated_stage"] == "Stage IIB"
    assert result["clinical_intake"]["biopsy_status"] == "POSITIVE"
    assert synthesis["urgency"] != "ROUTINE"
    if synthesis["confidence_level"] == "HIGH":
        assert synthesis["confidence_score"] >= 0.80




