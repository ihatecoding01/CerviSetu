"""Deterministic SYNTHETIC treatment journey for patients registered through the ABDM sandbox flow.

Everything generated here is demo data, labelled SYNTHETIC_DEMO at every level (patient region code,
case intake, plan regimen label, approver, session recorder). Synthetic patients are excluded from
the case queue, ward board and escalation scheduler, and their FHIR export is tagged.

The journey is a pure function of the patient token and registration date, and is generated once:
logging in again never changes it. After registration the real treatment clock takes over, so the
portal shows live progress from the same clock engine as real patients.
"""
import hashlib
from datetime import date, timedelta
from typing import Any, Dict, List

from backend.config import clinic_today
from backend.core.database import SYNTHETIC_REGION, global_db

GENERATOR_ID = "SYNTHETIC-GENERATOR"
LABEL = "SYNTHETIC_DEMO"
STAGES = ["IIB", "IIA2", "IIIA", "IIIB", "IIIC1"]
FACILITIES = ["Mirzapur Spoke Clinic", "Sonbhadra Spoke Clinic", "Chandauli Spoke Clinic"]


def _seed(token: str) -> bytes:
    return hashlib.sha256(f"cervisetu-synthetic:{token}".encode()).digest()


def journey_spec(token: str, registered_on: date) -> Dict[str, Any]:
    """Deterministic parameters for a token: same token + date always gives the same journey."""
    h = _seed(token)
    start = registered_on - timedelta(days=5 + h[0] % 26)      # started 5-30 days before registration
    slots: List[date] = []
    d = start
    while d < registered_on:
        if d.weekday() < 5:
            slots.append(d)
        d += timedelta(days=1)
    # 0-2 isolated past misses, never the most recent slot, so there is no open missed streak at registration
    missed = set()
    if len(slots) > 4:
        for i in range(h[1] % 3):
            missed.add(1 + h[2 + i] % (len(slots) - 3))
    return {
        "start_date": start,
        "stage": STAGES[h[5] % len(STAGES)],
        "age": 32 + h[6] % 34,
        "facility": FACILITIES[h[7] % len(FACILITIES)],
        "completed_dates": [s for i, s in enumerate(slots) if i not in missed][:25],
        "missed_dates": [s for i, s in enumerate(slots) if i in missed],
    }


def ensure_synthetic_journey(token: str, registered_on: date = None) -> Dict[str, Any]:
    """Create the synthetic case + plan + session history once. Idempotent per token."""
    plan = global_db.get_treatment_plan(token)
    if plan:
        return {"created": False, "plan_id": plan["plan_id"]}
    spec = journey_spec(token, registered_on or clinic_today())

    global_db.save_patient(token, spec["age"], "F", SYNTHETIC_REGION)
    case_id = f"CASE-SYN-{token[-6:]}"
    global_db.save_clinical_case(
        case_id=case_id, patient_token=token, cancer_type="CERVICAL", suspected_stage=spec["stage"],
        severity_score=0.6,
        intake_data={"data_label": LABEL, "synthetic": True, "suspected_cancer_type": "CERVICAL",
                     "estimated_stage": spec["stage"], "note": "Synthetic demo patient - not real clinical data"},
        diagnostic_data={"data_label": LABEL, "synthetic": True},
    )
    plan = global_db.create_treatment_plan({
        "plan_id": f"PLAN-SYN-{token[-6:]}",
        "patient_token": token,
        "status": "ACTIVE",
        "start_date": spec["start_date"].isoformat(),
        "ebrt_sessions": 25,
        "brachy_sessions": 4,
        "treatment_weekdays": "0,1,2,3,4",
        "brachy_gap_days": 3,
        "brachy_interval_days": 3,
        "rest_dates": "[]",
        "target_days": 49,
        "limit_days": 56,
        "facility_name": spec["facility"],
        "regimen_label": "[SYNTHETIC DEMO] CCRT: EBRT 25 fractions + HDR brachytherapy 4 fractions",
        "approved_by": GENERATOR_ID,
    })
    for n, d in enumerate(spec["completed_dates"], start=1):
        global_db.record_treatment_session(plan["plan_id"], token, n, d.isoformat(), "COMPLETED",
                                           GENERATOR_ID, "SYNTHETIC-LINAC", 2.0)
    return {"created": True, "plan_id": plan["plan_id"], "case_id": case_id,
            "start_date": spec["start_date"].isoformat(), "sessions_completed": len(spec["completed_dates"]),
            "past_misses": len(spec["missed_dates"])}
