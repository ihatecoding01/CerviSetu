"""DPDP Audit Ledger, Cryptographic Hash Chain, and Multi-Role Logging router."""
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.database import global_db
from backend.core.security import global_audit, global_vault, UserRole

router = APIRouter(prefix="/api", tags=["DPDP Audit Ledger & Multi-Role Logging"])


class UserActivityLogRequest(BaseModel):
    user_role: str
    actor_id: str
    patient_token: str
    action_type: str
    channel: Optional[str] = "WEB_CAREUI"
    severity: Optional[str] = "INFO"
    payload: Optional[Dict[str, Any]] = None


class DoctorSignOffRequest(BaseModel):
    doctor_id: str
    patient_token: str
    case_id: Optional[str] = None
    action_type: Optional[str] = "DOCTOR_OCR_INTAKE_SIGN"
    notes: Optional[str] = ""
    ncg_verified: Optional[bool] = True






class NurseSlipUploadRequest(BaseModel):
    nurse_id: str
    patient_token: str
    document_type: str
    laplacian_score: float
    is_legible: bool






@router.get("/audit-logs")
async def get_audit_logs(limit: int = 50):
    """Retrieve immutable audit ledger entries."""
    logs = global_audit.get_events(limit=limit)
    return {"audit_logs": logs}


@router.get("/vault/inspect/{token}")
async def inspect_vault(token: str, authorized_role: str = "CHIEF_MEDICAL_OFFICER"):
    """Gated access to inspect encrypted vault details for emergency authority review."""
    try:
        pii = global_vault.retrieve_pii(token)
        block = global_audit.record_user_event(
            user_role=UserRole.DOCTOR,
            action="DOCTOR_CMO_STATUTORY_UNMASK",
            actor_id=authorized_role,
            patient_token=token,
            details={"authorized_role": authorized_role},
            severity="CRITICAL",
            channel="REST_API"
        )
        global_db.log_user_activity(
            log_id=f"UNMASK-{secrets.token_hex(4).upper()}",
            user_role=UserRole.DOCTOR,
            actor_id=authorized_role,
            patient_token=token,
            action_type="DOCTOR_CMO_STATUTORY_UNMASK",
            channel="REST_API",
            severity="CRITICAL",
            payload={"authorized_role": authorized_role},
            sha256_hash=block.get("current_hash"),
            timestamp=block.get("timestamp")
        )
        return {"patient_token": token, "vault_data": pii}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/logs/event")
async def record_user_log_event(req: UserActivityLogRequest):
    """
    Record an immutable, role-attributed activity log for Patients, Doctors, or Nurses/Healthcare Workers.
    Chains into SHA-256 Audit Ledger and syncs to SQLite user_activity_logs.
    """
    if req.user_role not in UserRole.ALL_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user_role '{req.user_role}'. Must be one of: {UserRole.ALL_ROLES}"
        )

    log_id = f"LOG-{secrets.token_hex(6).upper()}"
    
    # 1. Cryptographically chain into SHA-256 Audit Ledger
    chained_block = global_audit.record_user_event(
        user_role=req.user_role,
        action=req.action_type,
        actor_id=req.actor_id,
        patient_token=req.patient_token,
        details=req.payload or {},
        severity=req.severity or "INFO",
        channel=req.channel or "WEB_CAREUI"
    )

    # 2. Persist in SQL database
    global_db.log_user_activity(
        log_id=log_id,
        user_role=req.user_role,
        actor_id=req.actor_id,
        patient_token=req.patient_token,
        action_type=req.action_type,
        channel=req.channel or "WEB_CAREUI",
        severity=req.severity or "INFO",
        payload=req.payload or {},
        sha256_hash=chained_block.get("current_hash"),
        timestamp=chained_block.get("timestamp")
    )

    return {
        "status": "SUCCESS",
        "log_id": log_id,
        "entry": chained_block
    }


@router.get("/logs/events")
async def get_user_logs(
    user_role: Optional[str] = None,
    patient_token: Optional[str] = None,
    limit: int = 50
):
    """Retrieve activity logs filtered by role (PATIENT, DOCTOR, NURSE_HEALTHCARE_WORKER) or patient token."""
    logs = global_db.get_user_activity_logs(user_role=user_role, patient_token=patient_token, limit=limit)
    return {"logs": logs, "total_returned": len(logs)}


@router.get("/logs/summary")
async def get_logs_summary():
    """Get aggregated activity metrics across all 3 user types and verify SHA-256 chain integrity."""
    summary = global_db.get_user_activity_summary()
    ledger_counts = global_audit.get_role_summary()
    is_valid, block_count, error = global_audit.verify_chain_integrity()

    return {
        "database_summary": summary,
        "ledger_role_counts": ledger_counts,
        "chain_integrity": {
            "is_valid": is_valid,
            "total_blocks_verified": block_count,
            "error": error
        }
    }


@router.post("/logs/doctor/sign-off")
async def log_doctor_sign_off(req: DoctorSignOffRequest):
    """Log a doctor's clinical sign-off on an OCR slip or treatment phase."""
    log_id = f"DOC-SIGN-{secrets.token_hex(4).upper()}"
    payload = {
        "case_id": req.case_id,
        "notes": req.notes,
        "ncg_verified": req.ncg_verified
    }
    block = global_audit.record_user_event(
        user_role=UserRole.DOCTOR,
        action=req.action_type or "DOCTOR_OCR_INTAKE_SIGN",
        actor_id=req.doctor_id,
        patient_token=req.patient_token,
        details=payload,
        severity="INFO",
        channel="WEB_CAREUI"
    )
    global_db.log_user_activity(
        log_id=log_id,
        user_role=UserRole.DOCTOR,
        actor_id=req.doctor_id,
        patient_token=req.patient_token,
        action_type=req.action_type or "DOCTOR_OCR_INTAKE_SIGN",
        channel="WEB_CAREUI",
        severity="INFO",
        payload=payload,
        sha256_hash=block.get("current_hash"),
        timestamp=block.get("timestamp")
    )
    return {"status": "SUCCESS", "log_id": log_id, "block": block}






@router.post("/logs/nurse/slip-upload")
async def log_nurse_slip_upload(req: NurseSlipUploadRequest):
    """Log a nurse or clinic helper uploading a paper OPD/lab slip and the Laplacian sharpness check."""
    log_id = f"NURSE-SLIP-{secrets.token_hex(4).upper()}"
    payload = {
        "document_type": req.document_type,
        "laplacian_score": req.laplacian_score,
        "is_legible": req.is_legible
    }
    block = global_audit.record_user_event(
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        action="NURSE_PAPER_SLIP_UPLOAD",
        actor_id=req.nurse_id,
        patient_token=req.patient_token,
        details=payload,
        severity="INFO" if req.is_legible else "WARNING",
        channel="WEB_CAREUI"
    )
    global_db.log_user_activity(
        log_id=log_id,
        user_role=UserRole.NURSE_HEALTHCARE_WORKER,
        actor_id=req.nurse_id,
        patient_token=req.patient_token,
        action_type="NURSE_PAPER_SLIP_UPLOAD",
        channel="WEB_CAREUI",
        severity="INFO" if req.is_legible else "WARNING",
        payload=payload,
        sha256_hash=block.get("current_hash"),
        timestamp=block.get("timestamp")
    )
    return {"status": "SUCCESS", "log_id": log_id, "block": block}






# ==========================================
# Live SHA-256 Verification & ASHA Tickets
# ==========================================



@router.get("/logs/verify-chain")
async def verify_audit_chain():
    """Verify cryptographic SHA-256 hash chaining across all blocks in the immutable ledger."""
    is_valid, total_blocks, err = global_audit.verify_chain_integrity()
    return {
        "status": "SUCCESS" if is_valid else "CORRUPTED",
        "is_valid": is_valid,
        "total_blocks_verified": total_blocks,
        "tamper_detected": not is_valid,
        "error": err
    }







@router.get("/dev/ai-usage")
async def get_ai_usage_summary():
    """Development-only Sarvam usage summary (per feature: requests, failures, cache hits, reported usage).

    This project has no authentication, so the endpoint is not protected; it is disabled when
    CERVISETU_ENV=production instead. It returns counters only, never prompts, transcripts or OCR text.
    """
    from backend.config import APP_ENV
    from backend.core.ai_usage import usage_summary

    if APP_ENV == "production":
        raise HTTPException(status_code=404, detail="Not available in production")
    return usage_summary()
