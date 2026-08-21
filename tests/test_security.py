"""Tests for AES-256 vault, PII de-identification, and audit ledger."""
import pytest
from src.core.security import TokenVault, PIIShield, AuditLedger


def test_token_vault_encryption():
    vault = TokenVault()
    token = "PT-ANON-TEST1"
    pii_payload = {
        "full_name": "Rameshwar Prasad",
        "phone": "+91 9876543210",
        "village": "Kalyanpur",
        "district": "Mirzapur"
    }

    vault.store_pii(token, pii_payload)
    retrieved = vault.retrieve_pii(token)

    assert retrieved["full_name"] == "Rameshwar Prasad"
    assert retrieved["phone"] == "+91 9876543210"
    assert retrieved["village"] == "Kalyanpur"


def test_pii_shield_masking():
    raw_text = "Patient Ramesh Kumar, phone +91 9876543210, Aadhaar 1234 5678 9012 visited today."
    masked, extracted = PIIShield.mask_text(raw_text)

    assert "[REDACTED_PHONE]" in masked
    assert "[REDACTED_ID]" in masked
    assert "+91 9876543210" not in masked
    assert "1234 5678 9012" not in masked


def test_audit_ledger_chain():
    ledger = AuditLedger()
    evt1 = ledger.record_event(
        action="TEST_ACTION_1",
        actor="TEST_AGENT",
        patient_token="PT-ANON-1",
        details={"step": 1}
    )
    evt2 = ledger.record_event(
        action="TEST_ACTION_2",
        actor="TEST_AGENT",
        patient_token="PT-ANON-1",
        details={"step": 2}
    )

    assert evt2["previous_hash"] == evt1["current_hash"]
    assert len(evt2["current_hash"]) == 64
