import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Send,
  ShieldAlert,
  HelpCircle,
  MapPin,
  FileText,
  BadgeIndianRupee,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Languages,
} from "lucide-react";
import { portalApi, type PatientGenieResponse } from "../../api/portal";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder";

interface Props {
  token: string;
  patientName?: string | null;
  hospital?: string | null;
  initialExpanded?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "genie";
  text: string;
  isDiagnosticRefusal?: boolean;
  suggestions?: string[];
  audioBase64?: string | null;
}

const SUPPORTED_LANGS = [
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "en", label: "English" },
  { code: "bho", label: "भोजपुरी (Bhojpuri)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
];

export const PatientGenie: React.FC<Props> = ({
  token,
  patientName,
  hospital = "your referral hospital",
  initialExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [language, setLanguage] = useState("hi");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const initialGreeting: ChatMessage = {
    id: "init",
    role: "genie",
    text:
      language === "hi"
        ? `नमस्ते ${patientName || "बहन"} जी! मैं आपकी सर्वाइसेतु सहायिका (Genie) हूँ। आप मुझसे ${hospital} अस्पताल जाने का रास्ता, वहाँ ले जाने वाले कागज़ात, और आयुष्मान भारत (PM-JAY) या सरकारी स्वास्थ्य योजनाओं के बारे में पूछ सकती हैं।\n\n(महत्वपूर्ण: मैं बीमारी या लक्षणों की डॉक्टरी जाँच नहीं कर सकती। डॉक्टरी सलाह के लिए अपनी आशा दीदी या डॉक्टर से संपर्क करें।)`
        : `Hello ${patientName || "Sister"}! I am CerviSetu Genie, your patient care companion. You can ask me how to reach ${hospital}, which documents to bring, and details on Ayushman Bharat (PM-JAY) or government health assistance schemes.\n\n(Important: I cannot provide medical diagnosis or treatment solutions. Please consult your ASHA worker or doctor for clinical questions.)`,
    suggestions:
      language === "hi"
        ? [
            "सरकारी स्वास्थ्य योजनाएं क्या हैं?",
            "अस्पताल कहाँ है और कैसे पहुँचें?",
            "कौन से कागज़ात साथ ले जाने हैं?",
            "क्या मुझे कैंसर है? (गार्डरेल टेस्ट)",
          ]
        : [
            "What government schemes cover my costs?",
            "Where is my hospital located?",
            "What documents should I take with me?",
            "Do I have cancer? (Test guardrail)",
          ],
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);

  // Sync initial message when language changes if conversation hasn't started yet
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "init") {
      setMessages([initialGreeting]);
    }
  }, [language]);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy, hearing]);

  const stopAudio = () => {
    if (audioPlayer.current) {
      audioPlayer.current.pause();
      audioPlayer.current = null;
    }
    setCurrentlyPlayingId(null);
    window.speechSynthesis?.cancel();
  };

  const playVoice = async (text: string, msgId: string, cachedBase64?: string | null) => {
    stopAudio();
    setAudioError(null);
    setCurrentlyPlayingId(msgId);

    try {
      let b64 = cachedBase64;
      if (!b64) {
        const resp = await portalApi.speak(text, language);
        b64 = resp.audio_base64;
        if (b64) {
          // Cache on message
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, audioBase64: b64 } : m)),
          );
        }
      }

      if (b64) {
        const audio = new Audio(`data:audio/wav;base64,${b64}`);
        audioPlayer.current = audio;
        audio.onended = () => setCurrentlyPlayingId(null);
        audio.onerror = () => {
          setCurrentlyPlayingId(null);
          fallbackWebSpeech(text);
        };
        await audio.play();
        return;
      }
    } catch {
      // Sarvam offline, fall through to browser synthesis
    }

    fallbackWebSpeech(text);
  };

  const fallbackWebSpeech = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === "en" ? "en-IN" : `${language === "bho" ? "hi" : language}-IN`;
      u.onend = () => setCurrentlyPlayingId(null);
      u.onerror = () => setCurrentlyPlayingId(null);
      window.speechSynthesis.speak(u);
    } else {
      setCurrentlyPlayingId(null);
    }
  };

  const handleAsk = async (userText: string) => {
    const q = userText.trim();
    if (!q || busy) return;

    stopAudio();
    setQuestion("");
    const userMsgId = `user-${Date.now()}`;
    const genieMsgId = `genie-${Date.now()}`;

    const newHistory = messages
      .filter((m) => m.id !== "init")
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: q }]);
    setBusy(true);

    try {
      const resp: PatientGenieResponse = await portalApi.askGenie(token, q, language, newHistory);
      const newMsg: ChatMessage = {
        id: genieMsgId,
        role: "genie",
        text: resp.answer,
        isDiagnosticRefusal: resp.is_diagnostic_refusal,
        suggestions: resp.suggestions,
      };

      setMessages((prev) => [...prev, newMsg]);

      if (autoSpeak) {
        void playVoice(resp.answer, genieMsgId);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: genieMsgId,
          role: "genie",
          text:
            language === "hi"
              ? "माफ़ कीजिए, अभी जवाब देने में समस्या आ रही है। कृपया कुछ देर बाद प्रयास करें या अपनी आशा कार्यकर्ता से बात करें।"
              : "I apologize, I could not retrieve an answer right now. Please try again shortly or contact your ASHA worker.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const recorder = useVoiceRecorder(60, async (audioWav) => {
    setHearing(true);
    setAudioError(null);
    try {
      const { text } = await portalApi.transcribe(audioWav);
      setHearing(false);
      if (text && text.trim()) {
        await handleAsk(text.trim());
      } else {
        setAudioError(
          language === "hi"
            ? "आवाज़ सुनाई नहीं दी। कृपया माइक बटन दबाकर दोबारा बोलें।"
            : "Could not catch your voice. Please tap the mic and try speaking again.",
        );
      }
    } catch {
      setHearing(false);
      setAudioError(
        language === "hi"
          ? "माइक ट्रांसक्रिप्शन विफल रहा। कृपया टाइप करके प्रश्न पूछें।"
          : "Voice transcription unavailable. Please type your question.",
      );
    }
  });

  return (
    <section
      aria-labelledby="genie-heading"
      className="bg-white border-2 border-pink-200/80 rounded-2xl shadow-sm overflow-hidden transition-all"
    >
      {/* Header bar (Codename Drake Luminous Accent) */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-pink-50/70 border-b border-black/10 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#9D174D] p-0.5 shadow-xs flex items-center justify-center text-white">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="genie-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {language === "hi" ? "सर्वाइसेतु जिनी (Patient Genie)" : "CerviSetu Patient Genie"}
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Sarvam Voice Active
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {language === "hi"
                ? "अस्पताल निर्देश, योजनाएं और सरकारी सहायता मार्गदर्शिका"
                : "Hospital navigation, schemes & government assistance companion"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Language selector */}
          <div className="relative inline-flex items-center">
            <Languages className="size-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs font-semibold pl-7 pr-4 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:border-black cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              {SUPPORTED_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Expand / Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-100 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Strict Non-Diagnostic Guardrail Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/90 text-amber-900 text-xs">
            <ShieldAlert className="size-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {language === "hi" ? "सख्त गैर-नैदानिक नियम (Assistive Only):" : "Strict Non-Diagnostic Guardrail:"}
              </span>{" "}
              {language === "hi"
                ? "जिनी केवल अस्पताल के रास्ते, ज़रूरी कागज़ात और आयुष्मान भारत/सरकारी योजनाओं की जानकारी देती है। यह बीमारी की जाँच या दवा की सलाह नहीं दे सकती।"
                : "Genie assists only with hospital directions, required documents, and government health schemes (PM-JAY). Genie does not diagnose diseases or prescribe medications."}
            </div>
          </div>

          {/* Chat Messages Scroll Area */}
          <div
            className="max-h-[380px] overflow-y-auto space-y-3.5 pr-1 text-sm scroll-smooth"
            role="log"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-3.5 ${
                    m.role === "user"
                      ? "bg-[#0F172A] text-white rounded-br-xs shadow-xs"
                      : m.isDiagnosticRefusal
                      ? "bg-rose-50/90 border-2 border-rose-300 text-rose-950 rounded-bl-xs"
                      : "bg-slate-50 border border-slate-200/90 text-slate-900 rounded-bl-xs"
                  }`}
                >
                  {/* Guardrail badge if refusal */}
                  {m.isDiagnosticRefusal && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-300 w-fit">
                      <AlertTriangle className="size-3.5" />
                      {language === "hi" ? "नैदानिक सलाह निषेध (Non-Diagnostic)" : "Non-Diagnostic Refusal"}
                    </div>
                  )}

                  <p className="whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                    {m.text}
                  </p>

                  {/* Actions for Genie message */}
                  {m.role === "genie" && (
                    <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => playVoice(m.text, m.id, m.audioBase64)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                          currentlyPlayingId === m.id
                            ? "bg-pink-100 text-[#9D174D] border border-pink-300"
                            : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700"
                        }`}
                        title="Listen using Sarvam Voice"
                      >
                        {currentlyPlayingId === m.id ? (
                          <>
                            <Square className="size-3 fill-current" />
                            <span>{language === "hi" ? "रोकें" : "Stop Voice"}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="size-3.5 text-[#0284C7]" />
                            <span>{language === "hi" ? "आवाज़ में सुनें" : "Speak (Sarvam AI)"}</span>
                          </>
                        )}
                      </button>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {m.isDiagnosticRefusal ? "Guardrail Protected" : "Sarvam Assist"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Follow-up suggestions */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%] sm:max-w-[80%]">
                    {m.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAsk(s)}
                        disabled={busy}
                        className="text-[11px] font-medium text-[#0284C7] bg-sky-50/80 hover:bg-sky-100 hover:text-[#0369A1] border border-sky-200/90 rounded-full px-3 py-1 text-left transition-all cursor-pointer disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1 pl-2">
                <Loader2 className="size-4 animate-spin text-[#0284C7]" />
                <span>
                  {language === "hi"
                    ? "जिनी सोच रही है..."
                    : "Genie is retrieving assistive information..."}
                </span>
              </div>
            )}

            {hearing && (
              <div className="flex items-center gap-2 text-xs text-rose-600 font-medium py-1 pl-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-rose-500"></span>
                </span>
                <span>
                  {language === "hi"
                    ? "सर्वम एआई आपकी आवाज़ सुन रहा है..."
                    : "Sarvam AI is transcribing your voice..."}
                </span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Category Prompt Buttons */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
              <HelpCircle className="size-3" />
              {language === "hi" ? "त्वरित विषय चुनें:" : "Quick helpful topics:"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleAsk(
                    language === "hi"
                      ? "आयुष्मान भारत और सरकारी सहायता योजनाएं क्या हैं?"
                      : "What government schemes and Ayushman Bharat coverage are available?",
                  )
                }
                disabled={busy}
                className="p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left transition-all text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <BadgeIndianRupee className="size-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {language === "hi" ? "सरकारी योजनाएं" : "Health Schemes"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAsk(
                    language === "hi"
                      ? `अस्पताल ${hospital} कहाँ है और कैसे पहुँचना है?`
                      : `Where is ${hospital} located and how do I get there?`,
                  )
                }
                disabled={busy}
                className="p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left transition-all text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <MapPin className="size-4 text-[#0284C7] shrink-0" />
                <span className="truncate">
                  {language === "hi" ? "अस्पताल का रास्ता" : "Hospital Location"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAsk(
                    language === "hi"
                      ? "अस्पताल जाते समय कौन से कागज़ात साथ ले जाने हैं?"
                      : "What documents and test reports should I bring with me?",
                  )
                }
                disabled={busy}
                className="p-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-left transition-all text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileText className="size-4 text-indigo-600 shrink-0" />
                <span className="truncate">
                  {language === "hi" ? "ज़रूरी कागज़ात" : "Papers to Bring"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAsk(
                    language === "hi"
                      ? "क्या मुझे कैंसर है? मुझे कौन सी दवा खानी चाहिए?"
                      : "Do I have cancer? Can you diagnose me and prescribe medicines?",
                  )
                }
                disabled={busy}
                className="p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100/90 border border-rose-200 text-left transition-all text-xs font-semibold text-rose-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Tests the non-diagnostic refusal guardrail"
              >
                <ShieldAlert className="size-4 text-rose-600 shrink-0" />
                <span className="truncate">
                  {language === "hi" ? "गार्डरेल परीक्षण" : "Test Guardrail"}
                </span>
              </button>
            </div>
          </div>

          {/* Voice & Text Input Box */}
          <div className="space-y-2">
            {audioError && (
              <p role="alert" className="text-xs text-rose-600 font-medium">
                {audioError}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk(question);
              }}
              className="flex items-center gap-2"
            >
              {/* Voice Record Button (Sarvam STT) */}
              <button
                type="button"
                onClick={recorder.recording ? recorder.stop : recorder.start}
                disabled={busy || hearing}
                className={`size-11 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  recorder.recording
                    ? "bg-rose-600 text-white animate-pulse shadow-md"
                    : "bg-white hover:bg-pink-50 border border-slate-300 text-[#9D174D] shadow-2xs hover:border-[#9D174D]"
                }`}
                title={
                  recorder.recording
                    ? "Click to stop recording"
                    : "Click to speak in your language (Sarvam Speech)"
                }
              >
                {recorder.recording ? (
                  <Square className="size-5 fill-current" />
                ) : (
                  <Mic className="size-5" />
                )}
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    language === "hi"
                      ? "अस्पताल, योजना या कागज़ात के बारे में पूछें..."
                      : "Ask about hospital directions, schemes, or paperwork..."
                  }
                  disabled={busy || recorder.recording}
                  className="w-full text-xs sm:text-sm pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || busy || recorder.recording}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-lg bg-[#0F172A] hover:bg-black text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
                  title="Send message"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </form>

            {/* Bottom Controls: Auto-speak toggle & status */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="rounded text-[#0284C7] focus:ring-0 cursor-pointer"
                />
                {autoSpeak ? <Volume2 className="size-3.5 text-[#0284C7]" /> : <VolumeX className="size-3.5 text-slate-400" />}
                <span>
                  {language === "hi"
                    ? "उत्तर आवाज़ में सुनें (Auto-Speak)"
                    : "Speak answers aloud (Sarvam Voice)"}
                </span>
              </label>

              <span className="text-[10px] text-slate-400">
                Token: <strong className="font-mono text-slate-600">{token}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

