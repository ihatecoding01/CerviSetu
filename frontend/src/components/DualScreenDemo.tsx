import { Sym } from "./icons/Sym";
import React, { useState, useEffect } from "react";
import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import {
  Tablet,
  Globe,
  ArrowLeft,
  Heart,
  Play,
  Pause,
  Download,
  QrCode,
  Check,
  MapPin,
  CircleDot,
  Volume2,
  Layers,
} from "lucide-react";

interface Props {
  onBackToStaff?: () => void;
  onBackToGateway?: () => void;
  isInsideDashboard?: boolean;
}

interface WardPatient {
  token: string;
  name: string;
  age: number;
  stage: string;
  currentStep: number;
  totalSteps: number;
  projectedFinishDays: number;
  clockStatus: "OPTIMAL" | "TARGET_AT_RISK" | "BREACH_RISK";
  adherenceStatus: "ATTENDING_DAILY" | "1_DAY_OVERDUE" | "4_DAYS_OVERDUE";
  adherenceSeverity: "NORMAL" | "TIER_1_SMS" | "TIER_2_IVR";
  lastFractionLogged: string;
  hubSlotStatus: string;
  centre: string;
  doctor: string;
}

const WARD_CASES: WardPatient[] = [
  {
    token: "PT-RURAL-7891",
    name: "Shanti Devi",
    age: 52,
    stage: "Stage IIB Cervical",
    currentStep: 14,
    totalSteps: 29,
    projectedFinishDays: 44,
    clockStatus: "OPTIMAL",
    adherenceStatus: "ATTENDING_DAILY",
    adherenceSeverity: "NORMAL",
    lastFractionLogged: "Today (Step 14)",
    hubSlotStatus: "REQUESTED_DAYS_38_44",
    centre: "Mirzapur District Oncology Daycare & Radiotherapy Spoke",
    doctor: "Dr. Sharma (MD, Radiotherapy)",
  },
  {
    token: "PT-RURAL-4421",
    name: "Geeta Kushwaha",
    age: 46,
    stage: "Stage IIIA Cervical",
    currentStep: 8,
    totalSteps: 29,
    projectedFinishDays: 52,
    clockStatus: "TARGET_AT_RISK",
    adherenceStatus: "1_DAY_OVERDUE",
    adherenceSeverity: "TIER_1_SMS",
    lastFractionLogged: "Yesterday (Step 8)",
    hubSlotStatus: "NOT_YET_DUE",
    centre: "Chunar Community Health Centre & Spoke",
    doctor: "Dr. Verma (MD, Radiation Oncology)",
  },
  {
    token: "PT-RURAL-1102",
    name: "Kamla Bind",
    age: 58,
    stage: "Stage IIIB Cervical",
    currentStep: 19,
    totalSteps: 29,
    projectedFinishDays: 59,
    clockStatus: "BREACH_RISK",
    adherenceStatus: "4_DAYS_OVERDUE",
    adherenceSeverity: "TIER_2_IVR",
    lastFractionLogged: "4 Days Ago (Step 19)",
    hubSlotStatus: "PAC_CHECKLIST_PENDING",
    centre: "Robertsganj Spoke Daycare Facility",
    doctor: "Dr. Ananya Sen (DNB, Radiation)",
  },
];

export const DualScreenDemo: React.FC<Props> = ({
  onBackToStaff,
  onBackToGateway,
  isInsideDashboard = false,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>("PT-RURAL-7891");
  const activeCase = WARD_CASES.find((c) => c.token === selectedToken) || WARD_CASES[0];

  // Mobile Phone Interactive State
  const [phoneLang, setPhoneLang] = useState<"hi" | "en">("hi");
  const [clockSteps, setClockSteps] = useState<number>(activeCase.currentStep);
  const [slotConfirmed, setSlotConfirmed] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [phoneToast, setPhoneToast] = useState<{ title: string; desc: string; type: "success" | "alert" | "info" } | null>(null);
  const [showPassModal, setShowPassModal] = useState<boolean>(false);

  // Sync steps when patient changes
  useEffect(() => {
    setClockSteps(activeCase.currentStep);
    setSlotConfirmed(activeCase.token === "PT-RURAL-7891" ? slotConfirmed : false);
  }, [selectedToken]);

  // Audio timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 15;
        });
      }, 500);
    } else {
      setAudioProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const handleAdvanceStep = () => {
    setClockSteps(15);
    setPhoneToast({
      title: phoneLang === "hi" ? "Day 21 (Fraction 15) सक्रिय!" : "Day 21 Milestone Cleared!",
      desc: phoneLang === "hi"
        ? "Pre-Brachy PAC चेकलिस्ट पूर्ण। हब अस्पताल को स्लॉट अनुरोध भेजा गया।"
        : "Pre-Brachy PAC cleared. Slot request dispatched to RCC Varanasi Hub.",
      type: "success",
    });
  };

  const handleConfirmSlot = () => {
    setSlotConfirmed(true);
    setPhoneToast({
      title: phoneLang === "hi" ? "वाराणसी हब स्लॉट स्वीकृत (Day 41)" : "Hub OT Slot Approved (Day 41)",
      desc: phoneLang === "hi"
        ? "UP-RTC बस वाउचर व धर्मशाला कमरा 402 स्वीकृत किया गया।"
        : "UP-RTC roadways bus pass and Dharamshala room 402 unlocked.",
      type: "success",
    });
  };

  const handleReportSymptom = (type: "mild" | "severe") => {
    if (type === "mild") {
      setPhoneToast({
        title: phoneLang === "hi" ? "घरेलू ORS व जल सेवन सलाह" : "Home ORS Advice Dispatched",
        desc: phoneLang === "hi" ? "उबला पानी व हल्का भोजन लें। ऑडियो सलाह नीचे सुनें।" : "Take boiled water and light meals. Listen to audio advice.",
        type: "info",
      });
    } else {
      setPhoneToast({
        title: phoneLang === "hi" ? "नर्स वार्ड अलर्ट प्रेषित" : "Nurse Ward Alert Sent",
        desc: phoneLang === "hi" ? "सिस्टर अंजलि (नर्स) तुरंत फोन पर संपर्क करेंगी।" : "Lead Nurse Sister Anjali has been alerted for immediate callback.",
        type: "alert",
      });
    }
  };

  return (
    <div className={`w-full font-sans antialiased text-black ${isInsideDashboard ? "" : "min-h-screen bg-[#FAFAFA] p-3 sm:p-6"}`}>
      {/* 1. Standalone Top Navbar (only rendered if outside dashboard) */}
      {!isInsideDashboard && (
        <header className="bg-white border border-slate-200/90 rounded-2xl px-4 sm:px-6 py-3.5 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {onBackToGateway && (
              <button
                onClick={onBackToGateway}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer font-medium"
              >
                <ArrowLeft className="size-3.5" /> Gateway
              </button>
            )}
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-bold text-sm text-black">Live Dual-Screen View</span>
              <span className="text-xs bg-[#DBFE87] text-black border border-[#c4e872] px-2.5 py-0.5 rounded-full font-bold">
                Spoke Clinic Tablet · Patient Phone
              </span>
            </div>
          </div>

          {onBackToStaff && (
            <button
              onClick={onBackToStaff}
              className="shrink-0 text-xs font-semibold bg-black hover:bg-black/85 text-white px-4 py-1.5 rounded-full shadow-xs transition-colors cursor-pointer"
            >
              Full Workstation <Sym n="arrow-right" />
            </button>
          )}
        </header>
      )}

      {/* 2. Explanatory Context Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-[#BA2D0B]/10 text-[#BA2D0B] flex items-center justify-center shrink-0 border border-[#BA2D0B]/20">
            <Layers className="size-5 text-[#BA2D0B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-black">Dual-Clock Asymmetric Architecture</h2>
              <span className="text-xs bg-[#DBFE87] text-black px-2 py-0.5 rounded-full font-bold">Live Synchronized</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any patient on the Clinic Tablet to see their real-time state reflected on the Patient Phone.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-slate-500">
          <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Tablet className="size-3.5 text-black" /> 30% Clinician
          </span>
          <span className="flex items-center gap-1.5 bg-[#DBFE87]/40 px-2.5 py-1 rounded-lg border border-[#c4e872] text-black font-bold">
            <Globe className="size-3.5 text-black" /> 70% Patient Co-Pilot
          </span>
        </div>
      </div>

      {/* 3. Main Split Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT VIEWPORT: CLINIC TABLET (CareUI Ward Board) - 7 COLS */}
        {/* ======================================================== */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs flex flex-col h-[820px] overflow-hidden">
          {/* Tablet Device Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#BA2D0B]/10 text-[#BA2D0B] flex items-center justify-center border border-[#BA2D0B]/20">
                <Tablet className="size-5 text-[#BA2D0B]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-black leading-none">
                  Spoke Clinic Tablet · CareUI Ward Board
                </h3>
                <span className="text-xs text-slate-500 block mt-1">
                  Mirzapur District Oncology Daycare · Linac Vault 01
                </span>
              </div>
            </div>

            <span className="text-xs font-bold bg-[#DBFE87] text-black border border-[#c4e872] px-2.5 py-1 rounded-full">
              30% Clinician Weight
            </span>
          </div>

          {/* Scrollable Tablet Workspace */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Dual-Clock Ward Board */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-black uppercase tracking-wider block">
                    Dual-Clock Ward Board (Projection vs. Acute Event)
                  </span>
                  <span className="text-xs text-slate-500">
                    Calculated GEC-ESTRO ≤49d standard decoupled from daily attendance events
                  </span>
                </div>
                <span className="text-xs font-bold bg-white px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-700">
                  3 Patients Monitored
                </span>
              </div>

              {/* Patient Case Cards */}
              <div className="space-y-3">
                {WARD_CASES.map((c) => {
                  const isSelected = c.token === selectedToken;
                  return (
                    <div
                      key={c.token}
                      onClick={() => setSelectedToken(c.token)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white border-[#BA2D0B] ring-2 ring-[#BA2D0B]/20 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Case Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-black">{c.token}</span>
                          <span className="text-xs font-bold text-slate-800">{c.name}</span>
                          <span className="text-xs text-slate-500">({c.age}y · {c.stage})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-slate-100 text-black px-2.5 py-0.5 rounded-full">
                            Step {c.token === activeCase.token ? clockSteps : c.currentStep}/29
                          </span>
                          {isSelected && (
                            <span className="text-xs font-bold bg-[#BA2D0B] text-white px-2 py-0.5 rounded-full">
                              Active Case
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2 Distinct Decoupled Columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Column 1: Biological Finish Clock (Calculated Projection) */}
                        <div className={`p-3 rounded-xl border ${
                          c.clockStatus === "OPTIMAL"
                            ? "bg-[#DBFE87]/15 border-[#c4e872]"
                            : c.clockStatus === "TARGET_AT_RISK"
                            ? "bg-[#F19941]/15 border-[#F19941]/40"
                            : "bg-[#BA2D0B]/10 border-[#BA2D0B]/30"
                        }`}>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                            Col 1: Biological Finish Clock
                          </span>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`size-2.5 rounded-full ${
                              c.clockStatus === "OPTIMAL"
                                ? "bg-[#DBFE87] ring-2 ring-black"
                                : c.clockStatus === "TARGET_AT_RISK"
                                ? "bg-[#F19941]"
                                : "bg-[#BA2D0B]"
                            }`} />
                            <strong className="text-black text-sm font-bold">
                              Proj: {c.projectedFinishDays} Days
                            </strong>
                          </div>
                          <span className="text-xs text-slate-600 block mt-0.5 font-medium">
                            {c.clockStatus === "OPTIMAL"
                              ? "≤49d GEC-ESTRO Optimal"
                              : c.clockStatus === "TARGET_AT_RISK"
                              ? "50–56d ABS Limit Warning"
                              : ">56d Biological Hard Breach"}
                          </span>
                        </div>

                        {/* Column 2: Clinical Adherence Event (Acute Log) */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                            Col 2: Acute Adherence Event
                          </span>
                          <div className="mt-1">
                            {c.adherenceStatus === "ATTENDING_DAILY" ? (
                              <span className="text-xs font-bold text-black bg-[#DBFE87] px-2 py-0.5 rounded-full inline-block">
                                Regular Attendance <Sym n="check" />
                              </span>
                            ) : c.adherenceStatus === "1_DAY_OVERDUE" ? (
                              <span className="text-xs font-bold text-[#BA2D0B] bg-[#F19941]/30 px-2 py-0.5 rounded-full inline-block">
                                Day 1 Overdue · Tier 1 SMS
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-white bg-[#BA2D0B] px-2 py-0.5 rounded-full inline-block">
                                Day 4 Overdue · Tier 2 IVR
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block mt-1">
                            Last: {c.lastFractionLogged}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clinician Deep-Dive & Gate Controls */}
            <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-black uppercase tracking-wider">
                  Active Clinical Governance: <span className="font-mono text-[#BA2D0B]">{activeCase.token}</span>
                </span>
                <span className="text-xs text-slate-500 font-medium">Hub Distance: ~75 km route</span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#90C3CB]/15 rounded-xl border border-[#90C3CB]/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-black block">
                      Day-21 (Fraction 15) Pre-Brachy Gate Status:
                    </span>
                    <span className="text-xs text-slate-700">
                      Pre-Anesthetic Checkup (PAC) cleared · CBC/RFT Creatinine 0.85 safe
                    </span>
                  </div>
                  {clockSteps >= 15 ? (
                    <span className="text-xs font-bold bg-[#DBFE87] text-black px-2.5 py-1 rounded-full border border-[#c4e872]">
                      Gate Cleared <Sym n="check" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAdvanceStep}
                      className="text-xs font-semibold bg-black hover:bg-black/85 text-white px-3 py-1.5 rounded-full shadow-xs transition-colors cursor-pointer"
                    >
                      Trigger Step 15 Gate
                    </button>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-black block">
                      Tertiary Hub OT Slot Coordination (RCC Varanasi):
                    </span>
                    <span className="text-xs text-slate-600">
                      Window: Days 38–44 · UP-RTC Bus Pass &amp; Dharamshala Accomp.
                    </span>
                  </div>
                  {slotConfirmed ? (
                    <span className="text-xs font-bold bg-[#DBFE87] text-black px-2.5 py-1 rounded-full border border-[#c4e872]">
                      Slot Confirmed (Day 41) <Sym n="check" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmSlot}
                      className="text-xs font-semibold bg-[#BA2D0B] hover:bg-[#a02609] text-white px-3 py-1.5 rounded-full shadow-xs transition-colors cursor-pointer"
                    >
                      Confirm Hub OT Slot
                    </button>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Attending Radiation Oncologist:</span>
                    <strong className="text-black">{activeCase.doctor}</strong>
                  </div>
                  <span className="font-mono text-black bg-[#DBFE87] px-2.5 py-0.5 rounded-full font-bold">
                    Signed &amp; Vaulted
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tablet Footer */}
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between font-mono">
            <span>DPDP Zero-Knowledge AES-256 Vaulted</span>
            <span>CareUI v2.0 · CDSCO SaMD Safe</span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* RIGHT VIEWPORT: PATIENT MOBILE PHONE (Realistic Smartphone) */}
        {/* ======================================================== */}
        <section className="lg:col-span-5 flex flex-col items-center">
          {/* Smartphone Hardware Frame */}
          <div className="w-full max-w-[395px] h-[820px] rounded-[2.75rem] border-[7px] border-slate-900 shadow-2xl bg-white flex flex-col overflow-hidden relative">
            {/* Dynamic Island / Camera Notch */}
            <div className="w-full bg-slate-900 pt-2 pb-1.5 px-6 flex items-center justify-between text-white text-xs select-none">
              <span className="font-semibold text-xs">09:41</span>
              <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center">
                <span className="size-2 rounded-full bg-[#DBFE87] animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Mobile App Header Bar */}
            <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-white border border-[#0F766E]/30 flex items-center justify-center">
                  <CerviSetuLogo size={22} />
                </div>
                <div>
                  <span className="font-bold text-xs text-black block leading-none">CerviSetu Co-Pilot</span>
                  <span className="text-xs text-slate-500">Patient Companion</span>
                </div>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPhoneLang("hi")}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    phoneLang === "hi" ? "bg-white text-black shadow-xs font-bold" : "text-slate-500 hover:text-black"
                  }`}
                >
                  हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneLang("en")}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    phoneLang === "en" ? "bg-white text-black shadow-xs font-bold" : "text-slate-500 hover:text-black"
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Scrollable Mobile Phone Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
              {/* Phone Live Notification Toast */}
              {phoneToast && (
                <div className={`p-3 rounded-2xl text-xs border shadow-xs transition-all ${
                  phoneToast.type === "alert"
                    ? "bg-[#BA2D0B]/10 border-[#BA2D0B]/30 text-[#BA2D0B]"
                    : phoneToast.type === "info"
                    ? "bg-[#90C3CB]/20 border-[#90C3CB]/40 text-black"
                    : "bg-[#DBFE87]/40 border-[#c4e872] text-black"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="block font-bold">{phoneToast.title}</strong>
                      <span className="block text-slate-700 mt-0.5 leading-snug">{phoneToast.desc}</span>
                    </div>
                    <button onClick={() => setPhoneToast(null)} className="text-slate-400 hover:text-black text-xs font-bold cursor-pointer">
                      <Sym n="x" />
                    </button>
                  </div>
                </div>
              )}

              {/* Card 1: Patient ID Banner */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-xs text-black bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {activeCase.token}
                  </span>
                  <span className="text-xs bg-[#DBFE87] text-black border border-[#c4e872] px-2 py-0.5 rounded-full font-bold">
                    {activeCase.stage}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3 text-slate-400 shrink-0" />
                    <span className="truncate">{activeCase.centre}</span>
                  </div>
                  <div className="text-slate-500">
                    <span className="font-semibold text-black">{phoneLang === "hi" ? "प्रभारी चिकित्सक:" : "Doctor:"}</span> {activeCase.doctor}
                  </div>
                </div>
              </div>

              {/* Card 2: 29-Step Visual Healing Clock Stepper */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-black bg-[#DBFE87] px-2 py-0.5 rounded-full">
                      {phoneLang === "hi" ? "उपचार यात्रा" : "Healing Clock"}
                    </span>
                    <h4 className="text-sm font-bold text-black mt-1">
                      {clockSteps} / 29 {phoneLang === "hi" ? "चरण पूर्ण" : "Steps Done"}
                    </h4>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-full">
                    {Math.round((clockSteps / 29) * 100)}%
                  </span>
                </div>

                {/* 3 Step Milestone Pathway */}
                <div className="space-y-3 pl-1 mb-4">
                  {/* Step 1: EBRT */}
                  <div className="flex items-start gap-2.5 relative">
                    <div className="flex flex-col items-center">
                      <div className="size-5 rounded-full bg-[#DBFE87] border border-black flex items-center justify-center shrink-0">
                        <Check className="size-3 text-black stroke-[3]" />
                      </div>
                      <div className="w-0.5 h-8 bg-slate-200 mt-1" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-black">
                          {phoneLang === "hi" ? "1. बाहरी विकिरण (EBRT)" : "1. EBRT (Fractions 1–25)"}
                        </span>
                        <span className="text-xs font-bold text-black bg-[#DBFE87] px-1.5 py-0.2 rounded-full">
                          14/25
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {phoneLang === "hi" ? "मिर्ज़ापुर डेकेयर पर दैनिक सिकाई" : "Daily spoke radiation fractions"}
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Day-21 PAC Gate */}
                  <div className="flex items-start gap-2.5 relative">
                    <div className="flex flex-col items-center">
                      <div className="size-5 rounded-full bg-[#F19941] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CircleDot className="size-3 animate-pulse" />
                      </div>
                      <div className="w-0.5 h-8 bg-slate-200 mt-1" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-black">
                          {phoneLang === "hi" ? "2. Day-21 PAC चेकलिस्ट" : "2. Day-21 PAC Gate (Frac 15)"}
                        </span>
                        {clockSteps < 15 ? (
                          <button
                            type="button"
                            onClick={handleAdvanceStep}
                            className="bg-black hover:bg-black/85 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                          >
                            Frac 15
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-black bg-[#DBFE87] px-1.5 py-0.2 rounded-full">
                            Cleared <Sym n="check" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {phoneLang === "hi" ? "वाराणसी हब स्लॉट विंडो समन्वय" : "Hub slot window Days 38–44"}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: HDR Brachytherapy */}
                  <div className="flex items-start gap-2.5">
                    <div className="size-5 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center shrink-0">
                      <span className="size-1.5 rounded-full bg-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          {phoneLang === "hi" ? "3. अंदरूनी ब्रैकीथेरेपी" : "3. HDR Brachytherapy"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full">
                          {slotConfirmed ? "Day 41 Locked" : "Pending Slot"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {phoneLang === "hi" ? "वाराणसी कैंसर सेंटर (मुफ्त बस + कमरा)" : "RCC Hub (~75 km route)"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Visual Fraction Track (5x5 grid) */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-black">
                      {phoneLang === "hi" ? "सिकाई ट्रैकर (1–25)" : "Fractions Track (1–25)"}
                    </span>
                    <span className="text-xs text-slate-500">14 Done</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const fNum = i + 1;
                      const isDone = fNum <= clockSteps;
                      const isCurrent = fNum === clockSteps + 1;
                      return (
                        <div
                          key={i}
                          className={`h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${
                            isDone
                              ? "bg-[#DBFE87] border-[#c4e872] text-black"
                              : isCurrent
                              ? "bg-[#F19941] border-[#F19941] text-white ring-2 ring-[#F19941] ring-offset-1"
                              : fNum === 15
                              ? "bg-[#F19941]/20 border-[#F19941]/50 text-[#BA2D0B]"
                              : "bg-white border-slate-200 text-slate-400 font-normal"
                          }`}
                        >
                          {fNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile OTT Projection Tag */}
                <div className="bg-[#DBFE87]/30 border border-[#c4e872] p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-black">
                    {phoneLang === "hi" ? "अनुमानित समापन:" : "Projected Finish:"}
                  </span>
                  <strong className="font-bold text-black font-mono">
                    {activeCase.projectedFinishDays} Days (≤49d On-Track)
                  </strong>
                </div>
              </div>

              {/* Card 3: Pre-Chemo Hydration Guard */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Heart className="size-4 text-[#BA2D0B]" />
                    <span className="text-xs font-bold text-black">
                      {phoneLang === "hi" ? "कीमो जल सेवन सलाह" : "Pre-Chemo Hydration"}
                    </span>
                  </div>
                  <span className="text-xs bg-[#DBFE87] text-black border border-[#c4e872] px-2 py-0.5 rounded-full font-bold">
                    eGFR Safe
                  </span>
                </div>

                <div className="bg-[#90C3CB]/20 rounded-xl p-3 border border-[#90C3CB]/40 text-xs text-black font-medium leading-relaxed mb-2.5">
                  {phoneLang === "hi"
                    ? "कल की कीमोथेरेपी के लिए 2.5 से 3 लीटर पानी/तरल लें और रक्त जांच (CBC/RFT) पर्ची साथ लाएं।"
                    : "Drink 2.5 to 3 liters of fluids before chemo tomorrow and bring your latest CBC/RFT report."}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Centre Protocol</span>
                  <span className="font-semibold text-black">Sister Anjali (Nurse)</span>
                </div>
              </div>

              {/* Card 4: Compassionate Symptom Triage Buttons */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <span className="text-xs font-bold text-black block mb-1">
                  {phoneLang === "hi" ? "लक्षण जांच (Triage)" : "Symptom Quick Check"}
                </span>
                <span className="text-xs text-slate-500 block mb-3">
                  {phoneLang === "hi" ? "यदि कोई परेशानी हो तो तुरंत बताएं:" : "Tap any symptom for instant guidance:"}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleReportSymptom("mild")}
                    className="p-2.5 bg-slate-50 hover:bg-[#90C3CB]/20 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-black block"><Sym n="droplet" /> {phoneLang === "hi" ? "हल्के दस्त" : "Mild Diarrhea"}</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Grade 1 · ORS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReportSymptom("severe")}
                    className="p-2.5 bg-[#BA2D0B]/10 hover:bg-[#BA2D0B]/20 border border-[#BA2D0B]/30 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-[#BA2D0B] block"><Sym n="alert" /> {phoneLang === "hi" ? "गंभीर दस्त" : "Severe Diarrhea"}</span>
                    <span className="text-xs text-[#BA2D0B]/80 block mt-0.5">Grade 2+ · Nurse Alert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReportSymptom("mild")}
                    className="p-2.5 bg-slate-50 hover:bg-[#F19941]/20 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-black block"><Sym n="flame" /> {phoneLang === "hi" ? "पेशाब जलन" : "Burning"}</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Grade 1 · Fluids</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReportSymptom("severe")}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-black block"><Sym n="zap" /> {phoneLang === "hi" ? "थकान/कमजोरी" : "Fatigue"}</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Grade 2 · Hb Review</span>
                  </button>
                </div>
              </div>

              {/* Card 5: Travel Voucher & Audio Player */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
                {/* Audio Player in Stark Black */}
                <div className="bg-black text-white rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#F19941] text-black flex items-center justify-center">
                        <Volume2 className="size-4 text-black" />
                      </div>
                      <span className="text-xs font-bold text-white">
                        {phoneLang === "hi" ? "ब्रैकीथेरेपी ऑडियो सलाह" : "Brachy Audio Reassurance"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="size-8 rounded-full bg-[#F19941] hover:bg-[#e08933] text-black flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    >
                      {isPlayingAudio ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
                    </button>
                  </div>

                  {isPlayingAudio && (
                    <div className="w-full bg-slate-800 rounded-full h-1 mb-2 overflow-hidden">
                      <div className="bg-[#DBFE87] h-1 rounded-full transition-all duration-300" style={{ width: `${audioProgress}%` }} />
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-snug">
                    {phoneLang === "hi"
                      ? "'ब्रैकीथेरेपी के दौरान डॉक्टरों की टीम निश्चेतना (एनेस्थीसिया) व दर्द-निवारक व्यवस्था रखती है। घबराएं नहीं।'"
                      : "'During brachytherapy, the medical team provides anesthesia and pain relief. Please do not fear the procedure.'"}
                  </p>
                </div>

                {/* State Bus & Dharamshala Pass */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-[#90C3CB]/20 rounded-xl border border-[#90C3CB]/40">
                    <span className="font-bold text-black block"><Sym n="bus" /> {phoneLang === "hi" ? "रोडवेज बस" : "Bus Voucher"}</span>
                    <strong className="font-mono text-black block mt-0.5">
                      {slotConfirmed ? "UP-RTC-7891" : (phoneLang === "hi" ? "लंबित" : "Pending")}
                    </strong>
                    <span className="text-xs text-slate-600 block mt-0.5">Mirzapur → Varanasi</span>
                  </div>

                  <div className="p-2.5 bg-[#F19941]/20 rounded-xl border border-[#F19941]/40">
                    <span className="font-bold text-black block"><Sym n="home" /> {phoneLang === "hi" ? "धर्मशाला" : "Dharamshala"}</span>
                    <strong className="font-mono text-black block mt-0.5">
                      {slotConfirmed ? "ROOM-402" : (phoneLang === "hi" ? "लंबित" : "Pending")}
                    </strong>
                    <span className="text-xs text-slate-600 block mt-0.5">RCC Varanasi Campus</span>
                  </div>
                </div>

                {slotConfirmed ? (
                  <button
                    type="button"
                    onClick={() => setShowPassModal(true)}
                    className="w-full py-2 bg-black hover:bg-black/85 text-white rounded-full text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="size-3.5" />
                    <span>{phoneLang === "hi" ? "डिजिटल पास व QR कोड देखें" : "View Digital Boarding Pass"}</span>
                  </button>
                ) : (
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                    {phoneLang === "hi" ? "हब OT स्लॉट पुष्टि पर पास अनलॉक होगा" : "Boarding pass unlocks after Hub OT confirmation"}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Hardware Home Indicator Bar */}
            <div className="bg-white py-2 flex items-center justify-center shrink-0 border-t border-slate-100">
              <div className="w-28 h-1 bg-slate-300 rounded-full" />
            </div>
          </div>
        </section>
      </div>

      {/* Digital Boarding Pass Modal */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-black shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-black bg-[#DBFE87] border border-[#c4e872] px-2 py-0.5 rounded-full">
                  UP Cancer Care Protocol
                </span>
                <h3 className="text-base font-bold mt-1 text-black">
                  {phoneLang === "hi" ? "यात्रा व धर्मशाला बोर्डिंग पास" : "Travel & Dharamshala Pass"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="size-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                <Sym n="x" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Token ID:</span>
                <strong className="font-mono text-sm text-black">{activeCase.token}</strong>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Hub-Spoke Transit Route:</span>
                <strong className="text-black text-xs block mt-0.5">
                  Mirzapur Spoke Clinic → RCC Varanasi Hub (~75 km)
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs">Bus Voucher:</span>
                  <strong className="font-mono text-black text-xs">UP-RTC-7891</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs">Dharamshala:</span>
                  <strong className="font-mono text-black text-xs">ROOM-402</strong>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200">
                <QrCode className="size-24 text-black" />
                <span className="text-xs font-mono text-slate-500 mt-2">Validity: Days 38–44</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert("Boarding pass saved to device (Simulated PDF).");
                setShowPassModal(false);
              }}
              className="mt-4 w-full py-2.5 bg-black hover:bg-black/85 text-white rounded-full font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="size-3.5" /> Download Digital Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
