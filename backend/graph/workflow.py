"""LangGraph StateGraph builder for clinical diagnostic and tracking multi-agent system."""
from typing import Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from backend.core.state import ClinicalAgentState
from backend.graph.nodes import (
    intake_node,
    diagnostic_node,
    tracker_node,
)


def create_clinical_graph(checkpointer: Optional[MemorySaver] = None):
    """
    Constructs the LangGraph multi-agent workflow:
    1. START -> intake_node (OCR + PII Vault)
    2. intake_node -> diagnostic_node (Clinical Oncologic Differential & Recommendations)
    3. diagnostic_node -> tracker_node (Rural Follow-Up & Adherence Escalation)
    4. tracker_node -> END
    """
    workflow = StateGraph(ClinicalAgentState)

    # Add Nodes
    workflow.add_node("intake", intake_node)
    workflow.add_node("diagnostic", diagnostic_node)
    workflow.add_node("tracker", tracker_node)

    # Add Edges
    workflow.add_edge(START, "intake")
    workflow.add_edge("intake", "diagnostic")
    workflow.add_edge("diagnostic", "tracker")
    workflow.add_edge("tracker", END)

    # Compile with memory checkpointer
    app = workflow.compile(checkpointer=checkpointer or MemorySaver())
    return app


# Default graph instance
clinical_graph = create_clinical_graph()
