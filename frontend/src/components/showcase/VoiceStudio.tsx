import React, { useState, useEffect, useRef } from "react";
import { api, type VoiceScriptResult } from "../../api/client";
import { SITE_LANGS, useSiteLang } from "../../i18n/site";
import {
  SolarVolume,
  SolarPlay,
  SolarPause,
  SolarCheck,
  SolarSmartphone,
} from "../icons/SolarIcons";

const DIALECTS = [
  { key: "HINDI", label: "Hindi", locale: "hi-IN" },
  { key: "BHOJPURI", label: "Bhojpuri", locale: "hi-IN" },
  { key: "BENGALI", label: "Bengali", locale: "bn-IN" },
  { key: "MARATHI", label: "Marathi", locale: "mr-IN" },
  { key: "TAMIL", label: "Tamil", locale: "ta-IN" },
  { key: "TELUGU", label: "Telugu", locale: "te-IN" },
];

export const VoiceStudio: React.FC = () => {
  // The dialect follows the site language, and picking a dialect switches the whole site to it
  const [siteLang, setSiteLang] = useSiteLang();
  const activeDialect = SITE_LANGS.find((l) => l.code === siteLang)?.dialect || "HINDI";
  const setActiveDialect = (key: string) => {
    const l = SITE_LANGS.find((x) => x.dialect === key);
    if (l) setSiteLang(l.code);
  };
  const [scriptData, setScriptData] = useState<VoiceScriptResult | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"script" | "transliteration" | "ssml">("script");
  const [dtmfSelected, setDtmfSelected] = useState<string | null>(null);
  const [ttsProvider, setTtsProvider] = useState<string>("sarvam_ai");
  const [audioBars, setAudioBars] = useState<number[]>([
    30, 60, 45, 90, 75, 40, 85, 95, 60, 70, 30, 80, 50, 90, 65, 45, 85, 40, 75, 55, 35, 65, 80,
  ]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Fetch localized script whenever dialect changes
  useEffect(() => {
    let cancelled = false;
    api.getVoiceScript({ language: activeDialect, fraction_number: 16, district: "Varanasi" }).then((res) => {
      if (!cancelled) setScriptData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDialect]);

  // Handle Play / Stop with Sarvam bulbul:v4-flash
  const togglePlayback = async () => {
    if (isPlaying) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setIsSynthesizing(false);
      return;
    }

    if (!scriptData) return;

    setIsSynthesizing(true);
    try {
      const res = await api.synthesizeSpeech({
        text: scriptData.script,
        language: activeDialect,
        model: "bulbul:v4-flash",
      });

      if (res.status === "SUCCESS" && res.audio_base64) {
        setTtsProvider("sarvam_ai");
        const audio = new Audio(`data:audio/wav;base64,${res.audio_base64}`);
        audioPlayerRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          setIsSynthesizing(false);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setIsSynthesizing(false);
        };
        await audio.play();
        setIsPlaying(true);
        setIsSynthesizing(false);
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis
    }

    // Web Speech fallback
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setTtsProvider("web_speech");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scriptData.script);
      const dialectConfig = DIALECTS.find((d) => d.key === activeDialect);
      utterance.lang = dialectConfig?.locale || "hi-IN";
      utterance.rate = 0.95;
      utterance.onend = () => {
        setIsPlaying(false);
        setIsSynthesizing(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setIsSynthesizing(false);
      };
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsSynthesizing(false);
    } else {
      setIsSynthesizing(false);
    }
  };

  // Waveform bounce animation during playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setAudioBars((prev) =>
        prev.map(() => Math.floor(Math.random() * 75) + 25)
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="w-full card-base card-gradient-pink rounded-lg p-6 sm:p-8 border border-black/15 shadow-sm">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/10 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-heading text-xs uppercase tracking-wider text-[#0284C7] font-bold bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
              Indic Clinical Speech Engine
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-600 font-medium">Automated Outreach</span>
          </div>
          <h3 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
            Vernacular Patient Accompaniment Voice Agent
          </h3>
        </div>

        {/* Confidence & Sarvam bulbul:v4-flash Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-md bg-sky-50 border border-sky-200 text-[#0369A1] font-bold shadow-2xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>Sarvam AI bulbul 4 flash</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-pink-50 border border-pink-200 text-[#9D174D] font-bold shadow-2xs">
            <span>Ritu Medical Voice</span>
          </div>
        </div>
      </div>

      {/* Dialect Switcher Chips */}
      <div className="mb-6">
        <label className="text-xs font-heading text-slate-700 block mb-2 uppercase tracking-wider font-bold">
          Select Regional Dialect
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {DIALECTS.map((d) => {
            const isSelected = activeDialect === d.key;
            return (
              <button
                key={d.key}
                onClick={() => {
                  setActiveDialect(d.key);
                  setIsPlaying(false);
                }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-heading font-semibold border transition-all cursor-pointer shadow-2xs ${
                  isSelected
                    ? "bg-[#9D174D] border-[#9D174D] text-white font-bold"
                    : "bg-white/90 border-black/15 text-slate-700 hover:border-black/30 hover:text-black"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Script Viewer & Audio Waveform Player */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sub tabs: Script / Transliteration / SSML */}
          <div className="flex items-center gap-3 border-b border-black/10 pb-2">
            <button
              onClick={() => setActiveTab("script")}
              className={`font-heading text-xs font-semibold pb-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === "script"
                  ? "border-[#9D174D] text-[#9D174D] font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Native Script
            </button>
            <button
              onClick={() => setActiveTab("transliteration")}
              className={`font-heading text-xs font-semibold pb-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === "transliteration"
                  ? "border-[#9D174D] text-[#9D174D] font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Phonetic Latin
            </button>
            <button
              onClick={() => setActiveTab("ssml")}
              className={`font-heading text-xs font-semibold pb-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === "ssml"
                  ? "border-[#9D174D] text-[#9D174D] font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              SSML Speech Markup
            </button>
          </div>

          {/* Script Content Card */}
          <div className="p-5 rounded-lg card-base card-gradient-subtle border border-black/15 min-h-[120px] flex items-center shadow-2xs">
            {activeTab === "script" && (
              <p className="text-base text-slate-900 font-medium leading-relaxed font-sans">
                {scriptData?.script || "Loading vernacular speech payload..."}
              </p>
            )}
            {activeTab === "transliteration" && (
              <p className="text-sm font-mono-data text-slate-700 leading-relaxed">
                {scriptData?.transliteration || "Loading phonetic transcription..."}
              </p>
            )}
            {activeTab === "ssml" && (
              <code className="text-xs font-mono-data text-[#0369A1] break-all leading-normal">
                {scriptData?.ssml || "<speak>...</speak>"}
              </code>
            )}
          </div>

          {/* Interactive Player with Waveform & Sarvam bulbul 4 flash */}
          <div className="p-4 rounded-lg card-base card-gradient-warm border border-black/15 flex items-center gap-4 shadow-2xs">
            <button
              onClick={togglePlayback}
              disabled={isSynthesizing}
              className="size-11 rounded-md bg-[#9D174D] hover:bg-[#831843] text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
              aria-label={isPlaying ? "Pause Speech" : "Play Speech"}
            >
              {isSynthesizing ? (
                <span className="font-mono-data text-[10px] font-bold animate-pulse">...</span>
              ) : isPlaying ? (
                <SolarPause size={18} />
              ) : (
                <SolarPlay size={18} />
              )}
            </button>

            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-mono-data text-slate-600 mb-2">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <div className="size-4 rounded bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
                    <SolarVolume size={11} />
                  </div>
                  <span>{scriptData?.language_name || "Indic Dialect"}</span>
                </span>
                <span className="text-[#0284C7] font-bold text-[11px]">
                  {isSynthesizing
                    ? "Streaming bulbul 4 flash audio..."
                    : isPlaying
                    ? `Live Playing (${ttsProvider === "sarvam_ai" ? "Sarvam bulbul 4 flash" : "Web Speech"})`
                    : "Click Play to Listen via Sarvam bulbul 4 flash"}
                </span>
              </div>

              {/* Animated Waveform Visualizer */}
              <div className="h-7 flex items-center gap-1">
                {audioBars.map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-sm transition-all duration-150 ${
                      isPlaying
                        ? i % 2 === 0
                          ? "bg-[#9D174D]"
                          : "bg-[#0284C7]"
                        : "bg-slate-300"
                    }`}
                    style={{ height: isPlaying ? `${height}%` : "20%" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: IVR Keypad & Automated Telemetry */}
        <div className="lg:col-span-5 card-base card-gradient-blue border border-black/15 rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/10">
            <span className="font-heading text-xs text-slate-900 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <div className="size-5 rounded-md bg-white border border-black/15 flex items-center justify-center text-[#0284C7]">
                <SolarSmartphone size={12} />
              </div>
              <span>Interactive Voice Response Keypad</span>
            </span>
            <span className="text-[10px] font-mono-data px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#0369A1] font-bold">
              Active Call
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Beneficiaries and guardians press numeric dial keys on basic feature phones without mobile internet to confirm immunization dates or symptom check-ins:
          </p>

          <div className="space-y-2 font-mono-data text-xs mb-5">
            <button
              onClick={() => setDtmfSelected("1")}
              className={`w-full p-2.5 rounded-md border text-left flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                dtmfSelected === "1"
                  ? "bg-white border-[#0284C7] text-[#0369A1] font-bold ring-1 ring-[#0284C7]"
                  : "bg-white/80 border-black/15 text-slate-700 hover:border-black/30"
              }`}
            >
              <span>Press 1 · Confirm Dose 2 HPV Vaccination Date</span>
              <span className="size-5 rounded-md bg-slate-100 border border-black/15 flex items-center justify-center text-slate-900 font-bold">
                1
              </span>
            </button>

            <button
              onClick={() => setDtmfSelected("2")}
              className={`w-full p-2.5 rounded-md border text-left flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                dtmfSelected === "2"
                  ? "bg-white border-[#9D174D] text-[#9D174D] font-bold ring-1 ring-[#9D174D]"
                  : "bg-white/80 border-black/15 text-slate-700 hover:border-black/30"
              }`}
            >
              <span>Press 2 · Report Screening Symptoms / ASHA Visit</span>
              <span className="size-5 rounded-md bg-slate-100 border border-black/15 flex items-center justify-center text-slate-900 font-bold">
                2
              </span>
            </button>

            <button
              onClick={() => setDtmfSelected("3")}
              className={`w-full p-2.5 rounded-md border text-left flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                dtmfSelected === "3"
                  ? "bg-white border-[#0284C7] text-[#0369A1] font-bold ring-1 ring-[#0284C7]"
                  : "bg-white/80 border-black/15 text-slate-700 hover:border-black/30"
              }`}
            >
              <span>Press 3 · Urgent Tertiary Care Referral Guidance</span>
              <span className="size-5 rounded-md bg-slate-100 border border-black/15 flex items-center justify-center text-slate-900 font-bold">
                3
              </span>
            </button>
          </div>

          {/* Action Triggered Response Box */}
          <div className="p-3.5 rounded-md card-base card-gradient-subtle border border-black/15 text-xs font-mono-data shadow-2xs">
            <span className="text-slate-500 block mb-1">Simulated Protocol Action:</span>
            {dtmfSelected === "1" && (
              <span className="text-[#0284C7] font-bold">
                Logged Dose 2 HPV Slot at Sub-Centre · ASHA Stock Confirmed
              </span>
            )}
            {dtmfSelected === "2" && (
              <span className="text-[#9D174D] font-bold">
                14-Day Community Follow-Up Logged · ASHA Home Check Scheduled
              </span>
            )}
            {dtmfSelected === "3" && (
              <span className="text-[#0284C7] font-bold">
                Pre-Arrival Dossier Synced to Tertiary Hospital Specialist Queue
              </span>
            )}
            {!dtmfSelected && (
              <span className="text-slate-400">Press any key above to simulate beneficiary response</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
