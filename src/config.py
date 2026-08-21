"""Clinical Agentic System Configuration."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
VAULT_DIR = DATA_DIR / "vault"
DB_PATH = DATA_DIR / "clinical_system.db"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
VAULT_DIR.mkdir(parents=True, exist_ok=True)

# Security & Encryption Configuration
# 32-byte AES key for PII Token Vault encryption (stored in env or auto-generated for local dev)
VAULT_SECRET_KEY = os.getenv(
    "VAULT_SECRET_KEY",
    "k9X2mQ7vL4zP1wR8tY5nJ0bV3cE6hA8dF4gK7uM2wP9=" # Default dev key (Base64 URL safe format)
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

# Rural Follow-Up & Escalation Timeline (in days missed)
ESCALATION_POLICY = {
    "tier_1_sms_days": 1,        # 1-2 days missed -> SMS / WhatsApp in local language
    "tier_2_ivr_days": 3,        # 3-5 days missed -> Automated voice IVR call
    "tier_3_asha_days": 6,       # 6-7 days missed -> ASHA / Village Health Worker dispatch
    "tier_4_authority_days": 8,  # >7 days missed + High Cancer Severity -> District Authority Alert & Address Unmask
}

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
