"""Tests for LangGraph multi-agent clinical workflow execution."""
import cv2
import numpy as np
from backend.graph.workflow import clinical_graph


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



