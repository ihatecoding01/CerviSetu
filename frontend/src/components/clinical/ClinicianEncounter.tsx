import { Sym } from "../icons/Sym";
import { useCallback, useState, useEffect } from "react";
import { api, type VoiceConsultResult } from "../../api/client";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder";
import {
  Activity,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Mic,
  MicOff,
  Volume2,
  Building2,
  Globe,
  Stethoscope,
  X,
  Plus,
  PanelRight,
  ChevronDown,
  Copy,
  Download,
  Microscope,
  Printer,
  Check,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "../careui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../careui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../careui/table";

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
  | "pathway"
  | "followup"
  | "consultation"
  | "abha-consent";

import { CaseRecord } from "./CaseRecord";
import { referralApi, STATUS_LABELS, type Referral, type ReferralEvent } from "../../api/referrals";
import { ReferralJourney } from "../patient/ReferralJourney";

export function ClinicianEncounter({
  patientToken: requestedToken = "",
  onSelectPatient,
  onBackToDashboard,
  onOpenPatientCompanion,
}: ClinicianEncounterProps) {
  // Navigation & Workspace Layout State
  const [activeTab, setActiveTab] = useState<EncounterTab>("overview");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<"details" | "reports">("details");
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState<boolean>(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  // Match real case if passed from Overview roster
  const [boardRows, setBoardRows] = useState<Referral[]>([]);
  const patientToken = requestedToken || boardRows.find((r) => r.following)?.patient_token || boardRows[0]?.patient_token || "";
  const cases = boardRows.map((r) => ({ patient_token: r.patient_token, patient_name: r.patient_name, suspected_stage: STATUS_LABELS[r.status] }));
  const patientDisplayName = boardRows.find((r) => r.patient_token === patientToken)?.patient_name || patientToken;

  // Live referral record for this patient
  const [referral, setReferral] = useState<Referral | null>(null);
  const [referralEvents, setReferralEvents] = useState<ReferralEvent[]>([]);
  const loadReferral = useCallback(async () => {
    const { referrals } = await referralApi.board();
    setBoardRows(referrals);
    const found = referrals.find((r) => r.patient_token === patientToken) ?? null;
    setReferral(found);
    if (found) {


      setReferralEvents((await referralApi.events(found.referral_id)).events);
    }
  }, [patientToken]);
  useEffect(() => { loadReferral().catch(() => setReferral(null)); }, [loadReferral]);


  // AI Voice Consultation State
  const [consult, setConsult] = useState<VoiceConsultResult | null>(null);
  const [consultBusy, setConsultBusy] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);
  const [typedNotes, setTypedNotes] = useState("");
  const [doneCommands, setDoneCommands] = useState<string[]>([]);
  const [chiefComplaints, setChiefComplaints] = useState<string>("");
  const [clinicalHistory, setClinicalHistory] = useState<string>("");
  const [medications, setMedications] = useState<{ id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string }[]>([]);

  // Toast Helper
  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Copy patient token
  const handleCopyToken = () => {
    navigator.clipboard.writeText(patientToken);
    setCopiedToken(true);
    showToast(`Copied ${patientToken} to clipboard`, "info");
    setTimeout(() => setCopiedToken(false), 2000);
  };


  const analyseConsult = async (input: { audio?: Blob; text?: string }) => {
    setConsultBusy(true);
    setConsultError(null);
    try {
      const context = referral ? `Status ${STATUS_LABELS[referral.status]}; screening finding ${referral.screening_finding}; histopathology ${referral.histopathology || "pending"}.` : "";
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
    const target: Record<string, string> = { RECORD_ARRIVED: "ARRIVED", RECORD_COLPOSCOPY: "COLPOSCOPY_DONE", RECORD_BIOPSY: "BIOPSY_TAKEN" };
    if (target[command.command] && referral) void referralApi.setStatus(referral.referral_id, { status: target[command.command] }).then(() => loadReferral());
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
    window.open(`/api/fhir/patient/${patientToken}`, "_blank");
    showToast("Exporting de-identified FHIR R4 record", "info");
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-[#111418] font-sans overflow-hidden">
      {/* 1. TOP AUTHORITATIVE PATIENT & ENCOUNTER BANNER */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-5 py-3 shrink-0 shadow-2xs z-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Patient Identification & Clinical Tags */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar Initial */}
            <div className="size-11 rounded-xl bg-[#E0F2FE] text-black font-bold text-lg flex items-center justify-center border border-[#BAE6FD] shadow-2xs shrink-0">
              {patientDisplayName.charAt(0)}
            </div>

            <div className="min-w-0">
              {/* Primary Identity Row */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-black truncate">
                  {patientDisplayName}
                </h1>
                <span className="text-xs text-gray-500 font-medium">{referral?.age ? `${referral.age} Y, Female` : "Female"}</span>
                <span className="text-gray-300">•</span>
                <button
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 text-xs font-mono text-[#9D174D] font-semibold bg-[#9D174D]/10 hover:bg-[#9D174D]/20 px-2 py-0.5 rounded border border-[#9D174D]/20 transition-colors cursor-pointer"
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
                      <span>Switch Patient ({boardRows.length})</span>
                      <ChevronDown className="size-3" />
                    </button>
                    {patientDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 text-xs">
                        <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Referred Patients
                        </div>
                        {boardRows.map((c) => (
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
                            <span className="text-[10px] font-mono text-gray-400">{STATUS_LABELS[c.status] ?? c.status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clinical Tags Row */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {referral?.urgent && <span className="text-[11px] font-semibold text-rose-900 bg-rose-50 px-2 py-0.5 rounded">Urgent</span>}
                {referral?.fictional && <span className="text-[11px] font-semibold text-black bg-[#E0F2FE]/40 px-2 py-0.5 rounded">Fictional</span>}
                {referral && <span className="text-[11px] font-medium text-slate-800 bg-[#BAE6FD]/20 px-2 py-0.5 rounded">{referral.health_post} → {referral.hospital ?? "Not referred"}</span>}
              </div>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              title="Toggle Case Details & Reports Rail"
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
                <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 text-xs divide-y divide-gray-100">
                  {/* Workflow Actions */}
                  <div className="py-1">
                    {referral && referral.status === "REFERRED" && (
                      <button
                        onClick={async () => {
                          setActionsDropdownOpen(false);
                          try {
                            await referralApi.arrival(referral.referral_id);
                            await loadReferral();
                            showToast("Patient arrival confirmed. Case record unlocked.", "success");
                          } catch (e: any) {
                            showToast(e.message || "Could not confirm arrival", "warning");
                          }
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2 text-emerald-800 font-semibold transition-colors"
                      >
                        <UserCheck className="size-3.5 text-emerald-600" />
                        <span>Confirm Patient Arrival</span>
                      </button>
                    )}

                    {referral && referral.status !== "REFERRED" && (
                      <>
                        <button
                          onClick={async () => {
                            setActionsDropdownOpen(false);
                            try {
                              await referralApi.setStatus(referral.referral_id, { status: "COLPOSCOPY_DONE" });
                              await loadReferral();
                              showToast("Status updated to Colposcopy Done", "success");
                            } catch (e: any) {
                              showToast(e.message || "Could not update status", "warning");
                            }
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                        >
                          <Stethoscope className="size-3.5 text-sky-600" />
                          <span>Mark Colposcopy Done</span>
                        </button>

                        <button
                          onClick={async () => {
                            setActionsDropdownOpen(false);
                            try {
                              await referralApi.setStatus(referral.referral_id, { status: "BIOPSY_TAKEN" });
                              await loadReferral();
                              showToast("Status updated to Biopsy Taken", "success");
                            } catch (e: any) {
                              showToast(e.message || "Could not update status", "warning");
                            }
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                        >
                          <Microscope className="size-3.5 text-pink-600" />
                          <span>Mark Biopsy Taken</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Tools & Export */}
                  <div className="py-1">
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
                      <Sparkles className="size-3.5 text-[#0284C7]" />
                      <span>AI Voice Notes</span>
                    </button>

                    <button
                      onClick={() => {
                        window.print();
                        setActionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 transition-colors"
                    >
                      <Printer className="size-3.5 text-gray-500" />
                      <span>Print Case Record</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. CASE TABS */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold pt-3 border-t border-gray-100">
          {[
            { id: "overview", label: "Overview", icon: Activity, badge: null },
            { id: "pathway", label: "Case Record", icon: Zap, badge: referral ? STATUS_LABELS[referral.status] : null },
            { id: "followup", label: "Follow-up", icon: Building2, badge: referral?.following ? `Day ${referral.follow_up_day}` : null },
            { id: "consultation", label: "Consultation & AI Voice", icon: Stethoscope, badge: isRecording ? "Live Audio" : null },
            { id: "abha-consent", label: "ABHA & DPDP Consent", icon: ShieldCheck, badge: null },
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
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden relative">
        {/* CENTER SCROLLABLE WORKSPACE */}
        <div className="lg:flex-1 min-w-0 lg:overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === "overview" && referral && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <section className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="case-overview">
                <h2 className="text-sm font-bold text-black mb-3">Screening Summary</h2>
                <dl className="text-xs divide-y divide-gray-100">
                  {[["Screening Finding", referral.screening_finding], ["Red Flags", referral.red_flags || "None recorded"], ["Colposcopy", referral.colposcopy || "Pending"], ["Histopathology", referral.histopathology || "Pending"], ["Next Follow-up", referral.next_follow_up || "Not set"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-gray-500">{k}</dt><dd className="font-semibold text-black text-right">{v}</dd></div>
                  ))}
                </dl>
                <p className="text-[11px] text-gray-500 mt-3">Histopathology confirms a tissue diagnosis. This record is not a diagnostic tool.</p>
              </section>
              <section className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-black mb-3">Care Journey</h2>
                <ReferralJourney referral={referral} />
              </section>
            </div>
          )}
          {activeTab === "overview" && !referral && (
            <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl p-6">No referral record exists for this patient yet. Add one from Clinical Intake.</p>
          )}

          {activeTab === "pathway" && referral && <CaseRecord key={referral.referral_id} referral={referral} onChanged={loadReferral} />}
          {activeTab === "pathway" && !referral && (
            <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl p-6">
              No referral case record is linked to this patient token ({patientToken}). Please create a referral from Intake or select an active referral from the dropdown above.
            </p>
          )}

          {activeTab === "followup" && referral && (
            <section className="bg-white border border-gray-200 rounded-2xl p-5 max-w-2xl">
              <h2 className="text-sm font-bold text-black mb-3">Contact Log</h2>
              {referralEvents.length === 0 ? <p className="text-xs text-gray-500">Nothing recorded yet.</p> : (
                <ol className="flex flex-col gap-2 text-xs">
                  {referralEvents.map((e) => (
                    <li key={e.event_id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-gray-900">{STATUS_LABELS[e.kind] ?? e.kind}{e.channel ? ` · ${e.channel}` : ""}{e.detail ? ` · ${e.detail}` : ""}</span>
                      <span className="font-mono text-gray-500">{e.status ? `${e.status} · ` : ""}{e.event_date}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          {activeTab === "followup" && !referral && (
            <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl p-6">
              No follow-up log available for this patient token ({patientToken}).
            </p>
          )}

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
                      isRecording ? "bg-black animate-pulse" : "bg-[#9D174D] hover:bg-[#a02609]"
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
                      Press Ambient Mic and speak the consultation in any supported language, or type your notes. Say things like "colposcopy done" or "biopsy taken" and they appear below for you to confirm.
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
                      <p role="alert" className="text-xs text-[#9D174D]">{consultError || consultRecorder.error}</p>
                    )}
                  </div>

                  {consult && (
                    <div data-testid="consult-draft" className="p-4 bg-sky-50 rounded-xl border border-sky-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-sky-900">
                          {consult.draft.source === "AI_DRAFT" ? "AI draft. Not confirmed by a clinician. Check every line before applying." : "Transcript ready (AI draft unavailable)"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button size="xs" variant="obsidian" onClick={handleApplyAiTranscript} className="bg-[#0369A1] hover:bg-[#075985] text-white font-semibold">
                            Apply to Form <Sym n="check" />
                          </Button>
                          <button onClick={() => setConsult(null)} aria-label="Dismiss draft" className="p-1 rounded text-sky-800 hover:bg-sky-100 cursor-pointer">
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-sky-900">Transcript: "{consult.transcript}"</p>
                      {consult.audio_id && (
                        <audio controls preload="none" src={api.consultAudioUrl(patientToken, consult.audio_id)} className="w-full h-8" />
                      )}
                      {consult.draft.working_impression && (
                        <div className="text-xs text-gray-800">
                          <span className="font-bold">Working impression: </span>
                          {consult.draft.working_impression}
                        </div>
                      )}
                      {([
                        ["Consider", consult.draft.differentials, "text-gray-800"],
                        ["Red flags", consult.draft.red_flags, "text-[#9D174D]"],
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
                              name: "",
                              dosage: "",
                              frequency: "",
                              duration: "",
                              instructions: "",
                            },
                          ])
                        }
                        className="text-xs text-[#9D174D]"
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

                  {/* Consultation Action Bar */}
                  <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      {medications.length} medication{medications.length === 1 ? "" : "s"} prescribed
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setChiefComplaints("");
                          setClinicalHistory("");
                          setMedications([]);
                          showToast("Consultation form reset.", "info");
                        }}
                        className="text-xs"
                      >
                        Reset
                      </Button>
                      <Button
                        variant="obsidian"
                        size="sm"
                        disabled={consultBusy}
                        onClick={async () => {
                          if (!patientToken) return;
                          setConsultBusy(true);
                          try {
                            if (referral) {
                              const medSummary = medications.length
                                ? `Rx: ${medications.map((m) => `${m.name} (${m.dosage}, ${m.frequency})`).join("; ")}`
                                : "";
                              const remarksText = [chiefComplaints ? `CC: ${chiefComplaints}` : "", clinicalHistory ? `History: ${clinicalHistory}` : "", medSummary].filter(Boolean).join(" | ");
                              await referralApi.clinical(referral.referral_id, {
                                remarks: remarksText || referral.remarks || undefined,
                              });
                            }
                            await api.logDoctorSignOff({
                              doctor_id: "STAFF-SESSION",
                              patient_token: patientToken,
                              case_id: referral?.referral_id || patientToken,
                              action_type: "DOCTOR_CONSULTATION_SIGNOFF",
                              notes: chiefComplaints || "Clinical consultation and prescription recorded.",
                              ncg_verified: false,
                            });
                            showToast("Consultation signed off and recorded in ledger.", "success");
                            if (referral) await loadReferral();
                          } catch (e: any) {
                            showToast(e.message || "Could not save consultation", "warning");
                          } finally {
                            setConsultBusy(false);
                          }
                        }}
                        className="bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-xs gap-1.5"
                      >
                        <Check className="size-3.5" />
                        <span>Save &amp; Sign-off Consultation</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================
              TAB 5: ABHA & DPDP CONSENT 
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
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#9D174D]" />
                      <span>
                        I voluntarily authorize sharing my health records with the referring health post and the hospital for my cervical care.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#9D174D]" />
                      <span>
                        I consent to the pseudonymization and cryptographic tokenization ({patientToken}) of my records for epidemiological tracking under DPDP Act 2023.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded size-4 text-[#9D174D]" />
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
          <aside className="w-full lg:w-80 lg:min-w-80 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col justify-between shrink-0 lg:overflow-y-auto z-10 shadow-xs">
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
                  Case Details
                </button>
                <button
                  onClick={() => setRightPanelTab("reports")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    rightPanelTab === "reports"
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Reports
                </button>
              </div>

              {rightPanelTab === "details" ? (
                <div className="space-y-2 text-xs">
                  {[["Status", referral ? STATUS_LABELS[referral.status] : "No referral"], ["Referred On", referral?.referred_on ?? "Not referred"], ["Arrived On", referral?.arrived_on ?? "Not recorded"], ["Health Post", referral?.health_post ?? "Not recorded"], ["Hospital", referral?.hospital ?? "Not referred"], ["Area", referral?.area ?? "Not recorded"]].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800 text-right">{v}</span></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {referral?.histopathology ? (
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200"><div className="font-semibold text-gray-800">Histopathology</div><p className="text-gray-600 mt-1">{referral.histopathology}</p></div>
                  ) : <p className="text-gray-500">No reports recorded yet.</p>}
                </div>
              )}
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
