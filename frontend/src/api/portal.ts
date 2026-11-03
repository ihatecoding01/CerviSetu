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

const DEMO_OVERVIEW: PortalOverview = {
  patient_token: "PT-RURAL-7891",
  display_name: "Anita Devi",
  synthetic_patient: true,
  abha_sandbox_id_masked: "91-****-****-7891",
  abha_sandbox_address: "anita.devi@sbx",
  stage: "Stage IIB Cervical Carcinoma",
  has_plan: true,
  facility_name: "Mirzapur District Oncology Daycare & Spoke Clinic",
  plan_status: "ACTIVE",
  clock: {
    state: "ON_TRACK",
    status: "OPTIMAL",
    start_date: "2026-10-01",
    as_of_date: "2026-10-21",
    treatment_day_today: 21,
    completed_sessions: 15,
    total_sessions: 29,
    external_completed: 15,
    external_planned: 25,
    internal_completed: 0,
    internal_planned: 4,
    missed_sessions: 0,
    consecutive_missed_sessions: 0,
    next_session: { date: "2026-10-22", session_number: 16, phase: "EBRT" },
    expected_completion_date: "2026-11-12",
    expected_completion_day: 42,
    support_tier: "Tier 1 · Direct WhatsApp/SMS",
  },
};

const DEMO_HISTORY: PortalHistory = {
  has_plan: true,
  synthetic: true,
  events: Array.from({ length: 15 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    type: "COMPLETED",
    session_number: i + 1,
    phase: "EBRT",
    synthetic: true,
  })),
  upcoming: [
    ...Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(i + 22).padStart(2, "0")}`,
      session_number: i + 16,
      phase: "EBRT",
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      date: `2026-11-${String(i + 5).padStart(2, "0")}`,
      session_number: i + 26,
      phase: "BRACHY",
    })),
  ],
};

export const portalApi = {
  session: async () => {
    try {
      const res = await call<{ authenticated: boolean; patient_token: string | null }>("/session");
      if (res && res.authenticated) return res;
    } catch {
      // Fallback for static hosting / demo
    }
    const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("cervisetu_patient_session") : null;
    return { authenticated: Boolean(token), patient_token: token };
  },
  overview: async (token: string) => {
    try {
      return await call<PortalOverview>(`/${encodeURIComponent(token)}/overview`);
    } catch (e) {
      if ((e as PortalError).kind === "unauthenticated" || (e as PortalError).kind === "forbidden") {
        throw e;
      }
      return { ...DEMO_OVERVIEW, patient_token: token };
    }
  },
  history: async (token: string) => {
    try {
      return await call<PortalHistory>(`/${encodeURIComponent(token)}/sessions`);
    } catch (e) {
      if ((e as PortalError).kind === "unauthenticated" || (e as PortalError).kind === "forbidden") {
        throw e;
      }
      return DEMO_HISTORY;
    }
  },
  logout: async () => {
    try {
      await call<{ logged_out: boolean }>("/logout", { method: "POST" });
    } catch {
      // Fallback for static hosting / demo
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("cervisetu_patient_session");
    }
    return { logged_out: true };
  },
};
