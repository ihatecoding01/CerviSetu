/**
 * CerviSetu API Client
 * Connects to the FastAPI backend running at localhost:8000
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
  event_id: string;
  action: string;
  actor: string;
  patient_token?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  severity: string;
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

  async inspectVault(token: string, role = "CHIEF_MEDICAL_OFFICER"): Promise<VaultData> {
    return request<VaultData>(`/api/vault/inspect/${token}?authorized_role=${role}`);
  },
};
