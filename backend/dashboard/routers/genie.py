"""Ask Genie: a staff assistant that answers from the live ward board, case list and a guide to this app.

Answers are decision support. Genie reads only de-identified records (patient tokens, never names), the
question is masked before it reaches the AI, and if the AI is unavailable the answer is computed directly
from the same live data. Genie never changes a record.
"""
import json
import re
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.database import global_db
from backend.core.llm_client import global_llm
from backend.core.security import PIIShield

router = APIRouter(prefix="/api/genie", tags=["Ask Genie"])

MAX_QUESTION = 500
LANGUAGES = {"en": "English", "hi": "Hindi", "bho": "Bhojpuri", "bn": "Bengali", "mr": "Marathi", "ta": "Tamil", "te": "Telugu"}

# Where staff do things. Each entry: tab id, screen name, keywords, what the screen is for.
APP_GUIDE = [
    ("intake-tab", "Clinical Intake", ("intake", "new case", "new patient", "upload", "document", "ocr", "report", "pdf", "lab"),
     "Register a new case and upload reports. The document workspace reads scans with OCR, flags abnormal labs and answers questions about the document."),
    ("encounter-tab", "Clinical Encounter", ("encounter", "consult", "voice", "mic", "dictat", "chemo", "clearance", "discharge", "prescri"),
     "Open a patient, dictate or type the consultation for a reviewable draft, clear chemotherapy, and sign the discharge."),
    ("tracker-tab", "Rural Tracker", ("tracker", "escalat", "authority", "district", "dossier", "message", "sms", "whatsapp", "alert"),
     "Follow treatment-clock escalations, approve district dossiers and see the delivery status of every message."),
    ("asha-tab", "ASHA Network", ("asha", "home visit", "field", "follow-up", "follow up"),
     "Log and review ASHA home visits and field follow-up."),
    ("prevention-tab", "Prevention & Screening", ("prevention", "screening", "hpv", "vaccin", "via"),
     "Screening and vaccination programme work for doctors, nurses and administrators."),
    ("privacy-tab", "Security & Audit", ("audit", "ledger", "security", "privacy", "vault", "consent"),
     "Review the tamper-evident audit ledger and privacy controls."),
    ("patient-tab", "Patient Portal", ("portal", "companion", "symptom"),
     "See what the patient sees, including their treatment plan and spoken symptom reports."),
]
TAB_IDS = {g[0] for g in APP_GUIDE} | {"overview-tab"}
GUIDE_TEXT = "\n".join(f"- {name} (tab {tab}): {desc}" for tab, name, _, desc in APP_GUIDE)

ANSWER_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "patients": {"type": "array", "items": {"type": "string"}},
        "open_tab": {"type": "string"},
    },
    "required": ["answer"],
}


class GenieQuestion(BaseModel):
    question: str
    language: str = "en"


def _at_risk(p: Dict[str, Any]) -> bool:
    bad = ("BREACH", "AT_RISK", "RISK", "EXCEEDED", "MISSED")
    status = f"{p.get('target_49d_status')} {p.get('limit_56d_status')}".upper()
    return bool(p.get("missed_sessions")) or any(b in status for b in bad)


def _plain(text: str) -> str:
    """Staff should never see the prompt's internal labels, even if the model repeats them."""
    for pattern, word in ((r"\b(the )?LIVE DATA\b", "today's records"), (r"\b(the )?APP GUIDE\b", "the app"),
                          (r"\btreatment_plans( list)?\b", "treatment plans"), (r"\brecent_cases( list)?\b", "recent cases"),
                          (r"\s*\(tab [a-z-]+\)|\s*\([a-z]+-tab\)", "")):
        text = re.sub(pattern, word, text, flags=re.IGNORECASE)
    return text.strip()


async def _snapshot() -> Dict[str, Any]:
    from backend.dashboard.routers.clinical import get_ward_board

    board = await get_ward_board()
    plans = [{k: p.get(k) for k in (
        "patient_token", "stage", "age", "treatment_day_today", "completed_sessions", "total_sessions",
        "missed_sessions", "consecutive_missed_sessions", "projected_finish_day", "target_49d_status",
        "limit_56d_status", "clock_state", "current_escalation_tier")} for p in board["plans"]]
    cases = [{"patient_token": c.get("patient_token"), "stage": c.get("suspected_stage"), "status": c.get("status"),
              "age": c.get("age")} for c in global_db.get_all_cases(limit=30)]
    return {"as_of_date": board["as_of_date"], "treatment_plans": plans, "recent_cases": cases}


def _from_data(question: str, snap: Dict[str, Any]) -> Dict[str, Any]:
    """Answer without the AI, using only the live data and the app guide."""
    q = question.lower()
    plans = snap["treatment_plans"]
    token = re.search(r"\bPT-[A-Z0-9-]+\b", question.upper())
    if token:
        match = next((p for p in plans if p["patient_token"] == token.group(0)), None)
        if match:
            return {"answer": (f"{match['patient_token']}: day {match['treatment_day_today']}, "
                               f"{match['completed_sessions']} of {match['total_sessions']} sessions done, "
                               f"{match['missed_sessions']} missed, projected finish day {match['projected_finish_day']}."),
                    "patients": [match["patient_token"]], "open_tab": "encounter-tab"}
        return {"answer": f"{token.group(0)} has no active treatment plan on the ward board.", "patients": [], "open_tab": None}
    if any(w in q for w in ("risk", "behind", "late", "miss", "56", "49", "delay", "overdue", "urgent", "attention", "priorit")):
        risky = sorted(filter(_at_risk, plans), key=lambda p: -(p.get("missed_sessions") or 0))
        if not risky:
            return {"answer": f"None of the {len(plans)} treatment plans on the ward board have missed sessions or a clock warning today.",
                    "patients": [], "open_tab": "overview-tab"}
        lines = [f"{p['patient_token']}: {p['missed_sessions']} missed, projected finish day {p['projected_finish_day']}" for p in risky[:8]]
        return {"answer": f"{len(risky)} of {len(plans)} plans need attention:\n" + "\n".join(lines),
                "patients": [p["patient_token"] for p in risky[:8]], "open_tab": "overview-tab"}
    for tab, name, words, desc in APP_GUIDE:
        if any(w in q for w in words):
            return {"answer": f"Use {name}. {desc}", "patients": [], "open_tab": tab}
    return {"answer": (f"Today the ward board has {len(plans)} treatment plans and {len(snap['recent_cases'])} recent cases. "
                       "I can tell you which patients need attention, give a patient's treatment clock, or show where to do a task."),
            "patients": [], "open_tab": "overview-tab"}


@router.post("/ask")
async def ask(req: GenieQuestion) -> Dict[str, Any]:
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please type a question.")
    if len(question) > MAX_QUESTION:
        raise HTTPException(status_code=422, detail=f"Please keep questions under {MAX_QUESTION} characters.")

    snap = await _snapshot()
    known = {p["patient_token"] for p in snap["treatment_plans"]} | {c["patient_token"] for c in snap["recent_cases"]}
    masked, _ = PIIShield.mask_text(question)
    system = (
        "You are Genie, the assistant for hospital staff using CerviSetu, a cervical cancer chemoradiation care "
        "platform. Answer briefly and directly from LIVE DATA and APP GUIDE only. Count and quote exactly what the "
        "data shows; if it does not contain the answer, say so plainly. Never invent patients, numbers, labs or "
        "doses. For a clinical question give decision support for the clinician to review, not an order. Never "
        "claim to have changed a record. Speak naturally to the staff member: use screen names, never words like "
        "LIVE DATA, APP GUIDE, treatment_plans, recent_cases or tab ids in the answer. "
        f"Write the answer in {LANGUAGES.get(req.language, 'English')}; keep patient tokens unchanged. "
        "patients lists the tokens you mention. open_tab is the most useful tab id, if any. "
        "Reply with one JSON object matching this schema: " + json.dumps(ANSWER_SCHEMA)
    )
    user = f"APP GUIDE:\n{GUIDE_TEXT}\n\nLIVE DATA:\n{json.dumps(snap)}\n\nQUESTION: {masked}"
    raw = global_llm.structured(system, user, ANSWER_SCHEMA, "genie_answer", max_tokens=700)

    if raw and str(raw.get("answer") or "").strip():
        patients: List[str] = [t for t in raw.get("patients") or [] if t in known][:8]
        tab = raw.get("open_tab")
        return {"source": "AI", "answer": _plain(str(raw["answer"]))[:2000], "patients": patients,
                "open_tab": tab if tab in TAB_IDS else None, "as_of_date": snap["as_of_date"]}
    return {"source": "LIVE_DATA", **_from_data(question, snap), "as_of_date": snap["as_of_date"]}
