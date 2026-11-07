import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Mic, MessageCircleQuestion, Minus, Square, Volume2, X } from "lucide-react";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder";
import { getSiteLang } from "../../i18n/site";
import { btn } from "./ui";

export interface GenieReply {
  answer: string;
  /** AI, LIVE_DATA (computed from records without AI) or GUARDRAIL (fixed safety text). */
  source: string;
  patients?: { token: string; label: string }[];
  link?: { label: string; go: () => void } | null;
  suggestions?: string[];
  refusal?: boolean;
}

export interface GenieConfig {
  /** Who this Genie serves, shown in the header, e.g. "For ASHA workers". */
  audience: string;
  intro: string;
  starters: string[];
  ask: (question: string, history: { role: string; text: string }[], lang: string) => Promise<GenieReply>;
  transcribe?: (audio: Blob) => Promise<string>;
  speak?: (text: string, lang: string) => Promise<string | null>;
  onOpenPatient?: (token: string) => void;
}

interface Msg extends Partial<GenieReply> {
  role: "user" | "genie";
  text: string;
  failed?: boolean;
}

const SOURCE: Record<string, string> = {
  AI: "AI-generated. Check before acting.",
  LIVE_DATA: "From live records, without AI.",
  GUARDRAIL: "Safety answer. Genie does not give medical advice.",
};

/** The one Genie entry point: a button for the top-right of every portal. */
export function GenieTrigger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-controls="genie-popup" data-testid="ask-genie"
      className="inline-flex items-center gap-1.5 min-h-9 rounded-full border border-black/15 bg-white px-3 text-xs font-semibold text-[#111418] hover:bg-slate-50 cursor-pointer whitespace-nowrap">
      <MessageCircleQuestion className="size-4 text-[#0369A1]" aria-hidden="true" />
      <span>Ask Genie</span>
    </button>
  );
}

/** Compact popup anchored bottom-right. It never covers the page's own controls on wide screens. */
export function GeniePopup({ open, onClose, config }: { open: boolean; onClose: () => void; config: GenieConfig }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy]);
  useEffect(() => {
    if (!open) { audio.current?.pause(); window.speechSynthesis?.cancel(); return; }
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setText("");
    setError(null);
    const history = messages.filter((m) => !m.failed).map((m) => ({ role: m.role === "user" ? "user" : "genie", text: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await config.ask(q, history, getSiteLang());
      setMessages((m) => [...m, { role: "genie", text: r.answer, ...r }]);
    } catch {
      setMessages((m) => [...m, { role: "genie", text: "Genie could not answer just now. Please try again.", failed: true }]);
    } finally {
      setBusy(false);
    }
  };

  const recorder = useVoiceRecorder(60, async (wav) => {
    if (!config.transcribe) return;
    setBusy(true);
    try { await send(await config.transcribe(wav)); }
    catch { setError("Genie could not hear that. Please try again or type your question."); }
    finally { setBusy(false); }
  });

  const say = async (t: string) => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    const lang = getSiteLang();
    const b64 = config.speak ? await config.speak(t, lang).catch(() => null) : null;
    if (b64) { audio.current = new Audio(`data:audio/wav;base64,${b64}`); void audio.current.play(); return; }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang === "en" ? "en-IN" : `${lang === "bho" ? "hi" : lang}-IN`;
      window.speechSynthesis.speak(u);
    }
  };

  if (!open) return null;
  const last = messages[messages.length - 1];
  const suggestions = !busy && last?.role === "genie" && !last.failed ? last.suggestions ?? [] : [];

  return (
    <section id="genie-popup" role="dialog" aria-label="Genie assistant" data-testid="genie-panel"
      className="fixed z-50 bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[400px] h-[min(580px,calc(100dvh-5.5rem))] flex flex-col rounded-xl border border-black/10 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)]">
      <header className="flex items-start justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#111418]">Genie</h2>
          <p className="text-xs text-slate-500">{config.audience} · AI assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onClose} aria-label="Minimise Genie" className="p-2 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"><Minus className="size-4" /></button>
          <button type="button" onClick={() => { setMessages([]); onClose(); }} aria-label="Close Genie and clear the conversation" className="p-2 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="size-4" /></button>
        </div>
      </header>

      <div ref={log} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">{config.intro}</p>
            <div className="flex flex-col gap-1.5">
              {config.starters.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="text-left rounded-md border border-black/10 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 cursor-pointer">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => m.role === "user" ? (
          <p key={i} className="self-end max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-[#111418] whitespace-pre-wrap break-words">{m.text}</p>
        ) : (
          <div key={i} className={`max-w-[92%] rounded-lg border px-3 py-2 text-sm ${m.refusal ? "border-amber-200 bg-amber-50 text-amber-950" : m.failed ? "border-rose-200 bg-rose-50 text-rose-900" : "border-black/[0.08] bg-white text-[#111418]"}`} data-testid="genie-answer">
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
            {!!m.patients?.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.patients.map((p) => (
                  <button key={p.token} type="button" onClick={() => config.onOpenPatient?.(p.token)} className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 cursor-pointer">Open {p.label}</button>
                ))}
              </div>
            )}
            {m.link && <button type="button" onClick={m.link.go} className="mt-2 text-xs font-semibold text-[#0369A1] hover:underline cursor-pointer">{m.link.label}</button>}
            {!m.failed && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{SOURCE[m.source ?? ""] ?? SOURCE.AI}</span>
                <button type="button" onClick={() => say(m.text)} aria-label="Read this answer aloud" className="p-1 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"><Volume2 className="size-3.5" /></button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-slate-500" role="status">{recorder.recording ? "Listening..." : "Genie is answering..."}</p>}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">{s}</button>)}
          </div>
        )}
      </div>

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void send(text); }} className="border-t border-black/[0.06] p-3 flex items-end gap-2">
        <label className="sr-only" htmlFor="genie-input">Your question</label>
        <textarea id="genie-input" ref={box} rows={1} value={text} maxLength={500} data-testid="genie-input"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          placeholder={recorder.recording ? `Listening... ${recorder.seconds}s` : "Type your question"}
          className="flex-1 min-h-10 max-h-28 resize-none rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]/40" />
        {config.transcribe && (
          <button type="button" onClick={() => (recorder.recording ? recorder.stop() : recorder.start())} disabled={busy && !recorder.recording}
            aria-label={recorder.recording ? "Stop and send" : "Speak your question"}
            className={btn(recorder.recording ? "danger" : "secondary", "!min-h-10 !px-3")}>
            {recorder.recording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </button>
        )}
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" data-testid="genie-send" className={btn("primary", "!min-h-10 !px-3")}><ArrowUp className="size-4" /></button>
      </form>
      {(error || recorder.error) && <p className="px-3 pb-2 text-xs text-rose-800" role="alert">{error || recorder.error}</p>}
    </section>
  );
}
