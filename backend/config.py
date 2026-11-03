"""Clinical Agentic System Configuration."""
import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
# CERVISETU_DATA_DIR lets the test suite use a throwaway directory instead of the demo data
DATA_DIR = Path(os.getenv("CERVISETU_DATA_DIR") or BASE_DIR / "data")
UPLOADS_DIR = DATA_DIR / "uploads"
VAULT_DIR = DATA_DIR / "vault"
DB_PATH = DATA_DIR / "clinical_system.db"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
VAULT_DIR.mkdir(parents=True, exist_ok=True)

# Security & Encryption Configuration
# 32-byte AES key for PII Token Vault encryption (stored in env or auto-generated for local dev)
DEV_VAULT_SECRET_KEY = "k9X2mQ7vL4zP1wR8tY5nJ0bV3cE6hA8dF4gK7uM2wP9="  # Public dev key, never for real patients
# `or` (not a getenv default) so a blank VAULT_SECRET_KEY= line in .env still falls back to the dev key
VAULT_SECRET_KEY = os.getenv("VAULT_SECRET_KEY") or DEV_VAULT_SECRET_KEY

# CERVISETU_ENV=production refuses to start without a private vault key
APP_ENV = os.getenv("CERVISETU_ENV", "development").lower()
if APP_ENV == "production" and (VAULT_SECRET_KEY == DEV_VAULT_SECRET_KEY or len(VAULT_SECRET_KEY) < 32):
    raise RuntimeError(
        "VAULT_SECRET_KEY must be set to a private key of at least 32 characters when CERVISETU_ENV=production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

# Image Quality Thresholds
IMAGE_QUALITY_THRESHOLDS = {
    "blur_laplacian_min": float(os.getenv("BLUR_LAPLACIAN_MIN", "85.0")),   # Min variance of Laplacian
    "fft_high_freq_min": float(os.getenv("FFT_HIGH_FREQ_MIN", "12.0")),     # Min high-frequency energy %
    "min_contrast_rms": float(os.getenv("MIN_CONTRAST_RMS", "18.0")),        # Min RMS contrast
    "min_resolution_width": int(os.getenv("MIN_RES_WIDTH", "256")),
    "min_resolution_height": int(os.getenv("MIN_RES_HEIGHT", "256")),
    "max_underexposed_pct": float(os.getenv("MAX_UNDEREXPOSED_PCT", "88.0")),# Max % pixels near zero
    "max_overexposed_pct": float(os.getenv("MAX_OVEREXPOSED_PCT", "60.0")),  # Max % pixels near 255
}

# Rural Follow-Up & Escalation Timeline (in days missed, audited compressed radiobiological windows)
ESCALATION_POLICY = {
    "tier_1_sms_days": 1,        # Day +1 missed -> Multilingual WhatsApp / SMS Nudge
    "tier_2_ivr_days": 2,        # Day +2 missed -> Automated interactive voice IVR call + Nurse outreach
    "tier_3_asha_days": 3,       # Day +3 missed -> Immediate ASHA Village Home Visit Ticket (stigma-safe)
    "tier_4_authority_days": 5,  # Day +5 missed -> District CMO Statutory Emergency MMU/108 Escort
}

# Treatment clock calendar: session dates and "today" are clinic-local dates, not UTC
CLINIC_TIMEZONE = ZoneInfo(os.getenv("CERVISETU_CLINIC_TZ", "Asia/Kolkata"))


def clinic_today() -> date:
    return datetime.now(CLINIC_TIMEZONE).date()


# Severity Score Weights (0.0 to 1.0)
SEVERITY_THRESHOLDS = {
    "high_risk_cutoff": 0.70,   # High risk triggers Tier 4 authority unmasking on non-response
    "moderate_risk_cutoff": 0.40,
}

# Supported LLM Providers & Settings
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")

# Groq Oncology Inference Settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

# Sarvam AI Indic Speech & Vision Settings
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai")
SARVAM_TTS_MODEL = os.getenv("SARVAM_TTS_MODEL", "bulbul:v4-flash")
SARVAM_LLM_MODEL = os.getenv("SARVAM_LLM_MODEL", "sarvam-105b")
# Set CERVISETU_DISABLE_LLM=1 to force the deterministic rule-based pipeline (used by the test suite)
LLM_DISABLED = os.getenv("CERVISETU_DISABLE_LLM", "").lower() in ("1", "true", "yes")

# Clinical document OCR (uploaded slips/reports). Off unless explicitly enabled AND a provider is set.
# NOTE: with "sarvam_vision" the unmasked document image leaves this server; use synthetic documents.
OCR_ENABLED = os.getenv("CERVISETU_OCR_ENABLED", "").lower() in ("1", "true", "yes")
OCR_PROVIDER = os.getenv("CERVISETU_OCR_PROVIDER", "").strip().lower()   # "sarvam_vision" or empty
OCR_MAX_PAGES = int(os.getenv("CERVISETU_OCR_MAX_PAGES", "2"))
OCR_MAX_BYTES = int(os.getenv("CERVISETU_OCR_MAX_BYTES", str(8 * 1024 * 1024)))
OCR_LANGUAGE = os.getenv("CERVISETU_OCR_LANGUAGE", "")                  # BCP-47 e.g. en-IN; empty = provider default (Indic)
OCR_TIMEOUT_SECONDS = float(os.getenv("CERVISETU_OCR_TIMEOUT_SECONDS", "60"))
# Document photos: reject only clearly unreadable images (sharpness below this fraction of the blur threshold)
OCR_BLUR_REJECT_RATIO = float(os.getenv("CERVISETU_OCR_BLUR_REJECT_RATIO", "0.5"))

# Supabase Production PostgreSQL Database Settings
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Cloudflare Pages & Deployment Settings
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")


