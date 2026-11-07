import { api } from "../../api/client";
import { portalApi } from "../../api/portal";
import { referralApi, type Referral } from "../../api/referrals";
import type { GenieConfig, GenieReply } from "./Genie";

export type StaffRole = "DOCTOR" | "NURSE" | "ASHA" | "HOSPITAL" | "ADMIN";

const ROLE: Record<StaffRole, { audience: string; intro: string; starters: string[] }> = {
  DOCTOR: {
    audience: "For doctors",
    intro: "I can summarise the cases you can see, point out missing reports, and show where to record findings. Anything clinical I say is a draft for you to check.",
    starters: ["Which referrals need my review today?", "Which arrived patients still have no histopathology?", "Where do I upload a biopsy report?"],
  },
  NURSE: {
    audience: "For nurses",
    intro: "I can explain intake fields, check what is still missing, and help you word messages for patients. I do not make clinical decisions.",
    starters: ["Which referrals are close to day 14?", "What must be filled before I refer a patient?", "How do I explain the referral to a patient simply?"],
  },
  ASHA: {
    audience: "For ASHA workers",
    intro: "I can explain your follow-up tasks, what each status means, how to record a call or visit, and what to say to the woman and her family. I cannot see test results or change a referral.",
    starters: ["Who should I visit first today?", "What should I say if she is afraid to go?", "How do I record that she was not at home?"],
  },
  HOSPITAL: {
    audience: "For the hospital desk",
    intro: "I can help you find expected patients and explain how to confirm an arrival.",
    starters: ["Who is expected at our hospital?", "What happens when I confirm an arrival?"],
  },
  ADMIN: {
    audience: "For administrators",
    intro: "I can explain programme counts, where to manage hospitals, routes and staff, and what audit entries mean. I cannot see patient records.",
    starters: ["Summarise today's programme counts", "What happens to existing patients when I change a route?", "How do I deactivate a staff account?"],
  },
};

// Names stay in the browser: the server and the AI only see patient codes.
let rows: Referral[] = [];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hideNames = (t: string) => rows.reduce((x, r) => x.replace(new RegExp(`\\b${escape(r.patient_name)}\\b`, "gi"), r.patient_token), t);
const showNames = (t: string) => rows.reduce((x, r) => x.replace(new RegExp(`(\\(\\s*)?${escape(r.patient_token)}(\\s*\\))?`, "g"), r.patient_name), t);

export function staffGenie(
  role: StaffRole,
  opts: { onOpenPatient?: (token: string) => void; onOpenTab?: (tab: string) => void; tabNames?: Record<string, string> } = {},
): GenieConfig {
  return {
    ...ROLE[role],
    onOpenPatient: opts.onOpenPatient,
    transcribe: async (wav) => (await api.genieTranscribe(wav)).text,
    speak: async (text, lang) => (await api.genieSpeak(text, lang)).audio_base64,
    ask: async (question, history, lang): Promise<GenieReply> => {
      if (role !== "ADMIN") rows = await referralApi.board().then((b) => b.referrals).catch(() => rows);
      const body = { question: hideNames(question), language: lang, history: history.map((h) => ({ ...h, text: hideNames(h.text) })), board: [] };
      const r = await api.askGenie(body);
      const tab = r.open_tab as string | null | undefined;
      return {
        answer: showNames(r.answer),
        source: r.source,
        suggestions: r.suggestions,
        patients: opts.onOpenPatient ? (r.patients ?? []).map((t: string) => ({ token: t, label: rows.find((x) => x.patient_token === t)?.patient_name ?? t })) : [],
        link: tab && opts.onOpenTab && opts.tabNames?.[tab] ? { label: `Open ${opts.tabNames[tab]}`, go: () => opts.onOpenTab!(tab) } : null,
      };
    },
  };
}

export function patientGenie(token: string, hospital: string | null): GenieConfig {
  return {
    audience: "For you",
    intro: `I can explain your next step${hospital ? `, how to reach ${hospital}` : ""}, what to take with you, and schemes that may help with costs. I cannot tell you about your results or medicines. Your doctor will explain those.`,
    starters: ["What should I do next?", "What should I take to the hospital?", "Is there help with travel or costs?"],
    transcribe: async (wav) => (await portalApi.transcribe(wav)).text,
    speak: async (text, lang) => (await portalApi.speak(text, lang)).audio_base64,
    ask: async (question, history, lang) => {
      const r = await portalApi.askGenie(token, question, lang, history);
      return { answer: r.answer, source: r.source, suggestions: r.suggestions, refusal: r.is_diagnostic_refusal };
    },
  };
}
