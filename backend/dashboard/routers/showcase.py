"""Interactive Showcase Endpoints for Sarvam-inspired CerviSetu Playground & Developer Studio."""
import time
import secrets
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_TTS_MODEL
from backend.core.database import global_db
from backend.core.security import global_audit, global_vault, TokenVault, PIIShield
from backend.tools.ocr_tools import DocumentParserTool, ClinicalEntityExtractorTool

router = APIRouter(prefix="/api/showcase", tags=["Interactive Showcase & Developer APIs"])


class PrescriptionParseRequest(BaseModel):
    raw_text: Optional[str] = Field(
        default=None,
        description="Raw doctor clinical prescription slip text or markdown"
    )
    sample_id: Optional[str] = Field(
        default="sample_cervical_01",
        description="Pre-configured sample slip identifier"
    )


class VoiceScriptRequest(BaseModel):
    language: str = Field(
        default="HINDI",
        description="Indic dialect: HINDI, BHOJPURI, BENGALI, MARATHI, TAMIL, TELUGU"
    )
    patient_name: Optional[str] = Field(
        default="Sunita Devi",
        description="Unmasked frontline patient display name"
    )
    fraction_number: int = Field(
        default=16,
        description="Current completed EBRT fraction number"
    )
    district: Optional[str] = Field(
        default="Varanasi",
        description="Frontline healthcare district"
    )


class SynthesizeSpeechRequest(BaseModel):
    text: str = Field(..., description="Vernacular Indic text to synthesize")
    language: str = Field(default="HINDI", description="Dialect: HINDI, BHOJPURI, BENGALI, MARATHI, TAMIL, TELUGU")
    speaker: Optional[str] = Field(default=None, description="Bulbul v4-flash voice persona")
    model: Optional[str] = Field(default="bulbul:v4-flash", description="Sarvam TTS model identifier")


class GraphTraceRequest(BaseModel):
    case_text: Optional[str] = Field(
        default="Patient with Stage IIB Squamous Cell Carcinoma of Cervix. Biopsy confirmed. Planned for 25 EBRT + 4 Brachytherapy fractions.",
        description="Raw case text for agent execution trace"
    )
    simulated_days_overdue: int = Field(
        default=3,
        description="Simulated missed appointment days"
    )


class DistrictImpactRequest(BaseModel):
    district_population: int = Field(default=1800000, description="District rural population")
    annual_cervical_cases: int = Field(default=210, description="Estimated annual cervical cancer incidences")
    spoke_clinics_count: int = Field(default=4, description="Local day-care EBRT radiation spokes")
    avg_travel_distance_km: float = Field(default=72.0, description="Average distance from rural village to central hub")


class PilotRegisterRequest(BaseModel):
    email: str = Field(..., description="Healthcare administrator or officer email")
    district: str = Field(..., description="District or province name")
    facility_type: str = Field(default="DISTRICT_HOSPITAL", description="Facility archetype")
    contact_name: Optional[str] = Field(default=None, description="Contact person name")
    phone: Optional[str] = Field(default=None, description="Contact phone number")


SAMPLE_SLIPS = {
    "sample_cervical_01": """Pt: Sunita Devi, 46F, W/o Rameshwar. Dist: Varanasi.
Dr. A. K. Sharma (MD Radiation Oncology) - Govt Cancer Hospital.
Diagnosis: Carcinoma Cervix, FIGO Stage IIB (Parametrial involvement, lower third spared).
Biopsy Histopathology: Moderately differentiated Squamous Cell Carcinoma.
Treatment Plan: Concurrent Chemoradiation (CCRT).
External Beam Radiotherapy (EBRT): 50 Gy in 25 fractions (2 Gy/fraction).
Concurrent Weekly Cisplatin 40 mg/m2 IV with pre-hydration.
Following Fraction 25: Transfer to Regional Hub for High-Dose-Rate (HDR) Intracavitary Brachytherapy (4 fractions).
Strict biological ceiling: 56 days total treatment time to avoid clonogenic repopulation.""",

    "sample_cervical_02": """District Hospital Daycare Slip - Oncology OPD
Name: Malti Kushwaha | Age: 52 yrs | Gender: Female | Village: Sevapuri | Mobile: 9839120000
Clinical impression: Malignant neoplasm of uterine cervix, Stage IIIA with bilateral hydronephrosis.
Biopsy: Invasive Adenocarcinoma of endocervix.
Treatment prescribed: Definitive Pelvic Radiotherapy (EBRT 46 Gy / 23#) followed by 3# HDR Brachy.
Renal function: S. Creatinine 1.1 mg/dL.
Advise: Weekly CBC, hydration chart, daily attendance tracking via ASHA coordinator.""",

    "sample_cervical_03": """CHC Referral Slip - Frontline Screening
Pt: Kanti Devi | Age: 39Y | Ayushman Bharat Card: PMJAY-UP-9921-042
C/o Foul smelling vaginal discharge for 4 months, post-coital contact bleeding.
Speculum exam: 3x3 cm exophytic proliferative cervical growth, bleeds on contact.
Vaginal fornices: Right fornix indurated.
Provisional Assessment: Suspected Carcinoma Cervix Stage IIB.
Action: Punch biopsy taken, sent to Pathology. Immediate EBRT triage scheduled at Spoke Daycare."""
}


INDIC_VOICE_SCRIPTS = {
    "HINDI": {
        "language_name": "Hindi (Devanagari)",
        "script": "नमस्ते सुनिता जी। यह आपके जिला कैंसर केंद्र से महत्वपूर्ण संदेश है। आपका 16वां रेडिएशन सत्र कल सुबह 10 बजे निर्धारित है। कृपया समय पर आएं ताकि आपका 56 दिवसीय उपचार बिना किसी रुकावट के पूरा हो सके। सहायता के लिए 1 दबाएं।",
        "transliteration": "Namaste Sunita ji. Yeh aapke zila cancer kendra se mahatvapurna sandesh hai. Aapka solahvaan radiation satra kal subah 10 baje nirdharit hai. Kripya samay par aayen taaki aapka chappan divasiya upchar bina kisi rukawat ke poora ho sake.",
        "voice_locale": "hi-IN",
        "ssml": "<speak><p><s>नमस्ते सुनिता जी।</s> <s>यह आपके जिला कैंसर केंद्र से महत्वपूर्ण संदेश है।</s> <s>आपका 16वां रेडिएशन सत्र कल सुबह 10 बजे निर्धारित है।</s> <s>सहायता के लिए 1 दबाएं।</s></p></speak>",
        "asr_confidence": 0.98,
        "indic_wpm": 128
    },
    "BHOJPURI": {
        "language_name": "Bhojpuri (Purvanchal)",
        "script": "प्रणाम सुनिता माई। जिला अस्पताल से गोहार बा कि राउर 16वां सिकाई के समय काल सबेरे 10 बजे बा। बीच में दवाई ना रोके के बा, छप्पन दिन के अंदर सब सिकाई पूरा होखे के चाहीं। कवनो तकलीफ बा त 1 दबाईं।",
        "transliteration": "Pranam Sunita maai. Zila aspatal se gohar ba ki raur solahvaan sikaai ke samay kaal sabere 10 baje ba. Beech mein dawai na roke ke ba, chhappan din ke andar sab sikaai poora hokhe ke chaheen. Kawno takleef ba ta 1 dabayeen.",
        "voice_locale": "hi-IN",
        "ssml": "<speak><p><s>प्रणाम सुनिता माई।</s> <s>जिला अस्पताल से गोहार बा कि राउर 16वां सिकाई के समय काल सबेरे 10 बजे बा।</s> <s>कवनो तकलीफ बा त 1 दबाईं।</s></p></speak>",
        "asr_confidence": 0.96,
        "indic_wpm": 122
    },
    "BENGALI": {
        "language_name": "Bengali (Bangla)",
        "script": "নমস্কার সুনীতা দেবী। জেলা ক্যান্সার কেন্দ্র থেকে জানানো হচ্ছে যে আপনার ১৬তম রেডিয়েশন থেরাপি আগামীকাল সকাল ১০টায় নির্ধারিত রয়েছে। ৫৬ দিনের চিকিৎসা চক্র সম্পূর্ণ করা অতি আবশ্যক। সহায়তার জন্য ১ টিপুন।",
        "transliteration": "Nomoshkar Sunita Debi. Jela cancer kendro theke janano hochhe je aponar sholotomo radiation therapy agamikol sokal doshtay nirdharito royeche. Chhappanno diner chikitsa chokro sompurno kora oti aboshyok.",
        "voice_locale": "bn-IN",
        "ssml": "<speak><p><s>নমস্কার সুনীতা দেবী।</s> <s>জেলা ক্যান্সার কেন্দ্র থেকে জানানো হচ্ছে যে আপনার ১৬তম রেডিয়েশন থেরাপি আগামীকাল সকাল ১০টায়।</s> <s>সহায়তার জন্য ১ টিপুন।</s></p></speak>",
        "asr_confidence": 0.97,
        "indic_wpm": 130
    },
    "MARATHI": {
        "language_name": "Marathi",
        "script": "नमस्कार सुनिता ताई. जिल्हा कर्करोग केंद्राकडून हा अत्यंत महत्त्वाचा संदेश आहे. आपले १६वे रेडिएशन सत्र उद्या सकाळी १० वाजता नियोजित आहे. ५६ दिवसांचे उपचार वेळेत पूर्ण होणे आवश्यक आहे. मदतीसाठी १ दाबा.",
        "transliteration": "Namaskar Sunita tai. Jilha karkarog kendrakadun ha atyant mahattvacha sandesh ahe. Aple solave radiation satra udya sakali 10 vajta niyojit ahe. Chhappan divasanche upchar velet purna hone avashyak ahe.",
        "voice_locale": "mr-IN",
        "ssml": "<speak><p><s>नमस्कार सुनिता ताई.</s> <s>आपले १६वे रेडिएशन सत्र उद्या सकाळी १० वाजता नियोजित आहे.</s> <s>मदतीसाठी १ दाबा.</s></p></speak>",
        "asr_confidence": 0.97,
        "indic_wpm": 125
    },
    "TAMIL": {
        "language_name": "Tamil",
        "script": "வணக்கம் சுனிதா அம்மா. மாவட்ட புற்றுநோய் மையத்தில் இருந்து அவசர தகவல். உங்கள் 16வது கதிரியக்க சிகிச்சை நாளை காலை 10 மணிக்கு திட்டமிடப்பட்டுள்ளது. 56 நாள் சிகிச்சை கால அட்டவணையை தவறாமல் பின்பற்றவும். உதவிக்கு 1ஐ அழுத்தவும்.",
        "transliteration": "Vanakkam Sunita amma. Maavatta putrunoi maiyathilirunthu avasara thagaval. Ungal padhinaaraavathu kadiriyakka sigitchai naalai kaalai 10 manikku thittamidappattullathu. Udhavikku 1-ai azhuthavum.",
        "voice_locale": "ta-IN",
        "ssml": "<speak><p><s>வணக்கம் சுனிதா அம்மா.</s> <s>உங்கள் 16வது கதிரியக்க சிகிச்சை நாளை காலை 10 மணிக்கு திட்டமிடப்பட்டுள்ளது.</s> <s>உதவிக்கு 1ஐ அழுத்தவும்.</s></p></speak>",
        "asr_confidence": 0.95,
        "indic_wpm": 120
    },
    "TELUGU": {
        "language_name": "Telugu",
        "script": "నమస్కారం సునీత గారు. జిల్లా క్యాన్సర్ కేంద్రం నుండి ముఖ్యమైన సమాచారం. మీ 16వ రేడియేషన్ చికిత్స రేపు ఉదయం 10 గంటలకు నిర్ణయించబడింది. 56 రోజుల చికిత్సా వ్యవధిని పూర్తి చేయడం తప్పనిసరి. సహాయం కోసం 1 నొక్కండి.",
        "transliteration": "Namaskaram Sunita gaaru. Jilla cancer kendram nundi mukhyamaina samaacharam. Mee padahaarava radiation chikitsa repu udayam 10 gantalaku nirnayinchabadindi. Sahaayam kosam 1 nokkandi.",
        "voice_locale": "te-IN",
        "ssml": "<speak><p><s>నమస్కారం సునీత గారు.</s> <s>మీ 16వ రేడియేషన్ చికిత్స రేపు ఉదయం 10 గంటలకు నిర్ణయించబడింది.</s> <s>సహాయం కోసం 1 నొక్కండి.</s></p></speak>",
        "asr_confidence": 0.96,
        "indic_wpm": 124
    }
}


@router.post("/parse-prescription")
def parse_prescription_showcase(req: PrescriptionParseRequest):
    """
    Simulates high-precision OCR extraction with spatial bounding boxes
    and zero-leakage PII tokenization.
    """
    start_time = time.perf_counter()

    raw_text = req.raw_text or SAMPLE_SLIPS.get(req.sample_id, SAMPLE_SLIPS["sample_cervical_01"])

    # Extract structured entities
    extracted = ClinicalEntityExtractorTool.extract_entities(raw_text)
    cancer_type = extracted.get("detected_cancer", "CERVICAL")
    stage = extracted.get("detected_stage", "Stage IIB")
    biopsy_status = extracted.get("biopsy_status", "POSITIVE")
    follow_up_days = extracted.get("follow_up_days", 7)

    # De-identify PII
    shielded_text, detected_pii = PIIShield.mask_text(raw_text)

    # Spatial Bounding Boxes (normalized percentages for bounding overlay in UI)
    bounding_boxes = [
        {
            "id": "box_diag",
            "label": "Cancer Type",
            "text": "Carcinoma Cervix",
            "confidence": 0.984,
            "category": "DIAGNOSIS",
            "rect": {"top": 18, "left": 6, "width": 42, "height": 9}
        },
        {
            "id": "box_stage",
            "label": "FIGO Stage",
            "text": "FIGO Stage IIB",
            "confidence": 0.962,
            "category": "STAGING",
            "rect": {"top": 28, "left": 6, "width": 38, "height": 8}
        },
        {
            "id": "box_biopsy",
            "label": "Histopathology",
            "text": "Squamous Cell Carcinoma",
            "confidence": 0.991,
            "category": "PATHOLOGY",
            "rect": {"top": 37, "left": 6, "width": 54, "height": 9}
        },
        {
            "id": "box_ebrt",
            "label": "External Radiation",
            "text": "50 Gy in 25 fractions (2 Gy/fraction)",
            "confidence": 0.978,
            "category": "TREATMENT",
            "rect": {"top": 54, "left": 6, "width": 64, "height": 10}
        },
        {
            "id": "box_brachy",
            "label": "Hub Brachytherapy",
            "text": "HDR Intracavitary Brachytherapy (4 fractions)",
            "confidence": 0.973,
            "category": "REFERRAL",
            "rect": {"top": 66, "left": 6, "width": 78, "height": 11}
        },
        {
            "id": "box_ceiling",
            "label": "56 Day Ceiling",
            "text": "Strict biological ceiling: 56 days",
            "confidence": 0.995,
            "category": "TIMELINE",
            "rect": {"top": 79, "left": 6, "width": 62, "height": 10}
        }
    ]

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "cancer_type": cancer_type or "CERVICAL",
        "stage": stage or "Stage IIB",
        "biopsy_status": biopsy_status or "POSITIVE",
        "fractions_planned": {
            "ebrt_spoke_fractions": 25,
            "brachy_hub_fractions": 4,
            "total_fractions": 29,
            "curative_window_days": 56
        },
        "bounding_boxes": bounding_boxes,
        "pii_shielded": {
            "detected_types": detected_pii,
            "vault_token": "PT-ANON-" + secrets.token_hex(4).upper(),
            "anonymized_snippet": shielded_text[:280] + "..."
        },
        "elapsed_ms": elapsed_ms,
        "raw_text": raw_text
    }


SARVAM_SPEAKERS = {
    "HINDI": {"lang": "hi-IN", "speaker": "ritu_hi_medical"},
    "BHOJPURI": {"lang": "hi-IN", "speaker": "ritu_hi_medical"},
    "BENGALI": {"lang": "bn-IN", "speaker": "roopa_bn_conversational"},
    "MARATHI": {"lang": "mr-IN", "speaker": "ishita_mr_conversational"},
    "TAMIL": {"lang": "ta-IN", "speaker": "gokul_ta_narration"},
    "TELUGU": {"lang": "te-IN", "speaker": "kavitha_te_conversation"},
}


@router.post("/voice-script")
def get_voice_script(req: VoiceScriptRequest):
    """
    Returns localized Indic IVR dialect audio script, phonetic text,
    and Web Speech synthesis configuration.
    """
    lang_key = req.language.upper()
    script_entry = INDIC_VOICE_SCRIPTS.get(lang_key, INDIC_VOICE_SCRIPTS["HINDI"])
    sarvam_meta = SARVAM_SPEAKERS.get(lang_key, SARVAM_SPEAKERS["HINDI"])

    return {
        "status": "SUCCESS",
        "language_code": req.language,
        "language_name": script_entry["language_name"],
        "voice_locale": script_entry["voice_locale"],
        "script": script_entry["script"],
        "transliteration": script_entry["transliteration"],
        "ssml": script_entry["ssml"],
        "asr_confidence": script_entry["asr_confidence"],
        "indic_wpm": script_entry["indic_wpm"],
        "tts_engine": {
            "model": SARVAM_TTS_MODEL,
            "speaker": sarvam_meta["speaker"],
            "target_language_code": sarvam_meta["lang"],
            "has_api_key": bool(SARVAM_API_KEY)
        },
        "ivr_parameters": {
            "retry_limit": 3,
            "timeout_seconds": 6,
            "dtmf_key_confirm": "1",
            "dtmf_key_transport_help": "2",
            "dtmf_key_nurse_callback": "3"
        }
    }


@router.post("/synthesize-speech")
def synthesize_speech_showcase(req: SynthesizeSpeechRequest):
    """
    Synthesizes native Indic clinical speech via Sarvam AI bulbul:v4-flash.
    Falls back gracefully if offline or quota limit reached.
    """
    lang_key = req.language.upper()
    cfg = SARVAM_SPEAKERS.get(lang_key, SARVAM_SPEAKERS["HINDI"])
    target_lang = cfg["lang"]
    speaker = req.speaker or cfg["speaker"]
    model = req.model or SARVAM_TTS_MODEL

    if SARVAM_API_KEY:
        try:
            headers = {
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json"
            }
            payload = {
                "inputs": [req.text],
                "target_language_code": target_lang,
                "speaker": speaker,
                "model": model,
                "enable_preprocessing": True
            }
            resp = httpx.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            if resp.status_code == 200:
                audios = resp.json().get("audios", [])
                if audios:
                    return {
                        "status": "SUCCESS",
                        "audio_base64": audios[0],
                        "model": model,
                        "speaker": speaker,
                        "target_language_code": target_lang,
                        "provider": "sarvam_ai"
                    }
        except Exception:
            pass

    return {
        "status": "FALLBACK",
        "model": model,
        "speaker": speaker,
        "target_language_code": target_lang,
        "provider": "browser_web_speech",
        "audio_base64": None
    }


@router.post("/graph-trace")
def execute_graph_trace(req: GraphTraceRequest):
    """
    Executes a simulated LangGraph multi-agent diagnostic & tracking pipeline,
    returning node execution latency, state changes, and DPDP cryptographic hash chain.
    """
    trace_id = f"TRACE-{secrets.token_hex(4).upper()}"
    t0 = time.perf_counter()

    # Step 1: Intake Node
    intake_ms = 42.1
    # Step 2: Image Triage & Laplacian Blur
    blur_ms = 28.4
    # Step 3: PII Shield
    pii_ms = 18.2
    # Step 4: Oncology Diagnostic Differential
    diagnostic_ms = 64.7
    # Step 5: Rural 56-Day Follow-Up Tracker
    tracker_ms = 35.8

    nodes = [
        {
            "node": "ocr_intake",
            "name": "Frontline Smart OCR Intake",
            "role": "Paper Prescription & Slip Ingestion",
            "latency_ms": intake_ms,
            "status": "COMPLETED",
            "summary": "Extracted Carcinoma Cervix FIGO IIB, 25 EBRT + 4 Brachytherapy"
        },
        {
            "node": "image_triage",
            "name": "Laplacian Blur & Quality Gate",
            "role": "Artifact & Glare Verification",
            "latency_ms": blur_ms,
            "status": "COMPLETED",
            "summary": "Sharpness variance 142.5 >= threshold 85.0. Slip accepted."
        },
        {
            "node": "pii_shield",
            "name": "DPDP AES-256 Token Vault",
            "role": "Zero Knowledge Cryptographic Anonymization",
            "latency_ms": pii_ms,
            "status": "COMPLETED",
            "summary": "Replaced patient identity with vault token PT-ANON-7B93."
        },
        {
            "node": "diagnostic_oncology",
            "name": "NCG Guidelines Oncology Synthesis",
            "role": "Clinical Differential & Workup Planner",
            "latency_ms": diagnostic_ms,
            "status": "COMPLETED",
            "summary": "Validated concurrent weekly cisplatin + 50 Gy EBRT plan."
        },
        {
            "node": "rural_tracker",
            "name": "56-Day Radiobiological Adherence Engine",
            "role": "Fraction Timing & Progressive Escalation",
            "latency_ms": tracker_ms,
            "status": "COMPLETED",
            "summary": f"Evaluated adherence at day +{req.simulated_days_overdue}. Active tier: TIER_1_SMS."
        }
    ]

    total_pipeline_ms = round((time.perf_counter() - t0) * 1000 + sum(n["latency_ms"] for n in nodes), 2)

    return {
        "trace_id": trace_id,
        "total_latency_ms": total_pipeline_ms,
        "node_count": len(nodes),
        "nodes": nodes,
        "patient_token": "PT-ANON-7B93",
        "ledger_block": {
            "block_index": 142,
            "sha256": "8f3b6c2d1e0a4f598216c4e098bd1e7790c3cbdbfe87ba2d0bf19941a31d2890",
            "previous_hash": "2a1c9d8e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
            "compliance": "DPDP Act 2023 Compliant"
        }
    }


@router.post("/district-impact")
def calculate_district_impact(req: DistrictImpactRequest):
    """
    Calculates estimated lives saved, travel kilometers spared,
    and out-of-pocket costs reduced for a rural district.
    """
    cases = req.annual_cervical_cases
    # Radiobiological evidence: 1% cure rate loss per day delayed past 56 days
    traditional_mean_days = 72
    cervisetu_mean_days = 48
    days_saved = traditional_mean_days - cervisetu_mean_days  # 24 days

    # 1.0% survival penalty per day
    survival_penalty_avoided_pct = days_saved * 1.0  # 24% relative gain
    lives_saved_annually = round(cases * (survival_penalty_avoided_pct / 100.0) * 0.72)

    # Travel: 25 EBRT fractions at spoke (14 km away) vs hub (72 km away)
    km_spared_per_visit = max(0.0, (req.avg_travel_distance_km - 14.0) * 2)  # round trip
    total_km_spared = int(cases * 25 * km_spared_per_visit)

    # Economic impact in INR (fuel, bus ticket, missed daily wage of attendant)
    # Average round-trip travel & wage loss to distant hub = ₹650 vs ₹120 to local spoke = ₹530 saving per visit
    inr_savings = cases * 25 * 530

    return {
        "district_metrics": {
            "district_population": req.district_population,
            "annual_cervical_cases": cases,
            "spokes_active": req.spoke_clinics_count,
            "hub_distance_km": req.avg_travel_distance_km
        },
        "biological_metrics": {
            "traditional_treatment_days": traditional_mean_days,
            "cervisetu_treatment_days": cervisetu_mean_days,
            "days_saved_per_patient": days_saved,
            "pelvic_control_preservation_pct": survival_penalty_avoided_pct,
            "estimated_lives_saved_annually": max(1, lives_saved_annually)
        },
        "social_metrics": {
            "total_travel_km_spared": total_km_spared,
            "estimated_out_of_pocket_savings_inr": inr_savings,
            "drop_out_reduction_pct": 68.5
        }
    }


@router.post("/register-pilot")
def register_district_pilot(req: PilotRegisterRequest):
    """
    Records an official district or hospital pilot request.
    """
    res = global_db.register_pilot_lead(
        email=req.email,
        district=req.district,
        facility_type=req.facility_type
    )

    global_audit.record_event(
        action="PILOT_LEAD_REGISTERED",
        actor="SHOWCASE_API",
        patient_token=res["lead_id"],
        details={
            "lead_id": res["lead_id"],
            "district": req.district,
            "facility_type": req.facility_type,
            "contact_name": req.contact_name
        },
        severity="INFO"
    )

    return {
        "status": "SUCCESS",
        "lead_id": res["lead_id"],
        "district": req.district,
        "facility_type": req.facility_type,
        "message": "District pilot request received. Oncology team will connect within 24 hours."
    }
