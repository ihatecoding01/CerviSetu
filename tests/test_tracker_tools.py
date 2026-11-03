"""Tests for patient tracking, progressive multi-channel reminders, and authority escalation."""
from backend.tools.tracker_tools import (
    CancerRiskScorerTool,
    TrackerTriageEngine,
    MultiChannelReminderTool,
    CommunityWorkerDispatchTool,
    EmergencyAuthorityEscalationTool
)
from backend.core.security import TokenVault


def test_cancer_risk_scorer():
    score_s4, cat_s4 = CancerRiskScorerTool.evaluate_risk(
        cancer_type="ORAL",
        stage="Stage IV",
        biopsy_status="POSITIVE",
        symptoms=["ulcer", "weight loss", "bleeding"]
    )
    assert score_s4 >= 0.80
    assert cat_s4 == "HIGH_CRITICAL"

    score_s1, cat_s1 = CancerRiskScorerTool.evaluate_risk(
        cancer_type="BREAST",
        stage="Stage I",
        biopsy_status="PENDING",
        symptoms=[]
    )
    assert score_s1 < 0.60


def test_progressive_escalation_tiers():
    vault = TokenVault()
    token = "PT-TEST-TRACK"
    vault.store_pii(token, {
        "full_name": "Sita Devi",
        "phone": "+91 9999988888",
        "village": "Rampur",
        "district": "Varanasi",
        "full_address": "House 12, Village Rampur, Dist. Varanasi"
    })

    # Day 1: Tier 1 SMS
    tier1, notifs1, dossier1 = TrackerTriageEngine.evaluate_and_escalate(
        patient_token=token,
        cancer_type="ORAL",
        stage="Stage III",
        biopsy_status="POSITIVE",
        symptoms=["ulcer"],
        days_overdue=1,
        vault=vault
    )
    assert tier1 == "TIER_1_SMS"
    assert len(notifs1) == 1
    assert "SMS" in notifs1[0].channel
    assert dossier1 is None

    # Day 2: Tier 2 IVR
    tier2, notifs2, dossier2 = TrackerTriageEngine.evaluate_and_escalate(
        patient_token=token,
        cancer_type="ORAL",
        stage="Stage III",
        biopsy_status="POSITIVE",
        symptoms=["ulcer"],
        days_overdue=2,
        vault=vault
    )
    assert tier2 == "TIER_2_IVR"
    assert len(notifs2) == 2  # SMS + IVR

    # Day 4: Tier 3 ASHA
    tier3, notifs3, dossier3 = TrackerTriageEngine.evaluate_and_escalate(
        patient_token=token,
        cancer_type="ORAL",
        stage="Stage III",
        biopsy_status="POSITIVE",
        symptoms=["ulcer"],
        days_overdue=4,
        vault=vault
    )
    assert tier3 == "TIER_3_ASHA"
    assert any("ASHA" in n.tier for n in notifs3)

    # Day 6: Tier 4 Authority Unmasking
    tier4, notifs4, dossier4 = TrackerTriageEngine.evaluate_and_escalate(
        patient_token=token,
        cancer_type="ORAL",
        stage="Stage III",
        biopsy_status="POSITIVE",
        symptoms=["ulcer"],
        days_overdue=6,
        vault=vault
    )
    assert tier4 == "TIER_4_AUTHORITY_ESCALATION"
    assert dossier4 is not None
    assert dossier4["full_name"] == "Sita Devi"
    assert "House 12, Village Rampur" in dossier4["village_address"]
