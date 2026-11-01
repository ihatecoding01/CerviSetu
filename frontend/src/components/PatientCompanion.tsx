import React, { useState, useEffect } from "react";
import {
  Heart,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Download,
  Building2,
  Sparkles,
  ShieldCheck,
  QrCode,
  Check
} from "lucide-react";
import { api, type HealingClock, type HubSpokePass, type SoundboardTrack } from "../api/client";

interface Props {
  patientToken?: string;
  onExitToGateway?: () => void;
  isEmbeddedInDualView?: boolean;
}

export const PatientCompanion: React.FC<Props> = ({
  patientToken = "PT-RURAL-7891",
  onExitToGateway,
  isEmbeddedInDualView = false,
}) => {
  const [clock, setClock] = useState<HealingClock>({
    patient_token: patientToken,
    ebrt_fractions_completed: 14,
    brachy_fractions_completed: 0,
    total_steps_completed: 14,
    projected_finish_days: 44,
    clock_target_49d_status: "OPTIMAL",
    clock_limit_56d_status: "ON_TRACK",
  });

  const [passData, setPassData] = useState<HubSpokePass>({
    pass_id: `PASS-${patientToken.slice(-4)}`,
    patient_token: patientToken,
    spoke_facility_name: "District Cancer Care Daycare & Radiotherapy Spoke",
    hub_facility_name: "Regional Cancer Centre (RCC) Brachytherapy Hub",
    distance_km: 75.0,
    requested_window: "Days 38–44",
    hub_ot_slot_date: null,
    slot_confirmed_by_doctor: 0,
    bus_voucher_code: null,
    dharamshala_room_code: null,
    is_simulated_mock: 1,
  });

  const [tracks, setTracks] = useState<SoundboardTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ title: string; desc: string; type: "success" | "alert" } | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);

  // Load backend state
  const refreshData = async () => {
    try {
      const clockRes = await api.getHealingClock(patientToken);
      if (clockRes?.clock) setClock(clockRes.clock);

      const passRes = await api.getPatientPasses(patientToken);
      if (passRes?.pass) setPassData(passRes.pass);

      const tracksRes = await api.getSoundboardTracks();
      if (tracksRes?.tracks) setTracks(tracksRes.tracks);
    } catch {
      // Keep state seamlessly if offline
    }
  };

  useEffect(() => {
    refreshData();
  }, [patientToken]);

  // Demo Action 1: Advance to Fraction 15 (Day 21)
  const handleAdvanceToFraction15 = async () => {
    setLoadingAction("advance");
    try {
      const res = await api.advanceFraction15(patientToken, 15);
      if (res?.clock) setClock(res.clock);
      if (res?.pass_status) setPassData(res.pass_status);
      setNotificationMsg({
        title: "Day 21 (Fraction 15) माइलस्टोन सक्रिय!",
        desc: "Pre-Brachy PAC चेकलिस्ट शुरू की गई। केंद्रीय अस्पताल (Hub) को Days 38–44 स्लॉट विंडो भेजी गई।",
        type: "success",
      });
    } catch {
      // Local fallback
      setClock((prev) => ({
        ...prev,
        ebrt_fractions_completed: 15,
        total_steps_completed: 15,
      }));
      setNotificationMsg({
        title: "Day 21 (Fraction 15) माइलस्टोन सक्रिय!",
        desc: "Pre-Brachy PAC चेकलिस्ट शुरू की गई। केंद्रीय अस्पताल को Days 38–44 स्लॉट अनुरोध भेजा गया।",
        type: "success",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Demo Action 2: Hub Confirms OT Slot (Step 2B)
  const handleConfirmHubSlot = async () => {
    setLoadingAction("confirm");
    try {
      const res = await api.confirmHubSlot(patientToken, "Day 41");
      if (res?.pass_data) setPassData(res.pass_data);
      setNotificationMsg({
        title: "केंद्रीय अस्पताल OT स्लॉट स्वीकृत!",
        desc: "ब्रैकीथेरेपी स्लॉट: Day 41. रोडवेज बस पास (UP-RTC) व धर्मशाला कमरा स्वीकृत कर दिया गया।",
        type: "success",
      });
    } catch {
      // Local fallback
      setPassData((prev) => ({
        ...prev,
        slot_confirmed_by_doctor: 1,
        hub_ot_slot_date: "Day 41",
        bus_voucher_code: `UP-RTC-${patientToken.slice(-4)}`,
        dharamshala_room_code: "DHM-ROOM-402",
      }));
      setNotificationMsg({
        title: "केंद्रीय अस्पताल OT स्लॉट स्वीकृत!",
        desc: "ब्रैकीथेरेपी स्लॉट: Day 41. रोडवेज बस पास व धर्मशाला कमरा स्वीकृत कर दिया गया।",
        type: "success",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Symptom Triage Action
  const handleReportSymptom = async (symptomName: string, grade: number) => {
    try {
      await api.logPatientSymptom({
        patient_token: patientToken,
        symptoms: [symptomName],
        severity_grade: grade,
        voice_note_received: true,
      });

      if (grade === 1) {
        setNotificationMsg({
          title: "घरेलू ORS व आहार मार्गदर्शन भेजा गया",
          desc: "हल्के दस्त के लिए उबला पानी, ORS घोल और हल्का भोजन लें। ऑडियो सलाह नीचे सुनें।",
          type: "success",
        });
      } else {
        setNotificationMsg({
          title: "डॉक्टर वार्ड लिस्ट में अलर्ट दर्ज (Priority Alert)",
          desc: "मध्यम/गंभीर लक्षण दर्ज। अस्पताल की नर्स आपसे संपर्क कर दवा सुनिश्चित करेगी।",
          type: "alert",
        });
      }
    } catch {
      setNotificationMsg({
        title: "लक्षण दर्ज किए गए",
        desc: "स्वास्थ्य केंद्र को आपकी स्थिति की सूचना भेज दी गई है।",
        type: "success",
      });
    }
  };

  const playTrack = (trackId: string) => {
    if (activeTrackId === trackId && isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    setActiveTrackId(trackId);
    setIsPlayingAudio(true);
    // Simulate audio duration
    setTimeout(() => {
      setIsPlayingAudio(false);
    }, 6000);
  };

  return (
    <div className={`flex flex-col items-center justify-center font-sans ${isEmbeddedInDualView ? "w-full" : "min-h-screen bg-slate-950 p-4 sm:p-6"}`}>
      {/* Mobile Device Container (385px Phone Shell) */}
      <div className="w-[385px] max-w-full bg-[#0F172A] rounded-[42px] border-[6px] border-slate-700 shadow-2xl p-4.5 text-slate-100 flex flex-col justify-between overflow-hidden relative transition-all">
        {/* Device Top Speaker Notch */}
        <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
          <div className="size-2 rounded-full bg-slate-900 border border-slate-700" />
        </div>

        {/* Top Status Bar */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 px-2 mb-3">
          <span className="font-mono">09:41</span>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CerviSetu Co-Pilot
          </div>
          {onExitToGateway && (
            <button
              onClick={onExitToGateway}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              लॉग आउट
            </button>
          )}
        </div>

        {/* Header Patient Identity & Language Badge */}
        <div className="bg-slate-800/90 rounded-2xl p-3 border border-slate-700/80 mb-3 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-mono">गोपनीय पहचान (Token)</span>
            <span className="font-bold text-sm text-slate-100 tracking-wide font-mono">{patientToken}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30 font-medium">
              हिंदी / Hindi
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">Stage IIB Cervical</span>
          </div>
        </div>

        {/* Live In-App Notification Toast */}
        {notificationMsg && (
          <div
            className={`p-3 rounded-2xl mb-3 text-xs border transition-all ${
              notificationMsg.type === "alert"
                ? "bg-rose-950/60 border-rose-700/60 text-rose-200"
                : "bg-emerald-950/60 border-emerald-700/60 text-emerald-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {notificationMsg.type === "alert" ? (
                <AlertTriangle className="size-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-bold block leading-tight">{notificationMsg.title}</span>
                <p className="text-[10px] mt-0.5 opacity-90 leading-relaxed">{notificationMsg.desc}</p>
              </div>
              <button
                onClick={() => setNotificationMsg(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Card 1: 29-Step Visual "Healing Clock" */}
          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/70 shadow-xs">
            <div className="flex justify-between items-center mb-2.5">
              <div>
                <span className="text-xs font-bold text-slate-200 block">29-चरण उपचार यात्रा</span>
                <span className="text-[10px] text-slate-400">Literacy-Free Healing Clock</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {clock.total_steps_completed} / 29 पूर्ण
              </span>
            </div>

            {/* EBRT Fractions Grid (1 to 25) */}
            <div className="mb-2.5">
              <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                <span>बाहरी विकिरण (EBRT: 1–25)</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {Math.min(clock.total_steps_completed, 25)} / 25
                </span>
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {Array.from({ length: 25 }).map((_, i) => {
                  const isDone = i < clock.total_steps_completed;
                  const isCurrent = i === clock.total_steps_completed;
                  return (
                    <div
                      key={i}
                      title={`EBRT Fraction ${i + 1}`}
                      className={`h-2.5 rounded-full transition-all ${
                        isDone
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                          : isCurrent
                          ? "bg-amber-400 animate-pulse scale-110"
                          : "bg-slate-700/70 border border-slate-600/60"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Brachytherapy Diamond Glyphs (26 to 29) */}
            <div className="mb-2">
              <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                <span>अंदरूनी ब्रैकीथेरेपी (Hub: 26–29)</span>
                <span className="font-mono text-blue-400 font-semibold">
                  {Math.max(0, clock.total_steps_completed - 25)} / 4
                </span>
              </div>
              <div className="flex gap-3 px-1">
                {Array.from({ length: 4 }).map((_, i) => {
                  const stepNum = 25 + i + 1;
                  const isDone = stepNum <= clock.total_steps_completed;
                  const isCurrent = stepNum === clock.total_steps_completed + 1 && clock.total_steps_completed >= 25;
                  return (
                    <div
                      key={i}
                      title={`Brachytherapy Fraction ${i + 1}`}
                      className={`size-3.5 rotate-45 transition-all ${
                        isDone
                          ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                          : isCurrent
                          ? "bg-amber-400 animate-pulse"
                          : "bg-slate-700/70 border border-slate-500"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Projected Biological OTT Finish */}
            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">अनुमानित समापन (Projected OTT):</span>
              <span className="font-bold text-emerald-400 font-mono">
                {clock.projected_finish_days} दिन (≤49d GEC-ESTRO On-Track)
              </span>
            </div>
          </div>

          {/* Card 2: Centre-Approved Pre-Cisplatin Hydration Reminder */}
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-2xl p-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <Heart className="size-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-bold text-blue-200 block">कीमोथेरेपी जल सेवन व तैयारी सूचना</span>
                <p className="text-[11px] text-blue-300/90 leading-relaxed mt-1">
                  "कल की कीमोथेरेपी के लिए अस्पताल द्वारा दी गई पानी पीने की सलाह का ध्यान रखें और अपनी रक्त जांच (CBC/RFT) रिपोर्ट साथ लाएं।"
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-[9px] text-blue-400/80 font-mono">
                  <ShieldCheck className="size-3 text-emerald-400" />
                  <span>Centre-Approved Protocol · eGFR/Kidney Guarded</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Bi-Weekly 2-Question Symptom Triage */}
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/70 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200">सहानुभूतिपूर्ण लक्षण जांच (Symptom Triage)</span>
              <span className="text-[10px] text-slate-400 font-mono">Bi-Weekly</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2.5">
              यदि आपको कोई परेशानी हो रही है, तो नीचे दिए बटन से तुरंत सूचित करें:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => handleReportSymptom("DIARRHEA", 1)}
                className="py-1.5 px-2 bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-[10px] text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>💧 हल्के पतले दस्त (Grade 1)</span>
              </button>

              <button
                onClick={() => handleReportSymptom("DIARRHEA_SEVERE", 2)}
                className="py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 rounded-xl text-[10px] text-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="size-3 text-rose-400 shrink-0" />
                <span>🚨 गंभीर दस्त (Grade 2+)</span>
              </button>

              <button
                onClick={() => handleReportSymptom("PELVIC_BURNING", 1)}
                className="py-1.5 px-2 bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-[10px] text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔥 पेशाब में जलन (Burning)</span>
              </button>

              <button
                onClick={() => handleReportSymptom("SEVERE_FATIGUE", 2)}
                className="py-1.5 px-2 bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-[10px] text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡ अत्यधिक थकान (Fatigue)</span>
              </button>
            </div>
          </div>

          {/* Card 4: Day-21 (Fraction 15) Brachy Reassurance & Hub Travel Pass */}
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-3 shadow-xs">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs font-bold text-amber-200 block">केंद्रीय अस्पताल (Hub) समन्वय</span>
                <span className="text-[10px] text-amber-300/80">Day 21 Milestone · 75 km Hub Bridge</span>
              </div>
              <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {clock.total_steps_completed >= 15 ? "Active Step" : "Unlocks at Frac 15"}
              </span>
            </div>

            {/* Reassurance Audio Player (Hindi Sarvam Voice) */}
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-700 mb-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Volume2 className="size-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-100 block">
                      ब्रैकीथेरेपी प्रक्रिया ऑडियो (Reassurance)
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Sarvam Saaras v3 · {tracks.length > 0 ? `${tracks.length} Tracks Ready` : "Hindi"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => playTrack("brachy_reassurance")}
                  className="size-7 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs cursor-pointer transition-transform active:scale-95"
                >
                  {isPlayingAudio && activeTrackId === "brachy_reassurance" ? (
                    <Pause className="size-3.5 fill-current" />
                  ) : (
                    <Play className="size-3.5 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Reviewed Hindi Transcript Preview */}
              <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-amber-200/90 leading-relaxed font-sans">
                🔊 <em>"ब्रैकीथेरेपी (अंदरूनी विकिरण उपचार) के दौरान आपको सुरक्षित और आरामदायक रखने के लिए डॉक्टरों की टीम निश्चेतना (एनेस्थीसिया) और दर्द-निवारक व्यवस्था करती है। इससे घबराएं नहीं।"</em>
              </div>
            </div>

            {/* Logistical Travel Pass Status */}
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-700">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">रोडवेज बस व धर्मशाला पास:</span>
                {passData.slot_confirmed_by_doctor === 1 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                    <CheckCircle2 className="size-3" /> स्वीकृत ({passData.hub_ot_slot_date || "Day 41"})
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-mono">
                    {clock.total_steps_completed >= 15 ? "Hub स्लॉट पुष्टि प्रतीक्षित" : "Step 15 पर अनुरोधित"}
                  </span>
                )}
              </div>

              {passData.slot_confirmed_by_doctor === 1 && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    <div>🎫 बस वाउचर: <strong className="text-slate-200 font-mono">{passData.bus_voucher_code}</strong></div>
                    <div>🏠 धर्मशाला: <strong className="text-slate-200 font-mono">{passData.dharamshala_room_code}</strong></div>
                  </div>
                  <button
                    onClick={() => setShowPassModal(true)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Download className="size-3" /> पास देखें
                  </button>
                </div>
              )}

              <div className="text-[9px] text-slate-500 mt-1.5 font-mono">
                [Simulated State Transport & Hospital Dharamshala API Mock]
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Demo Trigger Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Live Demo Controls
            </span>
            <span className="text-[9px] text-slate-500 font-mono">Deterministic Step Rule</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {clock.total_steps_completed < 15 ? (
              <button
                onClick={handleAdvanceToFraction15}
                disabled={loadingAction === "advance"}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="size-3.5 text-amber-300" />
                <span>Demo: Advance to Fraction 15 (Day 21)</span>
              </button>
            ) : passData.slot_confirmed_by_doctor === 0 ? (
              <button
                onClick={handleConfirmHubSlot}
                disabled={loadingAction === "confirm"}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Building2 className="size-3.5 text-blue-200" />
                <span>Demo: Hub Confirms OT Slot (Day 41)</span>
              </button>
            ) : (
              <div className="w-full py-1.5 bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 rounded-xl text-[11px] font-semibold text-center flex items-center justify-center gap-1">
                <Check className="size-3.5" />
                <span>2-Step Hub Handoff & Vouchers Complete</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Bilingual Family Caregiver Pass Modal */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-900 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Simulated State Travel Pass
                </span>
                <h3 className="text-base font-extrabold mt-1">यात्रा व धर्मशाला बोर्डिंग पास</h3>
              </div>
              <button
                onClick={() => setShowPassModal(false)}
                className="size-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">मरीज पहचान टोकन:</span>
                <strong className="font-mono text-sm">{patientToken}</strong>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block">प्रस्थान व गंतव्य (~75 km Route):</span>
                <div className="font-bold text-slate-800 text-[11px] mt-0.5">
                  Mirzapur Spoke Clinic ➔ RCC Varanasi Hub
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block">रोडवेज बस कोड:</span>
                  <strong className="font-mono text-emerald-800">{passData.bus_voucher_code}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">धर्मशाला कमरा:</span>
                  <strong className="font-mono text-blue-800">{passData.dharamshala_room_code}</strong>
                </div>
              </div>

              <div className="flex items-center justify-center p-3 bg-white rounded-xl border border-slate-200">
                <QrCode className="size-24 text-slate-800" />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  alert("Pass downloaded to family phone (Simulated PDF).");
                  setShowPassModal(false);
                }}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="size-3.5" /> डाउनलोड करें (Download)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
