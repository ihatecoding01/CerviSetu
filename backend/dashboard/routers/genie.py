"""Ask Genie: a staff assistant that answers from the live ward board, case list and a guide to this app.

Answers are decision support. Genie reads only de-identified records (patient tokens, never names), the
question is masked before it reaches the AI, and if the AI is unavailable the answer is computed directly
from the same live data. Genie never changes a record.
"""
import json
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.core.database import global_db
from backend.core.llm_client import global_llm
from backend.core.security import PIIShield

router = APIRouter(prefix="/api/genie", tags=["Ask Genie"])

MAX_QUESTION = 500
SPEECH_CODES = {"en": "en-IN", "hi": "hi-IN", "bho": "hi-IN", "bn": "bn-IN", "mr": "mr-IN", "ta": "ta-IN", "te": "te-IN"}
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
        "suggestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer"],
}


class Turn(BaseModel):
    role: str
    text: str


class BoardRow(BaseModel):
    """De-identified row of the ward board on the staff member's screen: never names or villages."""
    token: str
    stage: str = ""
    lane: str = ""
    projected_day: Optional[int] = None
    attendance: str = ""
    detail: str = ""


class GenieQuestion(BaseModel):
    question: str
    language: str = "en"
    history: List[Turn] = Field(default_factory=list)
    board: List[BoardRow] = Field(default_factory=list)


class SpeakRequest(BaseModel):
    text: str
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
    for tab, name, _, _ in APP_GUIDE:  # Screen names, never tab ids
        text = re.sub(rf"\b(the )?{tab}\b", name, text)
    return text.strip()


async def _snapshot(board_rows: Optional[List[BoardRow]] = None) -> Dict[str, Any]:
    from backend.dashboard.routers.clinical import get_ward_board

    board = await get_ward_board()
    plans = [{k: p.get(k) for k in (
        "patient_token", "stage", "age", "treatment_day_today", "completed_sessions", "total_sessions",
        "missed_sessions", "consecutive_missed_sessions", "projected_finish_day", "target_49d_status",
        "limit_56d_status", "clock_state", "current_escalation_tier")} for p in board["plans"]]
    cases = [{"patient_token": c.get("patient_token"), "stage": c.get("suspected_stage"), "status": c.get("status"),
              "age": c.get("age")} for c in global_db.get_all_cases(limit=30)]
    tracked = {p["patient_token"] for p in plans}
    ward = [r.model_dump() for r in (board_rows or [])[:40] if r.token not in tracked]
    return {"as_of_date": board["as_of_date"], "treatment_plans": plans, "recent_cases": cases, "ward_board": ward}


def _records_text(snap: Dict[str, Any]) -> str:
    """Records as plain sentences, so the assistant talks about patients and not database fields."""
    lines = [f"Date: {snap['as_of_date']}", "Patients on the ward board:"]
    for r in snap["ward_board"]:
        day = f", projected to finish on day {r['projected_day']}" if r["projected_day"] else ""
        lines.append(f"- {r['token']}: {r['stage']}, status {r['lane'] or 'unknown'}{day}. {r['attendance']}. {r['detail']}")
    for p in snap["treatment_plans"]:
        lines.append(f"- {p['patient_token']}: stage {p['stage']}, age {p['age']}, on treatment day {p['treatment_day_today']}, "
                     f"{p['completed_sessions']} of {p['total_sessions']} sessions done, {p['missed_sessions']} missed, "
                     f"projected to finish on day {p['projected_finish_day']}, escalation level {p['current_escalation_tier'] or 'none'}.")
    seen = {r["token"] for r in snap["ward_board"]} | {p["patient_token"] for p in snap["treatment_plans"]}
    others = [c for c in snap["recent_cases"] if c["patient_token"] not in seen]
    if others:
        lines.append("Other recent cases, with no active plan yet:")
        lines += [f"- {c['patient_token']}: stage {c['stage']}, age {c['age']}" for c in others[:20]]
    return "\n".join(lines)



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
        row = next((r for r in snap["ward_board"] if r["token"] == token.group(0)), None)
        if row:
            return {"answer": f"{row['token']}: {row['stage']}. {row['attendance']}. {row['detail']}", "patients": [row["token"]], "open_tab": "encounter-tab"}
        return {"answer": f"{token.group(0)} has no active treatment plan on the ward board.", "patients": [], "open_tab": None}
    if any(w in q for w in ("risk", "behind", "late", "miss", "56", "49", "delay", "overdue", "urgent", "attention", "priorit")):
        order = {"critical": 0, "warning": 1}
        ward = sorted((r for r in snap["ward_board"] if r["lane"] in order), key=lambda r: order[r["lane"]])
        risky = sorted(filter(_at_risk, plans), key=lambda p: -(p.get("missed_sessions") or 0))
        lines = [f"{r['token']}: {r['attendance']}, projected day {r['projected_day']}. {r['detail']}" for r in ward]
        lines += [f"{p['patient_token']}: {p['missed_sessions']} missed, projected finish day {p['projected_finish_day']}" for p in risky]
        tokens = [r["token"] for r in ward] + [p["patient_token"] for p in risky]
        if not tokens:
            return {"answer": "Nobody on the ward board has missed sessions or a clock warning today.", "patients": [], "open_tab": "overview-tab"}
        return {"answer": f"{len(tokens)} patients need attention:\n" + "\n".join(lines[:8]), "patients": tokens[:8], "open_tab": "overview-tab"}
    for tab, name, words, desc in APP_GUIDE:
        if any(w in q for w in words):
            return {"answer": f"Use {name}. {desc}", "patients": [], "open_tab": tab}
    return {"answer": (f"Today the ward board has {len(plans) + len(snap['ward_board'])} patients on treatment. "
                       "I can tell you which patients need attention, give a patient's treatment clock, or show where to do a task."),
            "patients": [], "open_tab": "overview-tab"}


@router.post("/ask")
async def ask(req: GenieQuestion) -> Dict[str, Any]:
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please type a question.")
    if len(question) > MAX_QUESTION:
        raise HTTPException(status_code=422, detail=f"Please keep questions under {MAX_QUESTION} characters.")

    snap = await _snapshot(req.board)
    known = ({p["patient_token"] for p in snap["treatment_plans"]} | {c["patient_token"] for c in snap["recent_cases"]}
             | {r["token"] for r in snap["ward_board"]})
    masked, _ = PIIShield.mask_text(question)
    earlier = "\n".join(f"{'Staff' if t.role == 'user' else 'Genie'}: {PIIShield.mask_text(t.text[:800])[0]}" for t in req.history[-10:])
    system = (
        "You are Genie, a warm, sharp colleague to doctors, nurses and ASHA workers at a cervical cancer "
        "chemoradiation clinic. Talk like a helpful person in a real conversation: natural sentences, short, the "
        "direct answer first, no headings, never field names or JSON-like wording. Use the conversation so far to "
        "understand follow-ups such as 'her' or 'what about the second one'. Greetings and small talk get a brief "
        "friendly reply. Facts about patients come only from TODAY'S RECORDS; if something is not there, say you "
        "don't have it and suggest where to look. Never invent patients, numbers, labs or doses. You may explain "
        "general oncology knowledge and guidelines, and clinical suggestions are for the clinician to review, not "
        "orders. If new symptoms or findings are mentioned without clearly naming the patient, ask which patient "
        "before saying anything about a specific person; never attach them to whoever was discussed earlier. Never "
        "state a toxicity grade unless the staff member gave it. Never tell staff to stop or change treatment as a "
        "fact: offer it as something to consider. Never claim to have changed a record. Status critical or warning means the patient needs attention. "
        f"Write in {LANGUAGES.get(req.language, 'English')}; keep patient codes unchanged. "
        "patients: the codes you mention. open_tab: a tab id only if opening it is clearly the next step. "
        "suggestions: up to 3 short follow-up questions the staff member might ask next, in the same language. "
        "Reply with one JSON object matching this schema: " + json.dumps(ANSWER_SCHEMA)
    )
    user = (f"HOW THE APP IS ORGANISED:\n{GUIDE_TEXT}\n\nTODAY'S RECORDS:\n{_records_text(snap)}\n\n"
            f"CONVERSATION SO FAR:\n{earlier or '(none)'}\n\nSTAFF MEMBER NOW SAYS: {masked}")
    raw = global_llm.structured(system, user, ANSWER_SCHEMA, "genie_answer", max_tokens=800)

    if raw and str(raw.get("answer") or "").strip():
        patients: List[str] = [t for t in raw.get("patients") or [] if t in known][:8]
        tab = raw.get("open_tab")
        suggestions = [str(x)[:90] for x in raw.get("suggestions") or [] if str(x).strip()][:3]
        return {"source": "AI", "answer": _plain(str(raw["answer"]))[:2000], "patients": patients,
                "open_tab": tab if tab in TAB_IDS else None, "suggestions": suggestions, "as_of_date": snap["as_of_date"]}
    return {"source": "LIVE_DATA", "suggestions": [], **_from_data(question, snap), "as_of_date": snap["as_of_date"]}


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), language_code: str = Form("unknown")) -> Dict[str, Any]:
    """Speech to masked text, for talking to Genie."""
    data = await audio.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="That recording is too long. Please keep it under a minute.")
    stt = global_llm.transcribe(data, audio.filename or "genie.wav", language_code)
    if not stt or not str(stt.get("transcript") or "").strip():
        raise HTTPException(status_code=503, detail="I couldn't hear that. Please try again or type your question.")
    return {"text": PIIShield.mask_text(stt["transcript"].strip())[0]}


@router.post("/speak")
async def speak(req: SpeakRequest) -> Dict[str, Any]:
    """Genie's answer as speech; the browser's own voice is used if this returns no audio."""
    from backend.config import SARVAM_TTS_MODEL

    text = req.text.strip()[:1500]
    if not text:
        raise HTTPException(status_code=422, detail="Nothing to say.")
    out = global_llm.synthesize(text, SPEECH_CODES.get(req.language, "en-IN"), SARVAM_TTS_MODEL)
    return {"audio_base64": out.get("audio_base64")}
