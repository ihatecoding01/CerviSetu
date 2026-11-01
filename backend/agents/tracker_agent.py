"""Pillar 2: Rural Patient Tracking and Multi-Tier Escalation Agent."""
import secrets
from typing import Any, Dict, List
from backend.core.database import global_db
from backend.core.security import global_vault
from backend.core.state import ClinicalAgentState
from backend.tools.tracker_tools import TrackerTriageEngine


class PatientTrackerAgent:
    """Agent responsible for tracking patient revisit timelines, executing progressive reminders, and managing emergency authority escalations."""

    def process(self, state: ClinicalAgentState) -> Dict[str, Any]:
        """Evaluate overdue days and trigger appropriate escalation tier."""
        patient_token = state.get("patient_token") or "UNASSIGNED"
        days_overdue = state.get("days_overdue", 0)
        intake = state.get("clinical_intake") or {}
        
        cancer_type = intake.get("suspected_cancer_type", "Unknown")
        stage = intake.get("estimated_stage", "Unknown")
        biopsy_status = intake.get("biopsy_status", "PENDING")
        symptoms = intake.get("presenting_complaints", [])

        # Run multi-tier escalation triage
        active_tier, dispatched_notifs, authority_dossier = TrackerTriageEngine.evaluate_and_escalate(
            patient_token=patient_token,
            cancer_type=cancer_type,
            stage=stage,
            biopsy_status=biopsy_status,
            symptoms=symptoms,
            days_overdue=days_overdue,
            vault=global_vault
        )

        # Persist notifications to DB
        for notif in dispatched_notifs:
            notif_id = f"NOTIF-{secrets.token_hex(4).upper()}"
            global_db.log_notification(
                notif_id=notif_id,
                patient_token=patient_token,
                tier=notif.tier,
                channel=notif.channel,
                recipient_role=notif.recipient_role,
                message_content=notif.message_content,
                timestamp=notif.timestamp
            )

        # Update follow-up tracker in database
        if active_tier:
            global_db.update_follow_up(
                tracker_id=f"TRK-{patient_token}",
                patient_token=patient_token,
                case_id="LATEST",
                due_date="Overdue",
                days_overdue=days_overdue,
                last_reminder_tier=active_tier
            )

        audit_messages = []
        if dispatched_notifs:
            for n in dispatched_notifs:
                audit_messages.append(f"Dispatched {n.tier} via {n.channel} to {n.recipient_role}.")
        else:
            audit_messages.append(f"Patient tracking: {days_overdue} days overdue. Follow-up is within normal limits.")

        if authority_dossier:
            audit_messages.append(f"CRITICAL ESCALATION: Emergency authority dossier compiled ({authority_dossier['dossier_id']}).")

        return {
            "current_escalation_tier": active_tier,
            "dispatched_notifications": [n.model_dump() for n in dispatched_notifs],
            "authority_escalation_dossier": authority_dossier,
            "audit_trail": audit_messages
        }
