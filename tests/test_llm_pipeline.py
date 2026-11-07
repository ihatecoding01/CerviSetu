"""Tests for the Sarvam LLM extraction/summary layer using a fake client (no network)."""
from backend.agents.diagnostic_agent import DiagnosticAgent, generate_ai_summary
from backend.core.llm_client import SarvamLLMClient
from backend.tools.ocr_tools import ClinicalEntityExtractorTool, LLMClinicalExtractor, OCRIntakePipeline


NOTE = "Patient: Kamla Devi\nPhone: 98765 43210\nVillage: Rampur\nPCB x 3m. HPE: SCC. MRI: FIGO IIIB."


class FakeLLM:
    """Returns canned JSON per schema name and records what it was sent."""

    model = "fake-model"
    enabled = True

    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def structured(self, system, user, schema, name, **kwargs):
        self.calls.append(user)
        return self.responses.get(name)


ENTITIES = {
    "cancer_type": "CERVICAL", "figo_stage": "IIIB", "biopsy_status": "POSITIVE",
    "histology": "squamous cell carcinoma", "symptoms": ["Post-coital bleeding"], "age": 48,
    "gender": "FEMALE", "screening_findings": ["VIA positive"],
    "treatment_plan": "Colposcopy guided biopsy", "follow_up_days": 14,
}


def test_llm_fields_override_rules_and_recompute_severity():
    rules = ClinicalEntityExtractorTool.extract_entities("PCB x 3m. HPE: SCC.")
    merged = LLMClinicalExtractor.enhance("PCB x 3m. HPE: SCC.", rules, llm=FakeLLM({"clinical_extraction": ENTITIES}))

    assert merged["extraction_source"] == "SARVAM_LLM"
    assert merged["suspected_stage"] == "Stage IIIB"
    assert merged["biopsy_status"] == "POSITIVE"
    assert merged["treatment_plan"].startswith("Colposcopy")
    assert merged["severity_score"] == 0.85


def test_invalid_llm_values_are_ignored():
    bad = dict(ENTITIES, figo_stage="Stage 9Z", age=400, biopsy_status="MAYBE", cancer_type="OTHER")
    rules = ClinicalEntityExtractorTool.extract_entities("Carcinoma cervix stage IIB. Age: 50")
    merged = LLMClinicalExtractor.enhance("x", rules, llm=FakeLLM({"clinical_extraction": bad}))

    assert merged["suspected_stage"] == "Stage IIB"
    assert merged["age"] == rules["age"]
    assert merged["biopsy_status"] == rules["biopsy_status"]
    assert merged["cancer_type"] == "CERVICAL"


def test_falls_back_to_rules_when_llm_unavailable():
    rules = ClinicalEntityExtractorTool.extract_entities("Carcinoma cervix stage IIB.")
    merged = LLMClinicalExtractor.enhance("x", rules, llm=FakeLLM({}))
    assert merged["extraction_source"] == "RULES"
    assert merged["suspected_stage"] == "Stage IIB"


def test_only_deidentified_text_is_sent_to_llm():
    fake = FakeLLM({"clinical_extraction": ENTITIES})
    OCRIntakePipeline(llm=fake).process_raw_intake(NOTE)

    sent = fake.calls[0]
    assert "Kamla" not in sent
    assert "98765" not in sent
    assert "Rampur" not in sent


def test_diagnostic_agent_does_not_generate_summary_during_intake():
    fake = FakeLLM({"clinical_summary": {"clinician_summary": "x", "patient_message_hindi": "x", "patient_message_english": "x"}})
    state = {
        "patient_token": "PT-TEST-LLM",
        "clinical_intake": {"suspected_cancer_type": "CERVICAL", "estimated_stage": "Stage IIIB", "biopsy_status": "POSITIVE"},
        "cancer_severity_score": 0.85,
    }
    synthesis = DiagnosticAgent(llm=fake).process(state)["diagnostic_synthesis"]

    assert fake.calls == []
    assert synthesis["ai_generated"] is False
    assert synthesis["ai_summary_status"] == "not_generated"


def test_on_demand_summary_is_a_validated_draft():
    summary = {
        "clinician_summary": "48F, FIGO IIIB SCC, biopsy positive.",
        "patient_message_hindi": "कृपया हर अपॉइंटमेंट पर आएं।",
        "patient_message_english": "Please attend every appointment.",
    }
    intake = {"suspected_cancer_type": "CERVICAL", "estimated_stage": "Stage IIIB", "biopsy_status": "POSITIVE"}
    out = generate_ai_summary(intake, {"urgency": "PRIORITY"}, llm=FakeLLM({"clinical_summary": summary}))
    assert out["status"] == "GENERATED"
    assert out["patient_message_hindi"] == summary["patient_message_hindi"]

    bad = generate_ai_summary({**intake, "age": 51}, {}, llm=FakeLLM({"clinical_summary": {"clinician_summary": ""}}))
    assert bad["status"] == "INVALID_OUTPUT"


def test_diagnostic_agent_without_llm_keeps_rule_output():
    state = {"patient_token": "PT-TEST-LLM2", "clinical_intake": {"suspected_cancer_type": "CERVICAL"}, "cancer_severity_score": 0.3}
    synthesis = DiagnosticAgent(llm=FakeLLM({})).process(state)["diagnostic_synthesis"]
    assert synthesis["ai_generated"] is False
    assert synthesis["ai_clinician_summary"] == ""


def test_client_disabled_without_key():
    assert SarvamLLMClient(api_key="").structured("s", "u", {}, "n") is None
