"""Tests for the de-identified FHIR R4 export."""
from fastapi.testclient import TestClient

from backend.dashboard.app import app
from backend.graph.workflow import clinical_graph

client = TestClient(app)


def test_fhir_bundle_is_deidentified_and_coded():
    out = clinical_graph.invoke(
        {"raw_text": "Patient: Meera Devi\nPhone: 98765 12345\nCarcinoma cervix stage IIB. Biopsy: squamous cell carcinoma.", "days_overdue": 0},
        config={"configurable": {"thread_id": "fhir-test"}},
    )
    token = out["patient_token"]
    bundle = client.get(f"/api/fhir/patient/{token}").json()

    assert bundle["resourceType"] == "Bundle"
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    assert types[0] == "Patient" and "Condition" in types and "Observation" in types

    condition = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Condition")
    assert condition["code"]["coding"][0]["code"] == "C53.9"
    assert condition["stage"][0]["summary"]["text"] == "FIGO IIB"

    text = str(bundle)
    assert "Meera" not in text and "98765" not in text
