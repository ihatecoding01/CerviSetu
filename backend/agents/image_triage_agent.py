"""Pillar 3: Medical Image Quality and Anomaly Triage Agent."""
import secrets
from typing import Any, Dict
from backend.core.database import global_db
from backend.core.security import global_audit
from backend.core.state import ClinicalAgentState
from backend.tools.image_tools import ImageQualityEvaluator


class ImageTriageAgent:
    """Agent that screens uploaded scans for motion blur, exposure artifacts, and non-medical anomalies."""

    def process(self, state: ClinicalAgentState) -> Dict[str, Any]:
        """Assess uploaded image path and determine diagnostic readiness."""
        image_path = state.get("image_path")
        patient_token = state.get("patient_token") or "UNASSIGNED"

        if not image_path:
            # No image uploaded - image triage not applicable
            return {
                "image_quality": None,
                "image_triage_passed": True,  # Allow document-only flow
                "audit_trail": ["Image triage skipped: No image payload provided."]
            }

        eval_result = ImageQualityEvaluator.evaluate_image(
            image_path=image_path,
            patient_token=patient_token
        )

        scan_id = f"SCAN-{secrets.token_hex(4).upper()}"
        global_db.save_scan_record(
            scan_id=scan_id,
            patient_token=patient_token,
            image_path=image_path,
            quality_data=eval_result.model_dump()
        )

        log_msg = (
            f"Image triage: {'PASSED' if eval_result.is_valid else 'FAILED'}. "
            f"Sharpness: {eval_result.blur_score:.1f}, Contrast: {eval_result.contrast_rms:.1f}, Modality: {eval_result.detected_modality}"
        )

        return {
            "image_quality": eval_result.model_dump(),
            "image_triage_passed": eval_result.is_valid,
            "audit_trail": [log_msg]
        }
