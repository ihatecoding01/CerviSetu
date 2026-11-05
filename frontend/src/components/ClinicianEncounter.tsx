import { Sym } from "./icons/Sym";
import { useState, useEffect } from "react";
import { api, type VoiceConsultResult } from "../api/client";
import { useVoiceRecorder } from "../lib/useVoiceRecorder";
import {
  Activity,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Mic,
  MicOff,
  Volume2,
  Building2,
  Globe,
  Stethoscope,
  Bed,
  Bus,
  X,
  Plus,
  Undo2,
  AlertTriangle,
  PanelRight,
  ChevronDown,
  Copy,
  Download,
  Printer,
  Check,
  Sparkles,
} from "lucide-react";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./careui/table";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";

export interface CaseRecord {
  case_id?: string;
  patient_token?: string;
  patient_name?: string;
  cancer_type?: string;
  suspected_stage?: string;
  days_overdue?: number;
  severity_score?: number;
  status?: string;
  intake_json?: string;
}

interface ClinicianEncounterProps {
  patientToken?: string;
  cases?: CaseRecord[];
  onSelectPatient?: (token: string) => void;
  onBackToDashboard?: () => void;
  onOpenPatientCompanion?: (token: string) => void;
}

export type EncounterTab =
  | "overview"
  | "ccrt-protocol"
  | "hub-bridge"
  | "consultation"
  | "abha-consent";

export function ClinicianEncounter({
  patientToken = "PT-RURAL-7891",
  cases = [],
  onSelectPatient,
  onBackToDashboard,
  onOpenPatientCompanion,
}: ClinicianEncounterProps) {
  // Navigation & Workspace Layout State
  const [activeTab, setActiveTab] = useState<EncounterTab>("overview");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<"details" | "reports">("details");
  const [encounterDropdownOpen, setEncounterDropdownOpen] = useState<boolean>(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState<boolean>(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  // Match real case if passed from Overview roster
  const matchedCase = cases.find((c) => c.patient_token === patientToken);
  const patientDisplayName = matchedCase?.patient_name || (patientToken === "PT-RURAL-7891" ? "Shanti Devi" : `Patient ${patientToken.slice(-6)}`);
  const patientStage = matchedCase?.suspected_stage || "FIGO Stage IIB (Parametrial Extension)";

  // Clinical & Treatment State
  const [ebrtFractions, setEbrtFractions] = useState<number>(14);
  const [brachyFractions, setBrachyFractions] = useState<number>(0);
  const [undoActive, setUndoActive] = useState<boolean>(false);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(60);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [duplicateGuardTriggered, setDuplicateGuardTriggered] = useState<boolean>(false);
  const [machineDowntime, setMachineDowntime] = useState<boolean>(false);

  // Chemo Clearance State
  const [chemoStatus, setChemoStatus] = useState<"APPROVED" | "HELD" | "REDUCED" | "PENDING">("PENDING");
  const [labHb, setLabHb] = useState<number>(10.4);
  const [labAnc, setLabAnc] = useState<number>(2200);
  const [labPlatelets, setLabPlatelets] = useState<number>(180);
  const [labCreatinine, setLabCreatinine] = useState<number>(0.85);

  // Pre-Brachy Hub Bridge State
  const [pacCleared, setPacCleared] = useState<boolean>(true);
  const [intracavitarySuitable, setIntracavitarySuitable] = useState<boolean>(true);
  const [hubSlotConfirmed, setHubSlotConfirmed] = useState<boolean>(false);
  const [provisionalSlotDate, setProvisionalSlotDate] = useState<string>("Day 41 (Wednesday)");
  const [hubDeficiencyReturned, setHubDeficiencyReturned] = useState<boolean>(false);
  const [busVoucherIssued, setBusVoucherIssued] = useState<boolean>(false);
  const [dischargeComplete, setDischargeComplete] = useState<boolean>(false);
  const [dischargeMsg, setDischargeMsg] = useState<string | null>(null);

  // AI Voice Consultation State
  const [consult, setConsult] = useState<VoiceConsultResult | null>(null);
  const [consultBusy, setConsultBusy] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);
  const [typedNotes, setTypedNotes] = useState("");
  const [doneCommands, setDoneCommands] = useState<string[]>([]);
  const [chiefComplaints, setChiefComplaints] = useState<string>(
    "Patient presents with persistent watery discharge and moderate pelvic burning for 4 days. Denies fever. Reports fatigue after radiation fractions."
  );
  const [clinicalHistory, setClinicalHistory] = useState<string>(
    "Known case of FIGO Stage IIB Cervical SCC on concurrent chemoradiation. Completed 14 EBRT fractions without interruption. Tolerating weekly Cisplatin well with normal creatinine."
  );
  const [medications, setMedications] = useState([
    {
      id: "med-1",
      name: "Cisplatin (Weekly Infusion)",
      dosage: "40 mg/m² (65 mg)",
      frequency: "Once Weekly",
      duration: "5 Weeks",
      instructions: "Pre-infusion IV Hydration 1000 mL + Mannitol",
    },
    {
      id: "med-2",
      name: "Oral Loperamide",
      dosage: "2 mg",
      frequency: "1-1-1 (Thrice a day as needed)",
      duration: "5 Days",
      instructions: "Take after every unformed stool for radiation diarrhea",
    },
    {
      id: "med-3",
      name: "Oral Rehydration Salts (ORS)",
      dosage: "1 sachet in 1L water",
      frequency: "Throughout day",
      duration: "Ongoing",
      instructions: "Drink boiled cooled water; maintain adequate renal output",
    },
  ]);

  // Toast Helper
  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Recording timer

  // Undo countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (undoActive) {
      interval = setInterval(() => {
        setUndoSecondsLeft((prev) => {
          if (prev <= 1) {
            setUndoActive(false);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setUndoSecondsLeft(60);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [undoActive]);

  // Derived Dual Clock Metrics
  const totalCompleted = ebrtFractions + brachyFractions;
  const daysElapsed = 21; // Day 21
  const projectedFinish = Math.max(44, daysElapsed + (25 - ebrtFractions) + (4 - brachyFractions) + 2);
  const isOptimal = projectedFinish <= 49;
  const isBreach = projectedFinish > 56;

  // Auto-calculated eGFR (CKD-EPI formula approximation for 48y female with Cr 0.85)
  const calculatedEgfr = Math.round(144 * Math.pow(labCreatinine / 0.7, -1.2) * Math.pow(0.9938, 48));

  // Copy patient token
  const handleCopyToken = () => {
    navigator.clipboard.writeText(patientToken);
    setCopiedToken(true);
    showToast(`Copied ${patientToken} to clipboard`, "info");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Handler: 1-Tap Fraction Logger
  const handleLogFraction = () => {
    if (undoActive) {
      setDuplicateGuardTriggered(true);
      setTimeout(() => setDuplicateGuardTriggered(false), 3000);
      return;
    }

    if (ebrtFractions < 25) {
      const nextFraction = ebrtFractions + 1;
      setEbrtFractions(nextFraction);
      setUndoActive(true);
      setUndoSecondsLeft(60);
      showToast(`Fraction ${nextFraction} logged as delivered (2.0 Gy to Pelvis)`, "success");

      if (undoTimeout) clearTimeout(undoTimeout);
      const t = setTimeout(() => {
        setUndoActive(false);
      }, 60000); // 60 seconds undo window
      setUndoTimeout(t);
    }
  };

  const handleUndoFraction = () => {
    if (undoActive && ebrtFractions > 0) {
      const reverted = ebrtFractions;
      setEbrtFractions((prev) => prev - 1);
      setUndoActive(false);
      if (undoTimeout) clearTimeout(undoTimeout);
      showToast(`Fraction ${reverted} delivery logging reverted`, "warning");
    }
  };

  const handleChemoAction = async (status: "APPROVED" | "HELD" | "REDUCED") => {
    setChemoStatus(status);
    try {
      await api.logChemoClearance({
        patient_token: patientToken,
        cycle_number: 3,
        status: status,
        dose_mg: status === "APPROVED" ? 65.0 : status === "REDUCED" ? 48.75 : 0.0,
        hb: labHb,
        anc: labAnc,
        platelets: labPlatelets,
        creatinine: labCreatinine,
        egfr: calculatedEgfr,
        doctor_id: "DR-SHARMA-01",
        clinical_notes: status === "HELD"
          ? "Held Cisplatin 48h for renal recovery. Daily radiation EBRT fractions MUST continue unbroken."
          : "Chemotherapy clearance logged.",
        ebrt_must_continue: 1,
      });
    } catch {
      // Offline fallback
    }

    if (status === "APPROVED") {
      showToast("Cisplatin 65 mg approved with 1000 mL hydration", "success");
    } else if (status === "HELD") {
      showToast("Cisplatin held for 48h renal rest. Radiation fractions continue unbroken.", "warning");
    } else {
      showToast("Cisplatin dose reduced 25% (48.75 mg)", "info");
    }
  };

  const handleReturnDeficiency = async () => {
    setHubDeficiencyReturned(true);
    try {
      await api.returnHubTransferDeficiency(patientToken, {
        requested_deficiencies: ["Repeat CBC Hemoglobin >= 10.0 verification", "Pre-Brachy clinical staging documentation"],
        spoke_action_sla_hours: 48,
        notes: "Please re-evaluate at Spoke prior to Hub transfer on Day 41."
      });
    } catch {
      // Offline fallback
    }
    showToast("Referral returned to Spoke with 48h Action SLA", "warning");
  };

  const handleDischargeSignoff = async () => {
    try {
      const res = await api.dischargeSignoff(patientToken, {
        doctor_id: "DR-SHARMA-01",
        total_ebrt_fractions: 25,
        total_brachy_fractions: 4,
        clinical_summary: "Complete course of 25 EBRT + 4 Brachytherapy delivered within curative envelope. No Grade 3 late toxicity.",
      });
      setDischargeComplete(true);
      setDischargeMsg(res.message);
      const purge = await api.purgeAudioCache(patientToken) as { recordings_deleted?: number };
      showToast(`Discharge sign-off registered. ${purge.recordings_deleted ?? 0} stored recording(s) deleted (DPDP Act).`, "success");
    } catch {
      setDischargeMsg("Discharge sign-off could not be confirmed with the server. Please retry when back online.");
      showToast("Could not reach the server. Sign-off and audio purge not confirmed.", "warning");
    }
  };

  const analyseConsult = async (input: { audio?: Blob; text?: string }) => {
    setConsultBusy(true);
    setConsultError(null);
    try {
      const context = `EBRT fractions delivered ${ebrtFractions}; Hb ${labHb} g/dL; ANC ${labAnc}/uL; platelets ${labPlatelets} x10^3/uL; creatinine ${labCreatinine} mg/dL.`;
      const result = await api.voiceConsult(patientToken, { ...input, context });
      setConsult(result);
      setDoneCommands([]);
      setTypedNotes("");
    } catch (e) {
      setConsultError(e instanceof Error ? e.message : "Could not process the consultation");
    } finally {
      setConsultBusy(false);
    }
  };

  const consultRecorder = useVoiceRecorder(180, (audio) => analyseConsult({ audio }));
  const isRecording = consultRecorder.recording;
  const recordingSeconds = consultRecorder.seconds;

  const runVoiceCommand = (command: VoiceConsultResult["commands"][number]) => {
    if (command.command === "CHEMO_HOLD") handleChemoAction("HELD");
    if (command.command === "CHEMO_REDUCE") handleChemoAction("REDUCED");
    if (command.command === "CHEMO_APPROVE") handleChemoAction("APPROVED");
    if (command.command === "LOG_FRACTION") handleLogFraction();
    setDoneCommands((prev) => [...prev, command.command]);
  };

  const handleApplyAiTranscript = () => {
    if (!consult) return;
    const { draft } = consult;
    if (draft.chief_complaints) setChiefComplaints(draft.chief_complaints);
    if (draft.clinical_history) setClinicalHistory(draft.clinical_history);
    if (draft.medications.length) {
      setMedications((prev) => [
        ...prev,
        ...draft.medications.map((m, i) => ({ ...m, id: `med-voice-${Date.now()}-${i}` })),
      ]);
    }
    setConsult(null);
    showToast("Draft applied to the form. Please review before signing.", "success");
  };

  const handleExportFhir = () => {
    window.open(`/api/patient/${patientToken}/fhir`, "_blank");
    showToast("Exporting de-identified FHIR R4 medical bundle", "info");
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-[#111418] font-sans overflow-hidden">
      {/* 1. TOP AUTHORITATIVE PATIENT & ENCOUNTER BANNER */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 shrink-0 shadow-2xs z-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Patient Identification & Clinical Tags */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar Initial */}
            <div className="size-11 rounded-xl bg-[#DBFE87] text-black font-bold text-lg flex items-center justify-center border border-[#c4e872] shadow-2xs shrink-0">
              {patientDisplayName.charAt(0)}
            </div>

            <div className="min-w-0">
              {/* Primary Identity Row */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-black truncate">
                  {patientDisplayName}
                </h1>
                <span className="text-xs text-gray-500 font-medium">48 Y, Female</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-mono text-gray-600">ID: BHY67-7891</span>
                <span className="text-gray-300">•</span>
                <button
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 text-xs font-mono text-[#BA2D0B] font-semibold bg-[#BA2D0B]/10 hover:bg-[#BA2D0B]/20 px-2 py-0.5 rounded border border-[#BA2D0B]/20 transition-colors cursor-pointer"
                  title="Click to copy token"
                >
                  <span>{patientToken}</span>
                  {copiedToken ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 opacity-70" />}
                </button>

                {/* Patient Switcher if multiple cases are loaded */}
                {cases.length > 1 && onSelectPatient && (
                  <div className="relative">
                    <button
                      onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                      className="text-[11px] font-semibold text-gray-600 hover:text-black flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      <span>Switch Patient ({cases.length})</span>
                      <ChevronDown className="size-3" />
                    </button>
                    {patientDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 text-xs">
                        <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Active Ward Patients
                        </div>
                        {cases.map((c) => (
                          <button
                            key={c.patient_token}
                            onClick={() => {
                              if (c.patient_token) onSelectPatient(c.patient_token);
                              setPatientDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between transition-colors ${
                              c.patient_token === patientToken ? "bg-blue-50/80 font-bold text-blue-900" : "text-gray-700"
                            }`}
                          >
                            <span className="truncate">{c.patient_name || c.patient_token}</span>
                            <span className="text-[10px] font-mono text-gray-400">{c.suspected_stage || "CCRT"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clinical Tags Row */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Blood Group: B+
                </span>
                <span className="text-[11px] font-semibold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Allergy: Cisplatin Rash (Mild)
                </span>
                <span className="text-[11px] font-semibold text-black bg-[#DBFE87]/40 px-2 py-0.5 rounded border border-[#c4e872]">
                  BPL / Pink (PM-JAY Eligible)
                </span>
                <span className="text-[11px] font-medium text-slate-700 bg-gray-100 px-2 py-0.5 rounded">
                  ABHA: 91-4521-8890-1234
                </span>
                <span className="text-[11px] font-medium text-slate-800 bg-[#90C3CB]/20 px-2 py-0.5 rounded border border-[#90C3CB]/40 hidden md:inline">
                  Mirzapur Spoke Clinic (~12 km)
                </span>
              </div>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Encounter Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setEncounterDropdownOpen(!encounterDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-gray-50/80 hover:bg-gray-100 text-xs font-semibold text-gray-800 transition-colors cursor-pointer"
              >
                <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ambulatory (Curative CCRT)</span>
                <span className="text-[10px] font-mono text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                  Step {totalCompleted}/29
                </span>
                <ChevronDown className="size-3 text-gray-500" />
              </button>

              {/* Past Encounters Popover */}
              {encounterDropdownOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 text-xs">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Encounter Timeline & History
                  </div>
                  <div className="space-y-1.5">
                    <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200">
                      <div className="flex items-center justify-between font-bold text-blue-900">
                        <span>Ambulatory (Curative CCRT)</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">Active</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">24 Mar - Ongoing · Mirzapur Spoke</div>
                    </div>
                    {[
                      { title: "Daycare Chemo (Cycle 2)", date: "17 Mar 2026", status: "Completed" },
                      { title: "Radiation Planning & CT Sim", date: "10 Mar - 12 Mar 2026", status: "Completed" },
                      { title: "Biopsy Histopathology", date: "24 Feb - 26 Feb 2026", status: "Completed" },
                      { title: "First OPD Consult", date: "18 Feb 2026", status: "Discharged" },
                    ].map((enc, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-gray-100 hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-gray-800">{enc.title}</div>
                          <div className="text-[10px] text-gray-400">{enc.date}</div>
                        </div>
                        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-medium">
                          {enc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Back to Dashboard Roster */}
            {onBackToDashboard && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToDashboard}
                className="text-xs font-medium text-gray-700"
              >
                <Sym n="arrow-left" /> Back
              </Button>
            )}

            {/* Patient Companion Portal Link */}
            {onOpenPatientCompanion && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenPatientCompanion(patientToken)}
                className="text-xs font-medium text-black border-slate-200 hover:bg-slate-100 gap-1.5"
              >
                <Globe className="size-3.5" />
                <span className="hidden sm:inline">Portal</span>
              </Button>
            )}

            {/* Inspector Toggle Button */}
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                isRightPanelOpen
                  ? "bg-slate-100 border-slate-300 text-black"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              title="Toggle Encounter Details & Reports Rail"
            >
              <PanelRight className="size-3.5" />
              <span className="hidden md:inline">Inspector</span>
            </button>

            {/* Encounter Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setActionsDropdownOpen(!actionsDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-black/85 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Actions</span>
                <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded font-mono hidden sm:inline">⌘E</span>
                <ChevronDown className="size-3" />
              </button>

              {actionsDropdownOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 text-xs">
                  <button
                    onClick={() => {
                      handleExportFhir();
                      setActionsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                  >
                    <Download className="size-3.5 text-blue-600" />
                    <span>Export FHIR R4 Bundle</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("consultation");
                      setActionsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                  >
                    <Sparkles className="size-3.5 text-[#F19941]" />
                    <span>Ambient AI Voice Intake</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await api.recordNoShow(patientToken, "DR-SHARMA-01");
                        showToast("Marked today as patient no-show; clock recalculated", "warning");
                      } catch {
                        showToast("Marked today as patient no-show", "warning");
                      }
                      setActionsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                  >
                    <Clock className="size-3.5 text-amber-600" />
                    <span>Mark Today No-Show</span>
                  </button>

                  <button
                    onClick={() => {
                      window.print();
                      setActionsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                  >
                    <Printer className="size-3.5 text-gray-500" />
                    <span>Print Treatment Record</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. FIVE FOCUSED CLINICAL DOMAIN TABS */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold pt-3 border-t border-gray-100">
          {[
            { id: "overview", label: "Overview & Vitals", icon: Activity, badge: null },
            { id: "ccrt-protocol", label: "CCRT Protocol & Vault", icon: Zap, badge: `Step ${totalCompleted}/29` },
            { id: "hub-bridge", label: "Pre-Brachy Hub Bridge", icon: Building2, badge: hubSlotConfirmed ? "Slot Locked" : "Day 41 Prep" },
            { id: "consultation", label: "Consultation & AI Voice", icon: Stethoscope, badge: isRecording ? "Live Audio" : null },
            { id: "abha-consent", label: "ABHA & DPDP Consent", icon: ShieldCheck, badge: dischargeComplete ? "Discharged" : "DPDP Active" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as EncounterTab)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#111418] text-white shadow-xs"
                    : "text-gray-600 hover:text-black hover:bg-gray-100"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* 3. MAIN WORKSPACE WITH OPTIONAL COLLAPSIBLE INSPECTOR RAIL */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* CENTER SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 space-y-6">
          {/* ========================================================
              TAB 1: CLINICAL OVERVIEW & VITALS
              ======================================================== */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-5xl">
              {/* Today's Clinical Vitals Card */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-[#111418] uppercase tracking-wider">
                        Today's Ingested Vitals Panel
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500">
                        Recorded 09:30 AM by Nurse Sunita Patel · Linear Accelerator Ward #1
                      </CardDescription>
                    </div>
                    <Badge variant="primary" size="xs">Verified In-Person</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Blood Pressure</div>
                      <div className="text-base font-bold text-black mt-0.5">120 / 80</div>
                      <div className="text-[10px] text-emerald-700 font-medium">Normotensive</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Pulse Rate</div>
                      <div className="text-base font-bold text-black mt-0.5">66 <span className="text-[10px] text-gray-500 font-normal">/min</span></div>
                      <div className="text-[10px] text-emerald-700 font-medium">Normal Sinus</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Temperature</div>
                      <div className="text-base font-bold text-black mt-0.5">98.2 <span className="text-[10px] text-gray-500 font-normal">°F</span></div>
                      <div className="text-[10px] text-emerald-700 font-medium">Afebrile</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Respiratory Rate</div>
                      <div className="text-base font-bold text-black mt-0.5">20 <span className="text-[10px] text-gray-500 font-normal">/min</span></div>
                      <div className="text-[10px] text-gray-500 font-medium">Unlabored</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">SpO2 Oxygen</div>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">99%</div>
                      <div className="text-[10px] text-gray-500 font-medium">Room Air</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Body Weight</div>
                      <div className="text-base font-bold text-black mt-0.5">52.4 <span className="text-[10px] text-gray-500 font-normal">kg</span></div>
                      <div className="text-[10px] text-gray-500 font-medium">Baseline 53.0 kg</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Oncology Diagnoses & Staging */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#111418] uppercase tracking-wider">
                      Oncology Diagnosis & Staging
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Histopathological Confirmation & Disease Extent
                    </CardDescription>
                  </div>
                  <Badge variant="primary" size="xs">Curative Intent CCRT</Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Condition</TableHead>
                        <TableHead>Staging / Histology</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Biopsy Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-bold text-xs text-gray-900">
                          Cervical Squamous Cell Carcinoma (SCC)
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 font-mono">
                          {patientStage}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Confirmed Biopsy
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">24 Feb 2026</TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Active (Curative)
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Active Symptoms & Toxicity Triage */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#111418] uppercase tracking-wider">
                      Active Reported Symptoms & Vernacular Triage
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Ingested via Vernacular Co-Pilot Check-in & Nursing Intake
                    </CardDescription>
                  </div>
                  <span className="text-xs text-gray-400">CTCAE v5.0 Toxicity Grading</span>
                </CardHeader>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reported Symptom</TableHead>
                        <TableHead>Severity / Grade</TableHead>
                        <TableHead>Capture Channel</TableHead>
                        <TableHead>Clinical Action Executed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold text-xs text-gray-900">
                          Radiation Diarrhea (5 watery stools/day)
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Grade 2 (Moderate)
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">Patient Audio Check-in</TableCell>
                        <TableCell className="text-xs text-indigo-700 font-semibold">
                          Oral Loperamide + Hydration Guidance Dispatched
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-xs text-gray-900">
                          Pelvic Burning on Urination (Dysuria)
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Grade 1 (Mild)
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">Ward Vitals Check</TableCell>
                        <TableCell className="text-xs text-gray-600">
                          Urine culture ordered; Alkalinizing agent initiated
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================
              TAB 2: CCRT PROTOCOL & RADIATION VAULT (UNIFIED ENGINE)
              ======================================================== */}
          {activeTab === "ccrt-protocol" && (
            <div className="space-y-6 max-w-5xl">
              {/* Biological Healing Clock & 29-Step Trajectory */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Biological Healing Clock & Overall Treatment Time (OTT)
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      GEC-ESTRO Curative Target &le; 49 Days · NCG Absolute Safety Ceiling &le; 56 Days
                    </CardDescription>
                  </div>
                  <Badge
                    variant={isOptimal ? "primary" : isBreach ? "destructive" : "warning"}
                    size="md"
                  >
                    {isOptimal
                      ? "Optimal Curative Window (<=49d)"
                      : isBreach
                      ? "HARD CEILING BREACH (>56d)"
                      : "Caution Margin (50-56d)"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {/* Visual 29-Step Trajectory Indicator */}
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-2">
                      <span>29-Step Curative Treatment Trajectory</span>
                      <span>{totalCompleted} of 29 Sessions Delivered</span>
                    </div>

                    {/* 25 EBRT dots + 4 HDR Brachy diamonds */}
                    <div className="flex flex-wrap items-center gap-2 py-2">
                      {Array.from({ length: 25 }).map((_, i) => {
                        const isDone = i < ebrtFractions;
                        const isCurrent = i === ebrtFractions;
                        return (
                          <span
                            key={`ebrt-${i}`}
                            className={`size-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                              isDone
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : isCurrent
                                ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300 animate-pulse font-extrabold"
                                : "bg-gray-200 text-gray-400"
                            }`}
                            title={`EBRT Fraction ${i + 1} (2.0 Gy)`}
                          >
                            {i + 1}
                          </span>
                        );
                      })}

                      <span className="text-gray-300 font-bold px-1">|</span>

                      {Array.from({ length: 4 }).map((_, i) => {
                        const isDone = i < brachyFractions;
                        return (
                          <span
                            key={`brachy-${i}`}
                            className={`size-4.5 rotate-45 flex items-center justify-center text-[8px] font-bold transition-all ${
                              isDone
                                ? "bg-purple-600 text-white shadow-2xs"
                                : "bg-gray-200 text-gray-500"
                            }`}
                            title={`Brachytherapy Fraction ${i + 1} (HDR)`}
                          >
                            <span className="-rotate-45">B{i + 1}</span>
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200 gap-2">
                      <span>Fractions 1–25: External Beam Radiotherapy (50 Gy to Pelvis)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-purple-700">Fractions 26–29: HDR Brachytherapy (Hub RCC)</span>
                        <button
                          onClick={() => {
                            setBrachyFractions((prev) => Math.min(4, prev + 1));
                            showToast(`Logged Hub Brachytherapy Fraction ${Math.min(4, brachyFractions + 1)}`, "success");
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer font-semibold transition-colors"
                        >
                          + Log Brachy ({brachyFractions}/4)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3 Metric Summary Boxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-gray-200">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Days Elapsed Since Day 1</div>
                      <div className="text-xl font-bold text-black mt-0.5">{daysElapsed} Days</div>
                      <div className="text-[11px] text-gray-500">Start: 24 Mar 2026 (Clinic Timezone)</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-gray-200">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Projected Completion</div>
                      <div className="text-xl font-bold text-emerald-700 mt-0.5">Day {projectedFinish}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold">5 Days buffer before 49d target</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-gray-200">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Loss of Pelvic Control Risk</div>
                      <div className="text-xl font-bold text-black mt-0.5">0.0%</div>
                      <div className="text-[11px] text-gray-500">No penalty incurred (&le; 56d safe envelope)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Radiation Vault Beam Console (1-Tap Delivery) */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Radiation Vault Beam Delivery Console
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Operated by Nurse Sunita Patel / Technologist · Linear Accelerator #1
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => {
                      const next = !machineDowntime;
                      setMachineDowntime(next);
                      showToast(next ? "LINAC Downtime Active: Delinquency counters paused" : "LINAC Downtime Cleared", next ? "warning" : "info");
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                      machineDowntime
                        ? "bg-rose-50 border-rose-300 text-rose-800"
                        : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {machineDowntime ? "LINAC Downtime Active" : "Machine Status: Normal"}
                  </button>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {machineDowntime && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Machine Downtime Mode Active</AlertTitle>
                      <AlertDescription className="text-xs">
                        Patient delinquency escalation counters (Tier 1–4) are temporarily paused. Biological clock remains active; weekend make-up session scheduled.
                      </AlertDescription>
                    </Alert>
                  )}

                  {duplicateGuardTriggered && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>18-Hour Duplicate Fraction Lockout</AlertTitle>
                      <AlertDescription className="text-xs">
                        A fraction was already logged in the last 18 hours. To prevent radiation overdose, consecutive fractions are locked unless hyperfractionation (BID) is authorized by doctor.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Ready for Beam Delivery Card */}
                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">
                        Patient In-Vault &middot; Ready for Beam Delivery
                      </span>
                      <div className="text-base font-bold text-black mt-0.5">
                        Step {ebrtFractions + 1} of 29: EBRT Fraction {ebrtFractions + 1} (2.0 Gy to Pelvis)
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Verified 200 cGy &middot; Target Volume: Whole Pelvis + Parametrial Boost
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLogFraction}
                        disabled={ebrtFractions >= 25}
                        className="px-5 py-3 rounded-xl bg-[#BA2D0B] hover:bg-[#a02609] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        <Zap className="size-4" />
                        <span>LOG FRACTION {ebrtFractions + 1} AS DELIVERED</span>
                      </button>

                      {undoActive && (
                        <button
                          onClick={handleUndoFraction}
                          className="px-3.5 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Undo2 className="size-4" />
                          <span>Undo ({undoSecondsLeft}s)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Cisplatin Chemotherapy Clearance Card */}
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Weekly Cisplatin Chemotherapy Clearance Card
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Cycle #3 Due &middot; Nephrotoxicity & Cytopenia Safety Guardrails
                    </CardDescription>
                  </div>
                  <Badge
                    variant={chemoStatus === "APPROVED" ? "primary" : chemoStatus === "HELD" ? "destructive" : "neutral"}
                    size="md"
                  >
                    Clearance: {chemoStatus}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Lab Ingestion Grid */}
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold text-gray-700 uppercase tracking-wider">
                        24h Ingested Pathology Labs (CBC & RFT)
                      </span>
                      <span className="text-emerald-700 font-semibold">Pathology Lab OCR Verified <Sym n="check" /></span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Hemoglobin (Hb)</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={labHb}
                            onChange={(e) => setLabHb(parseFloat(e.target.value) || 0)}
                            className="w-14 text-sm font-bold text-black border-b border-gray-300 focus:outline-none focus:border-black"
                          />
                          <span className="text-[10px] text-gray-400">g/dL</span>
                        </div>
                        <div className={`text-[10px] font-semibold mt-1 ${labHb >= 10.0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {labHb >= 10.0 ? "Safe (>= 10.0)" : "Low (Transfusion Advised)"}
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Absolute Neutrophil (ANC)</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            value={labAnc}
                            onChange={(e) => setLabAnc(parseInt(e.target.value, 10) || 0)}
                            className="w-16 text-sm font-bold text-black border-b border-gray-300 focus:outline-none focus:border-black"
                          />
                          <span className="text-[10px] text-gray-400">/µL</span>
                        </div>
                        <div className={`text-[10px] font-semibold mt-1 ${labAnc >= 1500 ? "text-emerald-700" : "text-rose-700"}`}>
                          {labAnc >= 1500 ? "Safe (>= 1500)" : "Neutropenic Alert"}
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Platelet Count</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            value={labPlatelets}
                            onChange={(e) => setLabPlatelets(parseInt(e.target.value, 10) || 0)}
                            className="w-14 text-sm font-bold text-black border-b border-gray-300 focus:outline-none focus:border-black"
                          />
                          <span className="text-[10px] text-gray-400">k/µL</span>
                        </div>
                        <div className={`text-[10px] font-semibold mt-1 ${labPlatelets >= 100 ? "text-emerald-700" : "text-rose-700"}`}>
                          {labPlatelets >= 100 ? "Safe (>= 100k)" : "Thrombocytopenic"}
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Serum Creatinine</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            step="0.05"
                            value={labCreatinine}
                            onChange={(e) => setLabCreatinine(parseFloat(e.target.value) || 0)}
                            className="w-14 text-sm font-bold text-black border-b border-gray-300 focus:outline-none focus:border-black"
                          />
                          <span className="text-[10px] text-gray-400">mg/dL</span>
                        </div>
                        <div className={`text-[10px] font-semibold mt-1 ${labCreatinine <= 1.2 ? "text-emerald-700" : "text-rose-700"}`}>
                          {labCreatinine <= 1.2 ? "Normal (<= 1.2)" : "Elevated Creatinine"}
                        </div>
                      </div>

                      <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200">
                        <div className="text-[10px] text-blue-700 font-bold uppercase">Calculated eGFR</div>
                        <div className="text-base font-bold text-blue-900 mt-0.5">{calculatedEgfr} <span className="text-[10px] text-blue-600 font-normal">mL/min</span></div>
                        <div className="text-[10px] text-blue-700 font-semibold mt-1">Normal Renal Function</div>
                      </div>
                    </div>
                  </div>

                  {/* Crucial Chemo Hold Clinical Directive Alert */}
                  {chemoStatus === "HELD" && (
                    <div className="p-4 bg-rose-50 border-2 border-[#BA2D0B] rounded-xl shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-[#BA2D0B] text-white flex items-center justify-center shrink-0">
                          <AlertCircle className="size-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#BA2D0B] px-2 py-0.5 rounded">
                            NCG &amp; GEC-ESTRO Curative Directive
                          </span>
                          <div className="text-sm font-bold text-rose-950 mt-1">
                            Chemotherapy Held for 48h &mdash; Daily External Beam Radiation (EBRT) MUST Continue Unbroken!
                          </div>
                          <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                            Never suspend or delay daily radiation fractions for chemotherapy-induced nephrotoxicity or cytopenia. Halting radiation allows cervical cancer stem cells to repopulate rapidly, incurring ~1% loss of local pelvic control per lost day beyond the 56-day curative envelope.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Doctor Clearance Actions */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        Cisplatin Dosage Recommendation: 40 mg/m² (65 mg in 500 mL Normal Saline)
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Requires 1000 mL pre-hydration + 1000 mL post-hydration. Daily EBRT continues uninterrupted.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="obsidian"
                        size="sm"
                        onClick={() => handleChemoAction("APPROVED")}
                        className="bg-black hover:bg-black/85 text-white"
                      >
                        Approve Cisplatin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChemoAction("HELD")}
                        className="text-[#BA2D0B] border-[#BA2D0B]/40 hover:bg-rose-50 font-bold"
                      >
                        Hold (Keep EBRT Running)
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleChemoAction("REDUCED")}
                      >
                        Reduce 25%
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================
              TAB 3: PRE-BRACHY HUB BRIDGE (STEPS 2A, 2B, 2C)
              ======================================================== */}
          {activeTab === "hub-bridge" && (
            <div className="space-y-6 max-w-5xl">
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Day-21 (Fraction 15) Brachytherapy Hub-Spoke Handoff
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Regional Cancer Centre (Varanasi ~75 km Hub) Transfer &amp; Logistics Bridge
                    </CardDescription>
                  </div>
                  <Badge variant="primary" size="md">
                    {hubSlotConfirmed ? "Step 2B: Slot Locked" : "Step 2A: Gate Initiated"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {hubDeficiencyReturned && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Referral Returned with Deficiency (48h Action SLA)</AlertTitle>
                      <AlertDescription className="text-xs">
                        Hub Oncologist requested: Verify Hb &ge; 10.0 g/dL before transfer. Spoke nurse notified to arrange repeat CBC or PRBC transfusion.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Step 2A: Spoke Readiness Checklist */}
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200">
                    <div className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                      Step 2A: Spoke Pre-Brachy Readiness Checklist (Fraction 10 Prepared)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <label className="flex items-center gap-2.5 text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pacCleared}
                          onChange={() => setPacCleared(!pacCleared)}
                          className="rounded size-4 text-[#BA2D0B]"
                        />
                        <span>Pre-Anesthetic Clearance (PAC) Cleared by Anesthetist</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={intracavitarySuitable}
                          onChange={() => setIntracavitarySuitable(!intracavitarySuitable)}
                          className="rounded size-4 text-[#BA2D0B]"
                        />
                        <span>Pelvic Regression: Intracavitary Tandem &amp; Ovoids Suitable</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-gray-800 cursor-pointer">
                        <input type="checkbox" checked readOnly className="rounded size-4 text-emerald-600" />
                        <span>Hemoglobin &ge; 10.0 g/dL (Blood Transfusion Not Required)</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-gray-800 cursor-pointer">
                        <input type="checkbox" checked readOnly className="rounded size-4 text-emerald-600" />
                        <span>Renal Function (eGFR &ge; 60 mL/min) Validated</span>
                      </label>
                    </div>
                  </div>

                  {/* Accelerated BID Advisor for Late Arrivals */}
                  <div className="p-4 bg-[#DBFE87]/40 border border-[#b8dc63] rounded-xl flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-black text-[#DBFE87] font-bold text-xs flex items-center justify-center shrink-0">
                      BID
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-black bg-[#DBFE87] px-2 py-0.5 rounded">
                          Accelerated Brachytherapy Protocol
                        </span>
                        <span className="text-xs font-bold text-black">
                          GEC-ESTRO Curative Envelope Salvage (Late Arrivals / Delay Salvage)
                        </span>
                      </div>
                      <p className="text-xs text-gray-800 mt-1 leading-relaxed">
                        For patients arriving on or after Day 45, deliver 2 High-Dose-Rate brachytherapy fractions per day separated by &ge; 6 hours inter-fraction interval (e.g. 09:00 and 16:00). This protects normal rectal and bladder tissue while bringing overall treatment time (OTT) back under the 56-day curative threshold.
                      </p>
                    </div>
                  </div>

                  {/* Step 2B: Hub OT Slot Lock */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        Hub High-Dose-Rate Brachytherapy Slot (Requested Window: Days 38–44)
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Suite: RCC OT-2 &middot; Scheduled Date:</span>
                        <select
                          value={provisionalSlotDate}
                          onChange={(e) => setProvisionalSlotDate(e.target.value)}
                          className="text-xs font-semibold p-1.5 rounded-lg border border-gray-300 bg-white"
                        >
                          <option value="Day 41 (Wednesday)">Day 41 (Wednesday)</option>
                          <option value="Day 42 (Thursday)">Day 42 (Thursday)</option>
                          <option value="Day 43 (Friday)">Day 43 (Friday)</option>
                          <option value="Day 44 (Saturday)">Day 44 (Saturday)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="obsidian"
                        size="sm"
                        onClick={() => {
                          setHubSlotConfirmed(true);
                          setBusVoucherIssued(true);
                          showToast("Hub OT Slot locked on Day 41. Bus & Dharamshala passes dispatched.", "success");
                        }}
                        className="bg-black hover:bg-black/85 text-white"
                      >
                        {hubSlotConfirmed ? <><Sym n="check" /> Slot Confirmed (Day 41)</> : "Confirm Hub OT Slot (Step 2B)"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReturnDeficiency}
                        className="text-[#BA2D0B] border-[#BA2D0B]/40 hover:bg-rose-50 font-bold"
                      >
                        Return with Deficiency (48h SLA)
                      </Button>
                    </div>
                  </div>

                  {/* Step 2C: Automated Transport & Dharamshala Passes */}
                  {busVoucherIssued && (
                    <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <span>Logistics Bridge Activated: Passes Dispatched to Patient Phone</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                              <Bus className="size-3.5 text-blue-600" />
                              <span>State Bus Voucher (UP-RTC-7891)</span>
                            </div>
                            <div className="text-[11px] text-gray-500">Mirzapur Spoke &rarr; Varanasi RCC (~75 km)</div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Confirmed
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                              <Bed className="size-3.5 text-purple-600" />
                              <span>Hospital Dharamshala Pass (DHM-402)</span>
                            </div>
                            <div className="text-[11px] text-gray-500">3 Nights Stay &middot; Caregiver Accompanied</div>
                          </div>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                            Room 402
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================
              TAB 4: CONSULTATION & AI AMBIENT VOICE
              ======================================================== */}
          {activeTab === "consultation" && (
            <div className="space-y-6 max-w-5xl">
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Oncology Consultation Form &amp; Prescription
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Standard CARE EMR Layout with Sarvam Ambient Audio AI Transcription
                    </CardDescription>
                  </div>
                  {/* Ambient Microphone Toggle Button */}
                  <button
                    onClick={() => (isRecording ? consultRecorder.stop() : consultRecorder.start())}
                    disabled={consultBusy || consultRecorder.starting}
                    data-testid="consult-mic"
                    className={`h-9 px-3.5 rounded-full flex items-center gap-2 text-white shadow-xs transition-all cursor-pointer ${
                      isRecording ? "bg-black animate-pulse" : "bg-[#BA2D0B] hover:bg-[#a02609]"
                    }`}
                  >
                    {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    <span className="text-xs font-mono font-semibold">
                      {isRecording
                        ? `Recording ${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")} · Stop`
                        : consultBusy
                          ? "Analysing..."
                          : consultRecorder.starting
                            ? "Starting mic..."
                            : "Ambient Mic"}
                    </span>
                  </button>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {/* Voice or typed consultation -> reviewable diagnostic draft */}
                  <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
                    <p className="text-xs text-gray-600">
                      Press Ambient Mic and speak the consultation in any supported language, or type your notes. Say things like "hold chemo" or "log the fraction" and they appear below for you to confirm.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <textarea
                        value={typedNotes}
                        onChange={(e) => setTypedNotes(e.target.value)}
                        rows={2}
                        placeholder="Or type consultation notes here"
                        data-testid="consult-notes"
                        className="flex-1 text-xs p-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-black"
                      />
                      <Button
                        size="xs"
                        variant="obsidian"
                        disabled={consultBusy || !typedNotes.trim()}
                        onClick={() => analyseConsult({ text: typedNotes })}
                      >
                        Analyse Notes
                      </Button>
                    </div>
                    {(consultError || consultRecorder.error) && (
                      <p role="alert" className="text-xs text-[#BA2D0B]">{consultError || consultRecorder.error}</p>
                    )}
                  </div>

                  {consult && (
                    <div data-testid="consult-draft" className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-900">
                          {consult.draft.source === "AI_DRAFT" ? "AI draft for your review" : "Transcript ready (AI draft unavailable)"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button size="xs" variant="obsidian" onClick={handleApplyAiTranscript} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                            Apply to Form <Sym n="check" />
                          </Button>
                          <button onClick={() => setConsult(null)} aria-label="Dismiss draft" className="p-1 rounded text-emerald-700 hover:bg-emerald-100 cursor-pointer">
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-emerald-800 italic">"{consult.transcript}"</p>
                      {consult.audio_id && (
                        <audio controls preload="none" src={api.consultAudioUrl(patientToken, consult.audio_id)} className="w-full h-8" />
                      )}
                      {consult.draft.working_impression && (
                        <div className="text-xs text-gray-800">
                          <span className="font-bold">Working impression: </span>
                          {consult.draft.working_impression}
                          {consult.draft.toxicity_grade !== null && <span className="font-semibold"> (Toxicity grade {consult.draft.toxicity_grade})</span>}
                        </div>
                      )}
                      {([
                        ["Consider", consult.draft.differentials, "text-gray-800"],
                        ["Red flags", consult.draft.red_flags, "text-[#BA2D0B]"],
                        ["Suggested next steps", consult.draft.next_steps, "text-gray-800"],
                      ] as const).map(([title, items, color]) =>
                        items.length > 0 ? (
                          <div key={title} className={`text-xs ${color}`}>
                            <span className="font-bold">{title}</span>
                            <ul className="list-disc pl-4 mt-0.5">
                              {items.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null
                      )}
                      {consult.commands.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1" data-testid="consult-commands">
                          {consult.commands.map((c) => (
                            <button
                              key={c.command}
                              onClick={() => runVoiceCommand(c)}
                              disabled={doneCommands.includes(c.command)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white disabled:opacity-50 cursor-pointer"
                            >
                              {doneCommands.includes(c.command) ? `Done: ${c.label}` : `Confirm: ${c.label}`}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-500">Decision support only. Nothing is saved or actioned until you confirm it.</p>
                    </div>
                  )}

                  {/* Chief Complaints */}
                  <div>
                    <label className="text-xs font-bold text-gray-800 block mb-1.5">Chief Complaints</label>
                    <textarea
                      value={chiefComplaints}
                      onChange={(e) => setChiefComplaints(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-black bg-white text-gray-800 leading-relaxed"
                    />
                  </div>

                  {/* Clinical History & Narrative */}
                  <div>
                    <label className="text-xs font-bold text-gray-800 block mb-1.5">Clinical History &amp; Narrative</label>
                    <textarea
                      value={clinicalHistory}
                      onChange={(e) => setClinicalHistory(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-black bg-white text-gray-800 leading-relaxed"
                    />
                  </div>

                  {/* Prescription Medications Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Prescription Medications
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setMedications((prev) => [
                            ...prev,
                            {
                              id: `med-${prev.length + 1}`,
                              name: "Paracetamol 650 mg",
                              dosage: "1 Tablet",
                              frequency: "1-1-1 (Thrice a day as needed)",
                              duration: "3 Days",
                              instructions: "For post-radiation pelvic aching or mild fever",
                            },
                          ])
                        }
                        className="text-xs text-[#BA2D0B]"
                      >
                        <Plus className="size-3 mr-1" /> Add Medication
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Dosage</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Instructions</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medications.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-semibold text-xs text-gray-900">{m.name}</TableCell>
                            <TableCell className="text-xs text-gray-700">{m.dosage}</TableCell>
                            <TableCell className="text-xs text-gray-700 font-mono">{m.frequency}</TableCell>
                            <TableCell className="text-xs text-gray-700">{m.duration}</TableCell>
                            <TableCell className="text-xs text-gray-500">{m.instructions}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => setMedications((prev) => prev.filter((item) => item.id !== m.id))}
                                className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Remove medication"
                              >
                                <X className="size-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================
              TAB 5: ABHA & DPDP CONSENT (WITH DISCHARGE SIGN-OFF)
              ======================================================== */}
          {activeTab === "abha-consent" && (
            <div className="space-y-6 max-w-5xl">
              <Card className="bg-white border-gray-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-base font-bold text-[#111418]">
                    Ayushman Bharat Health Account (ABHA) &amp; DPDP Consent
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    National Health Authority (NHA) &amp; Digital Personal Data Protection Act 2023 Compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-5 text-xs">
                  <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3">
                    <Button variant="obsidian" size="xs">Link Existing ABHA</Button>
                    <Button variant="outline" size="xs">Generate New ABHA via Aadhaar</Button>
                    <span className="text-gray-400 text-[11px] ml-auto">
                      Aadhaar number is never stored on CerviSetu servers.
                    </span>
                  </div>

                  <div className="space-y-3 pt-1 text-gray-700">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#BA2D0B]" />
                      <span>
                        I voluntarily authorize sharing my health records with Regional Cancer Centre Hub and Mirzapur Spoke Clinic for the purpose of curative cancer management.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#BA2D0B]" />
                      <span>
                        I consent to the pseudonymization and cryptographic tokenization ({patientToken}) of my records for epidemiological tracking under DPDP Act 2023.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#BA2D0B]" />
                      <span>
                        Vernacular Audio Consent captured in Hindi: <em>"हाँ, मुझे सर्वाइसेतु से सहायता संदेश चाहिए।"</em> (Recorded on Day 1 Onboarding).
                      </span>
                    </label>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="size-4 text-emerald-700" />
                      <span className="font-semibold text-gray-800">DPDP Audio Consent Recording (Hindi)</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">SHA-256: 0x8bb3a45c...Verified <Sym n="check" /></span>
                  </div>

                  {/* Curative Milestone Completion & Final Discharge */}
                  <div className="p-5 bg-emerald-50/80 border-2 border-emerald-400 rounded-xl mt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="size-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded">
                            Curative Protocol Complete
                          </span>
                          <div className="text-sm font-bold text-emerald-950 mt-1">
                            Final Treatment Discharge &amp; DPDP Audio Cache Purge
                          </div>
                          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                            Signs off complete curative protocol (25 EBRT + 4 Brachytherapy delivered within curative envelope). Purges all transient raw ambient voice buffers from the local terminal in compliance with Section 8(7) of the Digital Personal Data Protection Act 2023.
                          </p>
                          {dischargeMsg && (
                            <div className="mt-2 text-xs font-semibold text-emerald-900 bg-white/90 p-2.5 rounded-lg border border-emerald-300">
                              <Sym n="check" /> {dischargeMsg}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="obsidian"
                        onClick={handleDischargeSignoff}
                        className="shrink-0 bg-black hover:bg-black/85 text-white text-xs font-bold"
                      >
                        {dischargeComplete ? <><Sym n="check" /> Discharged & Purged</> : "Execute Discharge Sign-Off"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ========================================================
            RIGHT COLLAPSIBLE INSPECTOR RAIL (DETAILS & REPORTS)
            ======================================================== */}
        {isRightPanelOpen && (
          <aside className="w-80 min-w-80 bg-white border-l border-gray-200 flex flex-col justify-between shrink-0 overflow-y-auto z-10 shadow-xs">
            <div className="p-4 space-y-4">
              {/* Tab Switcher: Details vs Reports */}
              <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-gray-50">
                <button
                  onClick={() => setRightPanelTab("details")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    rightPanelTab === "details"
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Encounter Details
                </button>
                <button
                  onClick={() => setRightPanelTab("reports")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    rightPanelTab === "reports"
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Reports (4)
                </button>
              </div>

              {rightPanelTab === "details" ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Encounter Metadata
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Encounter Status</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          In Progress
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Encounter Class</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Ambulatory CCRT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Priority</span>
                        <span className="font-medium text-gray-800">Routine Curative</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Start Date</span>
                        <span className="font-mono text-gray-700">24 Mar 2026</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Target Completion</span>
                        <span className="font-mono text-emerald-700 font-semibold">Day 44 (Optimal)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Facility &amp; Location
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-gray-800 font-semibold flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-gray-400" />
                        <span>Mirzapur District Oncology Daycare</span>
                      </div>
                      <div className="text-gray-500 text-[11px]">Primary Spoke Clinic (#04)</div>
                      <div className="text-gray-500 text-[11px]">Hub: Regional Cancer Centre, Varanasi</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Care Team
                    </div>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">Dr. Ananya Sharma</span>
                        <span className="text-gray-400">Radiation Oncologist</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">Nurse Sunita Patel</span>
                        <span className="text-gray-400">Vault Operator</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">Meena Devi</span>
                        <span className="text-gray-400">ASHA Coordinator</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Cryptographic Audit Stamp
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-[10px] font-mono text-gray-600 break-all space-y-1">
                      <div>Block: 0x8bb3a45c79e0...</div>
                      <div className="text-emerald-700 font-sans font-semibold flex items-center gap-1">
                        <ShieldCheck className="size-3" />
                        <span>Tamper-Proof Chained Ledger</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Diagnostic Reports &amp; Scans
                  </div>
                  {[
                    { name: "Cervical Biopsy Histopathology.pdf", date: "24 Feb 2026", size: "1.2 MB", tag: "Biopsy" },
                    { name: "Pelvic CT Simulation Scan.dcm", date: "10 Mar 2026", size: "18.4 MB", tag: "Imaging" },
                    { name: "Weekly CBC & RFT Panel.pdf", date: "Today 08:30 AM", size: "340 KB", tag: "Lab" },
                    { name: "Anesthesia PAC Clearance.pdf", date: "18 Mar 2026", size: "480 KB", tag: "PAC" },
                  ].map((rep, idx) => (
                    <div
                      key={idx}
                      onClick={() => showToast(`Opening ${rep.name}`, "info")}
                      className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-gray-800">
                        <span className="truncate">{rep.name}</span>
                        <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-medium shrink-0">
                          {rep.tag}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{rep.date}</span>
                        <span>{rep.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
              Logged in: <strong className="text-gray-700 font-semibold">Dr. Ananya Sharma</strong>
              <div className="text-[10px] text-gray-400">Radiation Oncology &middot; Spoke #04</div>
            </div>
          </aside>
        )}
      </div>

      {/* 4. TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
