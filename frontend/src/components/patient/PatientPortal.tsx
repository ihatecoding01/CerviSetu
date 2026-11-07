import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  HeartHandshake,
  Hospital,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import { portalApi, PortalError, type PortalOverview } from "../../api/portal";
import type { Referral } from "../../api/referrals";
import { usePatientLang } from "../../i18n/patient";
import { getSiteLang } from "../../i18n/site";
import { LanguageSwitch } from "../common/LanguageSwitch";
import { GeniePopup, GenieTrigger } from "../app/Genie";
import { patientGenie } from "../app/genieConfigs";
import { btn, ui } from "../app/ui";
import { Notice, when } from "../app/Status";
import { Card } from "../careui/card";

const FindCentre = lazy(() => import("./FindCentre"));
import type { AssignedInfo } from "./FindCentre";

interface Props {
  token: string;
  onRequireLogin: () => void;
  onOpenOwnRecord: (token: string) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "forbidden" }
  | { kind: "ready"; overview: PortalOverview };

const JOURNEY = [
  { label: "Referred to the hospital", desc: "VIA/Pap completed at health post", statuses: ["REFERRED"] },
  { label: "Reached the hospital", desc: "Arrival confirmed at OPD reception", statuses: ["ARRIVED"] },
  { label: "Check-up and tests at the hospital", desc: "Colposcopy exam & guided biopsy", statuses: ["COLPOSCOPY_DONE", "BIOPSY_TAKEN"] },
  { label: "Doctor explains results and plan", desc: "Results reviewed, same-day treatment plan", statuses: ["REPORT_READY", "TREATMENT_PLANNED"] },
  { label: "Care completed", desc: "Follow-up schedule confirmed", statuses: ["COMPLETED"] },
];

const stepOf = (status: string) => {
  const idx = JOURNEY.findIndex((s) => s.statuses.includes(status));
  return idx >= 0 ? idx : 0;
};

function statusLine(r: Referral): string {
  if (r.status === "ROUTINE_SCREENING") return "Your screening is recorded. No hospital referral is needed at this time.";
  if (r.status === "DECLINED") return "Your hospital referral is paused. You can restart anytime with your ASHA worker.";
  if (r.status === "ARRIVED") return "You have reached the hospital! Your hospital care team is looking after you.";
  if (r.status === "COLPOSCOPY_DONE" || r.status === "BIOPSY_TAKEN") return "Your check-up is in progress at the hospital OPD.";
  if (r.status === "REPORT_READY" || r.status === "TREATMENT_PLANNED") return "Your tests are ready. The doctor will explain your results and next steps.";
  if (r.status === "COMPLETED") return "Your cervical care pathway is complete. Rescreening advised in 3 years.";
  if (r.following) return `Your referral is active. Day ${r.follow_up_day} of 14 community follow-up.`;
  return "You have reached the hospital. Your hospital team is coordinating your care.";
}

const SAMPLE_COSTS: { item: string; min: number; max: number; note?: string }[] = [
  { item: "Doctor Consultation & Registration", min: 0, max: 20, note: "Free under PMJAY / MJPJAY" },
  { item: "Colposcopy (Magnified Check-Up)", min: 0, max: 0, note: "100% Free at Government District Hospitals" },
  { item: "Biopsy & Histopathology (If indicated)", min: 0, max: 0, note: "Covered under National Health Mission" },
  { item: "Prescribed Medications", min: 0, max: 150, note: "Free from hospital Jan Aushadhi counter" },
  { item: "Local Travel (Both Ways)", min: 40, max: 120, note: "Auto / Bus reimbursement eligible with ASHA" },
];
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function CostEstimate({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const min = SAMPLE_COSTS.reduce((t, c) => t + c.min, 0);
  const max = SAMPLE_COSTS.reduce((t, c) => t + c.max, 0);
  return (
    <Card variant="subtle" traceColor="#0284C7" className="p-4 sm:p-5 flex flex-col gap-3.5 border-sky-200" data-testid="cost-estimate">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="size-4 text-[#0284C7]" />
            <h3 className="font-heading text-sm font-bold text-slate-900">Hospital Care &amp; Cost Guide &middot; {hospital}</h3>
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-semibold">
            <ShieldCheck className="size-3.5 text-emerald-700" /> 100% Free under Ayushman Bharat (PM-JAY) &amp; MJPJAY
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-md text-slate-500 hover:bg-slate-200/60 cursor-pointer">
          <X className="size-4" />
        </button>
      </div>

      <ul className="text-xs divide-y divide-black/[0.06]">
        {SAMPLE_COSTS.map((c) => (
          <li key={c.item} className="flex justify-between gap-3 py-2">
            <span className="text-slate-700">
              {c.item}
              {c.note && <span className="block text-[11px] text-slate-500">{c.note}</span>}
            </span>
            <span className="text-slate-900 font-mono-data font-semibold shrink-0 tabular-nums">
              {c.min === 0 && c.max === 0 ? "FREE" : `${rupees(c.min)} – ${rupees(c.max)}`}
            </span>
          </li>
        ))}
        <li className="flex justify-between gap-3 pt-2.5 font-bold text-slate-900">
          <span>Estimated Patient Out-of-Pocket</span>
          <span className="tabular-nums font-mono-data text-emerald-800" data-testid="cost-total">
            {min === 0 ? "₹0 (Fully Covered)" : `${rupees(min)} – ${rupees(max)}`}
          </span>
        </li>
      </ul>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Government tertiary hospitals and medical colleges provide colposcopy, biopsy, and thermal ablation free of cost. Bring your Aadhaar Card, Ration Card, or PMJAY Health Card.
      </p>
    </Card>
  );
}

function ReferralSlipModal({ r, onClose }: { r: Referral; onClose: () => void }) {
  const printSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative flex flex-col gap-5 print:p-0 print:border-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <CerviSetuLogo size={28} />
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">Official Clinical Referral Slip</h3>
              <p className="text-xs text-slate-500">Ministry of Health &amp; Family Welfare &middot; Government of Maharashtra</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div className="rounded-xl border border-slate-300 p-5 bg-slate-50/50 flex flex-col gap-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#0284C7]">National Health Mission</p>
              <h4 className="font-heading text-lg font-bold text-slate-900 mt-0.5">{r.patient_name}</h4>
              <p className="text-slate-600 text-xs">Age: {r.age || "Recorded"} yrs &middot; {r.area}</p>
            </div>
            <div className="text-right">
              <span className="font-mono-data text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded text-slate-800">
                {r.patient_token}
              </span>
              <p className="text-[10px] text-slate-500 mt-1">Referred: {when(r.referred_on)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-200 text-xs">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Referring Facility</p>
              <p className="font-semibold text-slate-900">{r.health_post || "Urban Primary Health Post"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Referred Hospital</p>
              <p className="font-semibold text-[#0369A1]">{r.hospital || "District Hospital"}</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Screening Finding</p>
            <p className="font-mono-data font-semibold text-rose-950 bg-rose-50 p-2 rounded border border-rose-200 mt-1">
              {r.screening_finding || "Acetowhite lesion identified on VIA screening &bull; High-grade referral"}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <QrCode className="size-10 text-slate-800 shrink-0" />
              <div className="text-[10px] text-slate-500">
                <p className="font-semibold text-slate-700">Digital OPD Check-in</p>
                <p>Present at Hospital Counter 4</p>
              </div>
            </div>
            {r.urgent && (
              <span className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[11px] uppercase tracking-wider">
                Priority Urgent
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10 print:hidden">
          <button type="button" onClick={onClose} className={btn("secondary", "text-xs")}>
            Close
          </button>
          <button type="button" onClick={printSlip} className={btn("primary", "text-xs gap-1.5")}>
            <Printer className="size-4" /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function NextStepSection({
  r,
  busy,
  centre,
  onOpenCost,
  costOpen,
  onOpenSlip,
  onMarkVisited,
  visitedReported,
}: {
  r: Referral;
  busy: boolean;
  centre: AssignedInfo | null;
  onOpenCost: () => void;
  costOpen: boolean;
  onOpenSlip: () => void;
  onMarkVisited: () => void;
  visitedReported: boolean;
}) {
  const hospitalName = r.hospital || "District Referral Hospital";
  const mapsDestination = centre?.directions || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospitalName + " Mumbai")}`;

  return (
    <Card variant="blue" traceColor="#0284C7" className="p-5 sm:p-6 border-sky-200/80 shadow-2xs">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#0284C7] text-xs font-semibold uppercase tracking-wider">
            <Hospital className="size-4" />
            <span>Your next step</span>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 mt-1" data-testid="next-step">{r.following ? `Go to ${hospitalName} for closer check-up` : `Your visit at ${hospitalName} is scheduled`}</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
            Female specialist doctors will examine the screening findings with a painless, magnified lens (colposcopy). Taking this step early guarantees safety and protection.
          </p>
        </div>

        {/* Hospital Card */}
        <div className="rounded-xl border border-sky-200 bg-white/95 p-4 flex flex-col gap-3 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0369A1]">Your referral centre</p>
              <h3 className="font-heading text-lg font-bold text-slate-900 leading-snug">{hospitalName}</h3>
              <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                <MapPin className="size-3.5 text-slate-400 shrink-0" />
                <span>{centre?.place || `${r.area}, Mumbai`}</span>
                <span>&middot;</span>
                <span>Gynaecology OPD, Room 12</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                OPD Timings: Monday – Saturday · 8:00 AM – 1:00 PM
              </p>
            </div>
            {r.urgent && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                Priority Fast-Track
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* Direct reliable Google Maps navigation button */}
            <a
              href={mapsDestination}
              target="_blank"
              rel="noopener noreferrer"
              className={btn("primary", "text-xs gap-1.5 font-semibold")}
              data-testid="next-directions"
            >
              <Navigation className="size-3.5" aria-hidden="true" />
              Get directions
            </a>

            {/* Mark Visited with clear feedback */}
            <button
              type="button"
              disabled={busy || visitedReported}
              onClick={onMarkVisited}
              className={`px-3 py-2 rounded-md border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                visitedReported
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
              }`}
              data-testid="reply-visited"
            >
              {visitedReported ? (
                <>
                  <Check className="size-3.5 text-emerald-700" />
                  Visit Reported to Nurse
                </>
              ) : (
                "I have been to the hospital"
              )}
            </button>

            {/* Print Slip Button */}
            <button
              type="button"
              onClick={onOpenSlip}
              className="px-3 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="size-3.5 text-slate-500" />
              Print Referral Slip
            </button>

            {/* Cost estimate toggle */}
            <button
              type="button"
              aria-expanded={costOpen}
              onClick={onOpenCost}
              className="px-3 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              data-testid="estimate-cost"
            >
              <ReceiptText className="size-3.5 text-[#0284C7]" aria-hidden="true" />
              Estimate cost
            </button>
          </div>

          {costOpen && <CostEstimate hospital={hospitalName} onClose={onOpenCost} />}
        </div>

        {/* Take with you Checklist */}
        <div className="bg-sky-50/50 rounded-xl p-3.5 border border-sky-100 flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Check className="size-3.5 text-[#0369A1]" /> Take with you
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </span>
              <span>Your referral slip</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </span>
              <span>Aadhaar or any photo ID</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </span>
              <span>Any reports you have</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Check className="size-3" />
              </span>
              <span>Ayushman Bharat (PM-JAY) or Ration Card</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export const PatientPortal: React.FC<Props> = ({ token, onRequireLogin, onOpenOwnRecord }) => {
  const { lang, t } = usePatientLang();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [genieOpen, setGenieOpen] = useState(false);
  const [centre, setCentre] = useState<AssignedInfo | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [visitedReported, setVisitedReported] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [helpCallbackRequested, setHelpCallbackRequested] = useState(false);
  const [helpAssistanceRequested, setHelpAssistanceRequested] = useState(false);

  const requireLogin = useRef(onRequireLogin);
  requireLogin.current = onRequireLogin;

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", overview: await portalApi.overview(token) });
    } catch (e) {
      const kind = (e as PortalError).kind;
      if (kind === "unauthenticated") return requireLogin.current();
      if (kind === "forbidden") {
        setState({ kind: "forbidden" });
        portalApi.session().then((s) => setOwnToken(s.patient_token)).catch(() => setOwnToken(null));
        return;
      }
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    void load();
    setVisitedReported(false);
    setHelpCallbackRequested(false);
    setHelpAssistanceRequested(false);
  }, [load]);

  const logout = async () => {
    try {
      await portalApi.logout();
    } finally {
      requireLogin.current();
    }
  };

  const reply = async (id: string) => {
    setBusy(true);
    setNote(null);
    try {
      await portalApi.reply(token, id);
      const text: Record<string, string> = {
        VISITED: "Thank you! Your visit has been noted for your health post ASHA worker and hospital OPD reception.",
        NEEDS_HELP: "Assistance requested. Your assigned ASHA worker has been notified to assist you with hospital transport.",
        NURSE_CALL_BACK: "Call-back logged. A staff nurse or community mobilizer will call your registered phone.",
        STOP: "Reminders are paused. You can speak to your ASHA worker anytime to resume messages.",
      };
      setNote({ ok: true, text: text[id] || "Your update was recorded." });
      if (id === "VISITED") setVisitedReported(true);
      if (id === "NURSE_CALL_BACK") setHelpCallbackRequested(true);
      if (id === "NEEDS_HELP") setHelpAssistanceRequested(true);
      setState({ kind: "ready", overview: await portalApi.overview(token) });
    } catch {
      setNote({ ok: false, text: "Your update could not be saved right now. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const playVoiceGuidance = () => {
    if (!("speechSynthesis" in window)) {
      alert("Voice playback is not supported on this browser.");
      return;
    }
    if (voicePlaying) {
      window.speechSynthesis.cancel();
      setVoicePlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const currentLang = getSiteLang();
    const spokenByLang: Record<string, { text: string; code: string }> = {
      hi: {
        text: "नमस्ते. आपके स्वास्थ्य केंद्र ने आपको आगे की जाँच के लिए अस्पताल भेजा है. कृपया अपनी रेफरल पर्ची और पहचान पत्र साथ लेकर समय पर अस्पताल पहुँचें. सरकारी अस्पताल में सभी जाँच और परामर्श मुफ़्त हैं.",
        code: "hi-IN",
      },
      bho: {
        text: "प्रणाम. राउर स्वास्थ्य केंद्र आगे के जाँच खातिर अस्पताल भेजले बा. आपन रेफरल पर्ची आ पहचान पत्र साथे लेके अस्पताल जाईं. सरकारी अस्पताल में सब जाँच मुफ़्त बा.",
        code: "hi-IN",
      },
      mr: {
        text: "नमस्ते. तुमच्या आरोग्य केंद्राने पुढील तपासणीसाठी तुम्हाला रुग्णालयात पाठवले आहे. कृपया तुमची रेफरल चिठ्ठी आणि ओळखपत्र सोबत घेऊन वेळेवर रुग्णालयात जा. सर्व तपासण्या मोफत आहेत.",
        code: "mr-IN",
      },
      bn: {
        text: "নমস্কার. আপনার স্বাস্থ্য কেন্দ্র পরবর্তী পরীক্ষার জন্য আপনাকে হাসপাতালে রেফার করেছে. অনুগ্রহ করে আপনার রেফারেল স্লিপ এবং পরিচয়পত্র সাথে নিয়ে হাসপাতালে যান. সরকারি হাসপাতালে সব পরীক্ষা বিনামূল্যে.",
        code: "bn-IN",
      },
      ta: {
        text: "வணக்கம். தீவிர பரிசோதனைக்காக உங்கள் சுகாதார நிலையம் உங்களை மருத்துவமனைக்கு பரிந்துரைத்துள்ளது. தயவுசெய்து பரிந்துரைச் சீட்டு மற்றும் அடையாள அட்டையுடன் மருத்துவமனைக்கு செல்லவும். அரசு மருத்துவமனையில் பரிசோதனைகள் இலவசம்.",
        code: "ta-IN",
      },
      te: {
        text: "నమస్కారం. తదుపరి పరీక్షల కోసం మీ ఆరోగ్య కేంద్రం మిమ్మల్ని ఆసుపత్రికి రిఫర్ చేసింది. దయచేసి మీ రిఫరల్ స్లిప్ మరియు గుర్తింపు కార్డుతో ఆసుపత్రికి వెళ్లండి. ప్రభుత్వ ఆసుపత్రిలో పరీక్షలు పూర్తిగా ఉచితం.",
        code: "te-IN",
      },
      en: {
        text: "Namaste. Your health centre has referred you to the hospital for a closer check-up. Please bring your referral slip and ID. Consultation and tests are completely free under government schemes.",
        code: "en-IN",
      },
    };
    const chosen = spokenByLang[currentLang] || spokenByLang.en;
    const u = new SpeechSynthesisUtterance(chosen.text);
    u.lang = chosen.code;
    u.onend = () => setVoicePlaying(false);
    u.onerror = () => setVoicePlaying(false);
    setVoicePlaying(true);
    window.speechSynthesis.speak(u);
  };

  const ready = state.kind === "ready" ? state.overview : null;
  const r = ready?.referral ?? null;
  const isDemoRecord = token.startsWith("PT-CASE-") || r?.fictional;

  const page = (children: React.ReactNode) => (
    <div className={ui.page} lang={lang}>
      {/* Demo Patient Quick Switcher Bar */}
      <div className="bg-slate-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold text-sky-300">Patient Portal:</span>
          <span className="text-slate-300">
            {ready?.display_name || "Patient Record"} ({token})
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Switch demo case:</span>
          {[
            { t: "PT-CASE-BINDU", label: "Bindu (Day 4)" },
            { t: "PT-CASE-NISHI", label: "Nishi (Day 12)" },
            { t: "PT-CASE-RADHA", label: "Radha (Urgent)" },
            { t: "PT-CASE-RITA", label: "Rita (Arrived)" },
          ].map((p) => (
            <button
              key={p.t}
              type="button"
              onClick={() => onOpenOwnRecord(p.t)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                token === p.t
                  ? "bg-sky-500 text-white font-bold shadow-2xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRequireLogin}
            className="ml-2 text-sky-300 hover:text-white underline text-[11px] cursor-pointer"
          >
            OTP Login
          </button>
        </div>
      </div>

      {/* Main Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/[0.08] shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CerviSetuLogo size={30} alt="" />
            <div className="leading-tight min-w-0">
              <p className="font-heading font-bold text-[15px] text-slate-900">CerviSetu</p>
              <p className="text-[11px] text-slate-500 truncate">Patient Health Companion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch className="max-sm:w-[88px] max-sm:[&>select]:w-full" />
            <button
              type="button"
              onClick={playVoiceGuidance}
              title={voicePlaying ? "Stop audio" : "Listen in Hindi/Marathi"}
              className={`size-8 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                voicePlaying ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              {voicePlaying ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-[#0369A1]" />}
            </button>
            {ready && <GenieTrigger open={genieOpen} onClick={() => setGenieOpen((o) => !o)} />}
            {state.kind !== "loading" && (
              <button
                type="button"
                onClick={logout}
                aria-label={t("portal.logout")}
                title={t("portal.logout")}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                data-testid="patient-logout"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">{children}</main>
      {ready && <GeniePopup open={genieOpen} onClose={() => setGenieOpen(false)} config={patientGenie(token, r?.hospital ?? null)} />}
      {r && slipModalOpen && <ReferralSlipModal r={r} onClose={() => setSlipModalOpen(false)} />}
    </div>
  );

  if (state.kind === "loading") {
    return page(
      <div role="status" className="py-20 text-center flex flex-col items-center gap-3">
        <RefreshCw className="size-6 text-[#0369A1] animate-spin" />
        <p className="text-sm text-slate-600">Loading your health record...</p>
      </div>
    );
  }

  if (state.kind === "error" || state.kind === "forbidden") {
    const forbidden = state.kind === "forbidden";
    return page(
      <div role="alert" className={`${ui.panel} p-8 text-center flex flex-col items-center gap-3 max-w-lg mx-auto my-12`}>
        <AlertTriangle className="size-8 text-amber-600" aria-hidden="true" />
        <h1 className={ui.h2}>{forbidden ? t("portal.forbidden.title") : t("portal.error.title")}</h1>
        <p className="text-xs sm:text-sm text-slate-700">{forbidden ? t("portal.forbidden.body") : t("portal.error.body")}</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {forbidden && ownToken && (
            <button type="button" onClick={() => onOpenOwnRecord(ownToken)} className={btn("primary")}>
              {t("portal.openMine")}
            </button>
          )}
          {forbidden ? (
            <button type="button" onClick={logout} className={btn("secondary")}>
              {t("portal.loginAgain")}
            </button>
          ) : (
            <button type="button" onClick={load} className={btn("primary")}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("portal.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const o = state.overview;
  const at = r ? stepOf(r.status) : 0;

  return page(
    <>
      {/* Hero Welcome Banner */}
      <Card variant="warm" traceColor="#E11D48" className="p-5 sm:p-6 border-rose-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-12 rounded-xl bg-rose-100/80 text-rose-900 font-bold text-base flex items-center justify-center shrink-0 shadow-2xs border border-rose-200">
              {(o.display_name || "P").split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 id="hello" className="font-heading text-xl sm:text-2xl font-bold text-slate-900">
                  {o.display_name ? `Namaste, ${o.display_name}` : t("portal.helloNoName")}
                </h1>
                {isDemoRecord && (
                  <span className="text-[10px] font-mono-data font-bold bg-white text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                    Teaching Case
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5" data-testid="patient-status">
                {r ? statusLine(r) : "Your health worker will add your details here after your screening."}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="font-mono-data bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
                  <span>Token</span>: {o.patient_token}
                </span>
                {r?.health_post && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">&bull;</span>
                    <span>{`Registered at ${r.health_post}`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
            {r && (
              <button
                type="button"
                onClick={() => setSlipModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-900 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Printer className="size-3.5 text-rose-600" />
                Referral Slip
              </button>
            )}
            {r?.following && (
              <div className="text-right">
                <span className="text-[11px] font-bold text-[#0369A1]">Day {r.follow_up_day} of 14</span>
                <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-[#0369A1] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(8, (r.follow_up_day / 14) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Banner */}
      {note && <Notice tone={note.ok ? "routine" : "critical"} role={note.ok ? "status" : "alert"}>{note.text}</Notice>}

      {/* Main Grid: Next Step & Find Centre Map */}
      <div className={r?.hospital ? "grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start" : ""}>
        {r && (
          <NextStepSection
            r={r}
            busy={busy}
            centre={centre}
            onOpenCost={() => setCostOpen((c) => !c)}
            costOpen={costOpen}
            onOpenSlip={() => setSlipModalOpen(true)}
            onMarkVisited={() => reply("VISITED")}
            visitedReported={visitedReported}
          />
        )}
        {r?.hospital && (
          <section id="centre" aria-label="Your referral centre on the map" className="scroll-mt-20 lg:sticky lg:top-20">
            <Suspense fallback={<p className="text-sm text-slate-600">Loading map...</p>}>
              <FindCentre token={token} stacked onAssigned={setCentre} locationSlot={null} />
            </Suspense>
          </section>
        )}
      </div>

      {/* Care Journey Roadmap */}
      {r && (
        <Card variant="subtle" traceColor="#0369A1" className="p-5 sm:p-6 border-slate-200">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 id="journey" className="font-heading text-base font-bold text-slate-900">
                Your Complete Cervical Care Pathway
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every step from community screening to diagnosis and recovery
              </p>
            </div>
            <span className="text-[11px] font-mono-data font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              Step {at + 1} of 5
            </span>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3" data-testid="journey">
            {JOURNEY.map((st, i) => {
              const done = i < at;
              const now = i === at;
              return (
                <li
                  key={st.label}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    now
                      ? "bg-sky-50/80 border-[#0284C7] shadow-xs"
                      : done
                      ? "bg-slate-50/70 border-slate-200"
                      : "bg-white border-dashed border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        done
                          ? "bg-emerald-600 text-white"
                          : now
                          ? "bg-[#0369A1] text-white ring-2 ring-sky-200"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    {now && (
                      <span className="text-[10px] font-bold text-[#0369A1] uppercase tracking-wider">
                        Current Step
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold leading-snug ${now ? "text-slate-900" : "text-slate-700"}`}>
                      {st.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{st.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Direct Help & Support (Always Available) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-stretch">
        <Card variant="subtle" traceColor="#9D174D" className="p-5 sm:p-6 border-slate-200 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#9D174D] text-xs font-semibold uppercase tracking-wider">
              <HeartHandshake className="size-4" />
              <span>Dedicated Community Care</span>
            </div>
            <h3 className="font-heading text-base font-bold text-slate-900 mt-1">Need Help or Have Questions?</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              You are never alone on this journey. Request a personal call-back from your local ASHA worker or clinic nurse.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy || helpCallbackRequested}
              onClick={() => reply("NURSE_CALL_BACK")}
              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all ${
                helpCallbackRequested
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
              }`}
              data-testid="reply-callback"
            >
              <Phone className="size-4 text-[#0369A1]" aria-hidden="true" />
              {helpCallbackRequested ? "Call-back Requested" : "Sister, please call me"}
            </button>
            <button
              type="button"
              disabled={busy || helpAssistanceRequested}
              onClick={() => reply("NEEDS_HELP")}
              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all ${
                helpAssistanceRequested
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
              }`}
              data-testid="reply-help"
            >
              <HeartHandshake className="size-4 text-[#9D174D]" aria-hidden="true" />
              {helpAssistanceRequested ? "Help Request Logged" : "I need help to go"}
            </button>
          </div>
        </Card>

        {/* 24/7 Helplines Card */}
        <Card variant="subtle" className="p-5 sm:p-6 border-slate-200 flex flex-col justify-between gap-3">
          <div>
            <h3 className="font-heading text-sm font-bold text-slate-900">24/7 National &amp; State Helplines</h3>
            <p className="text-xs text-slate-500 mt-0.5">Toll-free emergency &amp; medical guidance services</p>
          </div>

          <div className="space-y-2 text-xs">
            <a
              href="tel:104"
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 transition-colors"
            >
              <span className="font-medium text-slate-800">104 Health Information Helpline</span>
              <span className="font-mono-data font-bold text-[#0369A1]">Call 104</span>
            </a>
            <a
              href="tel:108"
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 transition-colors"
            >
              <span className="font-medium text-slate-800">108 Free Medical Emergency Ambulance</span>
              <span className="font-mono-data font-bold text-rose-700">Call 108</span>
            </a>
          </div>
        </Card>
      </div>

      {/* Accordion 1: Reminder Preferences */}
      {r?.following && (
        <details className={`${ui.panel} group px-5 py-4`}>
          <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">
            <span>Reminder messages preferences</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180 text-slate-500" aria-hidden="true" />
          </summary>
          <div className="pt-3 text-xs text-slate-600 flex flex-col gap-2">
            {r.stopped_at ? (
              <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                Reminders are currently paused. Your health post worker can restart them whenever you wish.
              </p>
            ) : (
              <>
                <p>
                  We send polite SMS and WhatsApp notifications until the referral hospital registers your arrival. You can pause reminders at any time.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => reply("STOP")}
                  className={btn("danger", "self-start text-xs")}
                  data-testid="stop-reminders"
                >
                  Pause reminders
                </button>
              </>
            )}
          </div>
        </details>
      )}

      {/* Accordion 2: Privacy & Record Metadata */}
      <details className={`${ui.panel} group px-5 py-4`}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">
          <span>{t("portal.info.title")}</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 text-slate-500" aria-hidden="true" />
        </summary>
        <dl className="mt-3 text-xs divide-y divide-black/[0.06]">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-slate-500">{t("portal.info.token")}</dt>
            <dd className={`${ui.mono} font-bold text-slate-900`}>{o.patient_token}</dd>
          </div>
          {r?.health_post && (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">Referring Health Post</dt>
              <dd className="text-right text-slate-800">{r.health_post}</dd>
            </div>
          )}
          {r?.referred_on && (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">Referred On</dt>
              <dd className="text-right text-slate-800">{when(r.referred_on)}</dd>
            </div>
          )}
        </dl>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed flex flex-wrap gap-1">
          <span>{t("portal.info.privacy")}</span>
          <span>Protected under Digital Personal Data Protection Act 2023 with cryptographic ledger audit logging.</span>
        </p>
      </details>
    </>
  );
};
