"""Tests for OCR entity extraction and clinical intake pipeline."""
from backend.tools.ocr_tools import ClinicalEntityExtractorTool, OCRIntakePipeline


def test_clinical_entity_extractor():
    sample_text = """
    Patient aged 45, male. Presenting with painless breast mass and nipple discharge.
    Mammography reveals BIRADS 4 lesion. Suspected Stage II breast carcinoma.
    Biopsy advised. Follow-up in 2 weeks.
    """
    entities = ClinicalEntityExtractorTool.extract_entities(sample_text)

    assert entities["cancer_type"] == "BREAST"
    assert entities["suspected_stage"] == "Stage II"
    assert entities["age"] == 45
    assert entities["gender"] == "MALE"
    assert entities["follow_up_days"] == 14
    assert entities["severity_score"] > 0.50


def test_ocr_intake_pipeline():
    pipeline = OCRIntakePipeline()
    raw = """
    Patient: Amit Sharma, Phone: 9811223344, Aadhaar: 1234 5678 9012
    Prescription: Oral ulcer on tongue for 4 weeks. Suspected Stage III Oral Cancer. Biopsy pending.
    """
    doc = pipeline.process_raw_intake(raw)

    assert doc.patient_token.startswith("PT-ANON")
    assert "9811223344" not in doc.raw_anonymized_text
    assert doc.cancer_type == "ORAL"
    assert doc.suspected_stage == "Stage III"
