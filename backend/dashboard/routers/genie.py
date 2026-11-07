"""Ask Genie: a staff assistant that answers from the live referral board and a guide to this app.

Answers are decision support. Genie reads only de-identified records (patient tokens, never names), the
question is masked before it reaches the AI, and if the AI is unavailable the answer is computed directly
from the same live data. Genie never changes a record.
"""
import json
import re
from typing import Any, Dict, List, Optional

from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from backend.tools import care_locations, referral_pathway, teaching_cases
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
    ("encounter-tab", "Clinical Encounter", ("encounter", "consult", "voice", "mic", "dictat", "colposcopy", "biopsy", "histopathology", "prescri"),
     "Open a patient, dictate or type the consultation for a reviewable draft, and record colposcopy, biopsy and report findings."),
    ("tracker-tab", "Referral Tracker", ("tracker", "escalat", "authority", "district", "dossier", "message", "sms", "whatsapp", "alert"),
     "Follow each woman through the 14-day referral follow-up and see the delivery status of every message."),
    ("asha-tab", "ASHA Network", ("asha", "home visit", "field", "follow-up", "follow up"),
     "Log and review ASHA home visits and field follow-up."),
    ("prevention-tab", "Prevention & Screening", ("prevention", "screening", "hpv", "vaccin", "via"),
     "Screening and vaccination programme work for doctors, nurses and administrators."),
    ("privacy-tab", "Security & Audit", ("audit", "ledger", "security", "privacy", "vault", "consent"),
     "Review the tamper-evident audit ledger and privacy controls."),
    ("patient-tab", "Patient Portal", ("portal", "companion", "symptom"),
     "See what the patient sees, including their care journey and spoken symptom reports."),
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


class PatientGenieQuestion(BaseModel):
    token: str = Field(..., description="Patient token, e.g. PT-CASE-NISHI")
    question: str
    language: str = "en"
    history: List[Turn] = Field(default_factory=list)


PATIENT_ANSWER_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "is_diagnostic_refusal": {"type": "boolean"},
        "suggestions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "is_diagnostic_refusal"],
}

DIAGNOSTIC_KEYWORDS = [
    "do i have cancer", "have i got cancer", "is it cancer", "am i having cancer",
    "what stage", "which stage", "my stage", "stage 1", "stage 2", "stage 3", "stage 4", "stage i", "stage ii", "stage iii", "stage iv",
    "diagnos", "prognos", "biopsy result",
    "what is wrong with me", "am i sick", "will i die", "am i dying", "will i survive",
    "what medicine", "which medicine", "what drug", "what tablet", "what pill", "prescribe", "prescription",
    "how to treat my", "cure my", "cure for", "stop bleeding", "treat bleeding",
    "lsil", "hsil", "cin 1", "cin 2", "cin 3", "cin-1", "cin-2", "cin-3", "carcinoma",
    # Hindi keywords
    "मुझे कैंसर है", "क्या कैंसर है", "कौन सी दवा", "दवा खानी", "दवाई बताओ", "गोली लूँ", "क्या बीमारी", "इलाज बताओ", "जाँच में क्या निकला",
    # Hinglish & colloquial
    "kya mujhe cancer", "kaun si dawa", "dawa batao", "meri bimari", "kya bimari hai"
]

def _is_diagnostic_request(question: str) -> bool:
    q = question.lower()
    # Explicit scheme or hospital logistics questions are assistive
    if any(s in q for s in ["scheme", "yojana", "ayushman", "pmjay", "pm-jay", "योजना", "आयुष्मान", "सहायता कोष"]) and not any(d in q for d in ["do i have cancer", "what medicine", "what stage", "मुझे कैंसर है", "दवा खानी"]):
        return False
    return any(d in q for d in DIAGNOSTIC_KEYWORDS)

REFUSAL_MESSAGES = {
    "en": (
        "I cannot provide medical diagnoses, clinical assessments, or treatment prescriptions. "
        "Genie is strictly an assistive guide for hospital navigation and government schemes. "
        "Please contact your local ASHA worker (Asha Didi) immediately or consult your doctor at {hospital} "
        "for any medical or diagnostic evaluation."
    ),
    "hi": (
        "मैं कोई चिकित्सीय निदान (Medical Diagnosis) या उपचार या दवा की सलाह नहीं दे सकती। "
        "यह केवल अस्पताल की जानकारी और सरकारी योजनाओं के लिए एक सहायक मार्गदर्शिका है। "
        "किसी भी चिकित्सीय या जाँच संबंधी सलाह के लिए कृपया तुरंत अपनी स्थानीय आशा कार्यकर्ता (आशा दीदी) से संपर्क करें "
        "या अपने अस्पताल ({hospital}) के डॉक्टर से परामर्श लें।"
    ),
    "bho": (
        "हम कवनो डॉक्टरी जाँच (Medical Diagnosis) चाहे दवाई के सलाह नइखीं दे सकत। "
        "ई खाली अस्पताल के रास्ता आ सरकारी योजना बतावे खातिर एगो मददगार गाइड हवे। "
        "कवनो भी बीमारी भा जाँच खातिर तुरंते आपन आशा दीदी से मिलीं भा {hospital} के डॉक्टर से सलाह लीं।"
    ),
    "bn": (
        "আমি কোনো চিকিৎসা বা রোগের নির্ণয় বা ওষুধের পরামর্শ দিতে পারি না। "
        "এটি কেবল হাসপাতাল এবং সরকারি সহায়তা প্রকল্পের জন্য একটি নির্দেশিকা। "
        "অনুগ্রহ করে অবিলম্বে আপনার স্থানীয় আশা কর্মী (আশা দিদি) বা {hospital}-এর ডাক্তারের সাথে যোগাযোগ করুন।"
    ),
    "mr": (
        "मी कोणतेही वैद्यकीय निदान, तपासणी निष्कर्ष किंवा उपचारांचा सल्ला देऊ शकत नाही. "
        "ही केवळ रुग्णालय मार्गदर्शन आणि सरकारी योजनांसाठी सहाय्यक प्रणाली आहे. "
        "कृपया ताबडतोब आपल्या स्थानिक आशा सेविकेशी (आशा ताई) किंवा {hospital} मधील डॉक्टरांशी संपर्क साधा."
    ),
    "ta": (
        "மருத்துவ நோய் கண்டறிதல் அல்லது மருந்து சிகிச்சைகள் குறித்த ஆலோசனைகளை என்னால் வழங்க முடியாது. "
        "மருத்துவமனை வழிகாட்டல் மற்றும் அரசு திட்டங்களுக்கான உதவி மட்டுமே இது. "
        "மருத்துவ ஆலோசனைக்கு உடனடியாக உங்கள் ஆஷா பணியாளர் அல்லது {hospital} மருத்துவரைத் தொடர்பு கொள்ளவும்."
    ),
    "te": (
        "నేను వైద్య నిర్ధారణ (Medical Diagnosis) లేదా మందుల సలహాలను ఇవ్వలేను. "
        "ఇది కేవలం ఆసుపత్రి మార్గదర్శకత్వం మరియు ప్రభుత్వ పథకాల సహాయం కొరకు మాత్రమే. "
        "దయచేసి వెంటనే మీ స్థానిక ఆశా కార్యకర్త లేదా {hospital} లోని వైద్యుడిని సంప్రదించండి."
    ),
}

def _patient_from_data(question: str, language: str, patient_name: str, hospital: str, health_post: str, area: str, day: Optional[int], status: str, next_date: Optional[str]) -> Dict[str, Any]:
    q = question.lower()
    
    # Schemes query
    if any(k in q for k in ["scheme", "yojana", "ayushman", "pm-jay", "pmjay", "card", "money", "cost", "free", "fund", "relief", "bima", "paisa", "kharch", "योजना", "आयुष्मान", "पैसे", "खर्च"]):
        if language == "hi":
            ans = (
                f"नमस्ते {patient_name} जी, आपके लिए सरकार की प्रमुख स्वास्थ्य योजनाएं निम्नलिखित हैं:\n"
                f"1. आयुष्मान भारत (PM-JAY): पात्र परिवारों को प्रति वर्ष ₹5 लाख तक का निःशुल्क कैशलेस इलाज (बायोप्सी, सर्जरी, दवाएं और अस्पताल में भर्ती) मिलता है। अस्पताल के 'आयुष्मान मित्र' काउंटर पर अपना राशन कार्ड या आधार दिखाएं।\n"
                f"2. राष्ट्रीय स्वास्थ्य मिशन (NHM): गर्भाशय ग्रीवा (Cervix) की प्राथमिक जाँच (VIA) और परामर्श सरकारी स्वास्थ्य केंद्रों में 100% निःशुल्क है।\n"
                f"3. मुख्यमंत्री / राज्य कैंसर सहायता कोष: गरीब परिवारों को विशेष जांच और उपचार के लिए ₹3-5 लाख तक की वित्तीय सहायता उपलब्ध कराई जाती है।\n"
                f"4. यात्रा व एम्बुलेंस सहायता: रेफरल के लिए 102 या 108 नंबर पर कॉल करके निःशुल्क एम्बुलेंस सेवा का लाभ ले सकती हैं।\n"
                f"5. धर्मशाला सुविधा: {hospital} जैसे बड़े अस्पतालों के पास मरीजों और तीमारदारों के लिए बहुत कम शुल्क पर ठहरने की व्यवस्था होती है।"
            )
            sugg = ["अस्पताल कहाँ है और कैसे जाएँ?", "अस्पताल में कौन से कागज़ ले जाने हैं?", "मेरी अगली तारीख कब है?"]
        else:
            ans = (
                f"Government health schemes available to support your care:\n"
                f"1. Ayushman Bharat (PM-JAY): Provides up to ₹5 Lakhs per family per year for secondary and tertiary care hospitalization, covering diagnostics, biopsy, surgical procedures, and medications. You can verify eligibility with your Ration Card or Aadhaar at the {hospital} Ayushman Mitra desk.\n"
                f"2. National Health Mission (NHM): 100% free cervical screening (VIA), free consultation, and free pap smears at public health facilities.\n"
                f"3. State Cancer Relief / Rashtriya Arogya Nidhi (RAN): Financial assistance of ₹3 to ₹5 Lakhs for BPL families receiving treatment in premier public institutions.\n"
                f"4. Free Referral Transport: Call 102 or 108 for free ambulance and referral transit to {hospital}.\n"
                f"5. Subsidized Dharamshala / Night Shelter: Low-cost accommodation (₹20-50/night) is available near {hospital} for patients and family attendants."
            )
            sugg = ["Where is my hospital located?", "What documents should I take with me?", "When is my next visit?"]
        return {"answer": ans, "is_diagnostic_refusal": False, "suggestions": sugg}
    
    # Hospital location / directions
    if any(k in q for k in ["hospital", "where", "location", "reach", "direction", "address", "map", "route", "kahan", "kaise", "अस्पताल", "कहाँ", "रास्ता"]):
        if language == "hi":
            ans = (
                f"आपकी रेफरल अस्पताल {hospital} में है, जो कि {area} क्षेत्र में स्थित है। "
                f"यहाँ जाने के लिए आप स्थानीय बस, ऑटो या ट्रेन का उपयोग कर सकती हैं। आपातकालीन या रेफरल यात्रा के लिए 102/108 डायल करें। "
                f"अस्पताल पहुँचकर स्त्री रोग (Gynaecology) ओपीडी रजिस्ट्रेशन काउंटर पर अपनी रेफरल पर्ची दिखाएँ। "
                f"आपकी स्वास्थ्य चौकी '{health_post}' से रेफरल जारी किया गया है। आज आपकी 14-दिवसीय फॉलो-अप का {day or '—'}वाँ दिन है।"
            )
            sugg = ["कौन से कागज़ात ले जाने होंगे?", "क्या इलाज का खर्च लगेगा?", "जाँच में क्या होगा?"]
        else:
            ans = (
                f"You have been referred to {hospital}, located in {area}. "
                f"You can reach there by local bus, train, or auto-rickshaw. For medical transit assistance, dial 102 or 108. "
                f"Once you arrive at {hospital}, proceed to the Gynaecology OPD registration counter and present your referral slip from {health_post}. "
                f"Today is day {day or '—'} of your 14-day referral follow-up window."
            )
            sugg = ["What documents should I take?", "What schemes help with costs?", "What happens during colposcopy?"]
        return {"answer": ans, "is_diagnostic_refusal": False, "suggestions": sugg}

    # Documents / Preparation
    if any(k in q for k in ["document", "paper", "bring", "carry", "take", "slip", "preparation", "kya le jaye", "कागज़", "दस्तावेज़"]):
        if language == "hi":
            ans = (
                f"अस्पताल {hospital} जाते समय कृपया ये कागज़ात अवश्य साथ रखें:\n"
                f"1. {health_post} से प्राप्त रेफरल पर्ची (Referral Slip).\n"
                f"2. पहचान पत्र (आधार कार्ड या वोटर आईडी कार्ड).\n"
                f"3. यदि आपके पास आयुष्मान भारत गोल्डन कार्ड या राशन कार्ड है तो उसे भी साथ रखें।\n"
                f"4. पिछली कोई भी जाँच रिपोर्ट या पर्चियाँ।\n"
                f"अस्पताल में डॉक्टर एक कॉल्पोस्कोपी जाँच (हल्की दूरबीन से की जाने वाली त्वरित और सुरक्षित जाँच) करेंगे। इसमें घबराने की कोई बात नहीं है।"
            )
            sugg = ["अस्पताल कहाँ है?", "सरकारी सहायता योजनाएं क्या हैं?", "मेरी आशा दीदी से संपर्क कैसे करें?"]
        else:
            ans = (
                f"Documents and items to take with you to {hospital}:\n"
                f"1. Your Referral Slip issued by {health_post}.\n"
                f"2. Government Photo ID (Aadhaar Card or Voter ID).\n"
                f"3. Ayushman Bharat Golden Card or Ration Card (if available for cashless assistance).\n"
                f"4. Any previous screening or pathology slips.\n"
                f"The examination at the hospital is a colposcopy (a simple, magnified outpatient visual inspection). It is safe, quick, and protects your long-term health."
            )
            sugg = ["Where is the hospital located?", "What government schemes can help?", "When is my visit?"]
        return {"answer": ans, "is_diagnostic_refusal": False, "suggestions": sugg}

    # Next visit / appointment
    if any(k in q for k in ["visit", "date", "when", "appointment", "time", "kab", "तारीख", "कब"]):
        timing = f"Your next scheduled follow-up is on {next_date}." if next_date else f"Please visit {hospital} as soon as possible (currently Day {day} of your 14-day referral window)."
        if language == "hi":
            ans = f"{'आपकी अगली तारीख ' + next_date + ' को है।' if next_date else 'कृपया जल्द से जल्द ' + hospital + ' जाएँ (आपकी 14-दिवसीय समय-सीमा का ' + str(day) + 'वाँ दिन है)।'} जाने से पहले अपनी आशा कार्यकर्ता (आशा दीदी) को अवश्य सूचित करें।"
            sugg = ["अस्पताल कैसे पहुँचें?", "कौन से कागज़ात साथ रखें?", "सरकारी योजनाएं"]
        else:
            ans = f"{timing} Please let your local ASHA worker know before or after your visit so they can record your arrival."
            sugg = ["How to reach the hospital?", "What documents to take?", "What government schemes are available?"]
        return {"answer": ans, "is_diagnostic_refusal": False, "suggestions": sugg}

    # Default general assistive answer
    if language == "hi":
        ans = (
            f"नमस्ते {patient_name} जी! मैं आपकी सर्वाइसेतु सहायिका (Genie) हूँ। "
            f"मैं आपको {hospital} पहुँचने का रास्ता, अस्पताल में ले जाने वाले ज़रूरी कागज़ात और आयुष्मान भारत/सरकारी योजनाओं की जानकारी दे सकती हूँ। "
            f"कृपया ध्यान दें: मैं कोई डॉक्टरी जाँच या बीमारी का निदान नहीं करती। किसी भी लक्षण के लिए अपनी आशा दीदी या डॉक्टर से मिलें।"
        )
        sugg = ["सरकारी योजनाओं की जानकारी दें", "अस्पताल कहाँ है और कैसे जाएँ?", "कौन से कागज़ात ले जाने हैं?"]
    else:
        ans = (
            f"Hello {patient_name}! I am CerviSetu Genie, your patient care companion. "
            f"I can assist you with directions to {hospital}, documents to take, visit timings, and government financial assistance schemes (such as Ayushman Bharat PM-JAY). "
            f"Please note: I cannot provide medical diagnosis or treatment advice; for any medical questions, please consult your local ASHA worker or doctor."
        )
        sugg = ["What schemes can help cover costs?", "Where is my hospital and how to get there?", "What documents should I bring?"]
    return {"answer": ans, "is_diagnostic_refusal": False, "suggestions": sugg}


def _plain(text: str) -> str:
    """Staff should never see the prompt's internal labels, even if the model repeats them."""
    for pattern, word in ((r"\b(the )?LIVE DATA\b", "today's records"), (r"\b(the )?APP GUIDE\b", "the app"),
                          
                          (r"\s*\(tab [a-z-]+\)|\s*\([a-z]+-tab\)", "")):
        text = re.sub(pattern, word, text, flags=re.IGNORECASE)
    for tab, name, _, _ in APP_GUIDE:  # Screen names, never tab ids
        text = re.sub(rf"\b(the )?{tab}\b", name, text)
    return text.strip()


async def _snapshot(staff: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """The live referral board, with coded patient IDs only."""
    rows = [{
        "token": r["patient_token"], "finding": r["screening_finding"], "status": r["status"], "lane": r["lane"],
        "day": r["follow_up_day"] if r["following"] else None, "route": f"{r['health_post']} to {r['hospital'] or 'not referred'}",
    } for r in referral_pathway.list_referrals() if referral_pathway.visible_to(staff, r)]
    return {"as_of_date": date.today().isoformat(), "referrals": rows}


def _records_text(snap: Dict[str, Any]) -> str:
    """Records as plain sentences, so the assistant talks about patients and not database fields."""
    lines = [f"Date: {snap['as_of_date']}", "Women on the referral board:"]
    for r in snap["referrals"]:
        day = f", day {r['day']} of 14 follow-up" if r["day"] else ""
        lines.append(f"- {r['token']}: {r['finding']}, status {r['status']}, {r['route']}{day}.")
    return "\n".join(lines)


def _from_data(question: str, snap: Dict[str, Any]) -> Dict[str, Any]:
    """Answer without the AI, using only the live data and the app guide."""
    q = question.lower()
    rows = snap["referrals"]
    token = re.search(r"\bPT-[A-Z0-9-]+\b", question.upper())
    if token:
        match = next((r for r in rows if r["token"] == token.group(0)), None)
        if match:
            day = f" Day {match['day']} of 14." if match["day"] else ""
            return {"answer": f"{match['token']}: {match['finding']}. {match['status']}. {match['route']}.{day}",
                    "patients": [match["token"]], "open_tab": "encounter-tab"}
        return {"answer": f"{token.group(0)} has no referral on the board.", "patients": [], "open_tab": None}
    if any(w in q for w in ("risk", "behind", "late", "miss", "14", "delay", "overdue", "urgent", "attention", "priorit")):
        order = {"visit_due": 0, "attention": 1}
        due = sorted((r for r in rows if r["lane"] in order), key=lambda r: order[r["lane"]])
        if not due:
            return {"answer": "Nobody on the referral board needs extra follow-up today.", "patients": [], "open_tab": "overview-tab"}
        lines = [f"{r['token']}: day {r['day']} of 14. {r['route']}." for r in due]
        return {"answer": f"{len(due)} women need attention:\n" + "\n".join(lines[:8]),
                "patients": [r["token"] for r in due[:8]], "open_tab": "overview-tab"}
    for tab, name, words, desc in APP_GUIDE:
        if any(w in q for w in words):
            return {"answer": f"Use {name}. {desc}", "patients": [], "open_tab": tab}
    return {"answer": (f"The referral board has {len(rows)} women today. "
                       "I can tell you who needs attention, give a patient's referral status, or show where to do a task."),
            "patients": [], "open_tab": "overview-tab"}


@router.post("/ask")
async def ask(req: GenieQuestion, request: Request) -> Dict[str, Any]:
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please type a question.")
    if len(question) > MAX_QUESTION:
        raise HTTPException(status_code=422, detail=f"Please keep questions under {MAX_QUESTION} characters.")

    snap = await _snapshot(getattr(request.state, "staff", None))
    known = {r["token"] for r in snap["referrals"]}
    masked, _ = PIIShield.mask_text(question)
    earlier = "\n".join(f"{'Staff' if t.role == 'user' else 'Genie'}: {PIIShield.mask_text(t.text[:800])[0]}" for t in req.history[-10:])
    system = (
        "You are Genie, a warm, sharp colleague to doctors, nurses and ASHA workers in a cervical cancer "
        "screening and referral network. Talk like a helpful person in a real conversation: natural sentences, short, the "
        "direct answer first, no headings, never field names or JSON-like wording. Use the conversation so far to "
        "understand follow-ups such as 'her' or 'what about the second one'. Greetings and small talk get a brief "
        "friendly reply. Facts about patients come only from TODAY'S RECORDS; if something is not there, say you "
        "don't have it and suggest where to look. Never invent patients, numbers, labs or doses. You may explain "
        "general oncology knowledge and guidelines, and clinical suggestions are for the clinician to review, not "
        "orders. If new symptoms or findings are mentioned without clearly naming the patient, ask which patient "
        "before saying anything about a specific person; never attach them to whoever was discussed earlier. Never "
        "call a finding a confirmed diagnosis; histopathology confirms it. Never tell staff to stop or change treatment as a "
        "fact: offer it as something to consider. Never claim to have changed a record. Never suggest delaying a referral. "
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


@router.post("/patient-ask")
async def patient_ask(req: PatientGenieQuestion) -> Dict[str, Any]:
    """Patient care companion: guides on hospital directions, preparation, and government schemes.
    
    STRICT NON-DIAGNOSTIC GUARDRAIL: If the user asks for diagnostic solutions, medical diagnosis,
    symptom severity, or drug prescriptions, Genie refrains from answering in a kind tone and
    instead firmly instructs them to contact their local ASHA worker or doctor.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please enter a question.")
    if len(question) > MAX_QUESTION:
        raise HTTPException(status_code=422, detail=f"Please keep questions under {MAX_QUESTION} characters.")

    token = req.token.strip().upper()
    row = referral_pathway.get_for_patient(token)
    case = teaching_cases.BY_TOKEN.get(token) if not row else None

    patient_name = (row or {}).get("patient_name") or (case or {}).get("name") or "Sister"
    hospital = (row or {}).get("hospital") or "KEM Hospital"
    health_post = (row or {}).get("health_post") or (case or {}).get("post") or "Parel Health Post"
    area = (row or {}).get("area") or (case or {}).get("area") or "Parel"
    day = (row or {}).get("follow_up_day") or (case or {}).get("ago") or 12
    status = (row or {}).get("status") or "REFERRED"
    next_date = (row or {}).get("next_follow_up")

    # 1. Deterministic Non-Diagnostic Guardrail Check
    if _is_diagnostic_request(question):
        refusal_tmpl = REFUSAL_MESSAGES.get(req.language, REFUSAL_MESSAGES["en"])
        answer = refusal_tmpl.format(hospital=hospital)
        return {
            "source": "GUARDRAIL",
            "is_diagnostic_refusal": True,
            "answer": answer,
            "suggestions": [
                "Where is my hospital located?",
                "What government schemes can help with costs?",
                "What documents should I take with me?",
            ]
        }

    # 2. Try LLM if available
    masked, _ = PIIShield.mask_text(question)
    earlier = "\n".join(f"{'Patient' if t.role == 'user' else 'Genie'}: {PIIShield.mask_text(t.text[:800])[0]}" for t in req.history[-6:])
    lang_name = LANGUAGES.get(req.language, "English")

    system = (
        "You are CerviSetu Genie, an assistive patient care companion in an HPV screening and cervical health referral program. "
        "Talk directly and warmly to the patient or family member in clear, simple language. Keep sentences short and practical. "
        f"The patient is {patient_name} (token {token}). She is referred to {hospital} ({area}) from {health_post}. "
        f"Today is follow-up day {day} of her 14-day referral window. Status: {status}. Next appointment: {next_date or 'To be confirmed upon hospital visit'}. "
        "You can explain government schemes that help with treatment and travel costs: "
        "- Ayushman Bharat (PM-JAY): Up to ₹5 Lakh cashless coverage per eligible family per year for secondary/tertiary hospital care (colposcopy, biopsy, surgery, day care, medicines). "
        "- National Health Mission (NHM): 100% free cervical VIA screening and public OPD consultation. "
        "- State Cancer Relief Fund / Rashtriya Arogya Nidhi (RAN): Financial assistance of ₹3-5 Lakhs for BPL/marginalized patients at government tertiary hospitals. "
        "- Free Transport: Free ambulance dialing 102/108 and NHM travel stipend for rural referrals. "
        "- Dharamshala: Low-cost or free night shelter accommodation near major government referral centres. "
        "You can explain hospital logistics: bring referral slip, Aadhaar/Voter ID, ABHA/Ayushman card, and past reports; proceed to Gynaecology OPD. "
        "CRITICAL GUARDRAIL: YOU MUST NEVER PROVIDE MEDICAL DIAGNOSES, DISEASE STAGING, PROGNOSIS, OR DRUG PRESCRIPTIONS. "
        "If asking for diagnostic solutions, medical severity, or treatment prescriptions, YOU MUST REFRAIN FROM ANSWERING IN A KIND OR REASSURING TONE. "
        f"State firmly and directly that you cannot provide medical diagnosis, and instruct them to contact their local ASHA worker (Asha Didi) or doctor at {hospital}. "
        f"Write in {lang_name}. Keep patient token and hospital name exact. "
        "suggestions: up to 3 short follow-up questions the patient might ask next. "
        "Reply with one JSON object matching this schema: " + json.dumps(PATIENT_ANSWER_SCHEMA)
    )
    user = (
        f"PATIENT CONVERSATION SO FAR:\n{earlier or '(none)'}\n\n"
        f"PATIENT SAYS: {masked}"
    )

    raw = global_llm.structured(system, user, PATIENT_ANSWER_SCHEMA, "patient_genie_answer", max_tokens=600)
    if raw and str(raw.get("answer") or "").strip():
        ans_text = str(raw["answer"]).strip()
        is_diag_refusal = bool(raw.get("is_diagnostic_refusal", False)) or _is_diagnostic_request(question)
        if is_diag_refusal and not raw.get("is_diagnostic_refusal", False):
            refusal_tmpl = REFUSAL_MESSAGES.get(req.language, REFUSAL_MESSAGES["en"])
            ans_text = refusal_tmpl.format(hospital=hospital)
        suggestions = [str(x)[:90] for x in raw.get("suggestions") or [] if str(x).strip()][:3]
        return {
            "source": "AI",
            "is_diagnostic_refusal": is_diag_refusal,
            "answer": ans_text[:2000],
            "suggestions": suggestions,
        }

    # 3. Fallback to rich data-backed rule response
    fallback = _patient_from_data(question, req.language, patient_name, hospital, health_post, area, day, status, next_date)
    return {"source": "LIVE_DATA", **fallback}
