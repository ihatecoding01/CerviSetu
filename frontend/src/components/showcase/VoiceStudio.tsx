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
      // Call backend Sarvam bulbul:v4-flash TTS
      const res = await api.synthesizeSpeech({
        text: scriptData.script,
        language: activeDialect,
        model: "bulbul:v4-flash",
      });

      if (res.status === "SUCCESS" && res.audio_base64) {
        setTtsProvider("sarvam_ai");
        const audio = new Audio(`data:audio/wav;base64,${res.audio_base64}`);
        audioPlayerRef.current = audio;

        audio.onplay = () => {
          setIsSynthesizing(false);
          setIsPlaying(true);
        };
        audio.onended = () => {
          setIsPlaying(false);
          audioPlayerRef.current = null;
        };
        audio.onerror = () => {
          fallbackBrowserSpeech();
        };

        await audio.play();
        return;
      }
    } catch {
      // Fallback to browser speech if offline
    }

    fallbackBrowserSpeech();
  };

  const fallbackBrowserSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && scriptData) {
      setTtsProvider("browser_web_speech");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scriptData.script);
      utterance.lang = scriptData.voice_locale;
      utterance.rate = 0.95;

      utterance.onstart = () => {
        setIsSynthesizing(false);
        setIsPlaying(true);
      };
      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setIsSynthesizing(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setIsSynthesizing(false);
      setIsPlaying(false);
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
    <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#F19941]/30 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
              Indic Clinical Speech Engine
            </span>
            <span className="text-xs text-[#F19941]">·</span>
            <span className="text-xs text-[#4B5563]">Automated Outreach</span>
          </div>
          <h3 className="text-2xl font-semibold text-[#000000] tracking-tight">
            Vernacular Patient Accompaniment Voice Agent
          </h3>
        </div>

        {/* Confidence & Sarvam bulbul:v4-flash Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] text-[#000000] font-bold shadow-xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>Sarvam AI bulbul 4 flash</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#90C3CB] border-2 border-[#F19941] text-[#000000] font-bold shadow-xs">
            <span>Ritu Medical Voice</span>
          </div>
        </div>
      </div>

      {/* Dialect Switcher Chips */}
      <div className="mb-6">
        <label className="text-xs font-mono-data text-[#000000] block mb-2 uppercase tracking-wider font-bold">
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] shadow-xs"
                    : "bg-[#FFFFFF] border-[#F19941]/50 text-[#4B5563] hover:border-[#BA2D0B] hover:text-[#000000]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Script Viewer & Audio Waveform Player */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sub tabs: Script / Transliteration / SSML */}
          <div className="flex items-center gap-2 border-b-2 border-[#F19941]/20 pb-2">
            <button
              onClick={() => setActiveTab("script")}
              className={`text-xs font-semibold pb-1 border-b-2 transition-all cursor-pointer ${
                activeTab === "script"
                  ? "border-[#BA2D0B] text-[#000000]"
                  : "border-transparent text-[#4B5563] hover:text-[#000000]"
              }`}
            >
              Native Script
            </button>
            <button
              onClick={() => setActiveTab("transliteration")}
              className={`text-xs font-semibold pb-1 border-b-2 transition-all cursor-pointer ${
                activeTab === "transliteration"
                  ? "border-[#BA2D0B] text-[#000000]"
                  : "border-transparent text-[#4B5563] hover:text-[#000000]"
              }`}
            >
              Phonetic Latin
            </button>
            <button
              onClick={() => setActiveTab("ssml")}
              className={`text-xs font-semibold pb-1 border-b-2 transition-all cursor-pointer ${
                activeTab === "ssml"
                  ? "border-[#BA2D0B] text-[#000000]"
                  : "border-transparent text-[#4B5563] hover:text-[#000000]"
              }`}
            >
              SSML Speech Markup
            </button>
          </div>

          {/* Script Content Card with Secondary Border */}
          <div className="p-5 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941] min-h-[120px] flex items-center">
            {activeTab === "script" && (
              <p className="text-base text-[#000000] font-medium leading-relaxed">
                {scriptData?.script || "Loading vernacular speech payload..."}
              </p>
            )}
            {activeTab === "transliteration" && (
              <p className="text-sm font-mono-data text-[#4B5563] leading-relaxed">
                {scriptData?.transliteration || "Loading phonetic transcription..."}
              </p>
            )}
            {activeTab === "ssml" && (
              <code className="text-xs font-mono-data text-[#BA2D0B] break-all leading-normal">
                {scriptData?.ssml || "<speak>...</speak>"}
              </code>
            )}
          </div>

          {/* Interactive Player with Waveform & Sarvam bulbul 4 flash */}
          <div className="p-4 rounded-xl bg-[#FFFFFF] border-2 border-[#BA2D0B] flex items-center gap-4 shadow-xs">
            <button
              onClick={togglePlayback}
              disabled={isSynthesizing}
              className="size-12 rounded-xl bg-[#DBFE87] hover:bg-[#cbf76c] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
              aria-label={isPlaying ? "Pause Speech" : "Play Speech"}
            >
              {isSynthesizing ? (
                <span className="font-mono-data text-[10px] font-bold animate-pulse">...</span>
              ) : isPlaying ? (
                <SolarPause size={20} />
              ) : (
                <SolarPlay size={20} />
              )}
            </button>

            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-mono-data text-[#4B5563] mb-2">
                <span className="font-semibold text-[#000000] flex items-center gap-1.5">
                  <div className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                    <SolarVolume size={11} />
                  </div>
                  <span>{scriptData?.language_name || "Indic Dialect"}</span>
                </span>
                <span className="text-[#BA2D0B] font-bold">
                  {isSynthesizing
                    ? "Streaming bulbul 4 flash audio..."
                    : isPlaying
                    ? `Live Playing (${ttsProvider === "sarvam_ai" ? "Sarvam bulbul 4 flash" : "Web Speech"})`
                    : "Click Play to Listen via Sarvam bulbul 4 flash"}
                </span>
              </div>

              {/* Animated Waveform Visualizer */}
              <div className="h-8 flex items-center gap-1">
                {audioBars.map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isPlaying
                        ? i % 2 === 0
                          ? "bg-[#BA2D0B]"
                          : "bg-[#F19941]"
                        : "bg-[#90C3CB]"
                    }`}
                    style={{ height: isPlaying ? `${height}%` : "20%" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: IVR Keypad & Automated Telemetry */}
        <div className="lg:col-span-5 bg-[#F8F9FA] border-2 border-[#BA2D0B] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#F19941]/30">
            <span className="text-xs font-mono-data text-[#000000] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <div className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                <SolarSmartphone size={12} />
              </div>
              <span>Interactive Voice Response Keypad</span>
            </span>
            <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-[#DBFE87] border border-[#BA2D0B] text-[#000000] font-bold">
              Active Call
            </span>
          </div>

          <p className="text-xs text-[#4B5563] leading-relaxed mb-4">
            Patients press numeric dial keys on basic feature phones without mobile internet to coordinate transport or confirm radiotherapy sessions:
          </p>

          <div className="space-y-2.5 font-mono-data text-xs mb-6">
            <button
              onClick={() => setDtmfSelected("1")}
              className={`w-full p-3 rounded-lg border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                dtmfSelected === "1"
                  ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] font-bold"
                  : "bg-[#FFFFFF] border-[#F19941]/40 text-[#4B5563] hover:border-[#BA2D0B]"
              }`}
            >
              <span>Press 1 · Confirm Radiation Fraction Attendance</span>
              <span className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000] font-bold">
                1
              </span>
            </button>

            <button
              onClick={() => setDtmfSelected("2")}
              className={`w-full p-3 rounded-lg border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                dtmfSelected === "2"
                  ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] font-bold"
                  : "bg-[#FFFFFF] border-[#F19941]/40 text-[#4B5563] hover:border-[#BA2D0B]"
              }`}
            >
              <span>Press 2 · Request District Ambulance Bus Voucher</span>
              <span className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000] font-bold">
                2
              </span>
            </button>

            <button
              onClick={() => setDtmfSelected("3")}
              className={`w-full p-3 rounded-lg border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                dtmfSelected === "3"
                  ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] font-bold"
                  : "bg-[#FFFFFF] border-[#F19941]/40 text-[#4B5563] hover:border-[#BA2D0B]"
              }`}
            >
              <span>Press 3 · Urgent Oncology Nurse Call Back</span>
              <span className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000] font-bold">
                3
              </span>
            </button>
          </div>

          {/* Action Triggered Response Box */}
          <div className="p-3.5 rounded-lg bg-[#FFFFFF] border-2 border-[#BA2D0B] text-xs font-mono-data">
            <span className="text-[#4B5563] block mb-1">Simulated Protocol Action:</span>
            {dtmfSelected === "1" && (
              <span className="text-[#000000] font-bold">
                Logged Fraction 16 Attendance · Transport sync confirmed
              </span>
            )}
            {dtmfSelected === "2" && (
              <span className="text-[#BA2D0B] font-bold">
                Dispatched PMJAY Bus Voucher to patient mobile · ASHA alerted
              </span>
            )}
            {dtmfSelected === "3" && (
              <span className="text-[#F19941] font-bold">
                Daycare oncology nurse callback scheduled within 60 minutes
              </span>
            )}
            {!dtmfSelected && (
              <span className="text-[#4B5563]">Press any key above to simulate patient response</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
