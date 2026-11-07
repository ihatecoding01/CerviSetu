// Session-scoped patient portal API. The HttpOnly session cookie is sent automatically (credentials: include).
import type { Referral } from "./referrals";
import { BASE_URL, apiFetch } from "./config";

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
    res = await apiFetch(`${BASE_URL}/api/portal${path}`, { ...init });
  } catch {
    throw new PortalError("failed");
  }
  if (res.status === 401) throw new PortalError("unauthenticated");
  if (res.status === 403) throw new PortalError("forbidden");
  if (!res.ok) throw new PortalError("failed");
  return res.json();
}

export interface PortalOverview {
  patient_token: string;
  display_name: string | null;
  referral: Referral | null;
}

export interface CareCentre {
  name: string;
  area: string;
  address: string;
  phone: string;
  hospital_type: string;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  has_location: boolean;
}

export interface CentresResponse {
  assigned_name: string | null;
  assigned_status: "NO_REFERRAL" | "NOT_IN_DIRECTORY" | "LOCATION_MISSING" | "READY";
  assigned: CareCentre | null;
  nearby: CareCentre[];
  map: { tile_url: string; geocoder_url: string; routing_url: string };
}

export interface PatientGenieResponse {
  source: string;
  is_diagnostic_refusal: boolean;
  answer: string;
  suggestions?: string[];
}

export interface PatientGenieTurn {
  role: string;
  text: string;
}

export const portalApi = {
  centres: (token: string) => call<CentresResponse>(`/${encodeURIComponent(token)}/centres`),
  reply: (token: string, reply: string) =>
    call<Referral>(`/${token}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply }) }),
  session: () => call<{ authenticated: boolean; patient_token: string | null }>("/session"),
  overview: (token: string) => call<PortalOverview>(`/${encodeURIComponent(token)}/overview`),
  logout: () => call<{ logged_out: boolean }>("/logout", { method: "POST" }),
  askGenie: async (token: string, question: string, language = "en", history: PatientGenieTurn[] = []): Promise<PatientGenieResponse> => {
    let res: Response;
    try {
      // Bound to her own session on the server, like every other portal call
      res = await apiFetch(`${BASE_URL}/api/portal/${encodeURIComponent(token)}/genie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language, history }),
      });
    } catch {
      throw new PortalError("failed");
    }
    if (!res.ok) throw new PortalError("failed");
    return res.json();
  },
  speak: async (text: string, language = "en"): Promise<{ audio_base64: string | null }> => {
    try {
      const res = await apiFetch(`${BASE_URL}/api/genie/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) return { audio_base64: null };
      return res.json();
    } catch {
      return { audio_base64: null };
    }
  },
  transcribe: async (audio: Blob): Promise<{ text: string }> => {
    const form = new FormData();
    form.append("audio", audio, "genie.wav");
    const res = await apiFetch(`${BASE_URL}/api/genie/transcribe`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Could not transcribe voice");
    return res.json();
  },
};
