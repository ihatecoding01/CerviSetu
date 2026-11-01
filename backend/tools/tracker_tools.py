"""Rural Patient Tracking, Progressive Multi-Channel Notifications, and Authority Escalation Tools."""
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.config import ESCALATION_POLICY, SEVERITY_THRESHOLDS
from backend.core.security import TokenVault, global_vault, global_audit
from backend.core.state import NotificationDispatch


class CancerRiskScorerTool:
    """Computes comprehensive cancer severity score and urgency tier."""

    @classmethod
    def evaluate_risk(
        cls,
        cancer_type: str,
        stage: str,
        biopsy_status: str,
        symptoms: List[str]
    ) -> Tuple[float, str]:
        """
        Calculates a clinical severity score from 0.0 to 1.0.
        Returns: (severity_score, risk_category)
        """
        score = 0.30

        # Stage weighting
        st = stage.lower()
        if "stage iv" in st or "metastatic" in st or "advanced" in st:
            score += 0.50
        elif "stage iii" in st:
            score += 0.40
        elif "stage ii" in st:
            score += 0.25
        elif "stage i" in st or "early" in st:
            score += 0.15

        # Biopsy weighting
        if biopsy_status.upper() == "POSITIVE":
            score += 0.25
        elif biopsy_status.upper() == "SUSPICIOUS":
            score += 0.15

        # Red flag symptoms
        severe_symptoms = ["hemoptysis", "weight loss", "difficulty swallowing", "bleeding", "severe pain"]
        matches = [s for s in symptoms if any(k in s.lower() for k in severe_symptoms)]
        score += len(matches) * 0.05

        final_score = round(min(1.0, score), 2)
        
        if final_score >= SEVERITY_THRESHOLDS["high_risk_cutoff"]:
            category = "HIGH_CRITICAL"
        elif final_score >= SEVERITY_THRESHOLDS["moderate_risk_cutoff"]:
            category = "MODERATE"
        else:
            category = "LOW_ROUTINE"

        return final_score, category


class MultiChannelReminderTool:
    """Progressive reminder dispatcher across SMS, WhatsApp, and automated IVR voice calls."""

    SMS_TEMPLATES = {
        "HINDI": "नमस्ते। {center} से रिमाइंडर: आपकी महत्वपूर्ण जांच/फॉलो-अप तारीख निकल चुकी है। कृपया तुरंत अपने नजदीकी स्वास्थ्य केंद्र पर आएं।",
        "ENGLISH": "Hello. Reminder from {center}: Your critical cancer follow-up visit is overdue. Please visit your nearest health centre urgently for continued treatment."
    }

    IVR_SCRIPTS = {
        "HINDI": "यह {center} से एक महत्वपूर्ण स्वास्थ्य सूचना है। आपके डॉक्टर ने आगे की जांच के लिए तुरंत मिलने की सलाह दी है। अगर आपको सहायता चाहिए तो 1 दबाएं।",
        "ENGLISH": "This is an urgent medical notice from {center}. Your doctor has scheduled critical follow-up care. Please press 1 to connect with our rural health coordinator."
    }

    @classmethod
    def dispatch_tier_1_sms(
        cls,
        patient_token: str,
        center_name: str = "Community Health Centre",
        language: str = "HINDI"
    ) -> NotificationDispatch:
        """Tier 1: Send SMS / WhatsApp reminder (Day 1-2 overdue)."""
        template = cls.SMS_TEMPLATES.get(language, cls.SMS_TEMPLATES["ENGLISH"])
        msg = template.format(center=center_name)
        
        notif = NotificationDispatch(
            tier="TIER_1_SMS_WHATSAPP",
            timestamp=datetime.now(timezone.utc).isoformat(),
            recipient_role="PATIENT_PRIMARY_PHONE",
            channel="SMS/WhatsApp",
            message_content=msg,
            status="DELIVERED",
            escalation_reason="Day 1-2 missed follow-up appointment."
        )

        global_audit.record_event(
            action="TIER_1_SMS_DISPATCHED",
            actor="TRACKER_AGENT",
            patient_token=patient_token,
            details={"channel": "SMS", "language": language, "tier": notif.tier}
        )
        return notif

    @classmethod
    def dispatch_tier_2_ivr(
        cls,
        patient_token: str,
        center_name: str = "Community Health Centre",
        language: str = "HINDI"
    ) -> NotificationDispatch:
        """Tier 2: Automated Voice / IVR Call (Day 3-5 overdue)."""
        script = cls.IVR_SCRIPTS.get(language, cls.IVR_SCRIPTS["ENGLISH"])
        msg = script.format(center=center_name)

        notif = NotificationDispatch(
            tier="TIER_2_IVR_VOICE_CALL",
            timestamp=datetime.now(timezone.utc).isoformat(),
            recipient_role="PATIENT_PRIMARY_AND_GUARDIAN",
            channel="Automated Voice IVR",
            message_content=msg,
            status="COMPLETED_CALL",
            escalation_reason="Day 3-5 persistent non-response to SMS."
        )

        global_audit.record_event(
            action="TIER_2_IVR_DISPATCHED",
            actor="TRACKER_AGENT",
            patient_token=patient_token,
            details={"channel": "IVR_VOICE", "tier": notif.tier}
        )
        return notif


class CommunityWorkerDispatchTool:
    """Dispatches physical visit requests to local ASHA / Anganwadi frontline healthcare workers."""

    @classmethod
    def dispatch_asha_visit(
        cls,
        patient_token: str,
        cancer_type: str,
        severity_score: float,
        vault: Optional[TokenVault] = None
    ) -> NotificationDispatch:
        """Tier 3: Dispatch local ASHA worker with tasking order (Day 6-7 overdue)."""
        # Retrieve sanitized sector info without exposing full address
        v = vault or global_vault
        try:
            pii = v.retrieve_pii(patient_token)
            village = pii.get("village", "Assigned Village Sector")
            asha_contact = pii.get("asha_worker_contact", "Regional ASHA Coordinator")
        except Exception:
            village = "Assigned Village Sector"
            asha_contact = "Regional ASHA Coordinator"

        task_content = (
            f"[ASHA TASK ORDER] Urgent in-person home visit required in {village}. "
            f"Patient ID: {patient_token}. Condition: Suspected {cancer_type} (Severity: {severity_score:.2f}). "
            f"Action: Verify patient well-being, assess barriers (travel, fear, funds), and assist transport to District Hospital."
        )

        notif = NotificationDispatch(
            tier="TIER_3_ASHA_WORKER_DISPATCH",
            timestamp=datetime.now(timezone.utc).isoformat(),
            recipient_role=f"ASHA_WORKER ({asha_contact})",
            channel="ASHA Mobile Health Network",
            message_content=task_content,
            status="DISPATCHED_TO_FIELD_WORKER",
            escalation_reason="Day 6-7 missed follow-up; community intervention needed."
        )

        global_audit.record_event(
            action="TIER_3_ASHA_DISPATCHED",
            actor="TRACKER_AGENT",
            patient_token=patient_token,
            details={
                "village_sector": village,
                "asha_contact": asha_contact,
                "severity_score": severity_score
            }
        )
        return notif


class EmergencyAuthorityEscalationTool:
    """Gated unmasking of patient address for severe cancer cases to District Health Authorities."""

    @classmethod
    def generate_authority_escalation_dossier(
        cls,
        patient_token: str,
        cancer_type: str,
        stage: str,
        severity_score: float,
        days_overdue: int,
        authorized_by: str = "CHIEF_MEDICAL_OFFICER_ROUTER",
        vault: Optional[TokenVault] = None
    ) -> Tuple[NotificationDispatch, Dict[str, Any]]:
        """
        Tier 4: Emergency District Health Authority Intervention.
        Unmasks patient address from encrypted vault and compiles official relief dossier.
        """
        v = vault or global_vault
        try:
            pii = v.retrieve_pii(patient_token)
        except Exception as e:
            pii = {"error": f"Failed to retrieve vault: {str(e)}"}

        dossier_id = f"EMERG-DOSSIER-{secrets.token_hex(3).upper()}"
        dossier = {
            "dossier_id": dossier_id,
            "patient_token": patient_token,
            "full_name": pii.get("full_name", "UNKNOWN"),
            "primary_phone": pii.get("phone", "UNAVAILABLE"),
            "village_address": pii.get("full_address") or f"Village {pii.get('village', 'Unknown')}, Dist. {pii.get('district', 'Unknown')}",
            "guardian_name": pii.get("guardian_name", "N/A"),
            "guardian_phone": pii.get("guardian_phone", "N/A"),
            "clinical_diagnosis": f"{cancer_type} - {stage}",
            "severity_score": severity_score,
            "days_overdue": days_overdue,
            "escalation_reason": "High-severity malignant condition with total patient non-response exceeding statutory timeout (>7 days).",
            "dispatch_directive": "District Mobile Health Unit dispatched for emergency on-ground welfare check & medical escort.",
            "authorized_by": authorized_by,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        content = (
            f"[CRITICAL AUTHORITY ALERT {dossier_id}] Patient {pii.get('full_name')} at "
            f"{dossier['village_address']} is {days_overdue} days overdue for critical {cancer_type} care (Severity: {severity_score:.2f}). "
            f"District Medical Officer intervention ordered."
        )

        notif = NotificationDispatch(
            tier="TIER_4_DISTRICT_AUTHORITY_ESCALATION",
            timestamp=datetime.now(timezone.utc).isoformat(),
            recipient_role="DISTRICT_HEALTH_AUTHORITY / CMO",
            channel="Emergency Government Health Dispatch Portal",
            message_content=content,
            status="EMERGENCY_DISPATCH_AUTHORIZED",
            escalation_reason="Severe cancer risk with prolonged patient non-response; unmasked address for emergency outreach."
        )

        # High-severity audit event
        global_audit.record_event(
            action="TIER_4_AUTHORITY_ESCALATION_UNMASKED",
            actor=authorized_by,
            patient_token=patient_token,
            details={
                "dossier_id": dossier_id,
                "days_overdue": days_overdue,
                "severity_score": severity_score,
                "unmasked_address": dossier["village_address"]
            },
            severity="CRITICAL"
        )

        return notif, dossier


class TrackerTriageEngine:
    """Evaluates overdue status and executes the appropriate progressive escalation tier."""

    @classmethod
    def evaluate_and_escalate(
        cls,
        patient_token: str,
        cancer_type: str,
        stage: str,
        biopsy_status: str,
        symptoms: List[str],
        days_overdue: int,
        vault: Optional[TokenVault] = None
    ) -> Tuple[Optional[str], List[NotificationDispatch], Optional[Dict[str, Any]]]:
        """
        Executes progressive escalation tiers based on days overdue and cancer severity.
        Returns: (active_tier, dispatched_notifications, authority_dossier)
        """
        severity_score, risk_cat = CancerRiskScorerTool.evaluate_risk(
            cancer_type=cancer_type,
            stage=stage,
            biopsy_status=biopsy_status,
            symptoms=symptoms
        )

        dispatched: List[NotificationDispatch] = []
        dossier: Optional[Dict[str, Any]] = None
        active_tier: Optional[str] = None

        policy = ESCALATION_POLICY

        if days_overdue <= 0:
            return None, [], None

        # Tier 1: Day 1-2
        if days_overdue >= policy["tier_1_sms_days"]:
            active_tier = "TIER_1_SMS"
            dispatched.append(MultiChannelReminderTool.dispatch_tier_1_sms(patient_token))

        # Tier 2: Day 3-5
        if days_overdue >= policy["tier_2_ivr_days"]:
            active_tier = "TIER_2_IVR"
            dispatched.append(MultiChannelReminderTool.dispatch_tier_2_ivr(patient_token))

        # Tier 3: Day 6-7
        if days_overdue >= policy["tier_3_asha_days"]:
            active_tier = "TIER_3_ASHA"
            dispatched.append(CommunityWorkerDispatchTool.dispatch_asha_visit(
                patient_token=patient_token,
                cancer_type=cancer_type,
                severity_score=severity_score,
                vault=vault
            ))

        # Tier 4: >7 days + Severe Cancer Condition
        if days_overdue >= policy["tier_4_authority_days"]:
            if severity_score >= SEVERITY_THRESHOLDS["high_risk_cutoff"] or "stage iii" in stage.lower() or "stage iv" in stage.lower():
                active_tier = "TIER_4_AUTHORITY_ESCALATION"
                notif, d = EmergencyAuthorityEscalationTool.generate_authority_escalation_dossier(
                    patient_token=patient_token,
                    cancer_type=cancer_type,
                    stage=stage,
                    severity_score=severity_score,
                    days_overdue=days_overdue,
                    vault=vault
                )
                dispatched.append(notif)
                dossier = d

        return active_tier, dispatched, dossier
