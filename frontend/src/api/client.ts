/**
 * CerviSetu API Client
 * Connects to the FastAPI backend running at localhost:8000
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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

export const api = {
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
};
