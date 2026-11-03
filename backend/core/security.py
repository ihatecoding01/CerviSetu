"""Security, Encryption, PII De-Identification and Audit Trail Engine."""
import base64
import hashlib
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.config import VAULT_SECRET_KEY, VAULT_DIR


class SecurityError(Exception):
    """Exception raised for security and encryption policy violations."""
    pass


class UserRole:
    """User archetypes for role-based access control and audit accountability."""
    DOCTOR = "DOCTOR"
    NURSE_HEALTHCARE_WORKER = "NURSE_HEALTHCARE_WORKER"
    PATIENT = "PATIENT"
    SYSTEM = "SYSTEM"

    ALL_ROLES = [DOCTOR, NURSE_HEALTHCARE_WORKER, PATIENT, SYSTEM]


# Standardized clinical & operational event identifiers categorized by user role
DOCTOR_ACTIONS = {
    "DOCTOR_OCR_INTAKE_SIGN",
    "DOCTOR_VOICE_SCRIBE_APPROVE",
    "DOCTOR_TOXICITY_ALERT_TRIAGE",
    "DOCTOR_DAY21_READINESS_SIGN",
    "DOCTOR_HUB_OT_SLOT_CONFIRM",
    "DOCTOR_TREATMENT_COMPLETION_SIGN",
    "DOCTOR_CMO_STATUTORY_UNMASK",
    "VAULT_PII_ACCESSED",
}

NURSE_ACTIONS = {
    "NURSE_PAPER_SLIP_UPLOAD",
    "NURSE_LEGIBILITY_CHECK_ACK",
    "NURSE_EBRT_FRACTION_LOG",
    "NURSE_PRE_BRACHY_CHECKLIST_SUBMIT",
    "ASHA_FIELD_TICKET_RECEIVE",
    "ASHA_HOME_VISIT_COMPLETE",
    "HEALTHCARE_WORKER_VITALS_LOG",
}

PATIENT_ACTIONS = {
    "PATIENT_SYMPTOM_CHECKIN",
    "PATIENT_CISPLATIN_PREP_ACK",
    "PATIENT_HEALING_CLOCK_VIEW",
    "PATIENT_SCHEME_QUERY",
    "PATIENT_TRAVEL_PASS_DOWNLOAD",
    "PATIENT_BRACHY_COUNSELING_LISTEN",
    "PATIENT_IVR_RESPONSE",
    "PATIENT_DPDP_CONSENT_LOG",
}


class TokenVault:
    """AES-256-GCM Encrypted Vault for storing and retrieving sensitive PII."""

    def __init__(self, secret_key: Optional[str] = None):
        raw_key = (secret_key or VAULT_SECRET_KEY).encode("utf-8")
        # Ensure 32-byte key for AES-256
        hasher = hashlib.sha256()
        hasher.update(raw_key)
        self._key = hasher.digest()
        self._aesgcm = AESGCM(self._key)
        self._vault_file = VAULT_DIR / "encrypted_vault.bin"
        self._memory_vault: Dict[str, bytes] = {}
        self._load_vault()

    def _load_vault(self):
        """Load encrypted records from disk if present."""
        if self._vault_file.exists():
            try:
                with open(self._vault_file, "rb") as f:
                    data = f.read()
                    if data:
                        # Format: JSON of hex strings
                        raw = json.loads(data.decode("utf-8"))
                        self._memory_vault = {k: bytes.fromhex(v) for k, v in raw.items()}
            except Exception as e:
                # Corrupt or fresh vault
                self._memory_vault = {}

    def _persist_vault(self):
        """Persist encrypted records to disk."""
        raw = {k: v.hex() for k, v in self._memory_vault.items()}
        with open(self._vault_file, "w", encoding="utf-8") as f:
            json.dump(raw, f)

    def store_pii(self, token_id: str, pii_data: Dict[str, Any]) -> None:
        """Encrypt and store patient PII associated with token_id."""
        nonce = secrets.token_bytes(12) # 96-bit nonce for AES-GCM
        payload = json.dumps(pii_data).encode("utf-8")
        ciphertext = self._aesgcm.encrypt(nonce, payload, token_id.encode("utf-8"))
        # Store nonce + ciphertext
        encrypted_blob = nonce + ciphertext
        self._memory_vault[token_id] = encrypted_blob
        self._persist_vault()

    def delete_pii(self, token_id: str) -> None:
        """Remove a vault entry (no-op if absent)."""
        if self._memory_vault.pop(token_id, None) is not None:
            self._persist_vault()

    def retrieve_pii(self, token_id: str) -> Dict[str, Any]:
        """Decrypt and retrieve patient PII for token_id."""
        if token_id not in self._memory_vault:
            raise SecurityError(f"No vault entry found for token: {token_id}")
        
        blob = self._memory_vault[token_id]
        if len(blob) < 12:
            raise SecurityError(f"Corrupt encrypted blob for token: {token_id}")
        
        nonce = blob[:12]
        ciphertext = blob[12:]
        try:
            decrypted = self._aesgcm.decrypt(nonce, ciphertext, token_id.encode("utf-8"))
            return json.loads(decrypted.decode("utf-8"))
        except Exception as e:
            raise SecurityError(f"Decryption failed or data tampered for token {token_id}: {e}")

    def list_tokens(self) -> List[str]:
        """List all stored anonymized tokens without exposing PII."""
        return list(self._memory_vault.keys())


class PIIShield:
    """De-Identification and PII Masking Engine."""

    # Indian mobiles are commonly written split 5+5 ("98765 43210"), so allow one separator
    PHONE_PATTERN = re.compile(r'(?:\+?91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b|\b\d{3}[-\.\s]??\d{3}[-\.\s]??\d{4}\b')
    AADHAAR_PATTERN = re.compile(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b')
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')
    # Prefix is case-insensitive, but the name itself must be Capitalised words on the same line
    NAME_PREFIXES = re.compile(r'(?i:\b(Mr\.|Mrs\.|Ms\.|Shri|Smt\.|Dr\.|Patient:?|Name:?))[ \t]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)*)')
    # Village-level address fields; District is kept for hub-spoke routing
    LOCATION_PATTERN = re.compile(r'(?i:\b(Village|Address|Locality|Gram|Mohalla))[ \t]*:[ \t]*([^,\n]+)')

    @classmethod
    def generate_token(cls, prefix: str = "PT-ANON") -> str:
        """Generate a cryptographically random, collision-resistant patient token."""
        rand_suffix = secrets.token_hex(4).upper()
        return f"{prefix}-{rand_suffix}"

    @classmethod
    def mask_text(cls, text: str) -> Tuple[str, Dict[str, List[str]]]:
        """Redact PII from raw clinical text and return sanitized string + extracted items."""
        extracted: Dict[str, List[str]] = {
            "phones": [],
            "ids": [],
            "emails": [],
            "names": [],
            "locations": []
        }

        # Mask Phones
        for match in cls.PHONE_PATTERN.finditer(text):
            extracted["phones"].append(match.group())
        masked = cls.PHONE_PATTERN.sub("[REDACTED_PHONE]", text)

        # Mask Aadhaar / National IDs
        for match in cls.AADHAAR_PATTERN.finditer(masked):
            extracted["ids"].append(match.group())
        masked = cls.AADHAAR_PATTERN.sub("[REDACTED_ID]", masked)

        # Mask Emails
        for match in cls.EMAIL_PATTERN.finditer(masked):
            extracted["emails"].append(match.group())
        masked = cls.EMAIL_PATTERN.sub("[REDACTED_EMAIL]", masked)

        # Mask Names with prefixes
        for match in cls.NAME_PREFIXES.finditer(masked):
            extracted["names"].append(match.group(2))
        masked = cls.NAME_PREFIXES.sub(r'\1 [REDACTED_NAME]', masked)

        # Mask village / address fields
        for match in cls.LOCATION_PATTERN.finditer(masked):
            extracted["locations"].append(match.group(2).strip())
        masked = cls.LOCATION_PATTERN.sub(r'\1: [REDACTED_LOCATION]', masked)

        return masked, extracted

    @classmethod
    def sanitize_patient_payload(
        cls,
        raw_patient: Dict[str, Any],
        vault: TokenVault
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Split a raw patient record into:
        1. Anonymized Token ID
        2. Clean De-Identified Payload (safe for LLM/Agents)
        3. Encrypted Vault record (PII only accessible for authorized dispatch)
        """
        token_id = raw_patient.get("patient_token") or cls.generate_token()
        
        # PII items destined for AES-256 Vault
        pii_data = {
            "full_name": raw_patient.get("name", "Unknown"),
            "phone": raw_patient.get("phone", ""),
            "village": raw_patient.get("village", ""),
            "district": raw_patient.get("district", ""),
            "state": raw_patient.get("state", ""),
            "full_address": raw_patient.get("address", ""),
            "guardian_name": raw_patient.get("guardian_name", ""),
            "guardian_phone": raw_patient.get("guardian_phone", ""),
            "primary_center": raw_patient.get("primary_center", "Community Health Centre"),
            "asha_worker_contact": raw_patient.get("asha_worker_contact", "")
        }
        vault.store_pii(token_id, pii_data)

        # De-identified clinical payload for LangGraph agents
        de_identified_record = {
            "patient_token": token_id,
            "age": raw_patient.get("age"),
            "gender": raw_patient.get("gender"),
            "region_code": raw_patient.get("region_code", "RURAL_SECTOR"),
            "symptoms": raw_patient.get("symptoms", []),
            "clinical_history": raw_patient.get("clinical_history", ""),
            "preliminary_findings": raw_patient.get("preliminary_findings", ""),
            "cancer_suspected": raw_patient.get("cancer_suspected", False),
            "cancer_type": raw_patient.get("cancer_type", "Unknown"),
            "suspected_stage": raw_patient.get("suspected_stage", "Unknown"),
            "appointment_date": raw_patient.get("appointment_date", ""),
            "follow_up_due_date": raw_patient.get("follow_up_due_date", ""),
            "days_overdue": raw_patient.get("days_overdue", 0),
            "last_contact_date": raw_patient.get("last_contact_date", "")
        }

        return token_id, de_identified_record


class AuditLedger:
    """Tamper-evident, cryptographically chained audit logging system."""

    def __init__(self, log_file: Optional[Path] = None):
        import os
        env_log = os.environ.get("AUDIT_LOG_FILE")
        self._log_file = Path(log_file) if log_file else (Path(env_log) if env_log else (VAULT_DIR / "audit_ledger.jsonl"))
        self._last_hash = "GENESIS_BLOCK_00000000000000000000000000000000"
        self._load_last_hash()

    def _load_last_hash(self):
        """Read the hash of the latest block in the ledger."""
        if self._log_file.exists():
            try:
                with open(self._log_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    if lines:
                        last_entry = json.loads(lines[-1].strip())
                        self._last_hash = last_entry.get("current_hash", self._last_hash)
            except Exception:
                pass

    def record_user_event(
        self,
        user_role: str,
        action: str,
        actor_id: str,
        patient_token: str,
        details: Dict[str, Any],
        severity: str = "INFO",
        channel: str = "WEB_CAREUI"
    ) -> Dict[str, Any]:
        """Record an immutable, role-attributed audit event chained with SHA-256."""
        self._load_last_hash()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        block_data = {
            "timestamp": timestamp,
            "user_role": user_role,
            "actor": actor_id,
            "actor_id": actor_id,
            "patient_token": patient_token,
            "action": action,
            "channel": channel,
            "severity": severity,
            "details": details,
            "previous_hash": self._last_hash
        }

        serialized = json.dumps(block_data, sort_keys=True)
        current_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        block_data["current_hash"] = current_hash

        with open(self._log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(block_data) + "\n")

        self._last_hash = current_hash
        return block_data

    def record_event(
        self,
        action: str,
        actor: str,
        patient_token: str,
        details: Dict[str, Any],
        severity: str = "INFO",
        user_role: Optional[str] = None,
        channel: str = "WEB_CAREUI"
    ) -> Dict[str, Any]:
        """Record an immutable audit event chained with SHA-256 (supports automatic role resolution)."""
        if not user_role:
            if action in DOCTOR_ACTIONS or "DOCTOR" in actor.upper() or "MD" in actor.upper() or "CMO" in actor.upper():
                user_role = UserRole.DOCTOR
            elif action in NURSE_ACTIONS or "NURSE" in actor.upper() or "ASHA" in actor.upper() or "HELPER" in actor.upper():
                user_role = UserRole.NURSE_HEALTHCARE_WORKER
            elif action in PATIENT_ACTIONS or "PATIENT" in actor.upper():
                user_role = UserRole.PATIENT
            else:
                user_role = UserRole.SYSTEM

        return self.record_user_event(
            user_role=user_role,
            action=action,
            actor_id=actor,
            patient_token=patient_token,
            details=details,
            severity=severity,
            channel=channel
        )

    def get_events(
        self,
        patient_token: Optional[str] = None,
        user_role: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve recent audit events, optionally filtered by patient token and/or user role."""
        if not self._log_file.exists():
            return []
        
        events = []
        with open(self._log_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        entry = json.loads(line.strip())
                        if patient_token and entry.get("patient_token") != patient_token:
                            continue
                        if user_role and entry.get("user_role") != user_role:
                            continue
                        events.append(entry)
                    except Exception:
                        continue
        return events[-limit:]

    def get_role_summary(self) -> Dict[str, int]:
        """Return total event counts partitioned by user role."""
        counts = {
            UserRole.DOCTOR: 0,
            UserRole.NURSE_HEALTHCARE_WORKER: 0,
            UserRole.PATIENT: 0,
            UserRole.SYSTEM: 0
        }
        if not self._log_file.exists():
            return counts

        with open(self._log_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        entry = json.loads(line.strip())
                        role = entry.get("user_role", UserRole.SYSTEM)
                        counts[role] = counts.get(role, 0) + 1
                    except Exception:
                        continue
        return counts

    def verify_chain_integrity(self) -> Tuple[bool, int, Optional[str]]:
        """
        Verify cryptographic hash chain integrity of the entire audit ledger.
        Returns: (is_valid, block_count, error_message)
        """
        if not self._log_file.exists():
            return True, 0, None

        expected_prev_hash = "GENESIS_BLOCK_00000000000000000000000000000000"
        count = 0
        with open(self._log_file, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception as e:
                    return False, count, f"Malformed JSON on line {line_idx}: {e}"

                stored_hash = entry.get("current_hash")
                stored_prev = entry.get("previous_hash")

                if stored_prev != expected_prev_hash:
                    return False, count, f"Broken chain at line {line_idx}: prev {stored_prev} != expected {expected_prev_hash}"

                data_to_hash = dict(entry)
                data_to_hash.pop("current_hash", None)
                serialized = json.dumps(data_to_hash, sort_keys=True)
                computed_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

                if computed_hash != stored_hash:
                    return False, count, f"Tampered block at line {line_idx}: computed {computed_hash} != stored {stored_hash}"

                expected_prev_hash = stored_hash
                count += 1

        return True, count, None


# Global instances
global_vault = TokenVault()
global_audit = AuditLedger()
