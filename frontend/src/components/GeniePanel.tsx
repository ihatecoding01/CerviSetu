import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Send, X } from "lucide-react";
import { api } from "../api/client";
import type { Tab } from "./DashboardLayout";

interface Message {
  role: "user" | "genie";
  text: string;
  patients?: string[];
  openTab?: Tab | null;
  source?: string;
  failed?: boolean;
}

const SUGGESTIONS = [
  "Which patients need attention today?",
  "How many treatment plans are active?",
  "Where do I upload a lab report?",
];

const TAB_NAMES: Partial<Record<Tab, string>> = {
  "overview-tab": "Dashboard",
  "intake-tab": "Clinical Intake",
  "encounter-tab": "Clinical Encounter",
  "tracker-tab": "Rural Tracker",
  "asha-tab": "ASHA Network",
  "prevention-tab": "Prevention & Screening",
  "privacy-tab": "Security & Audit",
  "patient-tab": "Patient Portal",
};

function Drawer({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[420px] h-full bg-white border-l border-slate-200 flex flex-col"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-slate-100 cursor-pointer">
            <X className="size-4" />
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

interface GenieProps {
  onClose: () => void;
  onOpenTab: (tab: Tab) => void;
  onOpenPatient: (token: string) => void;
}

export function GeniePanel({ onClose, onOpenTab, onOpenPatient }: GenieProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      let language = "en";
      try {
        language = localStorage.getItem("cervisetu_site_lang") || "en";
      } catch {
        /* storage unavailable */
      }
      const r = await api.askGenie(q, language);
      setMessages((m) => [...m, { role: "genie", text: r.answer, patients: r.patients, openTab: r.open_tab as Tab | null, source: r.source }]);
    } catch {
      setMessages((m) => [...m, { role: "genie", text: "Genie could not reach the server. Please try again.", failed: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title="Ask Genie" onClose={onClose} testId="genie-panel">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Ask about today's patients and treatment clocks, or where to do something. Answers come from live ward data. Clinical suggestions are for your review.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="text-left text-xs font-medium rounded-xl border border-slate-200 px-3 py-2 hover:border-black cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} translate="no" className="notranslate ml-8 rounded-2xl bg-black text-white text-sm px-3.5 py-2 break-words">
              {m.text}
            </p>
          ) : (
            <div key={i} data-testid="genie-answer" className={`mr-4 rounded-2xl border px-3.5 py-2.5 ${m.failed ? "border-[#BA2D0B]/40" : "border-slate-200 bg-slate-50"}`}>
              <p translate="no" className="notranslate text-sm whitespace-pre-line break-words">{m.text}</p>
              {!!m.patients?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.patients.map((t) => (
                    <button key={t} type="button" onClick={() => onOpenPatient(t)} translate="no" className="notranslate text-xs font-mono rounded-full border border-slate-300 bg-white px-2 py-0.5 hover:border-black cursor-pointer">
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {m.openTab && TAB_NAMES[m.openTab] && (
                <button type="button" onClick={() => onOpenTab(m.openTab as Tab)} className="mt-2 block text-xs font-semibold underline cursor-pointer">
                  {TAB_NAMES[m.openTab]}
                </button>
              )}
              {m.source === "LIVE_DATA" && <p className="mt-2 text-[11px] text-slate-500">Calculated directly from live data.</p>}
            </div>
          ),
        )}
        {busy && <Loader2 className="size-4 animate-spin text-slate-500" aria-label="Thinking" />}
        <div ref={end} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-slate-200 p-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          autoFocus
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question"
          data-testid="genie-input"
          className="flex-1 min-w-0 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:border-black"
        />
        <button type="submit" disabled={busy || !question.trim()} aria-label="Send" data-testid="genie-send" className="size-9 shrink-0 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-40 cursor-pointer">
          <Send className="size-4" />
        </button>
      </form>
    </Drawer>
  );
}

const WHATS_NEW: { title: string; body: string; tab: Tab }[] = [
  { title: "Ask Genie", body: "Ask about today's patients and treatment clocks in your language.", tab: "overview-tab" },
  { title: "Voice consultation", body: "Dictate a consultation and review an AI draft before anything is saved.", tab: "encounter-tab" },
  { title: "Document workspace", body: "Read scanned reports with OCR, see flagged labs and ask questions about them.", tab: "intake-tab" },
  { title: "District review", body: "Approve the dossier before a patient's identity leaves the vault.", tab: "tracker-tab" },
  { title: "Message delivery status", body: "See whether each SMS, WhatsApp message and voice call was delivered.", tab: "tracker-tab" },
];

export function WhatsNewPanel({ onClose, onOpenTab }: { onClose: () => void; onOpenTab: (tab: Tab) => void }) {
  return (
    <Drawer title="What's new" onClose={onClose} testId="whats-new-panel">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {WHATS_NEW.map((f) => (
          <button key={f.title} type="button" onClick={() => onOpenTab(f.tab)} className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
            <span className="block text-sm font-semibold">{f.title}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{f.body}</span>
          </button>
        ))}
      </div>
    </Drawer>
  );
}
