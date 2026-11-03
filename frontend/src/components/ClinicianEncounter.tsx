import { useState, useEffect } from "react";
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
  Search,
  Filter,
  Building2,
  Globe,
  Stethoscope,
  Pill,
  Bed,
  Bus,
  X,
  Plus,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./careui/table";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";

interface ClinicianEncounterProps {
  patientToken?: string;
  onBackToDashboard?: () => void;
  onOpenPatientCompanion?: (token: string) => void;
}

export type EncounterTab =
  | "overview"
  | "dual-clock"
  | "radiation-vault"
  | "chemo-clearance"
  | "hub-bridge"
  | "consultation"
  | "abha-consent";

export function ClinicianEncounter({
  patientToken = "PT-RURAL-7891",
  onBackToDashboard,
  onOpenPatientCompanion,
}: ClinicianEncounterProps) {
  const [activeTab, setActiveTab] = useState<EncounterTab>("overview");
  const [rightPanelTab, setRightPanelTab] = useState<"details" | "reports">("details");

  // Clinical & Treatment State
  const [ebrtFractions, setEbrtFractions] = useState<number>(14);
  const [brachyFractions, setBrachyFractions] = useState<number>(0);
  const [undoActive, setUndoActive] = useState<boolean>(false);
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

  // AI Voice Consultation State (matching image copy 6 & 7)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(54);
  const [aiTranscriptVisible, setAiTranscriptVisible] = useState<boolean>(true);
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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Derived Dual Clock Metrics
  const totalCompleted = ebrtFractions + brachyFractions;
  const daysElapsed = 21; // Day 21
  const projectedFinish = Math.max(44, daysElapsed + (25 - ebrtFractions) + (4 - brachyFractions) + 2);
  const isOptimal = projectedFinish <= 49;
  const isBreach = projectedFinish > 56;

  // Auto-calculated eGFR (CKD-EPI formula approximation for 48y female with Cr 0.85)
  const calculatedEgfr = Math.round(144 * Math.pow(labCreatinine / 0.7, -1.2) * Math.pow(0.9938, 48));

  // Handler: 1-Tap Fraction Logger
  const handleLogFraction = () => {
    if (undoActive) {
      setDuplicateGuardTriggered(true);
      setTimeout(() => setDuplicateGuardTriggered(false), 3000);
      return;
    }

    if (ebrtFractions < 25) {
      setEbrtFractions((prev) => prev + 1);
      setUndoActive(true);
      if (undoTimeout) clearTimeout(undoTimeout);
      const t = setTimeout(() => {
        setUndoActive(false);
      }, 60000); // 60 seconds undo window
      setUndoTimeout(t);
    }
  };

  const handleUndoFraction = () => {
    if (undoActive && ebrtFractions > 0) {
      setEbrtFractions((prev) => prev - 1);
      setUndoActive(false);
      if (undoTimeout) clearTimeout(undoTimeout);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F8F9FA] text-[#111418] font-sans overflow-hidden">
      {/* 1. TOP PATIENT HEADER BANNER (Directly matching care_ui_insp/image.png) */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-4">
          {/* Avatar Icon */}
          <div className="size-11 rounded-xl bg-[#DBFE87] text-black font-bold text-lg flex items-center justify-center border border-[#c4e872] shadow-2xs">
            S
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-black">
                Shanti Devi
              </h1>
              <span className="text-xs text-gray-500 font-medium">48 Y, Female</span>
              <span className="text-gray-300">•</span>
              <span className="text-xs font-mono text-gray-600">ID: BHY67-7891</span>
              <span className="text-gray-300">•</span>
              <span className="text-xs font-mono text-[#BA2D0B] font-semibold bg-[#BA2D0B]/10 px-2 py-0.5 rounded border border-[#BA2D0B]/20">
                Token: {patientToken}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-black bg-[#DBFE87]/40 px-2 py-0.5 rounded-md border border-[#DBFE87]">
                Ration Card: BPL / Pink (PM-JAY Eligible)
              </span>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                ABHA: 91-4521-8890-1234
              </span>
              <span className="text-xs font-medium text-slate-800 bg-[#90C3CB]/20 px-2 py-0.5 rounded-md border border-[#90C3CB]/40">
                Mirzapur Spoke Clinic (~12 km)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons & Encounter Status */}
        <div className="flex items-center gap-2.5">
          {onBackToDashboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToDashboard}
              className="text-xs font-medium text-gray-700"
            >
              ← Back to Roster
            </Button>
          )}

          {onOpenPatientCompanion && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenPatientCompanion(patientToken)}
              className="text-xs font-medium text-black border-slate-200 hover:bg-slate-100 gap-1.5"
            >
              <Globe className="size-3.5" />
              Patient Web Portal
            </Button>
          )}

          <div className="relative">
            <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-black/85 text-xs font-semibold shadow-xs transition-colors cursor-pointer">
              <span>Encounter Actions</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-mono">⌘ + E</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. THREE-PANEL CLINICAL WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: ENCOUNTERS SIDEBAR (Matching care_ui_insp/image.png) */}
        <div className="w-60 min-w-60 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">
              Chosen Encounter
            </div>

            {/* Active Encounter Card */}
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 shadow-2xs mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#111418]">Ambulatory (Curative CCRT)</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                  Active
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">24 Mar - Ongoing</div>
              <div className="text-[10px] text-blue-700 font-medium mt-1 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-600"></span>
                <span>Day 21 · Fraction 15 Milestone</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Past Encounters
              </span>
              <button className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-0.5 cursor-pointer">
                <Filter className="size-3" /> Filter
              </button>
            </div>

            {/* List of Previous Encounters */}
            <div className="space-y-1.5">
              {[
                { title: "Daycare Chemo", date: "17 Mar - 17 Mar", status: "Completed", color: "text-emerald-700 bg-emerald-50" },
                { title: "Radiation Planning", date: "10 Mar - 12 Mar", status: "Completed", color: "text-emerald-700 bg-emerald-50" },
                { title: "Biopsy Histopathology", date: "24 Feb - 26 Feb", status: "Completed", color: "text-emerald-700 bg-emerald-50" },
                { title: "First OPD Consult", date: "18 Feb - 18 Feb", status: "Discharged", color: "text-gray-700 bg-gray-100" },
              ].map((enc, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                    <span>{enc.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${enc.color}`}>
                      {enc.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{enc.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
            Logged in: <strong className="text-gray-700 font-semibold">Dr. Ananya Sharma</strong>
            <div className="text-[10px] text-gray-400">Radiation Oncology · Spoke #04</div>
          </div>
        </div>

        {/* CENTER COLUMN: MAIN ENCOUNTER WORKSPACE WITH HORIZONTAL SUB-TABS */}
        <div className="flex-1 flex flex-col bg-[#F8F9FA] overflow-y-auto">
          {/* Subheader Title & Horizontal Tabs (matching care_ui_insp/image.png) */}
          <div className="bg-white border-b border-gray-200 px-6 pt-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#111418]">
                  Ambulatory Encounter: Curative Chemoradiation
                </span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Step {totalCompleted} of 29 Scheduled
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Blood Group:</span>
                <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  B Positive
                </span>
                <span className="text-xs font-semibold text-gray-600 ml-2">Allergies:</span>
                <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Cisplatin Rash (Mild)
                </span>
              </div>
            </div>

            {/* Horizontal Sub-Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium border-b border-transparent">
              {[
                { id: "overview", label: "Overview & Vitals", icon: Activity },
                { id: "dual-clock", label: "Dual-Clock Board", icon: Clock },
                { id: "radiation-vault", label: "Radiation Vault (1-Tap)", icon: Zap },
                { id: "chemo-clearance", label: "Chemo Clearances", icon: Pill },
                { id: "hub-bridge", label: "Pre-Brachy Hub Bridge", icon: Building2 },
                { id: "consultation", label: "Consultation & AI Voice", icon: Stethoscope },
                { id: "abha-consent", label: "ABHA & DPDP Consent", icon: ShieldCheck },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as EncounterTab)}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "border-[#BA2D0B] text-[#BA2D0B] font-bold bg-[#BA2D0B]/10 rounded-t-lg"
                        : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENT PANELS */}
          <div className="p-6 flex flex-col gap-6">
            {/* TAB 1: OVERVIEW & CLINICAL VITALS (Matching care_ui_insp/image.png) */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-5">
                {/* Vitals Summary Grid */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Clinical Vitals (Today's Reading)</span>
                    <span className="text-[11px] text-gray-400 font-normal">Recorded 09:30 AM by Nurse Sunita</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Blood Pressure</div>
                      <div className="text-sm font-bold text-[#111418] mt-0.5">120 / 80 <span className="text-[10px] text-gray-400 font-normal">mmHg</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Pulse Rate</div>
                      <div className="text-sm font-bold text-[#111418] mt-0.5">66 <span className="text-[10px] text-gray-400 font-normal">/min</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Temperature</div>
                      <div className="text-sm font-bold text-[#111418] mt-0.5">98.2 <span className="text-[10px] text-gray-400 font-normal">°F</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Respiratory</div>
                      <div className="text-sm font-bold text-[#111418] mt-0.5">20 <span className="text-[10px] text-gray-400 font-normal">/min</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">SpO2 (Pulse Ox)</div>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">99% <span className="text-[10px] text-gray-400 font-normal">Room air</span></div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Body Weight</div>
                      <div className="text-sm font-bold text-[#111418] mt-0.5">52.4 <span className="text-[10px] text-gray-400 font-normal">kg</span></div>
                    </div>
                  </div>
                </div>

                {/* Primary Diagnoses & Staging */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Oncology Diagnoses & Histopathology
                    </span>
                    <Badge variant="primary" size="xs">Curative Intent CCRT</Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Condition</TableHead>
                        <TableHead>Stage / Grade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Onset / Biopsy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold text-gray-900 text-xs">
                          Cervical Squamous Cell Carcinoma
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 font-mono">
                          FIGO Stage IIB (Parametrial Extension)
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Active
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Confirmed Biopsy
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">24 Feb 2026</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Active Reported Symptoms */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Active Reported Symptoms & Toxicity Triage
                    </span>
                    <span className="text-xs text-gray-400">Via Vernacular Patient Co-Pilot</span>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symptom</TableHead>
                        <TableHead>Reported Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Action Taken</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold text-gray-900 text-xs">
                          Radiation Diarrhea (5 stools/day)
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Grade 2 (Moderate)
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Active
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">Patient Audio Check-in</TableCell>
                        <TableCell className="text-xs text-indigo-700 font-medium">
                          Oral Loperamide + Hydration Audio Dispatched
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-gray-900 text-xs">
                          Pelvic Burning on Urination
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Grade 1 (Mild)
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Active
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">Ward Vitals Check</TableCell>
                        <TableCell className="text-xs text-gray-600">Alkalinizing agent prescribed</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* TAB 2: DUAL-CLOCK WARD BOARD (GEC-ESTRO <=49d vs NCG <=56d) */}
            {activeTab === "dual-clock" && (
              <div className="flex flex-col gap-5">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-[#111418]">
                          Biological Healing Clock & Overall Treatment Time (OTT)
                        </CardTitle>
                        <CardDescription className="text-xs text-gray-500">
                          Radiobiological Imperative: GEC-ESTRO Optimal &le; 49 Days · NCG Hard Safety Limit &le; 56 Days
                        </CardDescription>
                      </div>
                      <Badge
                        variant={isOptimal ? "primary" : isBreach ? "destructive" : "warning"}
                        size="md"
                      >
                        {isOptimal
                          ? "🟢 Optimal Curative Window (<=49d)"
                          : isBreach
                          ? "🔴 HARD CEILING BREACH (>56d)"
                          : "🟡 Caution Margin (50-56d)"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Visual 29-Step Clock Progress Model */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
                        <span>29-Step Curative Treatment Progress</span>
                        <span>{totalCompleted} / 29 Steps Completed</span>
                      </div>

                      {/* 25 EBRT dots + 4 Brachy diamonds */}
                      <div className="flex flex-wrap items-center gap-2 py-2">
                        {Array.from({ length: 25 }).map((_, i) => {
                          const isDone = i < ebrtFractions;
                          const isCurrent = i === ebrtFractions;
                          return (
                            <span
                              key={`ebrt-${i}`}
                              className={`size-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                                isDone
                                  ? "bg-emerald-500 text-white shadow-2xs"
                                  : isCurrent
                                  ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300 animate-pulse"
                                  : "bg-gray-200 text-gray-400"
                              }`}
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
                              className={`size-4 rotate-45 flex items-center justify-center text-[7px] font-bold transition-all ${
                                isDone
                                  ? "bg-purple-600 text-white shadow-2xs"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                              title={`Brachytherapy Step ${26 + i}`}
                            >
                              <span className="-rotate-45">B{i + 1}</span>
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        <span>Fractions 1–25: External Beam Radiation (50 Gy)</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-purple-700">Fractions 26–29: HDR Brachytherapy</span>
                          <button
                            onClick={() => setBrachyFractions((prev) => Math.min(4, prev + 1))}
                            className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer font-medium"
                          >
                            + Log Hub Brachy ({brachyFractions}/4)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Days Elapsed Since Day 1</div>
                        <div className="text-xl font-bold text-[#111418] mt-0.5">{daysElapsed} Days</div>
                        <div className="text-[11px] text-gray-500">Day 1 Onboarding: 24 Mar 2026</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Projected Completion</div>
                        <div className="text-xl font-bold text-emerald-700 mt-0.5">Day {projectedFinish}</div>
                        <div className="text-[11px] text-emerald-600 font-medium">5 Days buffer before 49d cutoff</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Loss of Pelvic Control Risk</div>
                        <div className="text-xl font-bold text-gray-900 mt-0.5">0.0%</div>
                        <div className="text-[11px] text-gray-500">Zero penalty while &le; 56 days</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 3: RADIATION VAULT (NURSE 1-TAP FRACTION LOGGER) */}
            {activeTab === "radiation-vault" && (
              <div className="flex flex-col gap-5">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-[#111418]">
                          Radiation Vault Treatment Console (Tablet Mode)
                        </CardTitle>
                        <CardDescription className="text-xs text-gray-500">
                          Operated by Nurse Sunita Patel / Technologist · Linear Accelerator #1
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMachineDowntime(!machineDowntime)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                            machineDowntime
                              ? "bg-rose-50 border-rose-300 text-rose-800"
                              : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {machineDowntime ? "⚠️ LINAC Downtime Active" : "Machine Normal"}
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Machine Downtime Banner */}
                    {machineDowntime && (
                      <Alert variant="warning">
                        <AlertTriangle className="size-4" />
                        <AlertTitle>Machine Downtime Mode Active</AlertTitle>
                        <AlertDescription className="text-xs">
                          Patient delinquency escalation counters (Tier 1–4) are temporarily paused. Biological clock remains active; weekend make-up session scheduled.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Duplicate Guard Warning */}
                    {duplicateGuardTriggered && (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>18-Hour Duplicate Fraction Lockout</AlertTitle>
                        <AlertDescription className="text-xs">
                          A fraction was already logged in the last 18 hours. To prevent radiation overdose, consecutive fractions are locked unless hyperfractionation (BID) is authorized by doctor.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Patient Verification Card */}
                    <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">
                          Ready for Beam Delivery
                        </span>
                        <div className="text-base font-bold text-[#111418] mt-0.5">
                          Step {ebrtFractions + 1} of 29: EBRT Fraction {ebrtFractions + 1} (2.0 Gy to Pelvis)
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Verified 200 cGy · Target Volume: Whole Pelvis + Parametrial Boost
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleLogFraction}
                          className="px-5 py-3 rounded-xl bg-[#BA2D0B] hover:bg-[#a02609] text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
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
                            <span>Undo (60s)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Forgotten QR Card Search Fallback */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                      <Search className="size-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Forgotten QR Card? Search by Patient Name ('Shanti'), Mobile ('98765'), or Village ('Pipra')..."
                        className="text-xs w-full bg-transparent border-none outline-none text-gray-800 placeholder:text-gray-400"
                      />
                      <Button variant="secondary" size="xs">Find Patient</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 4: CHEMO CLEARANCES (WEEKLY CISPLATIN) */}
            {activeTab === "chemo-clearance" && (
              <div className="flex flex-col gap-5">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-[#111418]">
                          Weekly Cisplatin Chemotherapy Clearance Card
                        </CardTitle>
                        <CardDescription className="text-xs text-gray-500">
                          Cycle #3 Due · Nephrotoxicity & Cytopenia Safety Guardrails
                        </CardDescription>
                      </div>
                      <Badge
                        variant={chemoStatus === "APPROVED" ? "primary" : chemoStatus === "HELD" ? "destructive" : "neutral"}
                        size="md"
                      >
                        Status: {chemoStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* 24h Pre-Chemo Lab Ingestion OCR Grid */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          24h Ingested Pathology Labs (CBC & RFT)
                        </span>
                        <span className="text-xs text-gray-500">Pathology Lab OCR Verified ✓</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Hemoglobin (Hb)</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              step="0.1"
                              value={labHb}
                              onChange={(e) => setLabHb(parseFloat(e.target.value) || 0)}
                              className="w-14 text-sm font-bold text-[#111418] border-b border-gray-200 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400">g/dL</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">Safe (&ge; 10.0)</div>
                        </div>

                        <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Absolute Neutrophil (ANC)</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              value={labAnc}
                              onChange={(e) => setLabAnc(parseInt(e.target.value, 10) || 0)}
                              className="w-16 text-sm font-bold text-[#111418] border-b border-gray-200 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400">/&mu;L</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">Safe (&ge; 1500)</div>
                        </div>

                        <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Platelets</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              value={labPlatelets}
                              onChange={(e) => setLabPlatelets(parseInt(e.target.value, 10) || 0)}
                              className="w-14 text-sm font-bold text-[#111418] border-b border-gray-200 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400">k/&mu;L</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">Safe (&ge; 100k)</div>
                        </div>

                        <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                          <div className="text-[10px] text-gray-500 font-semibold">Serum Creatinine</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="number"
                              step="0.05"
                              value={labCreatinine}
                              onChange={(e) => setLabCreatinine(parseFloat(e.target.value) || 0)}
                              className="w-14 text-sm font-bold text-[#111418] border-b border-gray-200 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400">mg/dL</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">Normal (&le; 1.2)</div>
                        </div>

                        <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200">
                          <div className="text-[10px] text-blue-700 font-semibold">Calculated eGFR</div>
                          <div className="text-sm font-bold text-blue-900 mt-0.5">{calculatedEgfr} mL/min</div>
                          <div className="text-[10px] text-blue-700 font-medium">Normal Renal Function</div>
                        </div>
                      </div>
                    </div>

                    {/* Doctor Clearance Actions */}
                    <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Cisplatin Dosage Recommendation: 40 mg/m² (65 mg in 500 mL Normal Saline)
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Requires 1000 mL pre-hydration + 1000 mL post-hydration. Daily EBRT continues uninterrupted regardless of chemo hold.
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="obsidian"
                          size="sm"
                          onClick={() => setChemoStatus("APPROVED")}
                          className="bg-black hover:bg-black/85 text-white"
                        >
                          Approve Cisplatin
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChemoStatus("HELD")}
                          className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          Hold (Keep EBRT Running)
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setChemoStatus("REDUCED")}
                        >
                          Reduce 25%
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 5: PRE-BRACHY HUB BRIDGE (STEPS 2A & 2B) */}
            {activeTab === "hub-bridge" && (
              <div className="flex flex-col gap-5">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
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
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
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
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                        Step 2A: Spoke Pre-Brachy Readiness Checklist (Fraction 10 Prepared)
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                          <input type="checkbox" checked={pacCleared} onChange={() => setPacCleared(!pacCleared)} className="rounded" />
                          <span>Pre-Anesthetic Clearance (PAC) Cleared by Anesthetist</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                          <input type="checkbox" checked={intracavitarySuitable} onChange={() => setIntracavitarySuitable(!intracavitarySuitable)} className="rounded" />
                          <span>Pelvic Regression: Intracavitary Tandem &amp; Ovoids Suitable</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                          <input type="checkbox" checked readOnly className="rounded" />
                          <span>Hemoglobin &ge; 10.0 g/dL (Blood Transfusion Not Required)</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                          <input type="checkbox" checked readOnly className="rounded" />
                          <span>Renal Function (eGFR &ge; 60 mL/min) Validated</span>
                        </label>
                      </div>
                    </div>

                    {/* Step 2B: Hub OT Slot Lock */}
                    <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Hub High-Dose-Rate Brachytherapy Slot (Requested Window: Days 38–44)
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Suite: RCC OT-2 · Scheduled Date:</span>
                          <select
                            value={provisionalSlotDate}
                            onChange={(e) => setProvisionalSlotDate(e.target.value)}
                            className="text-xs font-semibold p-1 rounded border border-gray-300 bg-white"
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
                          }}
                          className="bg-black hover:bg-black/85 text-white"
                        >
                          {hubSlotConfirmed ? "✓ Slot Confirmed (Day 41)" : "Confirm Hub OT Slot (Step 2B)"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHubDeficiencyReturned(true)}
                          className="text-amber-800 border-amber-300 hover:bg-amber-50"
                        >
                          Return with Deficiency (48h SLA)
                        </Button>
                      </div>
                    </div>

                    {/* Step 2C: Automated Transport & Dharamshala Pass Preview */}
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
                              <div className="text-[11px] text-gray-500">3 Nights Stay · Caregiver Accompanied</div>
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

            {/* TAB 6: CONSULTATION & AI VOICE (Matching care_ui_insp/image copy 6 & 7) */}
            {activeTab === "consultation" && (
              <div className="flex flex-col gap-5 relative">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Consultation Form &amp; Prescription
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Standard CARE EMR Consultation Layout with AI Ambient Transcription
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Chief Complaints */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-3 bg-[#BA2D0B] rounded-sm"></span>
                        <label className="text-xs font-bold text-gray-800">Chief Complaints</label>
                      </div>
                      <textarea
                        defaultValue="Patient presents with persistent watery discharge and moderate pelvic burning for 4 days. Denies fever. Reports fatigue after radiation fractions."
                        rows={2}
                        className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-black bg-white text-gray-800"
                      />
                    </div>

                    {/* Clinical History */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-3 bg-[#BA2D0B] rounded-sm"></span>
                        <label className="text-xs font-bold text-gray-800">Clinical History &amp; Narrative</label>
                      </div>
                      <textarea
                        defaultValue="Known case of FIGO Stage IIB Cervical SCC on concurrent chemoradiation. Completed 14 EBRT fractions without interruption. Tolerating weekly Cisplatin well with normal creatinine."
                        rows={2}
                        className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-black bg-white text-gray-800"
                      />
                    </div>

                    {/* Prescription & Medications Table (matching image copy 7) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-3 bg-[#BA2D0B] rounded-sm"></span>
                          <span className="text-xs font-bold text-gray-800">Prescription Medications</span>
                        </div>
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating AI Ambient Audio Recording Pill (matching image copy 6 & 7) */}
                <div className="fixed bottom-6 right-80 z-30 flex items-center gap-3">
                  {aiTranscriptVisible && (
                    <div className="p-3.5 bg-white rounded-2xl border border-gray-200 shadow-xl max-w-sm flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          8 Fields Auto-Filled by AI
                        </span>
                        <button
                          onClick={() => setAiTranscriptVisible(false)}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed font-sans">
                        <strong>TRANSCRIPT:</strong> "The patient has mild pelvic burning and loose motions 3 times a day.
                        Continue EBRT fraction 15 tomorrow. Prescribed oral Loperamide 2mg thrice daily and ORS."
                      </p>
                      <button
                        onClick={() => setAiTranscriptVisible(false)}
                        className="text-xs font-bold text-[#BA2D0B] self-end hover:underline"
                      >
                        Done ✓
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className={`h-12 px-4 rounded-full flex items-center gap-2 text-white shadow-xl transition-all cursor-pointer ${
                      isRecording ? "bg-black animate-pulse" : "bg-[#BA2D0B] hover:bg-[#a02609]"
                    }`}
                  >
                    {isRecording ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    <span className="text-xs font-mono font-semibold">
                      00:{recordingSeconds < 10 ? "0" : ""}{recordingSeconds}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 7: ABHA & DPDP CONSENT (Matching care_ui_insp/image copy 4) */}
            {activeTab === "abha-consent" && (
              <div className="flex flex-col gap-5">
                <Card className="bg-white border-gray-200 shadow-2xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#111418]">
                      Ayushman Bharat Health Account (ABHA) &amp; DPDP Consent
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500">
                      Standard National Health Authority (NHA) &amp; Digital Personal Data Protection Act 2023 Consent Flow
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 text-xs">
                    <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                      <Button variant="obsidian" size="xs">Link Existing ABHA</Button>
                      <Button variant="outline" size="xs">Generate New ABHA via Aadhaar</Button>
                      <span className="text-gray-400 text-[11px] ml-auto">
                        Aadhaar number is never stored on CerviSetu servers.
                      </span>
                    </div>

                    <div className="space-y-3 pt-2 text-gray-700">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded" />
                        <span>
                          I voluntarily authorize sharing my health records with Regional Cancer Centre Hub and Mirzapur Spoke Clinic for the purpose of curative cancer management.
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded" />
                        <span>
                          I consent to the pseudonymization and cryptographic tokenization (PT-RURAL-7891) of my records for epidemiological tracking under DPDP Act 2023.
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded" />
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
                      <span className="text-[10px] font-mono text-gray-500">SHA-256: 0x8bb3a45...Verified ✓</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ENCOUNTER DETAILS & AUDIT (Matching care_ui_insp/image.png) */}
        <div className="w-72 min-w-72 bg-white border-l border-gray-200 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-4">
            {/* Tab Switcher: Details vs Reports */}
            <div className="flex items-center border border-gray-200 rounded-lg p-0.5 mb-4 bg-gray-50">
              <button
                onClick={() => setRightPanelTab("details")}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rightPanelTab === "details"
                    ? "bg-white text-gray-900 shadow-2xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Details
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
              <div className="space-y-4 text-xs">
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Encounter Details
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        In Progress
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Encounter Class</span>
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Ambulatory
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
                      <span className="text-gray-500">End Date</span>
                      <span className="font-mono text-gray-400">--(Ongoing)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Departments &amp; Location
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-gray-800 font-semibold flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-gray-400" />
                      <span>Mirzapur District Oncology Daycare</span>
                    </div>
                    <div className="text-gray-500 text-[11px]">Department: Radiation Oncology</div>
                    <div className="text-gray-500 text-[11px]">Hub Partner: Regional Cancer Centre, Varanasi</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Primary Care Team
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="font-semibold text-gray-800">Dr. Ananya Sharma (Radiation Oncologist)</div>
                    <div className="text-gray-500">Nurse Sunita Patel (Vault Operator)</div>
                    <div className="text-gray-500">Meena Devi (Village ASHA Coordinator)</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Cryptographic Audit Stamp
                  </div>
                  <div className="p-2 bg-gray-50 rounded border border-gray-200 text-[10px] font-mono text-gray-600 break-all">
                    SHA-256 Ledger Block: 0x8bb3a45c...
                    <div className="text-emerald-700 font-sans font-semibold mt-1">Tamper-Proof ✓</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Diagnostic Reports &amp; Scans
                </div>
                {[
                  { name: "Cervical Biopsy Histopathology.pdf", date: "24 Feb 2026", size: "1.2 MB" },
                  { name: "Pelvic CT Simulation Scan.dcm", date: "10 Mar 2026", size: "18.4 MB" },
                  { name: "Weekly CBC & RFT Panel.pdf", date: "Today 08:30 AM", size: "340 KB" },
                  { name: "Anesthesia PAC Clearance.pdf", date: "18 Mar 2026", size: "480 KB" },
                ].map((rep, idx) => (
                  <div key={idx} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="font-semibold text-gray-800 truncate">{rep.name}</div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                      <span>{rep.date}</span>
                      <span>{rep.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
