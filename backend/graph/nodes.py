"""LangGraph node definitions for the clinical diagnostic and tracking multi-agent graph."""
from typing import Any, Dict
from backend.agents.ocr_intake_agent import OCRIntakeAgent
from backend.agents.image_triage_agent import ImageTriageAgent
from backend.agents.diagnostic_agent import DiagnosticAgent
from backend.agents.tracker_agent import PatientTrackerAgent
from backend.core.state import ClinicalAgentState

# Instantiate Agent Singletons
intake_agent = OCRIntakeAgent()
image_triage_agent = ImageTriageAgent()
diagnostic_agent = DiagnosticAgent()
tracker_agent = PatientTrackerAgent()


def intake_node(state: ClinicalAgentState) -> Dict[str, Any]:
    """Node 1: Parse clinical notes/prescriptions and de-identify PII into encrypted vault."""
    result = intake_agent.process(state)
    return result


def image_triage_node(state: ClinicalAgentState) -> Dict[str, Any]:
    """Node 2: Evaluate medical image sharpness, contrast, and domain validity."""
    result = image_triage_agent.process(state)
    return result


def should_diagnose(state: ClinicalAgentState) -> str:
    """Conditional Edge: Determine if scan quality is sufficient for diagnostic synthesis."""
    image_passed = state.get("image_triage_passed", True)
    if not image_passed:
        # Halt diagnostic node to prevent hallucinated/corrupted analysis on blurry or non-medical images
        return "skip_to_tracker"
    return "proceed_to_diagnostic"


def diagnostic_node(state: ClinicalAgentState) -> Dict[str, Any]:
    """Node 3: Generate preliminary differential diagnosis and workup plan."""
    result = diagnostic_agent.process(state)
    return result


def tracker_node(state: ClinicalAgentState) -> Dict[str, Any]:
    """Node 4: Monitor overdue timelines and dispatch progressive multi-tier escalations."""
    result = tracker_agent.process(state)
    return result
