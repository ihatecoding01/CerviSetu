"""LangGraph AgentState schema and clinical data structures."""
from typing import Annotated, Any, Dict, List, Optional, TypedDict
from pydantic import BaseModel, Field
import operator


class ImageQualityResult(BaseModel):
    """Result of medical image quality and anomaly assessment."""
    is_valid: bool = True
    blur_score: float = 0.0
    blur_status: str = "PASS"  # PASS / BLURRY / MARGINAL
    fft_high_freq_ratio: float = 0.0
    contrast_rms: float = 0.0
    contrast_status: str = "PASS"  # PASS / UNDEREXPOSED / OVEREXPOSED / LOW_CONTRAST
    is_medical_domain: bool = True
    detected_modality: str = "UNKNOWN"  # X-RAY, CT, DERMOSCOPY, HISTOPATHOLOGY, NON_MEDICAL
    aspect_ratio: float = 1.0
    resolution: str = "0x0"
    rejection_reasons: List[str] = Field(default_factory=list)
    corrective_advice: List[str] = Field(default_factory=list)


class ClinicalIntake(BaseModel):
    """Structured clinical entities parsed from prescriptions or lab reports."""
    patient_token: str
    age: Optional[int] = None
    gender: Optional[str] = None
    presenting_complaints: List[str] = Field(default_factory=list)
    clinical_history: Optional[str] = None
    biopsy_status: Optional[str] = None  # PENDING / POSITIVE / NEGATIVE / SUSPICIOUS
    cancer_suspected: bool = False
    suspected_cancer_type: Optional[str] = None  # ORAL, BREAST, CERVICAL, LUNG, etc.
    estimated_stage: Optional[str] = None  # Stage I, II, III, IV or Early/Advanced
    severity_score: float = 0.0  # 0.0 to 1.0
    prescribed_investigations: List[str] = Field(default_factory=list)
    next_follow_up_days: int = 7
    raw_anonymized_notes: str = ""
    extraction_source: str = "RULES"  # RULES or SARVAM_LLM
    histology: Optional[str] = None
    screening_findings: List[str] = Field(default_factory=list)
    treatment_plan: Optional[str] = None


class DiagnosticSynthesis(BaseModel):
    """Preliminary AI-assisted diagnostic summary generated for clinician review."""
    differential_diagnosis: List[str] = Field(default_factory=list)
    primary_impression: str = ""
    confidence_level: str = "LOW"  # LOW, MODERATE, HIGH
    confidence_score: float = 0.0  # 0.0 to 1.0
    red_flag_symptoms: List[str] = Field(default_factory=list)
    recommended_workup: List[str] = Field(default_factory=list)
    treatment_pathway_notes: str = ""
    urgency: str = "ROUTINE"  # ROUTINE, PRIORITY, CRITICAL_EMERGENCY
    ai_clinician_summary: str = ""
    patient_message_hindi: str = ""
    patient_message_english: str = ""
    ai_generated: bool = False
    requires_clinician_approval: bool = True
    # Summary drafts are generated only on explicit request (POST /api/patient/{token}/ai-summary)
    ai_summary_status: str = "not_generated"
    patient_message_sent: bool = False





class ClinicalAgentState(TypedDict):
    """Unified state dictionary passed between LangGraph agent nodes."""
    # Identification & Data Privacy
    patient_token: str
    session_id: str
    
    # Input payloads
    raw_text: Optional[str]
    document_path: Optional[str]
    image_path: Optional[str]
    
    # Pillar 1 Outputs
    clinical_intake: Optional[Dict[str, Any]]
    intake_status: str  # PENDING / COMPLETED / FAILED
    
    # Pillar 3 Outputs
    image_quality: Optional[Dict[str, Any]]
    image_triage_passed: bool
    
    # Diagnostic Processing
    diagnostic_synthesis: Optional[Dict[str, Any]]
    
    cancer_severity_score: float
    
    # Workflow & Audit State
    audit_trail: Annotated[List[str], operator.add]
    errors: Annotated[List[str], operator.add]
    next_node: Optional[str]
    status: str
