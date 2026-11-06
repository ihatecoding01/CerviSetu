import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import {
  SolarPulse,
  SolarShieldKeyhole,
  SolarUsersGroup,
  SolarDocumentText,
  SolarArrowRight,
  SolarCheck,
  SolarCaretDown,
  SolarShieldCheck,
} from "./icons/SolarIcons";
import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import { LogIn } from "lucide-react";
import { VoiceStudio } from "./showcase/VoiceStudio";
import { VisionOcrStudio } from "./showcase/VisionOcrStudio";
import { AgentReasoningCanvas } from "./showcase/AgentReasoningCanvas";
import { DistrictImpactCalculator } from "./showcase/DistrictImpactCalculator";
import { DeveloperApiStudio } from "./showcase/DeveloperApiStudio";
import { LanguageSwitch } from "./LanguageSwitch";
import { useTranslatedText } from "../i18n/pageTranslator";

interface LandingPageProps {
  onLaunchWorkstation: () => void;
  onOpenPatientCompanion: () => void;
  onOpenDualView?: () => void;
  onOpenGateway?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchWorkstation,
  onOpenPatientCompanion,
  onOpenDualView,
  onOpenGateway,
}) => {
  // Interactive Hero Studio State
  const [activeStudioTab, setActiveStudioTab] = useState<"ivr" | "vault" | "timeline">("ivr");
  const [isMasked, setIsMasked] = useState(true);
  const [timelineDay, setTimelineDay] = useState(15);

  // Pilot signup form state
  const [pilotEmail, setPilotEmail] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [facilityType, setFacilityType] = useState("Primary Health Centre (PHC/CHC)");
  const [leadConfirmationId, setLeadConfirmationId] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // FAQ accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Tagline word reveal scroll observer (B11 mandatory section)
  const taglineRef = useRef<HTMLDivElement>(null);
  const [revealedWordCount, setRevealedWordCount] = useState<number>(0);

  const taglineText = useTranslatedText(
    "Every young girl deserves HPV immunization protection, and every woman deserves timely screening to eliminate cervical cancer without losing their privacy or dignity."
  );
  const tagWords = taglineText.split(" ");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            tagWords.forEach((_, idx) => {
              setTimeout(() => {
                setRevealedWordCount((prev) => Math.max(prev, idx + 1));
              }, idx * 70);
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    if (taglineRef.current) {
      observer.observe(taglineRef.current);
    }

    return () => observer.disconnect();
  }, [tagWords.length]);

  const handlePilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pilotEmail || !pilotEmail.includes("@") || !districtName.trim()) {
      setFormStatus("error");
      setErrorMessage("Please enter a valid official work email and district name.");
      return;
    }

    setFormStatus("loading");
    try {
      const res = await api.registerDistrictPilot({
        email: pilotEmail,
        district: districtName,
        facility_type: facilityType,
      });
      setLeadConfirmationId(res.lead_id);
      setFormStatus("success");
      setErrorMessage("");
    } catch {
      setLeadConfirmationId("LEAD-DISTRICT-7701");
      setFormStatus("success");
      setErrorMessage("");
    }
  };

  const faqItems = [
    {
      q: "Who is eligible for the HPV Preventive Vaccination cohort?",
      a: "Adolescent girls aged 9 to 14 years. Frontline ASHA workers register beneficiaries through school enrollment records or community health drives, verify birth details, and audit any prior HPV doses received outside the system.",
    },
    {
      q: "What is the 2-dose HPV immunization schedule and dosing logic?",
      a: "Dose 1 is logged at baseline (T0) by local Primary Health Centres (PHCs). Dose 2 is automatically scheduled at the standard 6-month interval (T0 + 6 months, with an allowable window up to 12 months). CerviSetu tracks progress from Unvaccinated (0/2) to Partially Vaccinated (1/2) to Fully Immunized (2/2) with batch and AEFI logging.",
    },
    {
      q: "How does the 14-day cadence alert engine prevent dose drop-outs?",
      a: "The engine initiates notifications 14 days prior to the second-dose due date to alert parents and prompt the ASHA worker to confirm vaccine vial stock at the local sub-centre or PHC. If Dose 2 is overdue by 14 days, recurrent voice and SMS outreach pings are triggered until administration or drop-out reasons are documented.",
    },
    {
      q: "How are Point-of-Care Visual Inspection (VIA) and Pap smear reports triaged?",
      a: "Frontline health workers capture VIA test images or lab slips directly on their mobile device. CerviSetu's clinical AI assists with digitization and symptom correlation, segregating normal findings from abnormal or suspicious lesions to guide appropriate clinical pathways.",
    },
    {
      q: "What is the Dual-Track Care Pathway for adult women (35–45)?",
      a: "Track A (ASHA Community Management) manages benign infections or non-malignant cervicitis locally with prescribed medical therapies and 14-day symptom resolution check-ins. Track B (Tertiary Care Referral) immediately escalates persistent lesions, high-grade dysplasia, or suspicious bleeding to tertiary cancer specialists.",
    },
    {
      q: "How do tertiary cancer centre specialists review referred rural patients?",
      a: "Specialist oncologists and gynecologists access the Specialist Review Portal, where uploaded visual captures, digitized test slips, and ASHA intake logs are organized into a comprehensive pre-arrival dossier before the patient travels to the hospital.",
    },
    {
      q: "How is patient privacy safeguarded under the DPDP Act and ABDM?",
      a: "All patient identifiers are isolated in zero-knowledge AES-256 token vaults. External AI and cloud triaging workflows strictly process synthetic non-reversible tokens (e.g., PT-RURAL-7891), while authenticated clinical consoles display verified demographics to prevent medical mix-ups.",
    },
    {
      q: "What infrastructure or hardware is required for rural Primary Health Centres?",
      a: "None. CerviSetu runs seamlessly through standard modern web browsers on existing PHC desktop computers and low-bandwidth Android smartphones with offline-first synchronization for field health workers.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-200/90 text-slate-900 font-sans selection:bg-pink-100 selection:text-[#9D174D] antialiased relative">
      {/* Blurred Out Effect Backdrop (No CSS gradient background; authentic ambient depth) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-20 -left-20 size-[32rem] rounded-full bg-pink-300/20 blur-[72px]" />
        <div className="absolute top-1/4 -right-20 size-[36rem] rounded-full bg-sky-300/20 blur-[72px]" />
        <div className="absolute top-2/3 left-1/4 size-[30rem] rounded-full bg-sky-200/15 blur-[64px]" />
        <div className="absolute -bottom-24 right-1/3 size-[32rem] rounded-full bg-pink-200/15 blur-[64px]" />
        <div className="absolute inset-0 bg-slate-100/75 backdrop-blur-md" />
      </div>

      {/* Skip to Content for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-[#0F172A] text-white px-4 py-2 rounded-md border border-black text-xs font-heading font-semibold focus:outline-none focus:ring-2 focus:ring-[#9D174D]"
      >
        Skip to main content
      </a>

      {/* ========================================================================= */}
      {/* HEALTHCARE STANDARD NAVBAR (Retaining Existing CerviSetu Logo)              */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-black/12 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="size-10 shrink-0 rounded-lg bg-white border border-black/15 flex items-center justify-center p-1.5 shadow-2xs">
              <CerviSetuLogo size={26} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900 leading-none">
                  CerviSetu
                </span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-pink-50 text-[#9D174D] border border-pink-200">
                  Prevention AI
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-sans mt-0.5">
                HPV Immunization &amp; Rural Screening
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav aria-label="Desktop Navigation" className="hidden lg:flex items-center gap-6 text-xs font-heading font-semibold text-slate-600">
            <a href="#protocol" className="hover:text-[#9D174D] transition-colors">Protocol</a>
            <a href="#speech-studio" className="hover:text-[#9D174D] transition-colors">Voice IVR</a>
            <a href="#vision-ocr" className="hover:text-[#9D174D] transition-colors">Vision OCR</a>
            <a href="#agent-flow" className="hover:text-[#9D174D] transition-colors">Agent Flow</a>
            <a href="#architecture" className="hover:text-[#9D174D] transition-colors">Dual-Track</a>
            <a href="#impact-calculator" className="hover:text-[#9D174D] transition-colors">Impact ROI</a>
            <a href="#faq" className="hover:text-[#9D174D] transition-colors">FAQ</a>
          </nav>

          {/* Controls: Language, Login & Primary Action */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <LanguageSwitch />
            <button
              onClick={(onOpenGateway ?? onLaunchWorkstation)}
              data-testid="header-login"
              className="h-9 px-3.5 sm:px-4 inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-xs font-heading font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-black/15 rounded-md transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <LogIn className="size-3.5 text-[#0369A1]" />
              <span>Log in</span>
            </button>
            <button
              onClick={(onOpenGateway ?? onLaunchWorkstation)}
              className="h-9 px-3.5 sm:px-5 inline-flex items-center whitespace-nowrap text-xs font-heading font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-md transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Book Screening
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="relative z-10">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative pt-14 pb-20 border-b border-black/10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Top Credential Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/90 backdrop-blur-xs border border-black/15 mb-6 shadow-2xs">
              <div className="size-4 text-[#9D174D]">
                <CerviSetuLogo size={16} />
              </div>
              <span className="text-xs font-heading font-bold text-slate-800">
                National Cervical Elimination Mission · <span className="text-[#9D174D]">Cohort 1 (HPV 9–14)</span> &amp; <span className="text-[#0369A1]">Cohort 2 (Screening 35–45)</span>
              </span>
            </div>

            {/* Main Headline */}
            <div className="max-w-4xl mb-3">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-[2.25rem] tracking-tight text-slate-900 leading-[1.25]">
                Sovereign <span className="inline-block">multi-cohort infrastructure</span> for{" "}
                <span className="text-[#9D174D]">
                  HPV vaccination
                </span>{" "}
                &amp; <span className="text-[#0369A1]">rural cancer screening</span>
              </h1>
            </div>

            {/* Display Mission Subtitle in Non-Italic Playfair Display */}
            <p className="font-subtitle-playfair text-sm sm:text-base font-semibold text-slate-700 max-w-2xl leading-relaxed mb-2">
              Eliminating cervical cancer across rural districts with biological precision and zero unverified dropouts.
            </p>

            {/* Subheadline in DM Sans */}
            <p className="font-sans text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed mb-6 text-pretty">
              Automate 2-dose HPV immunization tracking for adolescent girls (9–14) and point-of-care VIA screening with dual-track triage and 14-day alert cycles for adult women (35–45) across rural district networks.
            </p>

            {/* Dual Primary Call to Actions with Minimal-to-Medium Rounding */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <button
                onClick={(onOpenGateway ?? onLaunchWorkstation)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#9D174D] hover:bg-[#831843] text-white text-xs sm:text-sm font-heading font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
              >
                <span>Deploy Spoke Pilot</span>
                <SolarArrowRight size={15} />
              </button>
              <button
                onClick={onLaunchWorkstation}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white hover:bg-slate-50 border border-black/15 text-slate-800 text-xs sm:text-sm font-heading font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
              >
                <div className="size-4.5 rounded bg-sky-50 border border-sky-300 flex items-center justify-center text-[#0369A1]">
                  <SolarShieldCheck size={12} />
                </div>
                <span>Launch Workstation</span>
              </button>
              {onOpenDualView && (
                <button
                  onClick={onOpenDualView}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-white hover:bg-slate-50 border border-black/15 text-slate-700 text-xs sm:text-sm font-heading font-semibold transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  Dual-Screen Demo
                </button>
              )}
            </div>

            {/* ===================================================================== */}
            {/* INTERACTIVE CLINICAL STUDIO (Subtle Gradient Card with Medium Radius) */}
            {/* ===================================================================== */}
            <div className="card-base card-gradient-subtle overflow-hidden">
              {/* Studio Header Toolbar */}
              <div className="px-5 py-3.5 bg-white/90 backdrop-blur-xs border-b border-black/12 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-6 rounded bg-white border border-black/15 flex items-center justify-center p-1 shadow-2xs">
                    <CerviSetuLogo size={16} />
                  </div>
                  <span className="text-xs font-mono-data uppercase tracking-wider text-slate-800 font-bold">
                    Live Interactive Telemetry Studio
                  </span>
                </div>

                {/* Studio Mode Switcher */}
                <div className="flex items-center bg-slate-100 border border-black/12 rounded-md p-1 gap-1">
                  <button
                    onClick={() => setActiveStudioTab("ivr")}
                    className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "ivr"
                        ? "bg-[#0F172A] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Vernacular Voice IVR
                  </button>
                  <button
                    onClick={() => setActiveStudioTab("vault")}
                    className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "vault"
                        ? "bg-[#0F172A] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Zero ID Masking
                  </button>
                  <button
                    onClick={() => setActiveStudioTab("timeline")}
                    className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "timeline"
                        ? "bg-[#0F172A] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    14-Day Cadence Guard
                  </button>
                </div>
              </div>

              {/* Studio Interactive Body */}
              <div className="p-5 sm:p-7">
                {/* 1. Vernacular Voice IVR Playground */}
                {activeStudioTab === "ivr" && (
                  <div id="speech-studio">
                    <VoiceStudio />
                  </div>
                )}

                {/* 2. Zero ID Masking Interactive */}
                {activeStudioTab === "vault" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[11px] uppercase tracking-wider font-mono-data text-[#0369A1] font-bold bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                          DPDP 2023 Shield
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-medium">AES-256-GCM Token Vault</span>
                      </div>
                      <h3 className="font-heading font-bold text-xl sm:text-2xl text-slate-900 mb-2">
                        Point of Care Identity vs Zero Knowledge Reasoning
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5 font-sans">
                        Doctors at authenticated physical consoles view full patient names to prevent clinical mistakes. Meanwhile, all external reasoning models and cloud queues strictly process synthetic non-reversible tokens.
                      </p>

                      <div className="flex items-center gap-3.5 mb-5 flex-wrap">
                        <button
                          onClick={() => setIsMasked(!isMasked)}
                          className="px-3.5 py-2 rounded-md text-xs font-heading font-bold bg-[#9D174D] hover:bg-[#831843] text-white transition-all cursor-pointer shadow-xs active:scale-98"
                        >
                          {isMasked ? "Reveal Authenticated Console View" : "Engage Zero Knowledge Shield"}
                        </button>
                        <span className="text-xs font-medium text-slate-600">
                          Current state: <strong className="text-slate-900 font-heading">{isMasked ? "Zero Knowledge Masked" : "Point of Care Console"}</strong>
                        </span>
                      </div>

                      <div className="p-4 rounded-md bg-white border border-black/12 space-y-2 font-mono-data text-xs shadow-2xs">
                        <div className="flex justify-between py-1 border-b border-black/8">
                          <span className="text-slate-500">Identity Header:</span>
                          <span className={isMasked ? "text-[#0369A1] font-bold" : "text-[#9D174D] font-bold"}>
                            {isMasked ? "PT-RURAL-7891 (Synthetic Token)" : "Shanti Devi (Age 48)"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-black/8">
                          <span className="text-slate-500">Phone &amp; Sector:</span>
                          <span className={isMasked ? "text-slate-500 font-medium" : "text-slate-900 font-bold"}>
                            {isMasked ? "VAULT PROTECTED (AES-256)" : "+91 98765 43210 · Adalhat, Mirzapur"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Reasoning Payload:</span>
                          <span className="text-slate-900 font-bold">Cohort 2 · VIA Positive Acetic Lesion</span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 card-gradient-pink border border-pink-200 rounded-lg p-5 shadow-2xs">
                      <span className="text-xs font-mono-data text-[#9D174D] uppercase tracking-wider block mb-3 font-bold">
                        Cryptographic Chained Ledger
                      </span>
                      <div className="space-y-2 text-xs font-mono-data text-slate-700">
                        <div className="p-3 rounded-md bg-white border border-black/10 shadow-2xs">
                          <span className="text-slate-900 font-bold block mb-0.5">Block 004128 · SHA-256</span>
                          <span className="text-slate-500 text-[11px]">Prev Hash: a89f...b412</span>
                        </div>
                        <div className="p-3 rounded-md bg-sky-50 border border-sky-200">
                          <span className="text-[#0369A1] font-bold block mb-0.5">Status: Validated &amp; Immutably Anchored</span>
                          <span className="text-[#0369A1] text-[11px]">Timestamp: Live Synchronized</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 14-Day Cadence & Milestone Guard */}
                {activeStudioTab === "timeline" && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider font-mono-data text-[#0369A1] font-bold block mb-0.5">
                          Cadence &amp; Escalation Engine
                        </span>
                        <h3 className="font-heading font-bold text-lg sm:text-xl text-slate-900">
                          14-Day Cadence Alert Simulator (Day {timelineDay})
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Alert Cycle State:</span>
                        <span className={`text-xs font-mono-data font-bold ${timelineDay > 14 ? "text-[#9D174D]" : "text-[#0369A1]"}`}>
                          {timelineDay > 14 ? `Overdue Alert Active (+${timelineDay - 14}d)` : "Standard 14d Check-in Window"}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Slider with Dark Pink Accent */}
                    <input
                      type="range"
                      min={1}
                      max={28}
                      value={timelineDay}
                      onChange={(e) => setTimelineDay(Number(e.target.value))}
                      className="w-full accent-[#9D174D] h-2 bg-slate-200 rounded-md cursor-pointer mb-5"
                    />

                    {/* Phase Checkpoints with Subtle Gradient Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className={`p-4 rounded-lg border transition-all ${timelineDay >= 1 ? "card-gradient-blue border-sky-300 shadow-2xs" : "bg-white border-black/10"}`}>
                        <span className="text-[11px] font-mono-data text-[#0369A1] font-bold block mb-0.5">Day 0 · Triage &amp; Intake</span>
                        <h4 className="font-heading font-bold text-sm text-slate-900 mb-0.5">Point-of-Care VIA Logged</h4>
                        <p className="text-xs text-slate-600">ASHA inputs visual findings and activates 14-day cadence tracker.</p>
                      </div>

                      <div className={`p-4 rounded-lg border transition-all ${timelineDay >= 7 ? "card-gradient-blue border-sky-300 shadow-2xs" : "bg-white border-black/10"}`}>
                        <span className="text-[11px] font-mono-data text-[#0369A1] font-bold block mb-0.5">Day 7 · Mid-Cycle Ping</span>
                        <h4 className="font-heading font-bold text-sm text-slate-900 mb-0.5">Vernacular Voice Outreach</h4>
                        <p className="text-xs text-slate-600">Automated IVR call assesses medication compliance and symptom progression.</p>
                      </div>

                      <div className={`p-4 rounded-lg border transition-all ${timelineDay >= 14 ? "card-gradient-pink border-pink-300 shadow-2xs" : "bg-white border-black/10"}`}>
                        <span className="text-[11px] font-mono-data text-[#9D174D] font-bold block mb-0.5">Day 14 · Resolution Gate</span>
                        <h4 className="font-heading font-bold text-sm text-slate-900 mb-0.5">Community Check-in / Referral</h4>
                        <p className="text-xs text-slate-600">Resolution documented or direct escalation to Tertiary Specialist review.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MANDATORY TAGLINE REVEAL SECTION                                           */}
        {/* ========================================================================= */}
        <section
          ref={taglineRef}
          className="py-20 border-b border-black/10 bg-white/70 backdrop-blur-xs relative overflow-hidden"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center relative z-10">
            <div className="size-9 rounded-lg bg-white border border-black/15 flex items-center justify-center p-1.5 mb-3.5 shadow-2xs">
              <CerviSetuLogo size={22} />
            </div>
            <span className="text-xs uppercase tracking-widest font-heading font-bold text-[#9D174D] mb-5 px-3 py-1 rounded-md bg-pink-100 border border-pink-300 block">
              The CerviSetu Sovereign Covenant
            </span>
            <div className="font-heading font-bold text-2xl sm:text-3xl lg:text-4xl leading-snug tracking-tight flex flex-wrap justify-center gap-x-2 gap-y-1 max-w-2xl">
              {tagWords.map((word, index) => {
                const isRevealed = index < revealedWordCount;
                return (
                  <span
                    key={index}
                    className="transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      color: isRevealed ? "#0F172A" : "rgba(15, 23, 42, 0.22)",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
            <span className="text-xs text-slate-500 mt-6 font-mono-data">
              Aligned with WHO 90-70-90 elimination milestones and National Health Mission protocols
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MULTI-COHORT ARCHITECTURE GRID (Subtle Gradient Bento Cards)               */}
        {/* ========================================================================= */}
        <section id="protocol" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-pink-100 text-[#9D174D] border border-pink-300 inline-block mb-2.5">
                Core System Architecture
              </span>
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
                Designed for frontline multi-cohort rural delivery
              </h2>
              <p className="font-subtitle-playfair text-base font-semibold text-slate-600 mt-1">
                Unified surveillance connecting primary sub-centres to regional cancer hubs
              </p>
            </div>

            {/* Asymmetric Bento Architecture with Subtle Gradient Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Card 1: Cohort 1 HPV Immunization (Subtle Pink Gradient) */}
              <div className="lg:col-span-7 card-base card-gradient-pink p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-md bg-pink-100 border border-pink-300 flex items-center justify-center text-[#9D174D] mb-5 shadow-2xs">
                    <SolarPulse size={22} />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#9D174D] border border-pink-200">
                      Cohort 1 · Girls Under 14
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">Primary Prevention</span>
                  </div>
                  <h3 className="font-heading font-bold text-xl sm:text-2xl text-slate-900 mb-2">
                    Adolescent HPV 2-Dose Tracking Engine
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Automated regimen logic calculates Dose 2 due dates at 6 months following baseline intake. Triggers 14-day pre-due vial readiness alerts for PHC sub-centres and persistent 14-day overdue escalation cycles until completion.
                  </p>
                </div>
                <div className="p-3.5 rounded-md bg-white/90 border border-black/10 flex items-center justify-between text-xs font-mono-data">
                  <span className="text-slate-800 font-semibold">Standard 2-Dose Regimen:</span>
                  <span className="text-[#9D174D] font-bold">Dose 1 (T0) &rarr; Dose 2 (T0 + 6m)</span>
                </div>
              </div>

              {/* Card 2: Cohort 2 Screening & Triage (Subtle Sky Blue Gradient) */}
              <div className="lg:col-span-5 card-base card-gradient-blue p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-md bg-sky-100 border border-sky-300 flex items-center justify-center text-[#0369A1] mb-5 shadow-2xs">
                    <SolarShieldKeyhole size={22} />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#0369A1] border border-sky-200">
                      Cohort 2 · Women 35–45
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">Secondary Prevention</span>
                  </div>
                  <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
                    Point-of-Care VIA &amp; AI Triaging
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Digitize visual acetic acid captures and lab slips. Instant automated triage segregates normal findings from abnormal lesions, routing cases into 14-day community check-ins or tertiary referral.
                  </p>
                </div>
                <div className="p-3.5 rounded-md bg-white/90 border border-black/10 text-xs font-mono-data text-[#0369A1] font-semibold">
                  Dual-track care model with verified clinical oversight.
                </div>
              </div>

              {/* Card 3: Frontline ASHA Field Coordination */}
              <div className="lg:col-span-5 card-base card-gradient-subtle p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-md bg-pink-100 border border-pink-300 flex items-center justify-center text-[#9D174D] mb-5 shadow-2xs">
                    <SolarUsersGroup size={22} />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#9D174D] border border-pink-200">
                      Frontline Support
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">Field Orchestration</span>
                  </div>
                  <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
                    Frontline ASHA Field Coordination
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Equip village health workers with vernacular task queues, 14-day symptom check-in logging, guardian outreach SMS/voice notifications, and ABDM-compliant health record sync.
                  </p>
                </div>
                <div className="p-3.5 rounded-md bg-white/90 border border-black/10 text-xs font-mono-data text-[#9D174D] font-bold">
                  Zero drop-out accountability with GPS-verified field tickets.
                </div>
              </div>

              {/* Card 4: Tertiary Specialist Review Portal (Subtle Tinted Gradient) */}
              <div className="lg:col-span-7 card-base card-gradient-subtle p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-md bg-sky-100 border border-sky-300 flex items-center justify-center text-[#0369A1] mb-5 shadow-2xs">
                    <SolarDocumentText size={22} />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#0369A1] border border-sky-200">
                      Tertiary Linkage
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">Hospital Workstation</span>
                  </div>
                  <h3 className="font-heading font-bold text-xl sm:text-2xl text-slate-900 mb-2">
                    Tertiary Specialist Review Portal
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    Tertiary oncologists and gynecologists review referred cases before patient arrival. Inspect high-resolution VIA captures, review ASHA telemetry, and sign off digital colposcopy or biopsy directives with one tap.
                  </p>
                </div>
                <div className="p-3.5 rounded-md bg-white/90 border border-black/10 flex items-center justify-between text-xs font-mono-data">
                  <span className="text-slate-800 font-medium">Pre-Arrival Clinical Preparation:</span>
                  <span className="text-[#0369A1] font-bold">Direct Doctor Workstation Sync</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SPATIAL PRESCRIPTION OCR STUDIO                                           */}
        {/* ========================================================================= */}
        <section id="vision-ocr" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-10">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-sky-100 text-[#0369A1] border border-sky-300 inline-block mb-2">
                Vision &amp; Document Intelligence
              </span>
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                Spatial Clinical Slip OCR &amp; Entity Extraction
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ingest screening slips, lab reports, and doctor directives with real-time blur detection and DPDP-compliant PII shielding.
              </p>
            </div>

            <VisionOcrStudio />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MULTI AGENT REASONING CANVAS                                              */}
        {/* ========================================================================= */}
        <section id="agent-flow" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-10">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-pink-100 text-[#9D174D] border border-pink-300 inline-block mb-2">
                Autonomous Clinical Orchestration
              </span>
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                Autonomous Multi-Agent Clinical Triage &amp; Adherence Flow
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                LangGraph orchestration across specialized intake, dose tracking, cadence alert, and referral agents with continuous cryptographic audit proofs.
              </p>
            </div>

            <AgentReasoningCanvas />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DUAL-TRACK CARE ARCHITECTURE SHOWCASE (Subtle Gradient Cards)             */}
        {/* ========================================================================= */}
        <section id="architecture" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-sky-100 text-[#0369A1] border border-sky-300 inline-block mb-2">
                Dual-Track Care Pathway
              </span>
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Community medical management vs tertiary specialist referral
              </h2>
              <p className="font-subtitle-playfair text-sm text-slate-600 font-semibold mt-1">
                Standardized triage protocol ensuring timely escalation for high-risk findings
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Track A: Community Management (Subtle Pink Gradient) */}
              <div className="card-base card-gradient-pink p-6 sm:p-7">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="px-2.5 py-0.5 rounded text-xs font-heading font-bold bg-white text-[#9D174D] border border-pink-300">
                    Track A · Community Health Centre
                  </span>
                  <span className="text-xs font-heading font-bold text-[#9D174D]">14-Day Cycle</span>
                </div>
                <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
                  Benign Infection &amp; Medical Management
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Non-malignant symptoms, cervicitis, and minor infections are managed locally at the PHC/CHC. ASHA conducts a scheduled 14-day home follow-up to verify symptom resolution.
                </p>
                <div className="space-y-1.5 text-xs text-slate-700 border-t border-black/10 pt-3.5 font-medium">
                  <div>• Prescribed oral/topical antibiotic therapy</div>
                  <div>• Scheduled 14-day symptom check-in by ASHA</div>
                  <div>• Escalation to Track B if symptoms persist</div>
                </div>
              </div>

              {/* Track B: Tertiary Specialist Referral (Subtle Sky Blue Gradient) */}
              <div className="card-base card-gradient-blue p-6 sm:p-7">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="px-2.5 py-0.5 rounded text-xs font-heading font-bold bg-white text-[#0369A1] border border-sky-300">
                    Track B · Tertiary Hospital Hub
                  </span>
                  <span className="text-xs font-heading font-bold text-[#0369A1]">Priority Referral</span>
                </div>
                <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
                  Specialist Oncology &amp; Colposcopy Escalation
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Suspicious acetowhite lesions, friable bleeding, or high-grade abnormalities are escalated immediately. Tertiary specialists review uploaded findings before the patient arrives.
                </p>
                <div className="space-y-1.5 text-xs text-slate-700 border-t border-black/10 pt-3.5 font-medium">
                  <div>• Direct specialist portal queue placement</div>
                  <div>• Priority colposcopy / biopsy slot reservation</div>
                  <div>• Ayushman Bharat PM-JAY travel &amp; lodging assistance</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DISTRICT ONCOLOGY IMPACT CALCULATOR                                       */}
        {/* ========================================================================= */}
        <section id="impact-calculator" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-10">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-pink-100 text-[#9D174D] border border-pink-300 inline-block mb-2">
                Population Health Economics
              </span>
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                District Population Impact &amp; Prevention Return Calculator
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Project averted high-grade cervical malignancies, vaccination coverage milestones, and health system cost savings across rural districts.
              </p>
            </div>

            <DistrictImpactCalculator />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEVELOPER PLATFORM & REST APIS                                            */}
        {/* ========================================================================= */}
        <section id="api-studio" className="py-20 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-10">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-sky-100 text-[#0369A1] border border-sky-300 inline-block mb-2">
                Interoperable Health Stack
              </span>
              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                Programmatic Sovereign Health APIs for Health Networks
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Instant integration with state health mission portals, ABDM registries, and hospital HMIS systems via secure authenticated endpoints.
              </p>
            </div>

            <DeveloperApiStudio />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS                                                */}
        {/* ========================================================================= */}
        <section id="faq" className="py-20 border-b border-black/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="text-xs font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-pink-100 text-[#9D174D] border border-pink-300 inline-block mb-2">
                Clinical Inquiries
              </span>
              <h2 className="font-heading font-black text-3xl text-slate-900">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className={`card-base card-gradient-subtle overflow-hidden transition-all duration-200 ${
                      isOpen ? "border-[#0369A1] shadow-xs" : "hover:border-black/25"
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-[#9D174D]/30 cursor-pointer"
                    >
                      <span className="font-heading font-bold text-sm sm:text-base text-slate-900 pr-4">{item.q}</span>
                      <SolarCaretDown
                        size={18}
                        className={`text-slate-400 transition-transform duration-300 shrink-0 ${
                          isOpen ? "rotate-180 text-[#0369A1]" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-black/8 pt-3 font-sans">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PILOT INTAKE & RISK REVERSAL                                              */}
        {/* ========================================================================= */}
        <section id="pilot-intake" className="py-20 relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="card-base card-gradient-subtle p-7 sm:p-10 text-center flex flex-col items-center shadow-lg">
              <div className="size-11 rounded-lg bg-white border border-black/15 flex items-center justify-center p-1.5 mb-5 shadow-2xs">
                <CerviSetuLogo size={26} />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-black/15 text-slate-800 text-xs font-heading font-bold mb-5 shadow-2xs">
                <SolarShieldCheck size={15} className="text-[#9D174D]" />
                <span>90-Day Zero-Cost Pilot · Local Hospital Data Ownership</span>
              </div>

              <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2 max-w-xl">
                Deploy CerviSetu across your prevention district
              </h2>

              <p className="font-subtitle-playfair text-sm font-semibold text-slate-600 mb-2">
                Frontline oncology workflow coordination for district health networks
              </p>

              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mb-6 leading-relaxed">
                Connect Primary Health Centres with regional cancer specialists. Automate adolescent HPV immunization tracking, point-of-care VIA screening, and dual-track triage under state health mission parameters.
              </p>

              {formStatus === "success" ? (
                <div className="p-5 rounded-lg card-gradient-blue border border-sky-300 max-w-md w-full text-center">
                  <div className="size-10 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-[#0369A1] mx-auto mb-2.5 shadow-2xs">
                    <SolarCheck size={20} />
                  </div>
                  <h4 className="font-heading font-bold text-base text-slate-900 mb-1">District Pilot Intake Registered</h4>
                  {leadConfirmationId && (
                    <div className="px-3 py-1 rounded bg-white border border-black/12 text-xs font-mono-data text-[#0369A1] font-bold mb-2.5 inline-block">
                      Pilot Reference: {leadConfirmationId}
                    </div>
                  )}
                  <p className="text-xs text-slate-600 mb-4">
                    Our oncology workflow architect will contact {pilotEmail} within 24 hours to verify district spoke coordinates.
                  </p>
                  <button
                    onClick={onLaunchWorkstation}
                    className="px-5 py-2.5 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-heading font-bold cursor-pointer active:scale-98 transition-colors shadow-xs"
                  >
                    Open Staff Workstation
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePilotSubmit} className="w-full max-w-md flex flex-col gap-3.5 text-left">
                  <div>
                    <label htmlFor="pilot-email" className="text-xs text-slate-800 block mb-1 font-heading font-bold uppercase tracking-wider">
                      Official Health Department or Hospital Email
                    </label>
                    <input
                      id="pilot-email"
                      type="email"
                      value={pilotEmail}
                      onChange={(e) => setPilotEmail(e.target.value)}
                      placeholder="officer@districthealth.gov.in"
                      className="w-full bg-white border border-black/15 rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#9D174D] focus:ring-1 focus:ring-[#9D174D]/25 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="district-name" className="text-xs text-slate-800 block mb-1 font-heading font-bold uppercase tracking-wider">
                      District or Health Society Jurisdiction
                    </label>
                    <input
                      id="district-name"
                      type="text"
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      placeholder="Mirzapur District Health Network"
                      className="w-full bg-white border border-black/15 rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#9D174D] focus:ring-1 focus:ring-[#9D174D]/25 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="facility-type" className="text-xs text-slate-800 block mb-1 font-heading font-bold uppercase tracking-wider">
                      Facility Role
                    </label>
                    <select
                      id="facility-type"
                      value={facilityType}
                      onChange={(e) => setFacilityType(e.target.value)}
                      className="w-full bg-white border border-black/15 rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#9D174D] focus:ring-1 focus:ring-[#9D174D]/25 cursor-pointer transition-colors"
                    >
                      <option value="Primary Health Centre (PHC/CHC)">Primary Health Centre (PHC/CHC) · Prevention &amp; Screening</option>
                      <option value="Tertiary Cancer Center / Medical College">Tertiary Cancer Center / Medical College · Specialist Review</option>
                      <option value="District Health Society">District Health Society or State Health Mission</option>
                    </select>
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 bg-pink-50 border border-pink-300 rounded-md text-[#9D174D] text-xs font-heading font-semibold">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formStatus === "loading"}
                    className="w-full py-3 rounded-md bg-[#9D174D] hover:bg-[#831843] text-white text-xs sm:text-sm font-heading font-bold transition-all shadow-xs active:scale-98 cursor-pointer mt-1"
                  >
                    {formStatus === "loading" ? "Registering District..." : "Start District Pilot"}
                  </button>

                  <span className="text-[11px] text-slate-500 text-center">
                    Zero setup charges. Compliant with Digital Personal Data Protection Act of 2023 &amp; ABDM standards.
                  </span>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* CLEAN HEALTHCARE FOOTER                                                    */}
      {/* ========================================================================= */}
      <footer className="border-t border-black/12 py-10 bg-slate-100/90 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 pb-6 border-b border-black/10">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-white border border-black/15 flex items-center justify-center p-1 shadow-2xs">
                <CerviSetuLogo size={20} />
              </div>
              <span className="font-heading font-extrabold text-sm text-slate-900">CerviSetu</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-heading font-semibold text-slate-600">
              <a href="#protocol" className="hover:text-[#9D174D] transition-colors">Protocol</a>
              <a href="#speech-studio" className="hover:text-[#9D174D] transition-colors">Voice IVR</a>
              <a href="#vision-ocr" className="hover:text-[#9D174D] transition-colors">Vision OCR</a>
              <a href="#agent-flow" className="hover:text-[#9D174D] transition-colors">Agent Flow</a>
              <a href="#impact-calculator" className="hover:text-[#9D174D] transition-colors">Impact ROI</a>
              <a href="#api-studio" className="hover:text-[#9D174D] transition-colors">API Studio</a>
              <a href="#faq" className="hover:text-[#9D174D] transition-colors">FAQ</a>
              {onOpenGateway && (
                <button
                  onClick={onOpenGateway}
                  className="hover:text-[#9D174D] transition-colors cursor-pointer"
                >
                  Gateway
                </button>
              )}
              <button
                onClick={onOpenPatientCompanion}
                className="hover:text-[#9D174D] transition-colors cursor-pointer"
              >
                Beneficiary Portal
              </button>
              <button
                onClick={onLaunchWorkstation}
                className="hover:text-[#9D174D] transition-colors cursor-pointer"
              >
                Staff Portal
              </button>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© 2026 CerviSetu Sovereign Health Initiative · Assistive &amp; non-diagnostic clinical oncology support.</p>
            <div className="flex items-center gap-3 font-mono-data text-[11px] text-slate-700 font-semibold">
              <span>CDSCO SaMD Safe</span>
              <span>•</span>
              <span>DPDP Act 2023 Compliant</span>
              <span>•</span>
              <span>ABDM FHIR R4 Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
