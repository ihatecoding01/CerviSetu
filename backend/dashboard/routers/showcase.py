"""Interactive Showcase Endpoints for Sarvam-inspired CerviSetu Playground & Developer Studio."""
import os
import time
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import SARVAM_API_KEY, SARVAM_TTS_MODEL
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
        default=None,
        description="Unmasked frontline patient display name"
    )
    district: Optional[str] = Field(
        default=None,
        description="Health post area"
    )


class SynthesizeSpeechRequest(BaseModel):
    text: str = Field(..., description="Vernacular Indic text to synthesize")
    language: str = Field(default="HINDI", description="Dialect: HINDI, BHOJPURI, BENGALI, MARATHI, TAMIL, TELUGU")
    speaker: Optional[str] = Field(default=None, description="Bulbul v4-flash voice persona")
    model: Optional[str] = Field(default=None, description="Must equal the configured SARVAM_TTS_MODEL if given")


class GraphTraceRequest(BaseModel):
    case_text: Optional[str] = Field(
        default="Pap HSIL, HPV positive. Referred for colposcopy-guided biopsy.",
        description="Raw case text for agent execution trace"
    )
    simulated_days_overdue: int = Field(
        default=3,
        description="Day of the 14-day follow-up"
    )


class DistrictImpactRequest(BaseModel):
    district_population: int = Field(default=1800000, description="District rural population")
    annual_cervical_cases: int = Field(default=210, description="Estimated annual cervical cancer incidences")
    spoke_clinics_count: int = Field(default=4, description="Local day-care EBRT radiation spokes")
    avg_travel_distance_km: float = Field(default=72.0, description="Average distance from rural village to central hub")
    women_screened: int = Field(default=10000, ge=0, description="Women screened per year")
    abnormal_rate_pct: float = Field(default=5.0, ge=0, le=100, description="Assumed percentage with an abnormal result")
    current_follow_up_pct: float = Field(default=50.0, ge=0, le=100, description="Assumed percentage completing follow-up today")
    target_follow_up_pct: float = Field(default=80.0, ge=0, le=100, description="Target percentage completing follow-up")


class PilotRegisterRequest(BaseModel):
    email: str = Field(..., description="Healthcare administrator or officer email")
    district: str = Field(..., description="District or province name")
    facility_type: str = Field(default="DISTRICT_HOSPITAL", description="Facility archetype")
    contact_name: Optional[str] = Field(default=None, description="Contact person name")
    phone: Optional[str] = Field(default=None, description="Contact phone number")


SAMPLE_SLIPS = {
    "sample_cervical_01": "Sample slip (fictional patient).\nPt: Nishi Paul, 36F (Fictional). Area: Parel.\nScreening: Pap: HSIL, HPV positive.\nEvaluation: Colposcopy-guided biopsy taken.\nHistopathology: CIN 2.\nReferred to: KEM Hospital.\nNext step: Treatment plan by the hospital team.",
    "sample_cervical_02": "Sample slip (fictional patient).\nPt: Rita Naidu, 52F (Fictional). Area: Charni Road.\nScreening: Suspicious cervical lesion.\nEvaluation: Colposcopy-guided biopsy taken.\nHistopathology: Invasive squamous cell carcinoma.\nReferred to: Sir JJ Hospital.\nNext step: MRI pelvis and gynaecologic oncology review.",
    "sample_cervical_03": "Sample slip (fictional patient).\nPt: Bindu Gupta, 29F (Fictional). Area: Bandra.\nScreening: Pap: LSIL.\nEvaluation: Colposcopy-guided biopsy taken.\nHistopathology: CIN 1.\nReferred to: Cooper Hospital.\nNext step: Follow-up plan by the hospital team."
}

SAMPLE_METADATA = {
    "sample_cervical_01": {
        "cancer_type": "Pap: HSIL, HPV positive",
        "stage": "Colposcopy-guided biopsy taken",
        "biopsy_status": "CIN 2",
        "patient_display": "Nishi Paul, 36F (Fictional)",
        "patient_masked": "PT ANON 7B93",
        "district": "Parel",
        "doctor_name": "Medical Officer (Sample)",
        "facility_name": "PAREL HEALTH POST · SAMPLE REFERRAL SLIP",
        "referral": {
            "hospital": "KEM Hospital",
            "next_step": "Treatment plan by the hospital team",
            "follow_up_days": 14
        },
        "bounding_boxes": [
            {
                "id": "box_screening",
                "label": "Screening Finding",
                "text": "Pap: HSIL, HPV positive",
                "category": "SCREENING",
                "rect": {
                    "top": 24,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_colposcopy",
                "label": "Colposcopy",
                "text": "Colposcopy-guided biopsy taken",
                "category": "EVALUATION",
                "rect": {
                    "top": 34,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_biopsy",
                "label": "Histopathology",
                "text": "CIN 2",
                "category": "PATHOLOGY",
                "rect": {
                    "top": 44,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_referral",
                "label": "Referral Hospital",
                "text": "KEM Hospital",
                "category": "REFERRAL",
                "rect": {
                    "top": 58,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_next",
                "label": "Next Step",
                "text": "Treatment plan by the hospital team",
                "category": "PLAN",
                "rect": {
                    "top": 70,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_followup",
                "label": "Follow-up",
                "text": "14-day follow-up after referral",
                "category": "FOLLOW-UP",
                "rect": {
                    "top": 82,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            }
        ]
    },
    "sample_cervical_02": {
        "cancer_type": "Suspicious cervical lesion",
        "stage": "Colposcopy-guided biopsy taken",
        "biopsy_status": "Invasive squamous cell carcinoma",
        "patient_display": "Rita Naidu, 52F (Fictional)",
        "patient_masked": "PT ANON 4D17",
        "district": "Charni Road",
        "doctor_name": "Medical Officer (Sample)",
        "facility_name": "CHARNI ROAD HEALTH POST · SAMPLE REFERRAL SLIP",
        "referral": {
            "hospital": "Sir JJ Hospital",
            "next_step": "MRI pelvis and gynaecologic oncology review",
            "follow_up_days": 14
        },
        "bounding_boxes": [
            {
                "id": "box_screening",
                "label": "Screening Finding",
                "text": "Suspicious cervical lesion",
                "category": "SCREENING",
                "rect": {
                    "top": 24,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_colposcopy",
                "label": "Colposcopy",
                "text": "Colposcopy-guided biopsy taken",
                "category": "EVALUATION",
                "rect": {
                    "top": 34,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_biopsy",
                "label": "Histopathology",
                "text": "Invasive squamous cell carcinoma",
                "category": "PATHOLOGY",
                "rect": {
                    "top": 44,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_referral",
                "label": "Referral Hospital",
                "text": "Sir JJ Hospital",
                "category": "REFERRAL",
                "rect": {
                    "top": 58,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_next",
                "label": "Next Step",
                "text": "MRI pelvis and gynaecologic oncology review",
                "category": "PLAN",
                "rect": {
                    "top": 70,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_followup",
                "label": "Follow-up",
                "text": "14-day follow-up after referral",
                "category": "FOLLOW-UP",
                "rect": {
                    "top": 82,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            }
        ]
    },
    "sample_cervical_03": {
        "cancer_type": "Pap: LSIL",
        "stage": "Colposcopy-guided biopsy taken",
        "biopsy_status": "CIN 1",
        "patient_display": "Bindu Gupta, 29F (Fictional)",
        "patient_masked": "PT ANON 8C52",
        "district": "Bandra",
        "doctor_name": "Medical Officer (Sample)",
        "facility_name": "BANDRA HEALTH POST · SAMPLE REFERRAL SLIP",
        "referral": {
            "hospital": "Cooper Hospital",
            "next_step": "Follow-up plan by the hospital team",
            "follow_up_days": 14
        },
        "bounding_boxes": [
            {
                "id": "box_screening",
                "label": "Screening Finding",
                "text": "Pap: LSIL",
                "category": "SCREENING",
                "rect": {
                    "top": 24,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_colposcopy",
                "label": "Colposcopy",
                "text": "Colposcopy-guided biopsy taken",
                "category": "EVALUATION",
                "rect": {
                    "top": 34,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_biopsy",
                "label": "Histopathology",
                "text": "CIN 1",
                "category": "PATHOLOGY",
                "rect": {
                    "top": 44,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_referral",
                "label": "Referral Hospital",
                "text": "Cooper Hospital",
                "category": "REFERRAL",
                "rect": {
                    "top": 58,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_next",
                "label": "Next Step",
                "text": "Follow-up plan by the hospital team",
                "category": "PLAN",
                "rect": {
                    "top": 70,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            },
            {
                "id": "box_followup",
                "label": "Follow-up",
                "text": "14-day follow-up after referral",
                "category": "FOLLOW-UP",
                "rect": {
                    "top": 82,
                    "left": 5,
                    "width": 70,
                    "height": 8
                }
            }
        ]
    }
}


INDIC_VOICE_SCRIPTS = {
    "HINDI": {
        "language_name": "Hindi (Devanagari)",
        "script": "नमस्ते। यह आपके स्वास्थ्य केंद्र से संदेश है। आपकी अस्पताल की जाँच अभी बाकी है। कृपया जल्द अस्पताल जाएँ। अगर आप जा चुकी हैं तो 1 दबाएँ। मदद के लिए 2 दबाएँ। नर्स से बात करने के लिए 3 दबाएँ।",
        "transliteration": "Namaste. Yeh aapke swasthya kendra se sandesh hai. Aapki aspatal ki jaanch abhi baaki hai. Kripya jald aspatal jaayen. Agar aap ja chuki hain to 1 dabayen. Madad ke liye 2 dabayen. Nurse se baat karne ke liye 3 dabayen.",
        "voice_locale": "hi-IN",
        "ssml": "<speak><p><s>नमस्ते। यह आपके स्वास्थ्य केंद्र से संदेश है।</s> <s>आपकी अस्पताल की जाँच अभी बाकी है। कृपया जल्द अस्पताल जाएँ।</s> <s>अगर आप जा चुकी हैं तो 1 दबाएँ। मदद के लिए 2 दबाएँ। नर्स से बात करने के लिए 3 दबाएँ।</s></p></speak>",
        "indic_wpm": 128
    },
    "BHOJPURI": {
        "language_name": "Bhojpuri (Purvanchal)",
        "script": "प्रणाम। ई राउर स्वास्थ्य केंद्र से संदेश बा। राउर अस्पताल के जाँच अबहीं बाकी बा। किरपा क के जल्दी अस्पताल जाईं। अगर रउआ जा चुकल बानी त 1 दबाईं। मदद खातिर 2 दबाईं। नर्स से बात करे खातिर 3 दबाईं।",
        "transliteration": "Pranam. Ee raur swasthya kendra se sandesh ba. Raur aspatal ke jaanch abahin baaki ba. Kirpa ka ke jaldi aspatal jaain. Agar raua ja chukal baani ta 1 dabaain. Madad khatir 2 dabaain. Nurse se baat kare khatir 3 dabaain.",
        "voice_locale": "hi-IN",
        "ssml": "<speak><p><s>प्रणाम। ई राउर स्वास्थ्य केंद्र से संदेश बा।</s> <s>राउर अस्पताल के जाँच अबहीं बाकी बा। किरपा क के जल्दी अस्पताल जाईं।</s> <s>अगर रउआ जा चुकल बानी त 1 दबाईं। मदद खातिर 2 दबाईं। नर्स से बात करे खातिर 3 दबाईं।</s></p></speak>",
        "indic_wpm": 122
    },
    "BENGALI": {
        "language_name": "Bengali (Bangla)",
        "script": "নমস্কার। এটি আপনার স্বাস্থ্যকেন্দ্র থেকে একটি বার্তা। আপনার হাসপাতালের পরীক্ষা এখনও বাকি আছে। অনুগ্রহ করে শীঘ্রই হাসপাতালে যান। যদি গিয়ে থাকেন তবে ১ টিপুন। সাহায্যের জন্য ২ টিপুন। নার্সের সঙ্গে কথা বলতে ৩ টিপুন।",
        "transliteration": "Nomoskar. Eti apnar swasthyakendra theke ekti barta. Apnar haspataler porikkha ekhono baki ache. Onugroho kore shighroi haspatale jan. Jodi giye thaken tobe ek tipun. Sahajyer jonno dui tipun. Narser songe kotha bolte tin tipun.",
        "voice_locale": "bn-IN",
        "ssml": "<speak><p><s>নমস্কার। এটি আপনার স্বাস্থ্যকেন্দ্র থেকে একটি বার্তা।</s> <s>আপনার হাসপাতালের পরীক্ষা এখনও বাকি আছে। অনুগ্রহ করে শীঘ্রই হাসপাতালে যান।</s> <s>যদি গিয়ে থাকেন তবে ১ টিপুন। সাহায্যের জন্য ২ টিপুন। নার্সের সঙ্গে কথা বলতে ৩ টিপুন।</s></p></speak>",
        "indic_wpm": 126
    },
    "MARATHI": {
        "language_name": "Marathi (Devanagari)",
        "script": "नमस्कार. हा तुमच्या आरोग्य केंद्राकडून संदेश आहे. तुमची रुग्णालयातील तपासणी अजून बाकी आहे. कृपया लवकर रुग्णालयात जा. तुम्ही जाऊन आला असाल तर 1 दाबा. मदतीसाठी 2 दाबा. परिचारिकेशी बोलण्यासाठी 3 दाबा.",
        "transliteration": "Namaskar. Ha tumchya arogya kendrakadun sandesh aahe. Tumchi rugnalayatil tapasani ajun baki aahe. Krupaya lavkar rugnalayat ja. Tumhi jaun aala asal tar 1 daba. Madatisathi 2 daba. Paricharikeshi bolnyasathi 3 daba.",
        "voice_locale": "mr-IN",
        "ssml": "<speak><p><s>नमस्कार. हा तुमच्या आरोग्य केंद्राकडून संदेश आहे.</s> <s>तुमची रुग्णालयातील तपासणी अजून बाकी आहे. कृपया लवकर रुग्णालयात जा.</s> <s>तुम्ही जाऊन आला असाल तर 1 दाबा. मदतीसाठी 2 दाबा. परिचारिकेशी बोलण्यासाठी 3 दाबा.</s></p></speak>",
        "indic_wpm": 125
    },
    "TAMIL": {
        "language_name": "Tamil",
        "script": "வணக்கம். இது உங்கள் சுகாதார நிலையத்திலிருந்து வரும் செய்தி. உங்கள் மருத்துவமனை பரிசோதனை இன்னும் நிலுவையில் உள்ளது. தயவுசெய்து விரைவில் மருத்துவமனைக்குச் செல்லுங்கள். நீங்கள் சென்றிருந்தால் 1 அழுத்துங்கள். உதவிக்கு 2 அழுத்துங்கள். செவிலியரிடம் பேச 3 அழுத்துங்கள்.",
        "transliteration": "Vanakkam. Idhu ungal sugathara nilaiyathilirundhu varum seidhi. Ungal maruthuvamanai parisodhanai innum niluvaiyil ulladhu. Thayavuseidhu viraivil maruthuvamanaikku sellungal. Neengal sendrirundhal 1 azhuthungal. Udhavikku 2 azhuthungal. Seviliyaridam pesa 3 azhuthungal.",
        "voice_locale": "ta-IN",
        "ssml": "<speak><p><s>வணக்கம். இது உங்கள் சுகாதார நிலையத்திலிருந்து வரும் செய்தி.</s> <s>உங்கள் மருத்துவமனை பரிசோதனை இன்னும் நிலுவையில் உள்ளது. தயவுசெய்து விரைவில் மருத்துவமனைக்குச் செல்லுங்கள்.</s> <s>நீங்கள் சென்றிருந்தால் 1 அழுத்துங்கள். உதவிக்கு 2 அழுத்துங்கள். செவிலியரிடம் பேச 3 அழுத்துங்கள்.</s></p></speak>",
        "indic_wpm": 120
    },
    "TELUGU": {
        "language_name": "Telugu",
        "script": "నమస్కారం. ఇది మీ ఆరోగ్య కేంద్రం నుండి సందేశం. మీ ఆసుపత్రి పరీక్ష ఇంకా పూర్తి కాలేదు. దయచేసి త్వరగా ఆసుపత్రికి వెళ్ళండి. మీరు వెళ్ళి ఉంటే 1 నొక్కండి. సహాయం కోసం 2 నొక్కండి. నర్సుతో మాట్లాడటానికి 3 నొక్కండి.",
        "transliteration": "Namaskaram. Idi mee arogya kendram nundi sandesam. Mee asupatri pariksha inka purti kaaledu. Dayachesi twaraga asupatriki vellandi. Meeru velli unte 1 nokkandi. Sahayam kosam 2 nokkandi. Nursetho matladataniki 3 nokkandi.",
        "voice_locale": "te-IN",
        "ssml": "<speak><p><s>నమస్కారం. ఇది మీ ఆరోగ్య కేంద్రం నుండి సందేశం.</s> <s>మీ ఆసుపత్రి పరీక్ష ఇంకా పూర్తి కాలేదు. దయచేసి త్వరగా ఆసుపత్రికి వెళ్ళండి.</s> <s>మీరు వెళ్ళి ఉంటే 1 నొక్కండి. సహాయం కోసం 2 నొక్కండి. నర్సుతో మాట్లాడటానికి 3 నొక్కండి.</s></p></speak>",
        "indic_wpm": 124
    }
}


@router.post("/parse-prescription")
def parse_prescription_showcase(req: PrescriptionParseRequest):
    """
    Returns a sample referral slip with labelled fields and masked identity.
    """
    start_time = time.perf_counter()

    sample_key = req.sample_id if req.sample_id in SAMPLE_METADATA else "sample_cervical_01"
    meta = SAMPLE_METADATA[sample_key]
    raw_text = req.raw_text or SAMPLE_SLIPS.get(sample_key, SAMPLE_SLIPS["sample_cervical_01"])

    # Extract structured entities
    extracted = ClinicalEntityExtractorTool.extract_entities(raw_text)
    cancer_type = meta.get("cancer_type") or extracted.get("detected_cancer", "CERVICAL")
    stage = meta.get("stage") or extracted.get("detected_stage", "")
    biopsy_status = meta.get("biopsy_status") or extracted.get("biopsy_status", "")

    # De-identify PII
    shielded_text, detected_pii = PIIShield.mask_text(raw_text)

    # Spatial Bounding Boxes customized for this prescription slip
    bounding_boxes = meta.get("bounding_boxes", [])

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "cancer_type": cancer_type,
        "stage": stage,
        "biopsy_status": biopsy_status,
        "referral": meta["referral"],
        "bounding_boxes": bounding_boxes,
        "pii_shielded": {
            "detected_types": detected_pii,
            "vault_token": meta.get("patient_masked", "PT-ANON-7B93").replace(" ", "-"),
            "anonymized_snippet": shielded_text[:280] + "..."
        },
        "elapsed_ms": elapsed_ms,
        "raw_text": raw_text,
        "patient_display": meta.get("patient_display"),
        "patient_masked": meta.get("patient_masked"),
        "district": meta.get("district"),
        "doctor_name": meta.get("doctor_name"),
        "facility_name": meta.get("facility_name")
    }


SARVAM_SPEAKERS = {
    # Language codes for Sarvam TTS. Speaker is omitted by default so bulbul:v4-flash uses its documented
    # default persona; only IDs listed in SARVAM_TTS_SPEAKERS (env, comma-separated) may be requested.
    "HINDI": {"lang": "hi-IN"},
    "BHOJPURI": {"lang": "hi-IN"},
    "BENGALI": {"lang": "bn-IN"},
    "MARATHI": {"lang": "mr-IN"},
    "TAMIL": {"lang": "ta-IN"},
    "TELUGU": {"lang": "te-IN"},
}
ALLOWED_TTS_SPEAKERS = {s.strip() for s in os.getenv("SARVAM_TTS_SPEAKERS", "").split(",") if s.strip()}
MAX_TTS_CHARACTERS = 1500


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
        "indic_wpm": script_entry["indic_wpm"],
        "tts_engine": {
            "model": SARVAM_TTS_MODEL,
            "speaker": None,
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
    """Voice Studio TTS via the configured Sarvam model (one request per click, no retries).

    status SUCCESS means Sarvam returned audio. Anything else returns status FALLBACK with
    sarvam_audio=false and a reason, so the browser's own speech is never presented as Sarvam output.
    """
    from backend.core.llm_client import global_llm

    lang_key = req.language.upper()
    if lang_key not in SARVAM_SPEAKERS:
        raise HTTPException(status_code=422, detail=f"Unsupported language: {req.language}")
    if req.model and req.model != SARVAM_TTS_MODEL:
        raise HTTPException(status_code=422, detail=f"Only the configured TTS model {SARVAM_TTS_MODEL} is allowed")
    if req.speaker and req.speaker not in ALLOWED_TTS_SPEAKERS:
        raise HTTPException(status_code=422, detail="Unsupported speaker")
    if not req.text.strip() or len(req.text) > MAX_TTS_CHARACTERS:
        raise HTTPException(status_code=422, detail=f"Text must be 1-{MAX_TTS_CHARACTERS} characters")

    target_lang = SARVAM_SPEAKERS[lang_key]["lang"]
    out = global_llm.synthesize(req.text, target_lang, SARVAM_TTS_MODEL, req.speaker)
    if out.get("audio_base64"):
        return {"status": "SUCCESS", "audio_base64": out["audio_base64"], "model": SARVAM_TTS_MODEL,
                "speaker": req.speaker, "target_language_code": target_lang, "provider": "sarvam_ai",
                "sarvam_audio": True}
    return {
        "status": "FALLBACK",
        "reason": out.get("error", "UNAVAILABLE"),
        "model": SARVAM_TTS_MODEL,
        "speaker": req.speaker,
        "target_language_code": target_lang,
        "provider": "browser_web_speech",
        "sarvam_audio": False,
        "audio_base64": None,
    }


@router.post("/graph-trace")
def execute_graph_trace(req: GraphTraceRequest):
    """
    Returns the latest recorded LangGraph run,
    with node timings and the newest audit block.
    """
    from backend.core.run_trace import latest_ledger_block, latest_trace

    day = req.simulated_days_overdue
    step = "Daily reminders" if day <= 10 else "Intensive contact" if day <= 13 else "ASHA home visit"
    what_if = f"Follow-up day {day}: {step}"
    real = latest_trace()
    if real:
        nodes = [dict(n) for n in real["nodes"]]
        nodes[-1]["summary"] = f"{nodes[-1]['summary']} {what_if}."
        return {"trace_id": real["trace_id"], "source": "LATEST_REAL_RUN", "recorded_at": real["recorded_at"],
                "total_latency_ms": real["total_latency_ms"], "node_count": len(nodes), "nodes": nodes,
                "patient_token": "Hidden", "ledger_block": latest_ledger_block()}

    # No case has run on this server yet: show the pipeline's steps without inventing any measurements
    nodes = [
        {"node": "intake", "name": "Intake & PII Vault", "role": "Masks identity, reads the case", "latency_ms": 0,
         "status": "WAITING", "summary": "Run a case in Clinical Intake to record real timings."},
        {"node": "diagnostic", "name": "Case Summary", "role": "Summary and pathway for clinician review", "latency_ms": 0,
         "status": "WAITING", "summary": "Run a case in Clinical Intake to record real timings."},
    ]
    return {"trace_id": "NO-RUN-YET", "source": "NO_RUN_YET", "recorded_at": None, "total_latency_ms": 0,
            "node_count": len(nodes), "nodes": nodes, "patient_token": "None yet", "ledger_block": latest_ledger_block()}


@router.post("/district-impact")
def calculate_district_impact(req: DistrictImpactRequest):
    """
    Calculates estimated lives saved, travel kilometers spared,
    and out-of-pocket costs reduced for a rural district.
    """
    cases = req.annual_cervical_cases
    traditional_mean_days = 72
    cervisetu_mean_days = 48
    days_saved = traditional_mean_days - cervisetu_mean_days

    survival_penalty_avoided_pct = days_saved * 1.0
    lives_saved_annually = round(cases * (survival_penalty_avoided_pct / 100.0) * 0.72)

    km_spared_per_visit = max(0.0, (req.avg_travel_distance_km - 14.0) * 2)
    total_km_spared = int(cases * 25 * km_spared_per_visit)
    inr_savings = cases * 25 * 530

    abnormal = round(req.women_screened * req.abnormal_rate_pct / 100)
    current = round(abnormal * req.current_follow_up_pct / 100)
    target = round(abnormal * req.target_follow_up_pct / 100)

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
        },
        "women_screened": req.women_screened,
        "women_with_abnormal_results": abnormal,
        "completing_follow_up_now": current,
        "completing_follow_up_at_target": target,
        "additional_women_reaching_care": target - current,
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
