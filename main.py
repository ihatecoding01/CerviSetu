"""Main entry point for CerviSetu Clinical AI and Dashboard Server."""
import argparse
import sys
import uvicorn

# Ensure UTF-8 stdout encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.graph.workflow import clinical_graph
from backend.tools.tracker_tools import TrackerTriageEngine
from backend.core.security import global_vault, global_audit


def run_cli_demo():
    """Run an automated end-to-end multi-agent clinical case demonstration."""
    print("=" * 70)
    print(" CerviSetu - Agentic Clinical Diagnostic & Rural Tracking AI")
    print("=" * 70)

    sample_intake = """
    Patient: Shanti Devi, 52 Female
    Phone: +91 98765 11223, Village: Pipra, District: Mirzapur
    Clinical Notes:
    Patient presents with 4-week non-healing ulcer on lateral border of tongue.
    Associated with mild dysphagia and left submandibular lymphadenopathy.
    Biopsy advised; sample collected for histopathology.
    Suspected Stage III Oral Squamous Cell Carcinoma.
    Follow-up requested in 7 days for biopsy review.
    """

    print("\n[STEP 1] Ingesting clinical record into LangGraph Multi-Agent Workflow...")
    initial_state = {
        "patient_token": "NEW",
        "session_id": "demo-session-001",
        "raw_text": sample_intake,
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

    config = {"configurable": {"thread_id": "demo-thread"}}
    final_state = clinical_graph.invoke(initial_state, config=config)

    token = final_state.get("patient_token")
    intake = final_state.get("clinical_intake") or {}
    diag = final_state.get("diagnostic_synthesis") or {}

    print(f"\n[PII SHIELD] De-Identified Patient Token: {token}")
    print(f"[OCR & INTAKE] Extracted Cancer: {intake.get('suspected_cancer_type')} ({intake.get('estimated_stage')})")
    print(f"[DIAGNOSTIC AI] Primary Impression: {diag.get('primary_impression')}")
    print(f"[DIAGNOSTIC AI] Urgency Tier: {diag.get('urgency')}")
    print(f"[DIAGNOSTIC AI] Differentials: {', '.join(diag.get('differential_diagnosis', []))}")

    print("\n" + "-" * 70)
    print(" [STEP 2] Simulating Rural Follow-Up & Emergency Escalation Pipeline")
    print("-" * 70)

    for days in [1, 4, 7, 9]:
        print(f"\n>>> Simulating {days} Days Overdue Since Missed Appointment:")
        active_tier, dispatched, dossier = TrackerTriageEngine.evaluate_and_escalate(
            patient_token=token,
            cancer_type="ORAL",
            stage="Stage III",
            biopsy_status="POSITIVE",
            symptoms=["non-healing ulcer", "dysphagia"],
            days_overdue=days,
            vault=global_vault
        )
        for n in dispatched:
            print(f"  * [{n.tier}] -> {n.channel} ({n.recipient_role})")
            print(f"    Message: {n.message_content[:90]}...")
        
        if dossier:
            print(f"\n  [CRITICAL TIER 4 ESCALATION - ADDRESS UNMASKED]")
            print(f"  Dossier ID: {dossier['dossier_id']}")
            print(f"  Patient: {dossier['full_name']} | Address: {dossier['village_address']}")
            print(f"  Directive: {dossier['dispatch_directive']}")

    print("\n" + "=" * 70)
    print(" Demonstration Complete! Audit logs cryptographically chained.")
    print("=" * 70)


def start_server(host: str = "127.0.0.1", port: int = 8000):
    """Start the FastAPI application with Uvicorn."""
    print(f"Starting CerviSetu Dashboard on http://{host}:{port}...")
    uvicorn.run("backend.dashboard.app:app", host=host, port=port, reload=False)


def main():
    parser = argparse.ArgumentParser(description="CerviSetu Clinical Diagnostic AI & Tracker")
    parser.add_argument("--serve", action="store_true", help="Launch the FastAPI Web Dashboard")
    parser.add_argument("--demo", action="store_true", help="Run automated CLI demonstration")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")

    args = parser.parse_args()

    if args.demo:
        run_cli_demo()
    elif args.serve or len(sys.argv) == 1:
        # Default action
        start_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
