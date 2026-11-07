/** Cervical referral pathway: staff board, status changes, reminders, replies and ASHA consent. */
import { BASE_URL, apiFetch } from "./config";

export type Lane = "on_track" | "attention" | "visit_due";

export interface Referral {
  referral_id: string;
  patient_token: string;
  patient_name: string;
  age: number | null;
  area: string;
  health_post: string;
  hospital: string | null;
  screening_finding: string;
  colposcopy: string;
  histopathology: string;
  red_flags: string;
  urgent: boolean;
  status: string;
  referred_on: string | null;
  arrived_on: string | null;
  consent: string | null;
  consent_note: string | null;
  next_follow_up: string | null;
  fictional: boolean;
  assigned_asha?: string | null;
  message_consent?: string | null;
  family_consent?: boolean | number;
  stopped_at?: string | null;
  doctor_review?: string | null;
  doctor_review_note?: string | null;
  biopsy?: string;
  mri?: string;
  final_diagnosis?: string;
  treatment_plan?: string;
  remarks?: string;
  visit_outcome?: string | null;
  contact_phone?: string;
  form?: Record<string, string>;
  colposcopy_findings?: Record<string, string>;
  following: boolean;
  follow_up_day: number;
  follow_up_step: string;
  lane: Lane;
}

export interface ReferralEvent {
  event_id: string;
  event_date: string;
  follow_up_day: number;
  kind: string;
  channel: string | null;
  detail: string | null;
  status: string | null;
  actor: string;
}

export interface ReferralInput {
  patient_name: string;
  age?: number | null;
  area: string;
  phone: string;
  health_post: string;
  family_phone?: string;
  screening_finding: string;
  red_flags: string;
  urgent: boolean;
  refer: boolean;
  message_consent?: "GRANTED" | "WITHHELD" | null;
  family_consent?: boolean;
  form?: Record<string, string>;
}

export interface ClinicalInput {
  colposcopy?: string;
  colposcopy_findings?: Record<string, string>;
  biopsy?: string;
  histopathology?: string;
  mri?: string;
  final_diagnosis?: string;
  treatment_plan?: string;
  remarks?: string;
  next_follow_up?: string;
}

export interface ReferralFile {
  file_id: string;
  kind: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${BASE_URL}/api/referrals${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The request could not be completed.");
  return data as T;
}

export const STATUS_LABELS: Record<string, string> = {
  ROUTINE_SCREENING: "Routine Screening",
  REFERRED: "Referred",
  ARRIVED: "Arrived at Hospital",
  COLPOSCOPY_DONE: "Colposcopy Done",
  BIOPSY_TAKEN: "Biopsy Taken",
  REPORT_READY: "Report Ready",
  TREATMENT_PLANNED: "Treatment Planned",
  COMPLETED: "Completed",
  DECLINED: "Declined",
};
export const STATUS_ORDER = ["REFERRED", "ARRIVED", "COLPOSCOPY_DONE", "BIOPSY_TAKEN", "REPORT_READY", "TREATMENT_PLANNED", "COMPLETED"];
export const STEP_LABELS: Record<string, string> = {
  NONE: "No Follow-up Running",
  DAILY_REMINDER: "Daily Reminders",
  INTENSIVE_CONTACT: "Intensive Contact",
  ASHA_VISIT: "ASHA Home Visit",
};

export const referralApi = {
  board: () => call<{ referrals: Referral[]; routes: Record<string, string>; messaging_mode: string }>(""),
  create: (input: ReferralInput) => call<Referral>("", input),
  runCycle: () => call<{ reminders: number; visits_ordered: number }>("/run-cycle", {}),
  events: (id: string) => call<{ events: ReferralEvent[] }>(`/${id}/events`),
  setStatus: (id: string, input: { status: string }) => call<Referral>(`/${id}/status`, input),
  clinical: (id: string, input: ClinicalInput) => call<Referral>(`/${id}/clinical`, input),
  arrival: (id: string) => call<Referral>(`/${id}/arrival`, {}),
  resolveReview: (id: string, note: string) => call<Referral>(`/${id}/review`, { note }),
  remind: (id: string, channel: string) => call<{ status: string }>(`/${id}/reminder`, { channel }),
  reply: (id: string, reply: string) => call<Referral>(`/${id}/reply`, { reply }),
  contact: (id: string, outcome: string, note: string) => call<Referral>(`/${id}/contact`, { outcome, note }),
  visit: (id: string, outcome: string, consent: string | null, note: string) => call<Referral>(`/${id}/visit`, { outcome, consent, note }),
  assignAsha: (id: string) => call<Referral>(`/${id}/assign-asha`, {}),
  files: (id: string) => call<{ files: ReferralFile[] }>(`/${id}/files`),
  fileUrl: (id: string, fileId: string) => `${BASE_URL}/api/referrals/${id}/files/${fileId}`,
  upload: async (id: string, kind: string, file: File, photoConsent: boolean) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("photo_consent", String(photoConsent));
    body.append("file", file);
    const res = await apiFetch(`${BASE_URL}/api/referrals/${id}/files`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The file could not be saved.");
    return data as ReferralFile;
  },
};
