import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, Mic, Minus, Plus, Square, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { api } from "../api/client";
import { WARD_COHORT } from "../data/wardCohort";
import { useVoiceRecorder } from "../lib/useVoiceRecorder";
import type { Tab } from "./DashboardLayout";

interface Message {
  role: "user" | "genie";
  text: string;
  patients?: string[];
  openTab?: Tab | null;
  suggestions?: string[];
  source?: string;
  failed?: boolean;
}

const STARTERS = [
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

function siteLang() {
  try {
    return localStorage.getItem("cervisetu_site_lang") || "en";
  } catch {
    return "en";
  }
}

// Names stay on this screen: the server and the AI only ever see patient codes.
const NAME_BY_TOKEN = new Map(WARD_COHORT.map((p) => [p.token, p.name]));
const hideNames = (text: string) =>
  WARD_COHORT.reduce((t, p) => t.replace(new RegExp(`\\b${p.name}\\b`, "gi"), p.token), text);
const showNames = (text: string) =>
  WARD_COHORT.reduce((t, p) => t.replace(new RegExp(`(\\(\\s*)?${p.token}(\\s*\\))?`, "g"), p.name), text)
    .replace(/\b([A-Z][a-z]+ [A-Z][a-z]+) \(\1\)/g, "$1");
const BOARD = WARD_COHORT.map((p) => ({
  token: p.token,
  stage: p.stage,
  lane: p.lane,
  projected_day: p.ottDays || null,
  attendance: p.adhStatus.replace(/^\W+/u, ""),
  detail: `${p.ottSub}. ${p.adhDetail}`,
}));

/** Reveals a new answer word by word; older answers show in full. */
function Reveal({ text, animate, onTick }: { text: string; animate: boolean; onTick: () => void }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [count, setCount] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (count >= words.length) return;
    const id = setTimeout(() => {
      setCount((c) => c + 2);
      onTick();
    }, 18);
    return () => clearTimeout(id);
  }, [count, words.length, onTick]);
  return <>{words.slice(0, count).join("")}</>;
}

interface GenieProps {
  open: boolean;
  staffName?: string;
  onClose: () => void;
  onOpenTab: (tab: Tab) => void;
  onOpenPatient: (token: string) => void;
}

export function GeniePanel({ open, staffName, onClose, onOpenTab, onOpenPatient }: GenieProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Message[]>([]);
  historyRef.current = messages;

  const scroll = useRef(() => {
    // Sets scrollTop rather than scrollTo(), which returns a Promise in current Chrome: an effect must not return one
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }).current;
  useEffect(() => {
    scroll();
  }, [messages, busy, hearing, scroll]);
  useEffect(() => {
    if (open) input.current?.focus();
    else stopSpeaking();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stopSpeaking = () => {
    player.current?.pause();
    player.current = null;
    window.speechSynthesis?.cancel();
  };

  const say = async (text: string) => {
    stopSpeaking();
    const lang = siteLang();
    try {
      const { audio_base64 } = await api.genieSpeak(text, lang);
      if (audio_base64) {
        player.current = new Audio(`data:audio/wav;base64,${audio_base64}`);
        await player.current.play();
        return;
      }
    } catch {
      /* fall through to the browser's voice */
    }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "en" ? "en-IN" : `${lang === "bho" ? "hi" : lang}-IN`;
      window.speechSynthesis.speak(u);
    }
  };

  const ask = async (text: string, spoken = false) => {
    const q = text.trim();
    if (!q || busy) return;
    stopSpeaking();
    setQuestion("");
    setNotice(null);
    const history = historyRef.current.filter((m) => !m.failed).map((m) => ({ role: m.role, text: hideNames(m.text) }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const body = { question: hideNames(q), language: siteLang(), history, board: BOARD };
      // One automatic retry covers a dropped connection or a server restart
      const r = await api.askGenie(body).catch(async () => {
        await new Promise((done) => setTimeout(done, 1500));
        return api.askGenie(body);
      });
      setMessages((m) => [...m, {
        role: "genie",
        text: showNames(r.answer),
        patients: r.patients,
        openTab: r.open_tab as Tab | null,
        suggestions: r.suggestions,
        source: r.source,
      }]);
      if (spoken || speakReplies) void say(showNames(r.answer));
    } catch {
      setMessages((m) => [...m, { role: "genie", text: "I couldn't get an answer just now. Please try again.", failed: true }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const recorder = useVoiceRecorder(60, async (audio) => {
    setHearing(true);
    setNotice(null);
    try {
      const { text } = await api.genieTranscribe(audio);
      setHearing(false);
      await ask(text, true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "I couldn't hear that. Please try again or type your question.");
    } finally {
      setHearing(false);
    }
  });

  const newChat = () => {
    stopSpeaking();
    setMessages([]);
    setNotice(null);
  };
  const firstName = staffName?.replace(/^(Dr|Sister)\.?\s+/i, (m) => m) ?? "";
  const last = messages[messages.length - 1];
  const micError = notice || recorder.error;

  return (
    <>
    <aside
      role="complementary"
      aria-label="Ask Genie"
      data-testid="genie-panel"
      hidden={!open}
      className="fixed z-50 inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[400px] sm:h-[min(620px,calc(100vh-2rem))] bg-white sm:rounded-2xl sm:border border-slate-200 shadow-2xl overflow-hidden flex-col [&:not([hidden])]:flex"
    >
      <header className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <span className="size-7 rounded-full bg-black text-[#DBFE87] flex items-center justify-center">
          <Sparkles className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold flex-1">Genie</h2>
        <button type="button" onClick={() => { setSpeakReplies((v) => !v); stopSpeaking(); }} aria-pressed={speakReplies} title={speakReplies ? "Stop reading answers aloud" : "Read answers aloud"} data-testid="genie-voice-toggle" className="p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 cursor-pointer">
          {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <button type="button" onClick={newChat} title="New conversation" aria-label="New conversation" data-testid="genie-new" className="p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 cursor-pointer">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Minimise" title="Minimise" data-testid="genie-minimise" className="p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 cursor-pointer">
          <Minus className="size-4" />
        </button>
      </header>

      <div ref={log} aria-live="polite" className="flex-1 overflow-y-auto px-5 pb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-end pb-2">
            <p translate="no" className="notranslate text-2xl font-semibold tracking-tight">{firstName ? `${firstName},` : ""}</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-400 mb-6">how can I help?</p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="text-left text-sm rounded-2xl bg-slate-50 hover:bg-slate-100 px-4 py-3 transition-colors cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p translate="no" className="notranslate max-w-[85%] rounded-3xl bg-slate-100 text-sm px-4 py-2.5 break-words whitespace-pre-line">{m.text}</p>
                </div>
              ) : (
                <div key={i} data-testid="genie-answer">
                  <p translate="no" className={`notranslate text-[15px] leading-relaxed whitespace-pre-line break-words ${m.failed ? "text-[#BA2D0B]" : "text-slate-900"}`}>
                    <Reveal text={m.text} animate={i === messages.length - 1} onTick={scroll} />
                  </p>
                  {(!!m.patients?.length || (m.openTab && TAB_NAMES[m.openTab])) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.patients?.map((t) => (
                        <button key={t} type="button" onClick={() => onOpenPatient(t)} translate="no" className="notranslate text-xs font-medium rounded-full border border-slate-200 px-2.5 py-1 hover:border-black cursor-pointer">
                          {NAME_BY_TOKEN.get(t) ?? t}
                        </button>
                      ))}
                      {m.openTab && TAB_NAMES[m.openTab] && (
                        <button type="button" onClick={() => onOpenTab(m.openTab as Tab)} className="text-xs font-medium rounded-full border border-slate-200 px-2.5 py-1 hover:border-black cursor-pointer">
                          {TAB_NAMES[m.openTab]}
                        </button>
                      )}
                    </div>
                  )}
                  {m.source === "LIVE_DATA" && <p className="mt-2 text-[11px] text-slate-400">Calculated directly from live data.</p>}
                </div>
              ),
            )}
            {(busy || hearing) && (
              <div className="flex gap-1 py-2" aria-label="Thinking" data-testid="genie-thinking">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            {!busy && last?.role === "genie" && !!last.suggestions?.length && (
              <div className="flex flex-col items-start gap-1.5" data-testid="genie-suggestions">
                {last.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} translate="no" className="notranslate text-left text-xs rounded-2xl bg-slate-50 hover:bg-slate-100 px-3 py-2 cursor-pointer">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 shrink-0">
        {micError && <p role="alert" className="px-3 pb-1.5 text-xs text-[#BA2D0B]">{micError}</p>}
        <form
          className="rounded-3xl border border-slate-200 focus-within:border-slate-400 transition-colors p-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          {recorder.recording ? (
            <p className="px-2 py-1.5 text-sm text-slate-600 flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#BA2D0B] animate-pulse" /> Listening... {recorder.seconds}s
            </p>
          ) : (
            <textarea
              ref={input}
              rows={1}
              value={question}
              maxLength={500}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
              placeholder="Message Genie"
              data-testid="genie-input"
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none max-h-28"
            />
          )}
          <div className="flex items-center justify-between">
            <span className="px-2 text-[11px] text-slate-400">Suggestions are for your review</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (recorder.recording ? recorder.stop() : (stopSpeaking(), recorder.start()))}
                disabled={busy || hearing || recorder.starting}
                aria-label={recorder.recording ? "Stop and send" : "Speak to Genie"}
                data-testid="genie-mic"
                className={`size-8 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40 ${recorder.recording ? "bg-[#BA2D0B] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {recorder.recording ? <Square className="size-3 fill-current" /> : <Mic className="size-4" />}
              </button>
              <button type="submit" disabled={busy || !question.trim() || recorder.recording} aria-label="Send" data-testid="genie-send" className="size-8 rounded-full bg-black text-white flex items-center justify-center disabled:bg-slate-200 cursor-pointer">
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </aside>
    </>
  );
}

function Drawer({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside role="dialog" aria-label={title} data-testid={testId} onClick={(e) => e.stopPropagation()} className="w-full sm:w-[420px] h-full bg-white border-l border-slate-200 flex flex-col">
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
