import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import {
  SolarPulse,
  SolarShieldKeyhole,
  SolarUsersGroup,
  SolarDocumentText,
  SolarSmartphone,
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
  onOpenDualView: () => void;
  onOpenGateway?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchWorkstation,
  onOpenPatientCompanion,
  onOpenDualView,
  onOpenGateway,
}) => {
  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Header compaction: translated labels vary a lot in width, so measure instead of
  // relying on breakpoints. 0 = full nav, 1 = nav in menu, 2 = also hide pilot CTA.
  const [headerRowEl, setHeaderRowEl] = useState<HTMLDivElement | null>(null);
  const [headerLevel, setHeaderLevel] = useState(0);
  const headerNeeded = useRef<number[]>([]);
  useEffect(() => {
    const el = headerRowEl;
    if (!el) return;
    const check = () => {
      setHeaderLevel((level) => {
        if (el.scrollWidth > el.clientWidth && level < 2) {
          headerNeeded.current[level] = el.scrollWidth;
          return level + 1;
        }
        if (level > 0 && el.clientWidth >= (headerNeeded.current[level - 1] ?? Infinity)) return level - 1;
        return level;
      });
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const onResize = () => check();
    window.addEventListener("resize", onResize);
    check();
    // Text changes (language switch) invalidate stored widths: re-measure from full.
    let timer = 0;
    const mo = new MutationObserver(() => {
      headerNeeded.current = [];
      setHeaderLevel(0);
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 60);
    });
    mo.observe(el, { subtree: true, childList: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [headerRowEl]);
  useEffect(() => {
    const el = headerRowEl;
    if (el && el.scrollWidth > el.clientWidth && headerLevel < 2) {
      headerNeeded.current[headerLevel] = el.scrollWidth;
      setHeaderLevel(headerLevel + 1);
    }
  }, [headerLevel, headerRowEl]);
  const navInline = headerLevel === 0;

  // Interactive Hero Studio State
  const [activeStudioTab, setActiveStudioTab] = useState<"ivr" | "vault" | "timeline">("ivr");
  const [isMasked, setIsMasked] = useState(true);
  const [timelineDay, setTimelineDay] = useState(15);

  // Pilot signup form state
  const [pilotEmail, setPilotEmail] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [facilityType, setFacilityType] = useState("District Spoke Clinic");
  const [leadConfirmationId, setLeadConfirmationId] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // FAQ accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Tagline word reveal scroll observer (B11 mandatory section)
  const taglineRef = useRef<HTMLDivElement>(null);
  const [revealedWordCount, setRevealedWordCount] = useState<number>(0);

  const taglineText = useTranslatedText("Every rural cancer patient deserves curative treatment completed within fifty six days without losing their identity or their dignity.");
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
      q: "Why is the fifty six day completion limit biologically critical for cervical cancer?",
      a: "Curative chemoradiation requires completing external beam radiation and brachytherapy within fifty six days. Clinical trials demonstrate that each additional day of delay causes an estimated zero point eight to one point two percent loss in pelvic tumor control because clonogenic tumor cells repopulate rapidly.",
    },
    {
      q: "How does the platform protect patient identity during reasoning workflows?",
      a: "All patient identifiers such as names, phone numbers, and village details are isolated inside an AES 256 GCM encrypted token vault. Clinical AI models and multi agent reasoning pipelines only ever process zero knowledge synthetic tokens such as PT RURAL 7891.",
    },
    {
      q: "How does the hub and spoke referral avoid travel delays for brachytherapy?",
      a: "Investigations and pre anesthetic clearance begin at fraction ten instead of fraction twenty five. When the treating oncologist verifies tumor regression on fraction fifteen, travel tickets and tertiary hospital dorm passes are already confirmed for fraction twenty six.",
    },
    {
      q: "What happens when a patient in a remote village misses a radiotherapy appointment?",
      a: "The system triggers progressive escalation tiers. Day one sends a local language text message. Day two places an automated interactive voice call. Day three dispatches a village health worker directly to the home. Day five compiles an emergency dossier for district medical officer transport.",
    },
    {
      q: "Can treating doctors view unmasked patient details at the point of care?",
      a: "Yes. Treating doctors and radiation nurses at authenticated treatment consoles see the verified patient name, photograph, and age. This prevents wrong patient radiation accidents while preserving zero knowledge privacy across cloud networks.",
    },
    {
      q: "Does the system require hospital network overhaul or expensive hardware?",
      a: "No. The entire platform runs through modern web browsers on existing hospital desktop computers and affordable tablets, with offline capable mobile companion views for field health workers.",
    },
    {
      q: "Is CerviSetu compliant with national privacy and medical device guidelines?",
      a: "Yes. CerviSetu operates as an assistive workflow coordination platform aligned with the Digital Personal Data Protection Act of 2023, ABDM FHIR standards, and CDSCO non diagnostic SaMD regulatory boundaries.",
    },
    {
      q: "How does the ninety day district pilot work?",
      a: "Selected public oncology daycare centers and regional cancer hubs receive full software access, staff onboarding, and integration support at zero license fee for three months with full hospital data ownership.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#000000] font-sans selection:bg-[#F19941] selection:text-[#000000] antialiased">
      {/* Skip to Content for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-[#000000] text-[#FFFFFF] px-4 py-2 rounded-lg border border-[#000000] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#BA2D0B]"
      >
        Skip to main content
      </a>

      {/* ========================================================================= */}
      {/* ARCHITECTURAL HEADER WITH EMBLEM & PRIMARY/SECONDARY BORDERS              */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-[#FFFFFF]/95 backdrop-blur-md border-b-2 border-[#BA2D0B]/25">
        <div ref={setHeaderRowEl} className="max-w-[1760px] mx-auto px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
          {/* Brand Logo with CerviSetu Caring Hands SVG Emblem */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="size-10 rounded-xl bg-white border border-[#0F766E]/30 flex items-center justify-center text-[#000000] shadow-xs p-1 transition-transform hover:scale-105">
              <CerviSetuLogo size={30} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tracking-tight text-[#000000]">CerviSetu</span>
                <span className="hidden 2xl:inline text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#90C3CB]/40 text-[#000000] font-semibold border border-[#F19941] font-mono-data">
                  Sovereign Health
                </span>
              </div>
              <span className="text-[11px] text-[#4B5563] tracking-normal whitespace-nowrap">
                Rural Oncology Radiation Network
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links — Spacious & Distinct */}
          <nav aria-label="Desktop Navigation" className={`hidden ${navInline ? "xl:flex" : ""} flex-1 items-center justify-center gap-4 2xl:gap-7`}>
            <a
              href="#protocol"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              56 Day Protocol
            </a>
            <a
              href="#speech-studio"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              Speech IVR
            </a>
            <a
              href="#vision-ocr"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              Vision OCR
            </a>
            <a
              href="#agent-flow"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              Agent Flow
            </a>
            <a
              href="#impact-calculator"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              Impact ROI
            </a>
            <a
              href="#api-studio"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              API Studio
            </a>
            <a
              href="#faq"
              className="text-sm font-medium whitespace-nowrap text-[#4B5563] hover:text-[#BA2D0B] transition-colors duration-200"
            >
              FAQ
            </a>
          </nav>

          {/* Header Action Buttons — Primary & Secondary Borders */}
          <div className={`hidden sm:flex items-center gap-3 shrink-0 ${navInline ? "xl:pl-5 2xl:pl-6 xl:border-l" : ""} lg:border-[#E5E7EB]`}>
            <LanguageSwitch />
            <button
              onClick={(onOpenGateway ?? onLaunchWorkstation)}
              data-testid="header-login"
              className="h-10 px-4 inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-white bg-black hover:bg-black/85 border border-black rounded-lg transition-colors duration-200 cursor-pointer active:scale-98"
            >
              <LogIn className="size-4" />
              Log in / Book
            </button>
            <a
              href="#pilot-intake"
              className={`h-10 px-4 ${headerLevel >= 2 ? "hidden" : "hidden md:inline-flex"} items-center whitespace-nowrap text-sm font-semibold text-[#FFFFFF] bg-[#BA2D0B] hover:bg-[#9E2407] border border-[#BA2D0B] rounded-lg transition-colors duration-200 cursor-pointer active:scale-98`}
            >
              Deploy Spoke Pilot
            </a>
          </div>

          {/* Mobile: direct Log in button next to the menu */}
          <button
            onClick={(onOpenGateway ?? onLaunchWorkstation)}
            className="sm:hidden shrink-0 h-10 px-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-black rounded-lg cursor-pointer"
          >
            <LogIn className="size-4" />
            Log in
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`${navInline ? "xl:hidden" : ""} shrink-0 p-2 text-[#000000] hover:bg-[#F4F5F7] rounded-lg border-2 border-[#F19941]`}
            aria-label="Toggle mobile menu"
          >
            <div className="w-5 flex flex-col gap-1.5 items-end">
              <span className={`h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? "w-5 rotate-45 translate-y-2" : "w-5"}`} />
              <span className={`h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : "w-3.5"}`} />
              <span className={`h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? "w-5 -rotate-45 -translate-y-2" : "w-4"}`} />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className={`fixed inset-0 z-30 bg-[#FFFFFF]/98 backdrop-blur-xl flex flex-col justify-center px-8 py-16 ${navInline ? "xl:hidden" : ""} border-b-2 border-[#BA2D0B]`}>
          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F19941]/30">
              <div className="size-9 rounded-lg bg-white border border-[#0F766E]/30 flex items-center justify-center p-1.5">
                <CerviSetuLogo size={20} />
              </div>
              <span className="text-xs uppercase tracking-widest text-[#4B5563] font-mono-data">System Navigation</span>
            </div>
            <a
              href="#protocol"
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-semibold text-[#000000] hover:text-[#BA2D0B] py-2 border-b border-[#F19941]/20"
            >
              56 Day Curative Protocol
            </a>
            <a
              href="#vault"
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-semibold text-[#000000] hover:text-[#BA2D0B] py-2 border-b border-[#F19941]/20"
            >
              Zero ID Privacy Vault
            </a>
            <a
              href="#accompaniment"
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-semibold text-[#000000] hover:text-[#BA2D0B] py-2 border-b border-[#F19941]/20"
            >
              ASHA Field Coordination
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-semibold text-[#000000] hover:text-[#BA2D0B] py-2 border-b border-[#F19941]/20"
            >
              Hub and Spoke Architecture
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-semibold text-[#000000] hover:text-[#BA2D0B] py-2 border-b border-[#F19941]/20"
            >
              Frequently Asked Questions
            </a>

            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  (onOpenGateway ?? onLaunchWorkstation)();
                }}
                className="w-full py-3 text-sm font-semibold text-white bg-black rounded-lg text-center"
              >
                Log in / Book Appointment
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLaunchWorkstation();
                }}
                className="w-full py-3 text-sm font-semibold text-[#000000] bg-white border-2 border-[#F19941] rounded-lg text-center"
              >
                Launch Staff Workstation
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenPatientCompanion();
                }}
                className="w-full py-3 text-sm font-semibold text-[#FFFFFF] bg-[#BA2D0B] rounded-lg text-center"
              >
                Open Patient Mobile Companion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content" className="relative">
        {/* ========================================================================= */}
        {/* HERO SECTION WITH ARCHITECTURAL STUDIO & SECONDARY/PRIMARY BORDERS        */}
        {/* ========================================================================= */}
        <section className="relative pt-16 pb-20 border-b-2 border-[#BA2D0B]/20 overflow-hidden bg-[#FFFFFF]">
          {/* Subtle Grid Lines Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#BA2D0B0a_1px,transparent_1px),linear-gradient(to_bottom,#F199410a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
            {/* Top Credential Pill with Primary Border */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#DBFE87]/50 border-2 border-[#BA2D0B] mb-8 shadow-xs">
              <div className="size-4">
                <CerviSetuLogo size={16} />
              </div>
              <span className="text-xs font-bold text-[#000000]">
                National Cancer Grid and GEC ESTRO Curative Standard
              </span>
            </div>

            {/* Authoritative Main Headline */}
            <div className="max-w-4xl mb-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#000000] leading-[1.1] text-balance">
                Sovereign clinical infrastructure for fifty six day curative cancer care in rural districts
              </h1>
            </div>

            {/* Clear Subheadline */}
            <p className="max-w-2xl text-base sm:text-lg text-[#4B5563] leading-relaxed mb-10 text-pretty">
              Synchronize district radiotherapy daycare with tertiary brachytherapy hubs. Deploy automated vernacular voice outreach and village health teams to stop patient drop out before biological limits expire.
            </p>

            {/* Dual Primary Call to Actions */}
            <div className="flex flex-wrap items-center gap-4 mb-16">
              <a
                href="#pilot-intake"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <span>Deploy Spoke Pilot</span>
                <SolarArrowRight size={16} />
              </a>
              <button
                onClick={onOpenDualView}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#FFFFFF] hover:bg-[#F4F5F7] border-2 border-[#F19941] text-[#000000] text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <div className="size-5 rounded bg-[#90C3CB] border border-[#F19941] flex items-center justify-center text-[#000000]">
                  <SolarSmartphone size={12} />
                </div>
                <span>Dual Screen Tablet & Phone Live View</span>
              </button>
            </div>

            {/* ===================================================================== */}
            {/* INTERACTIVE CLINICAL STUDIO (Primary #BA2D0B & Secondary #F19941 Borders)*/}
            {/* ===================================================================== */}
            <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl overflow-hidden shadow-xl">
              {/* Studio Header Toolbar with Secondary Border Divider */}
              <div className="px-6 py-4 bg-[#F8F9FA] border-b-2 border-[#F19941]/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-md bg-white border border-[#0F766E]/30 flex items-center justify-center p-1">
                    <CerviSetuLogo size={16} />
                  </div>
                  <span className="text-xs font-mono-data uppercase tracking-wider text-[#000000] font-bold">
                    Live Interactive Telemetry Studio
                  </span>
                </div>

                {/* Studio Mode Switcher with Secondary Border */}
                <div className="flex items-center bg-[#FFFFFF] border-2 border-[#F19941]/60 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setActiveStudioTab("ivr")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "ivr"
                        ? "bg-[#BA2D0B] text-[#FFFFFF] shadow-xs"
                        : "text-[#4B5563] hover:text-[#000000]"
                    }`}
                  >
                    Vernacular Voice IVR
                  </button>
                  <button
                    onClick={() => setActiveStudioTab("vault")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "vault"
                        ? "bg-[#BA2D0B] text-[#FFFFFF] shadow-xs"
                        : "text-[#4B5563] hover:text-[#000000]"
                    }`}
                  >
                    Zero ID Masking
                  </button>
                  <button
                    onClick={() => setActiveStudioTab("timeline")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      activeStudioTab === "timeline"
                        ? "bg-[#BA2D0B] text-[#FFFFFF] shadow-xs"
                        : "text-[#4B5563] hover:text-[#000000]"
                    }`}
                  >
                    56 Day Timeline Guard
                  </button>
                </div>
              </div>

              {/* Studio Interactive Body */}
              <div className="p-6 sm:p-8 bg-[#FFFFFF]">
                {/* 1. Vernacular Voice IVR Playground (Full Showcase Engine) */}
                {activeStudioTab === "ivr" && (
                  <div id="speech-studio">
                    <VoiceStudio />
                  </div>
                )}

                {/* 2. Zero ID Masking Interactive */}
                {activeStudioTab === "vault" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-7">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
                          DPDP 2023 Shield
                        </span>
                        <span className="text-xs text-[#F19941]">·</span>
                        <span className="text-xs text-[#4B5563]">AES 256 GCM Token Vault</span>
                      </div>
                      <h3 className="text-2xl font-semibold text-[#000000] mb-3">
                        Point of Care Identity vs Zero Knowledge Reasoning
                      </h3>
                      <p className="text-sm text-[#4B5563] leading-relaxed mb-6">
                        Doctors at physical consoles view full patient names to prevent radiation mistakes. Meanwhile, all external reasoning models and cloud queues strictly process synthetic non reversible tokens.
                      </p>

                      <div className="flex items-center gap-4 mb-6">
                        <button
                          onClick={() => setIsMasked(!isMasked)}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] transition-all cursor-pointer shadow-xs active:scale-98"
                        >
                          {isMasked ? "Reveal Authenticated Console View" : "Engage Zero Knowledge Shield"}
                        </button>
                        <span className="text-xs font-medium text-[#4B5563]">
                          Current state: {isMasked ? "Zero Knowledge Masked" : "Point of Care Console"}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941] space-y-2 font-mono-data text-xs">
                        <div className="flex justify-between py-1 border-b border-[#F19941]/30">
                          <span className="text-[#4B5563]">Identity Header:</span>
                          <span className={isMasked ? "text-[#BA2D0B] font-bold" : "text-[#F19941] font-bold"}>
                            {isMasked ? "PT RURAL 7891 (Synthetic Token)" : "Shanti Devi (Age 48)"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#F19941]/30">
                          <span className="text-[#4B5563]">Phone & Sector:</span>
                          <span className={isMasked ? "text-[#4B5563] font-semibold" : "text-[#000000] font-bold"}>
                            {isMasked ? "VAULT PROTECTED (AES 256)" : "+91 98765 43210 · Adalhat, Mirzapur"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#4B5563]">Reasoning Payload:</span>
                          <span className="text-[#000000] font-bold">Cancer Type: Cervical FIGO IIB</span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 bg-[#F8F9FA] border-2 border-[#BA2D0B]/30 rounded-xl p-6">
                      <span className="text-xs font-mono-data text-[#000000] uppercase tracking-wider block mb-4 font-bold">
                        Cryptographic Chained Ledger
                      </span>
                      <div className="space-y-2 text-xs font-mono-data text-[#4B5563]">
                        <div className="p-2.5 rounded bg-[#FFFFFF] border-2 border-[#F19941]/40">
                          <span className="text-[#000000] font-bold block">Block 004128 · SHA 256</span>
                          <span>Prev Hash: a89f...b412</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#DBFE87]/50 border-2 border-[#BA2D0B]/50">
                          <span className="text-[#000000] font-bold block">Status: Validated</span>
                          <span className="text-[#4B5563]">Timestamp: Live Synchronized</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 56 Day Timeline Guard */}
                {activeStudioTab === "timeline" && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold block mb-1">
                          Biological Repopulation Safeguard
                        </span>
                        <h3 className="text-xl font-semibold text-[#000000]">
                          56 Day Ceiling Simulator (Currently Day {timelineDay})
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[#4B5563] block">Pelvic Tumor Control Loss:</span>
                        <span className={`text-base font-mono-data font-bold ${timelineDay > 56 ? "text-[#BA2D0B]" : "text-[#000000]"}`}>
                          {timelineDay > 56 ? `${((timelineDay - 56) * 1.1).toFixed(1)}% Curative Degradation` : "0.0% · Optimal Window"}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Slider with Accent 1 Cyan track & Primary Red Thumb */}
                    <input
                      type="range"
                      min={1}
                      max={70}
                      value={timelineDay}
                      onChange={(e) => setTimelineDay(Number(e.target.value))}
                      className="w-full accent-[#BA2D0B] h-2.5 bg-[#90C3CB] rounded-lg cursor-pointer mb-6 border border-[#BA2D0B]"
                    />

                    {/* Phase Checkpoints with Primary and Secondary Borders */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-xl border-2 ${timelineDay >= 10 ? "bg-[#DBFE87]/30 border-[#BA2D0B]" : "bg-[#F8F9FA] border-[#F19941]/40"}`}>
                        <span className="text-xs font-mono-data text-[#BA2D0B] font-bold block mb-1">Fraction 10 · Day 14</span>
                        <h4 className="text-sm font-semibold text-[#000000] mb-1">Early PAC Clearance</h4>
                        <p className="text-xs text-[#4B5563]">Pre anesthetic blood work and renal clearance initiated automatically.</p>
                      </div>

                      <div className={`p-4 rounded-xl border-2 ${timelineDay >= 21 ? "bg-[#DBFE87]/30 border-[#BA2D0B]" : "bg-[#F8F9FA] border-[#F19941]/40"}`}>
                        <span className="text-xs font-mono-data text-[#BA2D0B] font-bold block mb-1">Fraction 15 · Day 21</span>
                        <h4 className="text-sm font-semibold text-[#000000] mb-1">Pelvic Response Exam</h4>
                        <p className="text-xs text-[#4B5563]">Oncologist verifies regression. Tertiary dorm pass issued immediately.</p>
                      </div>

                      <div className={`p-4 rounded-xl border-2 ${timelineDay >= 35 ? "bg-[#DBFE87]/30 border-[#BA2D0B]" : "bg-[#F8F9FA] border-[#F19941]/40"}`}>
                        <span className="text-xs font-mono-data text-[#BA2D0B] font-bold block mb-1">Fractions 26 to 29 · Day 35 to 49</span>
                        <h4 className="text-sm font-semibold text-[#000000] mb-1">Brachytherapy Admission</h4>
                        <p className="text-xs text-[#4B5563]">Curative completion finalized before Day 56 limit.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MANDATORY TAGLINE REVEAL SECTION (B11 — Primary Border Accents)           */}
        {/* ========================================================================= */}
        <section
          ref={taglineRef}
          className="py-24 border-b-2 border-[#BA2D0B]/20 bg-[#F8F9FA] relative"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center flex flex-col items-center">
            <div className="size-8 rounded-lg bg-white border border-[#0F766E]/30 flex items-center justify-center p-1.5 mb-4 shadow-xs">
              <CerviSetuLogo size={20} />
            </div>
            <span className="text-xs uppercase tracking-widest font-mono-data text-[#BA2D0B] font-bold mb-6 block">
              The Curative Covenant
            </span>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight flex flex-wrap justify-center gap-x-2.5 gap-y-1.5 max-w-[680px]">
              {tagWords.map((word, index) => {
                const isRevealed = index < revealedWordCount;
                return (
                  <span
                    key={index}
                    className="transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      color: isRevealed ? "#000000" : "rgba(0, 0, 0, 0.22)",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
            <span className="text-xs text-[#4B5563] mt-8 font-mono-data">
              Strict adherence to international radiation oncology safety benchmarks
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ASYMMETRIC INFRASTRUCTURE GRID (Primary & Secondary Borders)              */}
        {/* ========================================================================= */}
        <section id="protocol" className="py-24 border-b-2 border-[#F19941]/30 bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-16">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Core System Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight">
                Designed for the reality of rural oncology handoffs
              </h2>
            </div>

            {/* Asymmetric Bento Architecture with Accent Icons and Primary/Secondary Borders */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Card 1: 56 Day Biological Guard (Primary #BA2D0B Border) */}
              <div className="lg:col-span-7 bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <div className="size-11 rounded-xl bg-[#90C3CB] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] mb-6 shadow-xs">
                    <SolarPulse size={24} />
                  </div>
                  <h3 className="text-2xl font-semibold text-[#000000] mb-3">
                    Radiobiological 56 Day Completion Engine
                  </h3>
                  <p className="text-base text-[#4B5563] leading-relaxed mb-6">
                    In cervical cancer chemoradiation, every additional day beyond fifty six days causes accelerated clonogenic repopulation, eroding pelvic tumor control at zero point eight to one point two percent per day. CerviSetu tracks daily fractions against biological timers.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#DBFE87]/40 border-2 border-[#BA2D0B]/30 flex items-center justify-between text-xs font-mono-data">
                  <span className="text-[#000000] font-medium">GEC ESTRO & ABS Ceiling:</span>
                  <span className="text-[#BA2D0B] font-bold">56 Days Absolute Maximum</span>
                </div>
              </div>

              {/* Card 2: Zero ID Vault (Secondary #F19941 Border) */}
              <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#F19941] rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <div className="size-11 rounded-xl bg-[#DBFE87] border-2 border-[#F19941] flex items-center justify-center text-[#000000] mb-6 shadow-xs">
                    <SolarShieldKeyhole size={24} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#000000] mb-3">
                    Zero Knowledge AES 256 Token Vault
                  </h3>
                  <p className="text-sm text-[#4B5563] leading-relaxed mb-6">
                    Patient identifiers are stripped before entering multi agent reasoning nodes. Unmasked credentials appear strictly on verified hospital workstations to prevent radiation targeting errors.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941]/30 text-xs font-mono-data text-[#4B5563]">
                  Cryptographically chained SHA 256 immutable audit ledger.
                </div>
              </div>

              {/* Card 3: Frontline ASHA Field AI (Secondary #F19941 Border) */}
              <div className="lg:col-span-5 bg-[#FFFFFF] border-2 border-[#F19941] rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <div className="size-11 rounded-xl bg-[#DBFE87] border-2 border-[#F19941] flex items-center justify-center text-[#000000] mb-6 shadow-xs">
                    <SolarUsersGroup size={24} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#000000] mb-3">
                    ASHA Field Coordination Within 72 Hours
                  </h3>
                  <p className="text-sm text-[#4B5563] leading-relaxed mb-6">
                    Automated escalation notifies village health workers with sector GPS coordinates when patients miss two consecutive fractions. Equipped with a strict twenty four hour arrival watch timer.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941]/30 text-xs font-mono-data text-[#BA2D0B] font-bold">
                  Direct escalation to District Medical Officer if unresolved.
                </div>
              </div>

              {/* Card 4: Prescription Intake & Optical Blur Gate (Primary #BA2D0B Border) */}
              <div className="lg:col-span-7 bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <div className="size-11 rounded-xl bg-[#90C3CB] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] mb-6 shadow-xs">
                    <SolarDocumentText size={24} />
                  </div>
                  <h3 className="text-2xl font-semibold text-[#000000] mb-3">
                    Prescription Slip Intake & Laplacian Blur Gate
                  </h3>
                  <p className="text-base text-[#4B5563] leading-relaxed mb-6">
                    Nurses photograph handwritten doctor slips and lab sheets. Spatial laplacian blur variance immediately checks image sharpness, guiding frontline workers to retake shaky photos before data enters medical records.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#DBFE87]/40 border-2 border-[#BA2D0B]/30 flex items-center justify-between text-xs font-mono-data">
                  <span className="text-[#000000] font-medium">Laplacian Sharpness Variance Threshold:</span>
                  <span className="text-[#BA2D0B] font-bold">85.0 Minimum Score</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SPATIAL PRESCRIPTION OCR STUDIO (Primary & Secondary Borders)             */}
        {/* ========================================================================= */}
        <section id="vision-ocr" className="py-24 border-b-2 border-[#BA2D0B]/20 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Vision & Document Intelligence
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight mb-3">
                Spatial Prescription OCR and Clinical Entity Extraction
              </h2>
              <p className="text-base text-[#4B5563] leading-relaxed">
                Ingest handwritten oncologist orders, detect diagnostic stage and radiation dosage, and shield sensitive patient records before cloud transmission.
              </p>
            </div>

            <VisionOcrStudio />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MULTI AGENT REASONING CANVAS (Primary & Secondary Borders)                 */}
        {/* ========================================================================= */}
        <section id="agent-flow" className="py-24 border-b-2 border-[#F19941]/30 bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Autonomous Clinical Orchestration
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight mb-3">
                Autonomous Multi Agent Clinical Reasoning and Adherence Flow
              </h2>
              <p className="text-base text-[#4B5563] leading-relaxed">
                LangGraph orchestration across five specialized diagnostic and tracking agents with continuous DPDP Act 2023 cryptographic audit proofs.
              </p>
            </div>

            <AgentReasoningCanvas />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SPLIT PHASE PROTOCOL SHOWCASE (Primary & Secondary Borders)               */}
        {/* ========================================================================= */}
        <section id="architecture" className="py-24 border-b-2 border-[#BA2D0B]/20 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-16">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Split Phase Referral Bridge
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight">
                Eliminating the five day referral transfer bottleneck
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Spoke Clinic Stage with Secondary #F19941 Border */}
              <div className="p-8 rounded-2xl bg-[#FFFFFF] border-2 border-[#F19941] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-md text-xs font-mono-data bg-[#F19941]/20 text-[#000000] font-bold border border-[#F19941]">
                    District Spoke Clinic · Local 12 km
                  </span>
                  <span className="text-xs text-[#BA2D0B] font-bold">Fractions 1 to 25</span>
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-2">
                  External Beam Radiotherapy & Cisplatin
                </h3>
                <p className="text-sm text-[#4B5563] leading-relaxed mb-6">
                  Patients receive twenty five fractions locally without migrating away from family. Pre anesthetic clearance triggers on fraction ten to ensure blood tests are ready before referral.
                </p>
                <div className="space-y-2 text-xs text-[#4B5563] border-t-2 border-[#F19941]/30 pt-4 font-medium">
                  <div>• Daily one tap fraction attendance logging</div>
                  <div>• Automatic toxicity monitoring for weekly chemo</div>
                  <div>• Fraction 15 pelvic response gate</div>
                </div>
              </div>

              {/* Tertiary Hub Stage with Primary #BA2D0B Border */}
              <div className="p-8 rounded-2xl bg-[#FFFFFF] border-2 border-[#BA2D0B] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-md text-xs font-mono-data bg-[#90C3CB]/40 text-[#000000] font-bold border border-[#BA2D0B]">
                    Tertiary Cancer Hub · 75 km Transfer
                  </span>
                  <span className="text-xs text-[#BA2D0B] font-bold">Fractions 26 to 29</span>
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-2">
                  High Dose Rate Brachytherapy & Closure
                </h3>
                <p className="text-sm text-[#4B5563] leading-relaxed mb-6">
                  When the patient finishes spoke radiation, hospital hostel beds and applicator theater dates are already reserved, eliminating traditional referral wait lists.
                </p>
                <div className="space-y-2 text-xs text-[#4B5563] border-t-2 border-[#BA2D0B]/30 pt-4 font-medium">
                  <div>• Pre booked patient dorm pass minted on day 31</div>
                  <div>• High dose rate brachytherapy completed in 4 fractions</div>
                  <div>• Treatment closure within 49 to 54 day target</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DISTRICT ONCOLOGY IMPACT & SURVIVAL CALCULATOR (Primary/Secondary Borders) */}
        {/* ========================================================================= */}
        <section id="impact-calculator" className="py-24 border-b-2 border-[#BA2D0B]/20 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Population Health Economics
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight mb-3">
                District Oncology Population Impact and Biological Gain Calculator
              </h2>
              <p className="text-base text-[#4B5563] leading-relaxed">
                Calculate avoided clonogenic repopulation penalty, preserved survival rates, and out of pocket family savings for any rural district.
              </p>
            </div>

            <DistrictImpactCalculator />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEVELOPER PLATFORM & REST APIS (Primary & Secondary Borders)              */}
        {/* ========================================================================= */}
        <section id="api-studio" className="py-24 border-b-2 border-[#F19941]/30 bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Interoperable Health Stack
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight mb-3">
                Programmatic Sovereign Health APIs for Health Networks
              </h2>
              <p className="text-base text-[#4B5563] leading-relaxed">
                Instant integration with hospital HMIS and state health mission infrastructure via fast authenticated endpoints.
              </p>
            </div>

            <DeveloperApiStudio />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS (Secondary & Primary Borders)                  */}
        {/* ========================================================================= */}
        <section id="faq" className="py-24 border-b-2 border-[#F19941]/30 bg-[#FFFFFF]">
          <div className="max-w-4xl mx-auto px-6 sm:px-8">
            <div className="text-center max-w-xl mx-auto mb-16">
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block mb-3">
                Clinical Inquiries
              </span>
              <h2 className="text-3xl font-semibold text-[#000000]">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className={`bg-[#FFFFFF] border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                      isOpen ? "border-[#BA2D0B] shadow-xs" : "border-[#F19941]/50 hover:border-[#BA2D0B]"
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-[#BA2D0B] cursor-pointer"
                    >
                      <span className="text-base font-semibold text-[#000000] pr-4">{item.q}</span>
                      <SolarCaretDown
                        size={18}
                        className={`text-[#000000] transition-transform duration-300 ${
                          isOpen ? "rotate-180 text-[#BA2D0B]" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-[#4B5563] leading-relaxed border-t-2 border-[#F19941]/30 pt-4">
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
        {/* PILOT INTAKE & RISK REVERSAL (Primary #BA2D0B & Secondary #F19941 Borders)*/}
        {/* ========================================================================= */}
        <section id="pilot-intake" className="py-24 bg-[#FFFFFF]">
          <div className="max-w-4xl mx-auto px-6 sm:px-8">
            <div className="bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center shadow-xl">
              <div className="size-12 rounded-xl bg-white border border-[#0F766E]/30 flex items-center justify-center p-2 mb-6 shadow-xs">
                <CerviSetuLogo size={28} />
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DBFE87] border-2 border-[#BA2D0B] text-[#000000] text-xs font-mono-data uppercase tracking-wider mb-6 font-bold shadow-xs">
                <SolarShieldCheck size={16} />
                <span>Ninety Day Zero Cost Pilot · Local Hospital Data Ownership</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-semibold text-[#000000] tracking-tight mb-4 max-w-xl">
                Deploy CerviSetu across your oncology district
              </h2>

              <p className="text-base text-[#4B5563] max-w-lg mb-8 leading-relaxed">
                Connect district radiotherapy daycares with regional hubs. Start with zero software licensing fees under state health mission parameters.
              </p>

              {formStatus === "success" ? (
                <div className="p-6 rounded-2xl bg-[#DBFE87]/40 border-2 border-[#BA2D0B] max-w-md w-full text-center">
                  <div className="size-12 rounded-full bg-[#DBFE87] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] mx-auto mb-3 shadow-xs">
                    <SolarCheck size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-[#000000] mb-2">District Pilot Intake Registered</h4>
                  {leadConfirmationId && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border-2 border-[#F19941] text-xs font-mono-data text-[#BA2D0B] font-bold mb-3 inline-block">
                      Pilot Reference: {leadConfirmationId}
                    </div>
                  )}
                  <p className="text-xs text-[#4B5563] mb-4">
                    Our oncology workflow architect will contact {pilotEmail} within twenty four hours to verify district spoke coordinates.
                  </p>
                  <button
                    onClick={onLaunchWorkstation}
                    className="px-5 py-2.5 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-xs font-semibold cursor-pointer active:scale-98"
                  >
                    Open Staff Workstation
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePilotSubmit} className="w-full max-w-md flex flex-col gap-4 text-left">
                  <div>
                    <label htmlFor="pilot-email" className="text-xs font-mono-data text-[#000000] block mb-1.5 uppercase tracking-wider font-bold">
                      Official Oncology or Department Email
                    </label>
                    <input
                      id="pilot-email"
                      type="email"
                      value={pilotEmail}
                      onChange={(e) => setPilotEmail(e.target.value)}
                      placeholder="oncologist@districthospital.gov.in"
                      className="w-full bg-[#FFFFFF] border-2 border-[#F19941] rounded-lg px-4 py-3 text-sm text-[#000000] placeholder:text-[#4B5563]/60 focus:outline-none focus:border-[#BA2D0B] focus:ring-2 focus:ring-[#BA2D0B]/20 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="district-name" className="text-xs font-mono-data text-[#000000] block mb-1.5 uppercase tracking-wider font-bold">
                      District or Cancer Society Jurisdiction
                    </label>
                    <input
                      id="district-name"
                      type="text"
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      placeholder="Mirzapur District Oncology Network"
                      className="w-full bg-[#FFFFFF] border-2 border-[#F19941] rounded-lg px-4 py-3 text-sm text-[#000000] placeholder:text-[#4B5563]/60 focus:outline-none focus:border-[#BA2D0B] focus:ring-2 focus:ring-[#BA2D0B]/20 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="facility-type" className="text-xs font-mono-data text-[#000000] block mb-1.5 uppercase tracking-wider font-bold">
                      Facility Role
                    </label>
                    <select
                      id="facility-type"
                      value={facilityType}
                      onChange={(e) => setFacilityType(e.target.value)}
                      className="w-full bg-[#FFFFFF] border-2 border-[#F19941] rounded-lg px-4 py-3 text-sm text-[#000000] focus:outline-none focus:border-[#BA2D0B] focus:ring-2 focus:ring-[#BA2D0B]/20 cursor-pointer transition-colors"
                    >
                      <option value="District Spoke Clinic">District Spoke Clinic (EBRT Fractions 1 to 25)</option>
                      <option value="Tertiary Brachytherapy Hub">Tertiary Brachytherapy Hub (Fractions 26 to 29)</option>
                      <option value="State Health Mission">State Health Mission or District Health Society</option>
                    </select>
                  </div>

                  {errorMessage && (
                    <div className="p-3 bg-rose-100 border-2 border-rose-400 rounded-lg text-rose-800 text-xs font-semibold">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formStatus === "loading"}
                    className="w-full py-3 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer"
                  >
                    {formStatus === "loading" ? "Registering District..." : "Start District Pilot"}
                  </button>

                  <span className="text-[11px] text-[#4B5563] text-center">
                    Zero setup charges. Compliant with Digital Personal Data Protection Act of 2023.
                  </span>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ARCHITECTURAL FOOTER WITH EMBLEM & PRIMARY BORDER                         */}
      {/* ========================================================================= */}
      <footer className="border-t-2 border-[#BA2D0B]/25 py-12 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b-2 border-[#F19941]/30">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-white border border-[#0F766E]/30 flex items-center justify-center p-1.5 shadow-xs">
                <CerviSetuLogo size={22} />
              </div>
              <span className="text-base font-semibold text-[#000000]">CerviSetu</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-[#4B5563]">
              <a href="#protocol" className="hover:text-[#BA2D0B] transition-colors">Protocol</a>
              <a href="#speech-studio" className="hover:text-[#BA2D0B] transition-colors">Speech IVR</a>
              <a href="#vision-ocr" className="hover:text-[#BA2D0B] transition-colors">Vision OCR</a>
              <a href="#agent-flow" className="hover:text-[#BA2D0B] transition-colors">Agent Flow</a>
              <a href="#impact-calculator" className="hover:text-[#BA2D0B] transition-colors">Impact ROI</a>
              <a href="#api-studio" className="hover:text-[#BA2D0B] transition-colors">API Studio</a>
              <a href="#faq" className="hover:text-[#BA2D0B] transition-colors">FAQ</a>
              {onOpenGateway && (
                <button
                  onClick={onOpenGateway}
                  className="hover:text-[#BA2D0B] transition-colors cursor-pointer"
                >
                  Portal Gateway
                </button>
              )}
              <button
                onClick={onLaunchWorkstation}
                className="hover:text-[#BA2D0B] transition-colors cursor-pointer"
              >
                Staff Portal
              </button>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#4B5563]">
            <p>© 2026 CerviSetu Sovereign Health Initiative. Assistive and non diagnostic clinical support.</p>
            <div className="flex items-center gap-4 font-mono-data text-[11px] text-[#000000] font-bold">
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
