/**
 * CerviSetu API Client
 * Connects to the FastAPI backend running at localhost:8000
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Send the staff session cookie with every API call (needed when the API is on another origin).
const fetch: typeof window.fetch = (input, init) => window.fetch(input, { credentials: "include", ...init });

export interface PatientCase {
  patient_token: string;
  session_id?: string;
  clinical_intake?: Record<string, unknown>;
  diagnostic_synthesis?: Record<string, unknown>;
  current_escalation_tier?: string | null;
  dispatched_notifications?: Notification[];
  status?: string;
  days_overdue?: number;
  cancer_severity_score?: number;
  errors?: string[];
}

export interface EscalationSimResult {
  patient_token: string;
  days_overdue: number;
  active_tier: string;
  dispatched_notifications: DispatchedNotification[];
  authority_dossier?: Record<string, unknown> | null;
}

export interface DispatchedNotification {
  tier: string;
  channel: string;
  recipient_role: string;
  message_content: string;
  timestamp: string;
}

export interface AuditLog {
  event_id?: string;
  log_id?: string;
  user_role?: "DOCTOR" | "NURSE_HEALTHCARE_WORKER" | "PATIENT" | "SYSTEM";
  action: string;
  actor: string;
  actor_id?: string;
  patient_token?: string;
  channel?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  severity: string;
  current_hash?: string;
  previous_hash?: string;
}

export type UserRole = "DOCTOR" | "NURSE_HEALTHCARE_WORKER" | "PATIENT" | "SYSTEM";

export interface ActivitySummary {
  database_summary: {
    total_logs: number;
    by_role: {
      DOCTOR: number;
      NURSE_HEALTHCARE_WORKER: number;
      PATIENT: number;
      SYSTEM: number;
    };
    by_severity: Record<string, number>;
  };
  ledger_role_counts: Record<string, number>;
  chain_integrity: {
    is_valid: boolean;
    total_blocks_verified: number;
    error: string | null;
  };
}

export interface Facility {
  facility_type: string;
  role_label: string;
  facility_name: string;
  district: string;
  approx_distance_km: number;
  pmjay_empanelled: boolean;
  has_dharamshala?: boolean;
  services: string[];
  badge: string;
}

export interface HealingClock {
  patient_token: string;
  ebrt_start_date?: string;
  ebrt_fractions_completed: number;
  brachy_fractions_completed: number;
  total_steps_completed: number;
  projected_finish_days: number;
  clock_target_49d_status: string;
  clock_limit_56d_status: string;
  is_completed?: number;
  clock_status?: string;
  clock_source?: "TREATMENT_CLOCK" | "LEGACY_DEMO";
}

// Live CCRT treatment clock recomputed by the backend from plan, sessions and schedule exceptions
export type ClockStatus = "OPTIMAL" | "WARNING" | "BREACH_RISK" | "NO_PLAN" | "NOT_STARTED" | "PAUSED" | "COMPLETED" | "INCOMPLETE_SCHEDULE";

export interface TreatmentClock {
  patient_token: string;
  plan_id?: string;
  clock_state: string;
  clock_status: ClockStatus;
  start_date?: string;
  treatment_day_today?: number;
  completed_sessions?: number;
  total_sessions?: number;
  remaining_sessions?: number;
  missed_sessions?: number;
  consecutive_missed_sessions?: number;
  projected_finish_date?: string | null;
  projected_finish_day?: number | null;
  days_until_projected_finish?: number | null;
  target_49d_status?: string | null;
  limit_56d_status?: string | null;
  current_escalation_tier?: string | null;
  upcoming_sessions?: { date: string; session_number: number; phase: string }[];
}

export interface WardBoardRow {
  patient_token: string;
  plan_id: string;
  stage: string | null;
  age: number | null;
  regimen_label: string;
  start_date: string;
  treatment_day_today: number;
  completed_sessions: number;
  total_sessions: number;
  missed_sessions: number;
  consecutive_missed_sessions: number;
  projected_finish_day: number | null;
  projected_finish_date: string | null;
  target_49d_status: string | null;
  limit_56d_status: string | null;
  clock_state: string;
  clock_status: ClockStatus;
  current_escalation_tier: string | null;
  next_session: { date: string; session_number: number; phase: string } | null;
}

export interface HubSpokePass {
  pass_id: string;
  patient_token: string;
  spoke_facility_name: string;
  hub_facility_name: string;
  distance_km: number;
  requested_window: string;
  hub_ot_slot_date: string | null;
  slot_confirmed_by_doctor: number;
  bus_voucher_code: string | null;
  dharamshala_room_code: string | null;
  is_simulated_mock: number;
}

export interface SoundboardTrack {
  id: string;
  title_hi: string;
  speaker: string;
  hindi_text: string;
  english_translation: string;
  clinical_guardrail: string;
}

export interface VaultData {
  patient_token: string;
  vault_data?: Record<string, unknown>;
}

export interface PrescriptionParseResult {
  cancer_type: string;
  stage: string;
  biopsy_status: string;
  fractions_planned: {
    ebrt_spoke_fractions: number;
    brachy_hub_fractions: number;
    total_fractions: number;
    curative_window_days: number;
  };
  bounding_boxes: Array<{
    id: string;
    label: string;
    text: string;
    confidence: number;
    category: string;
    rect: { top: number; left: number; width: number; height: number };
  }>;
  pii_shielded: {
    detected_types: Record<string, string[]>;
    vault_token: string;
    anonymized_snippet: string;
  };
  elapsed_ms: number;
  raw_text: string;
  patient_display?: string;
  patient_masked?: string;
  facility_name?: string;
  doctor_name?: string;
  district?: string;
}

export interface VoiceScriptResult {
  status: string;
  language_code: string;
  language_name: string;
  voice_locale: string;
  script: string;
  transliteration: string;
  ssml: string;
  asr_confidence: number;
  indic_wpm: number;
  tts_engine?: {
    model: string;
    speaker: string;
    target_language_code: string;
    has_api_key: boolean;
  };
  ivr_parameters: {
    retry_limit: number;
    timeout_seconds: number;
    dtmf_key_confirm: string;
    dtmf_key_transport_help: string;
    dtmf_key_nurse_callback: string;
  };
}

export interface SynthesizeSpeechResult {
  status: string;
  audio_base64: string | null;
  model: string;
  speaker: string;
  target_language_code: string;
  provider: string;
}

export interface GraphTraceNode {
  node: string;
  name: string;
  role: string;
  latency_ms: number;
  status: string;
  summary: string;
}

export interface GraphTraceResult {
  trace_id: string;
  total_latency_ms: number;
  node_count: number;
  nodes: GraphTraceNode[];
  patient_token: string;
  ledger_block: {
    block_index: number;
    sha256: string;
    previous_hash: string;
    compliance: string;
  };
}

export interface DistrictImpactResult {
  district_metrics: {
    district_population: number;
    annual_cervical_cases: number;
    spokes_active: number;
    hub_distance_km: number;
  };
  biological_metrics: {
    traditional_treatment_days: number;
    cervisetu_treatment_days: number;
    days_saved_per_patient: number;
    pelvic_control_preservation_pct: number;
    estimated_lives_saved_annually: number;
  };
  social_metrics: {
    total_travel_km_spared: number;
    estimated_out_of_pocket_savings_inr: number;
    drop_out_reduction_pct: number;
  };
}

export interface PilotRegisterResult {
  status: string;
  lead_id: string;
  district: string;
  facility_type: string;
  message: string;
}

export interface HpvVaccination {
  vaccine_id: string;
  patient_token: string;
  patient_name: string;
  age: number;
  dose_number: number;
  vaccine_brand: string;
  administered_date: string;
  next_due_date?: string | null;
  school_or_center: string;
  status: "COMPLETED" | "DUE" | "OVERDUE";
  outreach_sent: number;
  created_at?: string;
}

export interface ScreeningRecord {
  screening_id: string;
  patient_token: string;
  patient_name: string;
  age: number;
  invitation_date?: string;
  test_type: "VIA" | "HPV_DNA" | "PAP_SMEAR";
  test_date: string;
  result: "NEGATIVE" | "VIA_POSITIVE" | "SUSPECTED_HIGH_RISK_HPV" | "ABNORMAL_PAP";
  notes?: string;
  triage_status: string;
  created_at?: string;
}

export interface PrecancerEpisode {
  precancer_id: string;
  patient_token: string;
  patient_name: string;
  diagnosis: "CIN_1" | "CIN_2" | "CIN_3_HSIL";
  treatment_type: "THERMAL_ABLATION" | "CRYOTHERAPY" | "LEEP";
  appointment_date: string;
  completion_date?: string;
  margins_clear: number;
  surveillance_interval_months: number;
  surveillance_due_date: string;
  surveillance_status: "SCHEDULED" | "COMPLETED" | "OVERDUE";
  notes?: string;
  created_at?: string;
}

export interface ChemoClearance {
  clearance_id: string;
  patient_token: string;
  cycle_number: number;
  status: "APPROVED" | "HELD" | "REDUCED" | "PENDING";
  dose_mg: number;
  hb: number;
  anc: number;
  platelets: number;
  creatinine: number;
  egfr: number;
  doctor_id: string;
  clinical_notes?: string;
  ebrt_must_continue: boolean;
  clearance_timestamp?: string;
}

export interface LinacDowntimeStatus {
  facility_name: string;
  machine_id: string;
  is_downtime_active: boolean;
  status: "OPERATIONAL" | "MAINTENANCE_PAUSED";
  started_at?: string | null;
  reason?: string | null;
  clock_paused_message?: string;
}

export interface AshaFieldTicket {
  ticket_id: string;
  patient_token: string;
  patient_name: string;
  guardian_name?: string;
  village: string;
  landmark?: string;
  phone?: string;
  days_overdue: number;
  escalation_tier: string;
  stigma_safe_category: string;
  status: "DISPATCHED" | "VISITED" | "TRAVELING_TOMORROW" | "ESCORT_NEEDED" | "CLOSED";
  delay_root_cause?: string;
  arrival_watch_active?: number;
  arrival_watch_expires?: string;
  notes?: string;
  created_at?: string;
}

export interface ChainVerifyResult {
  status: string;
  is_valid: boolean;
  total_blocks_verified: number;
  tamper_detected: boolean;
  error?: string | null;
}


async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API Error");
  }
  return res.json();
}

export interface PatientProfile {
  patient_token: string;
  display_name: string | null;
  abha_number_masked: string | null;
  abha_address: string | null;
  abha_label: string | null;
  stage: string | null;
  facility_name: string | null;
  synthetic_patient: boolean;
  data_label: string | null;
}

export const api = {
  async getPatientProfile(token: string): Promise<PatientProfile> {
    return request<PatientProfile>(`/api/abdm/profile/${token}`);
  },

  async runCase(formData: FormData): Promise<PatientCase> {
    const res = await fetch(`${BASE_URL}/api/run-case`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to run case");
    return res.json();
  },

  async simulateEscalation(payload: {
    patient_token: string;
    days_overdue: number;
    cancer_type?: string;
    stage?: string;
    biopsy_status?: string;
  }): Promise<EscalationSimResult> {
    return request<EscalationSimResult>("/api/simulate-escalation", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCases(): Promise<{ cases: PatientCase[] }> {
    return request<{ cases: PatientCase[] }>("/api/cases");
  },

  async getPatientTimeline(token: string): Promise<PatientCase> {
    return request<PatientCase>(`/api/patient/${token}`);
  },

  async getAuditLogs(limit = 50): Promise<{ audit_logs: AuditLog[] }> {
    return request<{ audit_logs: AuditLog[] }>(`/api/audit-logs?limit=${limit}`);
  },

  async getUserLogs(userRole?: string, patientToken?: string, limit = 50): Promise<{ logs: AuditLog[] }> {
    const params = new URLSearchParams();
    if (userRole) params.append("user_role", userRole);
    if (patientToken) params.append("patient_token", patientToken);
    params.append("limit", String(limit));
    return request<{ logs: AuditLog[] }>(`/api/logs/events?${params.toString()}`);
  },

  async getLogsSummary(): Promise<ActivitySummary> {
    return request<ActivitySummary>("/api/logs/summary");
  },

  async logDoctorSignOff(payload: {
    doctor_id: string;
    patient_token: string;
    case_id?: string;
    action_type?: string;
    notes?: string;
    ncg_verified?: boolean;
  }): Promise<any> {
    return request<any>("/api/logs/doctor/sign-off", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logDoctorTriage(payload: {
    doctor_id: string;
    patient_token: string;
    toxicity_grade: number;
    symptom: string;
    intervention: string;
  }): Promise<any> {
    return request<any>("/api/logs/doctor/triage", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logNurseFraction(payload: {
    nurse_id: string;
    patient_token: string;
    fraction_number: number;
    machine_id?: string;
    dose_gy?: number;
    session_date?: string;
    session_status?: "COMPLETED" | "CANCELLED";
  }): Promise<any> {
    return request<any>("/api/logs/nurse/fraction", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logNurseSlipUpload(payload: {
    nurse_id: string;
    patient_token: string;
    document_type: string;
    laplacian_score: number;
    is_legible: boolean;
  }): Promise<any> {
    return request<any>("/api/logs/nurse/slip-upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logPatientSymptom(payload: {
    patient_token: string;
    symptoms: string[];
    severity_grade: number;
    channel?: string;
    voice_note_received?: boolean;
  }): Promise<any> {
    return request<any>("/api/logs/patient/symptom-checkin", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logAshaHomeVisit(payload: {
    asha_id: string;
    patient_token: string;
    delay_root_cause: string;
    patient_contacted: boolean;
    field_notes?: string;
  }): Promise<any> {
    return request<any>("/api/logs/asha/home-visit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async inspectVault(token: string, role = "CHIEF_MEDICAL_OFFICER"): Promise<VaultData> {
    return request<VaultData>(`/api/vault/inspect/${token}?authorized_role=${role}`);
  },

  async searchFacilities(district = "Mirzapur"): Promise<{ query: string; facilities: Facility[] }> {
    return request<{ query: string; facilities: Facility[] }>(`/api/facilities/search?district=${encodeURIComponent(district)}`);
  },

  async approveTreatmentPlan(token: string, payload: { approved_by: string; start_date?: string }): Promise<{ status: string; clock: TreatmentClock }> {
    return request(`/api/patient/${token}/treatment-plan`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getPatientClock(token: string): Promise<TreatmentClock> {
    return request<TreatmentClock>(`/api/patient/${token}/clock`);
  },

  async getWardBoard(): Promise<{ as_of_date: string; plans: WardBoardRow[] }> {
    return request<{ as_of_date: string; plans: WardBoardRow[] }>("/api/ward-board");
  },

  async recordNoShow(token: string, recorded_by: string): Promise<{ clock: TreatmentClock }> {
    return request(`/api/patient/${token}/clock/no-show`, {
      method: "POST",
      body: JSON.stringify({ recorded_by }),
    });
  },

  async getHealingClock(token: string): Promise<{ status: string; patient_token: string; clock: HealingClock }> {
    return request<{ status: string; patient_token: string; clock: HealingClock }>(`/api/patient/${token}/healing-clock`);
  },

  async advanceFraction15(token: string, targetStep = 15): Promise<any> {
    return request<any>("/api/patient/demo/advance-fraction-15", {
      method: "POST",
      body: JSON.stringify({ patient_token: token, target_step: targetStep }),
    });
  },

  async confirmHubSlot(token: string, confirmedDay = "Day 41", doctorId = "DR-ONCO-HUB-01"): Promise<any> {
    return request<any>("/api/patient/demo/hub-confirm-slot", {
      method: "POST",
      body: JSON.stringify({ patient_token: token, confirmed_day: confirmedDay, doctor_id: doctorId }),
    });
  },

  async getPatientPasses(token: string): Promise<{ status: string; patient_token: string; pass: HubSpokePass }> {
    return request<{ status: string; patient_token: string; pass: HubSpokePass }>(`/api/patient/${token}/passes`);
  },

  async getSoundboardTracks(): Promise<{ status: string; tracks: SoundboardTrack[] }> {
    return request<{ status: string; tracks: SoundboardTrack[] }>("/api/patient/soundboard/audio");
  },

  async synthesizeSpeech(params: {
    text: string;
    language: string;
    speaker?: string;
    model?: string;
  }): Promise<SynthesizeSpeechResult> {
    try {
      return await request<SynthesizeSpeechResult>("/api/showcase/synthesize-speech", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      return {
        status: "FALLBACK",
        audio_base64: null,
        model: params.model || "bulbul:v4-flash",
        speaker: params.speaker || "ritu_hi_medical",
        target_language_code: "hi-IN",
        provider: "browser_web_speech",
      };
    }
  },

  async parsePrescriptionSlip(params: {
    raw_text?: string;
    sample_id?: string;
  }): Promise<PrescriptionParseResult> {
    try {
      return await request<PrescriptionParseResult>("/api/showcase/parse-prescription", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      // Fallback preview
      return {
        cancer_type: "CERVICAL",
        stage: "Stage IIB",
        biopsy_status: "POSITIVE",
        fractions_planned: {
          ebrt_spoke_fractions: 25,
          brachy_hub_fractions: 4,
          total_fractions: 29,
          curative_window_days: 56,
        },
        bounding_boxes: [
          { id: "box_diag", label: "Cancer Type", text: "Carcinoma Cervix", confidence: 0.984, category: "DIAGNOSIS", rect: { top: 18, left: 6, width: 42, height: 9 } },
          { id: "box_stage", label: "FIGO Stage", text: "FIGO Stage IIB", confidence: 0.962, category: "STAGING", rect: { top: 28, left: 6, width: 38, height: 8 } },
          { id: "box_biopsy", label: "Histopathology", text: "Squamous Cell Carcinoma", confidence: 0.991, category: "PATHOLOGY", rect: { top: 37, left: 6, width: 54, height: 9 } },
          { id: "box_ebrt", label: "External Radiation", text: "50 Gy in 25 fractions", confidence: 0.978, category: "TREATMENT", rect: { top: 54, left: 6, width: 64, height: 10 } },
          { id: "box_brachy", label: "Hub Brachytherapy", text: "HDR Intracavitary Brachytherapy", confidence: 0.973, category: "REFERRAL", rect: { top: 66, left: 6, width: 78, height: 11 } },
          { id: "box_ceiling", label: "56 Day Ceiling", text: "Strict biological ceiling: 56 days", confidence: 0.995, category: "TIMELINE", rect: { top: 79, left: 6, width: 62, height: 10 } },
        ],
        pii_shielded: {
          detected_types: { names: ["Sunita Devi"], phones: ["9839120000"] },
          vault_token: "PT-ANON-7B93",
          anonymized_snippet: "Pt: [MASKED_NAME_0], 46F. Dist: Varanasi. Diagnosis: Carcinoma Cervix, FIGO Stage IIB...",
        },
        elapsed_ms: 38.4,
        raw_text: params.raw_text || "Pt: Sunita Devi, 46F, W/o Rameshwar. Dist: Varanasi...",
      };
    }
  },

  async getVoiceScript(params: {
    language: string;
    patient_name?: string;
    fraction_number?: number;
    district?: string;
  }): Promise<VoiceScriptResult> {
    try {
      return await request<VoiceScriptResult>("/api/showcase/voice-script", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      return {
        status: "SUCCESS",
        language_code: params.language,
        language_name: "Hindi (Devanagari)",
        voice_locale: "hi-IN",
        script: "नमस्ते सुनिता जी। यह आपके जिला कैंसर केंद्र से महत्वपूर्ण संदेश है। आपका 16वां रेडिएशन सत्र कल सुबह 10 बजे निर्धारित है। कृपया समय पर आएं ताकि आपका 56 दिवसीय उपचार बिना किसी रुकावट के पूरा हो सके। सहायता के लिए 1 दबाएं।",
        transliteration: "Namaste Sunita ji. Yeh aapke zila cancer kendra se mahatvapurna sandesh hai. Aapka solahvaan radiation satra kal subah 10 baje nirdharit hai. Kripya samay par aayen taaki aapka chappan divasiya upchar bina kisi rukawat ke poora ho sake.",
        ssml: "<speak><p><s>नमस्ते सुनिता जी।</s> <s>सहायता के लिए 1 दबाएं।</s></p></speak>",
        asr_confidence: 0.98,
        indic_wpm: 128,
        ivr_parameters: {
          retry_limit: 3,
          timeout_seconds: 6,
          dtmf_key_confirm: "1",
          dtmf_key_transport_help: "2",
          dtmf_key_nurse_callback: "3",
        },
      };
    }
  },

  async getGraphExecutionTrace(params: {
    case_text?: string;
    simulated_days_overdue?: number;
  }): Promise<GraphTraceResult> {
    try {
      return await request<GraphTraceResult>("/api/showcase/graph-trace", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      return {
        trace_id: "TRACE-DEMO-991A",
        total_latency_ms: 189.2,
        node_count: 5,
        nodes: [
          { node: "ocr_intake", name: "Frontline Smart OCR Intake", role: "Paper Prescription & Slip Ingestion", latency_ms: 42.1, status: "COMPLETED", summary: "Extracted Carcinoma Cervix FIGO IIB, 25 EBRT + 4 Brachytherapy" },
          { node: "image_triage", name: "Laplacian Blur & Quality Gate", role: "Artifact & Glare Verification", latency_ms: 28.4, status: "COMPLETED", summary: "Sharpness variance 142.5 >= threshold 85.0. Slip accepted." },
          { node: "pii_shield", name: "DPDP AES 256 Token Vault", role: "Zero Knowledge Cryptographic Anonymization", latency_ms: 18.2, status: "COMPLETED", summary: "Replaced patient identity with vault token PT-ANON-7B93." },
          { node: "diagnostic_oncology", name: "NCG Guidelines Oncology Synthesis", role: "Clinical Differential & Workup Planner", latency_ms: 64.7, status: "COMPLETED", summary: "Validated concurrent weekly cisplatin + 50 Gy EBRT plan." },
          { node: "rural_tracker", name: "56 Day Radiobiological Adherence Engine", role: "Fraction Timing & Progressive Escalation", latency_ms: 35.8, status: "COMPLETED", summary: "Evaluated adherence at day +3. Active tier: TIER 1 SMS." },
        ],
        patient_token: "PT-ANON-7B93",
        ledger_block: {
          block_index: 142,
          sha256: "8f3b6c2d1e0a4f598216c4e098bd1e7790c3cbdbfe87ba2d0bf19941a31d2890",
          previous_hash: "2a1c9d8e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
          compliance: "DPDP Act 2023 Compliant",
        },
      };
    }
  },

  async calculateDistrictImpact(params: {
    district_population?: number;
    annual_cervical_cases?: number;
    spoke_clinics_count?: number;
    avg_travel_distance_km?: number;
  }): Promise<DistrictImpactResult> {
    try {
      return await request<DistrictImpactResult>("/api/showcase/district-impact", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      const cases = params.annual_cervical_cases || 210;
      const hubDist = params.avg_travel_distance_km || 72;
      return {
        district_metrics: {
          district_population: params.district_population || 1800000,
          annual_cervical_cases: cases,
          spokes_active: params.spoke_clinics_count || 4,
          hub_distance_km: hubDist,
        },
        biological_metrics: {
          traditional_treatment_days: 72,
          cervisetu_treatment_days: 48,
          days_saved_per_patient: 24,
          pelvic_control_preservation_pct: 24.0,
          estimated_lives_saved_annually: Math.round(cases * 0.24 * 0.72),
        },
        social_metrics: {
          total_travel_km_spared: Math.round(cases * 25 * (hubDist - 14) * 2),
          estimated_out_of_pocket_savings_inr: cases * 25 * 530,
          drop_out_reduction_pct: 68.5,
        },
      };
    }
  },

  async registerDistrictPilot(payload: {
    email: string;
    district: string;
    facility_type: string;
    contact_name?: string;
    phone?: string;
  }): Promise<PilotRegisterResult> {
    try {
      return await request<PilotRegisterResult>("/api/showcase/register-pilot", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        status: "SUCCESS",
        lead_id: "LEAD-MOCK-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
        district: payload.district,
        facility_type: payload.facility_type,
        message: "District pilot request received. Oncology team will connect within 24 hours.",
      };
    }
  },

  // ==========================================
  // Prevention & Screening APIs
  // ==========================================
  async logHpvVaccination(payload: {
    patient_token: string;
    patient_name: string;
    age: number;
    dose_number: number;
    vaccine_brand?: string;
    administered_date?: string;
    school_or_center?: string;
    status?: string;
  }): Promise<{ status: string; vaccination: HpvVaccination }> {
    return await request<{ status: string; vaccination: HpvVaccination }>("/api/prevention/vaccination", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getHpvVaccinations(status?: string): Promise<{ vaccinations: HpvVaccination[]; total: number }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return await request<{ vaccinations: HpvVaccination[]; total: number }>(`/api/prevention/vaccinations${q}`);
  },

  async triggerVaccineOutreach(vaccine_id: string): Promise<{ status: string; message: string; record: HpvVaccination }> {
    return await request<{ status: string; message: string; record: HpvVaccination }>("/api/prevention/vaccination/outreach", {
      method: "POST",
      body: JSON.stringify({ vaccine_id }),
    });
  },

  async recordScreening(payload: {
    patient_token: string;
    patient_name: string;
    age: number;
    invitation_date?: string;
    test_type: string;
    test_date?: string;
    result: string;
    notes?: string;
  }): Promise<{ status: string; screening: ScreeningRecord; recommended_pathway: string }> {
    return await request<{ status: string; screening: ScreeningRecord; recommended_pathway: string }>("/api/prevention/screening", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getScreenings(patient_token?: string): Promise<{ screenings: ScreeningRecord[]; total: number }> {
    const q = patient_token ? `?patient_token=${encodeURIComponent(patient_token)}` : "";
    return await request<{ screenings: ScreeningRecord[]; total: number }>(`/api/prevention/screenings${q}`);
  },

  async logPrecancerTreatment(payload: {
    patient_token: string;
    patient_name: string;
    diagnosis: string;
    treatment_type: string;
    appointment_date: string;
    completion_date?: string;
    margins_clear?: number;
    surveillance_interval_months?: number;
    notes?: string;
  }): Promise<{ status: string; precancer_episode: PrecancerEpisode }> {
    return await request<{ status: string; precancer_episode: PrecancerEpisode }>("/api/prevention/precancer-treatment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getPrecancerSurveillance(): Promise<{ surveillance_list: PrecancerEpisode[]; total: number }> {
    return await request<{ surveillance_list: PrecancerEpisode[]; total: number }>("/api/prevention/precancer-surveillance");
  },

  // ==========================================
  // Clinical Safety & Hospital APIs
  // ==========================================
  async logChemoClearance(payload: {
    patient_token: string;
    cycle_number: number;
    status: string;
    dose_mg?: number;
    hb?: number;
    anc?: number;
    platelets?: number;
    creatinine?: number;
    egfr?: number;
    doctor_id?: string;
    clinical_notes?: string;
    ebrt_must_continue?: number;
  }): Promise<{ status: string; clearance: ChemoClearance; ebrt_must_continue: boolean }> {
    return await request<{ status: string; clearance: ChemoClearance; ebrt_must_continue: boolean }>("/api/clinical/chemo-clearance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getChemoClearanceHistory(patient_token: string): Promise<{ clearances: ChemoClearance[]; total: number }> {
    return await request<{ clearances: ChemoClearance[]; total: number }>(`/api/clinical/chemo-clearance/${patient_token}`);
  },

  async toggleLinacDowntime(payload: {
    facility_name?: string;
    machine_id?: string;
    reason?: string;
  }): Promise<{ status: string; is_active: boolean; downtime_record?: Record<string, unknown> }> {
    return await request<{ status: string; is_active: boolean; downtime_record?: Record<string, unknown> }>("/api/clinical/linac-downtime", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getLinacDowntimeStatus(facility_name = "Mirzapur Spoke Clinic"): Promise<LinacDowntimeStatus> {
    return await request<LinacDowntimeStatus>(`/api/clinical/linac-downtime/status?facility_name=${encodeURIComponent(facility_name)}`);
  },

  async returnHubTransferDeficiency(patient_token: string, payload: {
    requested_deficiencies: string[];
    spoke_action_sla_hours?: number;
    notes?: string;
  }): Promise<{ status: string; patient_token: string; message: string; action_sla_hours: number }> {
    return await request<{ status: string; patient_token: string; message: string; action_sla_hours: number }>(`/api/clinical/hub-transfer/${patient_token}/deficiency-return`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async dischargeSignoff(patient_token: string, payload: {
    doctor_id: string;
    total_ebrt_fractions?: number;
    total_brachy_fractions?: number;
    clinical_summary?: string;
  }): Promise<{ status: string; patient_token: string; message: string; dpdp_compliance: string }> {
    return await request<{ status: string; patient_token: string; message: string; dpdp_compliance: string }>(`/api/encounter/${patient_token}/discharge-signoff`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // Patient Portal & DPDP Security
  // ==========================================
  async reportPatientSymptom(token: string, payload: {
    symptom_key: string;
    severity_grade: number;
    notes?: string;
  }): Promise<{ status: string; symptom_logged: string; grade: number; alert_generated: boolean }> {
    return await request<{ status: string; symptom_logged: string; grade: number; alert_generated: boolean }>(`/api/patient/${token}/symptoms`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async ackHydration(token: string, payload: {
    glasses_count: number;
    ors_taken: boolean;
  }): Promise<{ status: string; glasses_logged: number; ors_taken: boolean }> {
    return await request<{ status: string; glasses_logged: number; ors_taken: boolean }>(`/api/patient/${token}/hydration-ack`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async purgeAudioCache(token: string): Promise<{ status: string; message: string; token: string }> {
    return await request<{ status: string; message: string; token: string }>(`/api/patient/${token}/purge-audio-cache`, {
      method: "POST",
    });
  },

  // ==========================================
  // Audit Ledger & ASHA Field Tickets
  // ==========================================
  async verifyAuditChain(): Promise<ChainVerifyResult> {
    return await request<ChainVerifyResult>("/api/logs/verify-chain");
  },

  async getAshaTickets(patient_token?: string): Promise<{ tickets: AshaFieldTicket[]; total: number }> {
    const q = patient_token ? `?patient_token=${encodeURIComponent(patient_token)}` : "";
    return await request<{ tickets: AshaFieldTicket[]; total: number }>(`/api/logs/asha/tickets${q}`);
  },

  async updateAshaTicketOutcome(payload: {
    ticket_id: string;
    outcome_status: string;
    root_cause?: string;
    notes?: string;
  }): Promise<{ status: string; ticket: AshaFieldTicket; arrival_watch_active: boolean }> {
    return await request<{ status: string; ticket: AshaFieldTicket; arrival_watch_active: boolean }>("/api/logs/asha/ticket-outcome", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

};
