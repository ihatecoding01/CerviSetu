"""LangGraph StateGraph builder for clinical diagnostic and tracking multi-agent system."""
from typing import Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from src.core.state import ClinicalAgentState
from src.graph.nodes import (
    intake_node,
    image_triage_node,
    diagnostic_node,
    tracker_node,
    should_diagnose
)


def create_clinical_graph(checkpointer: Optional[MemorySaver] = None):
    """
    Constructs the LangGraph multi-agent workflow:
    1. START -> intake_node (OCR + PII Vault)
    2. intake_node -> image_triage_node (Blur, contrast & modality check)
    3. image_triage_node -> conditional routing:
       - proceed_to_diagnostic -> diagnostic_node -> tracker_node -> END
       - skip_to_tracker (if image is invalid/blurry) -> tracker_node -> END
    """
    workflow = StateGraph(ClinicalAgentState)

    # Add Nodes
    workflow.add_node("intake", intake_node)
    workflow.add_node("image_triage", image_triage_node)
    workflow.add_node("diagnostic", diagnostic_node)
    workflow.add_node("tracker", tracker_node)

    # Add Edges
    workflow.add_edge(START, "intake")
    workflow.add_edge("intake", "image_triage")

    # Conditional Routing after Image Quality Assessment
    workflow.add_conditional_edges(
        "image_triage",
        should_diagnose,
        {
            "proceed_to_diagnostic": "diagnostic",
            "skip_to_tracker": "tracker"
        }
    )

    workflow.add_edge("diagnostic", "tracker")
    workflow.add_edge("tracker", END)

    # Compile with memory checkpointer
    app = workflow.compile(checkpointer=checkpointer or MemorySaver())
    return app


# Default graph instance
clinical_graph = create_clinical_graph()
