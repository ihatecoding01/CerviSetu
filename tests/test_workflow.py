"""Tests for LangGraph multi-agent clinical workflow execution."""
import cv2
import numpy as np
from src.graph.workflow import clinical_graph


def test_workflow_document_case_execution():
    initial_state = {
        "patient_token": "NEW",
        "session_id": "test-session-001",
        "raw_text": "Patient with cervical lesion. Post-coital bleeding. Suspected Stage II Cervical Carcinoma. Follow-up in 7 days.",
        "document_path": None,
        "image_path": None,
        "clinical_intake": None,
        "intake_status": "PENDING",
        "image_quality": None,
        "image_triage_passed": True,
        "diagnostic_synthesis": None,
        "days_overdue": 0,
        "cancer_severity_score": 0.0,
        "current_escalation_tier": None,
        "dispatched_notifications": [],
        "authority_escalation_dossier": None,
        "audit_trail": [],
        "errors": [],
        "next_node": None,
        "status": "RUNNING"
    }

    config = {"configurable": {"thread_id": "test-thread-001"}}
    final_state = clinical_graph.invoke(initial_state, config=config)

    assert final_state["patient_token"].startswith("PT-ANON")
    assert final_state["intake_status"] == "COMPLETED"
    assert final_state["diagnostic_synthesis"] is not None
    assert final_state["clinical_intake"]["suspected_cancer_type"] == "CERVICAL"


def test_workflow_blurry_image_routing(tmp_path):
    # Save a deliberately blurred image
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.circle(img, (150, 150), 60, (100, 100, 100), -1)
    blurry = cv2.GaussianBlur(img, (45, 45), 20)
    img_path = tmp_path / "blurry.png"
    cv2.imwrite(str(img_path), blurry)

    initial_state = {
        "patient_token": "NEW",
        "session_id": "test-blurry-session",
        "raw_text": "Patient with oral ulcer. Biopsy pending.",
        "document_path": None,
        "image_path": str(img_path),
        "clinical_intake": None,
        "intake_status": "PENDING",
        "image_quality": None,
        "image_triage_passed": True,
        "diagnostic_synthesis": None,
        "days_overdue": 0,
        "cancer_severity_score": 0.0,
        "current_escalation_tier": None,
        "dispatched_notifications": [],
        "authority_escalation_dossier": None,
        "audit_trail": [],
        "errors": [],
        "next_node": None,
        "status": "RUNNING"
    }

    config = {"configurable": {"thread_id": "test-thread-blurry"}}
    final_state = clinical_graph.invoke(initial_state, config=config)

    # Image should fail triage
    assert final_state["image_triage_passed"] is False
    assert final_state["image_quality"]["blur_status"] == "BLURRY"
    # Diagnostic node should be safely bypassed to avoid hallucination on bad data
    assert final_state.get("diagnostic_synthesis") is None
