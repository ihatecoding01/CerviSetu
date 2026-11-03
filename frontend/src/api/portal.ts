// Session-scoped patient portal API. The HttpOnly session cookie is sent automatically (credentials: include).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type PortalErrorKind = "unauthenticated" | "forbidden" | "failed";

export class PortalError extends Error {
  kind: PortalErrorKind;
  constructor(kind: PortalErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/portal${path}`, { credentials: "include", ...init });
  } catch {
    throw new PortalError("failed");
  }
  if (res.status === 401) throw new PortalError("unauthenticated");
  if (res.status === 403) throw new PortalError("forbidden");
  if (!res.ok) throw new PortalError("failed");
  return res.json();
}

export interface PortalClock {
  state: string;
  status: string;
  start_date: string;
  as_of_date: string;
  treatment_day_today: number | null;
  completed_sessions: number;
  total_sessions: number;
  external_completed: number;
  external_planned: number;
  internal_completed: number;
  internal_planned: number;
  missed_sessions: number;
  consecutive_missed_sessions: number;
  next_session: { date: string; session_number: number; phase: string } | null;
  expected_completion_date: string | null;
  expected_completion_day: number | null;
  support_tier: string | null;
}

export interface PortalOverview {
  patient_token: string;
  display_name: string | null;
  synthetic_patient: boolean;
  abha_sandbox_id_masked: string | null;
  abha_sandbox_address: string | null;
  stage: string | null;
  has_plan: boolean;
  facility_name?: string;
  plan_status?: string;
  clock: PortalClock | null;
}

export interface PortalHistory {
  has_plan: boolean;
  synthetic?: boolean;
  events: { date: string; type: string; session_number: number | null; phase: string | null; synthetic: boolean }[];
  upcoming: { date: string; session_number: number; phase: string }[];
}

export const portalApi = {
  session: () => call<{ authenticated: boolean; patient_token: string | null }>("/session"),
  overview: (token: string) => call<PortalOverview>(`/${encodeURIComponent(token)}/overview`),
  history: (token: string) => call<PortalHistory>(`/${encodeURIComponent(token)}/sessions`),
  logout: () => call<{ logged_out: boolean }>("/logout", { method: "POST" }),
};
