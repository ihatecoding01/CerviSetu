import { StatusText } from "./icons/Sym";
import { Dot } from "./icons/Sym";
import { WARD_COHORT } from "../data/wardCohort";
import { useState, useEffect } from "react";
import type { PatientCase, LinacDowntimeStatus, WardBoardRow } from "../api/client";
import { api } from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./careui/table";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import {
  RefreshCw,
  AlertTriangle,
  Users,
  Clock,
  ArrowUpRight,
  Calendar,
  Stethoscope,
  PowerOff,
  ShieldCheck,
  Flame,
} from "lucide-react";

interface Props {
  cases: PatientCase[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectCase?: (patientToken: string) => void;
}

// 12-column x 5-row Dot Matrix Sparkline component modeled directly on components2.png
function DotMatrix({
  pattern,
  colorClass = "bg-[#BA2D0B]",
}: {
  pattern: number[]; // Array of 12 heights (1 to 5)
  colorClass?: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-1.5 pt-3 w-full">
      {pattern.slice(0, 12).map((height, colIndex) => (
        <div key={colIndex} className="flex flex-col-reverse gap-1 items-center">
          {[1, 2, 3, 4, 5].map((rowLevel) => {
            const isActive = rowLevel <= height;
            return (
              <span
                key={rowLevel}
                className={`size-1.5 rounded-full transition-all ${
                  isActive ? colorClass : "bg-gray-200"
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getTierBadge(tier: string | null | undefined) {
  if (!tier) return <Badge variant="neutral" size="xs">Routine Watch</Badge>;
  if (tier.includes("4")) return <Badge variant="destructive" size="xs">Tier 4 · CMO Escort</Badge>;
  if (tier.includes("3")) return <Badge variant="warning" size="xs">Tier 3 · ASHA Visit</Badge>;
  if (tier.includes("2")) return <Badge variant="warning" size="xs">Tier 2 · IVR Dial</Badge>;
  return <Badge variant="primary" size="xs">Tier 1 · SMS Nudge</Badge>;
}

const DEMO_TOKENS = new Set(["PT-RURAL-7891", "PT-RURAL-4421", "PT-RURAL-1102", "PT-RURAL-9034", "PT-PREC-202"]);

const CLOCK_LANE: Record<string, "optimal" | "warning" | "critical"> = {
  OPTIMAL: "optimal",
  WARNING: "warning",
  BREACH_RISK: "critical",
  INCOMPLETE_SCHEDULE: "critical",
};

// Map a case from /api/cases (DB record) or a fresh /api/run-case result onto a ward board row.
// When the patient has an approved CCRT plan, the clock columns come from the live treatment clock.
function caseToRosterRow(c: PatientCase, plan?: WardBoardRow) {
  const rec = c as PatientCase & Record<string, any>;
  const intake = rec.intake_data ?? rec.clinical_intake ?? {};
  const diag = rec.diagnostic_data ?? rec.diagnostic_synthesis ?? {};
  const stage = rec.suspected_stage ?? intake.estimated_stage ?? "Stage Unknown";
  const cancer = rec.cancer_type ?? intake.suspected_cancer_type ?? "";
  const age = rec.age ?? intake.age;
  const tier = rec.current_escalation_tier ?? null;
  const daysOverdue = rec.days_overdue ?? 0;
  const urgency = diag.urgency ?? "ROUTINE";
  const lane = daysOverdue >= 3 ? "critical" : daysOverdue >= 1 ? "warning" : "optimal";

  return {
    token: c.patient_token,
    name: "New Intake",
    age: age ? `${age}Y, Female` : "Age pending",
    village: intake.extraction_source === "SARVAM_LLM" ? "Registered via Sarvam AI intake" : "Registered via CerviSetu intake",
    stage: `${stage === "Unknown" ? "Stage Unknown" : stage} ${cancer === "CERVICAL" ? "Cervix" : cancer}`.trim(),
    lane,
    ottDays: 0,
    ottBadge: "⚪ Pre-CCRT · Clock Not Started",
    ottSub: intake.biopsy_status === "POSITIVE" ? "Biopsy positive · Awaiting CCRT plan sign-off" : "Awaiting biopsy / staging",
    adhStatus:
      urgency === "CRITICAL_EMERGENCY" ? "🔴 Critical · Expedite Plan" : urgency === "PRIORITY" ? "🟡 Priority Work-up" : "🟢 Routine Work-up",
    adhDetail: daysOverdue > 0 ? `Overdue Day +${daysOverdue}` : "New registration · No missed visits",
    tier,
    severity: Number(rec.severity_score ?? rec.cancer_severity_score ?? intake.severity_score ?? 0),
    avatarColor: "bg-white text-[#BA2D0B] border-[#BA2D0B]/40",
    ...(plan ? clockColumns(plan) : {}),
  };
}

function clockColumns(plan: WardBoardRow) {
  const day = plan.projected_finish_day;
  const icon = plan.clock_status === "BREACH_RISK" ? "🔴" : plan.clock_status === "WARNING" ? "🟡" : "🟢";
  const label =
    plan.clock_status === "COMPLETED" ? "✅ Course Completed" :
    plan.clock_status === "PAUSED" ? "⏸ Clinician-Approved Pause" :
    plan.clock_status === "NOT_STARTED" ? `⚪ Starts ${plan.start_date}` :
    `${icon} Proj: Day ${day ?? "-"} (${day !== null && day <= 49 ? "<=49d" : day !== null && day <= 56 ? "<=56d" : ">56d"})`;
  return {
    lane: CLOCK_LANE[plan.clock_status] ?? "optimal",
    ottDays: day ?? 0,
    ottBadge: label,
    ottSub: `Live clock · Started ${plan.start_date} · Today Day ${plan.treatment_day_today}`,
    adhStatus: plan.consecutive_missed_sessions > 0
      ? `🔴 Missed ${plan.consecutive_missed_sessions} in a row`
      : `🟢 ${plan.completed_sessions}/${plan.total_sessions} sessions done`,
    adhDetail: `${plan.missed_sessions} missed total` +
      (plan.next_session ? ` · Next #${plan.next_session.session_number} on ${plan.next_session.date}` : ""),
    tier: plan.current_escalation_tier,
  };
}

export function OverviewPanel({ cases, loading, error, onRefresh, onSelectCase }: Props) {
  const [activeLaneFilter, setActiveLaneFilter] = useState<"all" | "optimal" | "warning" | "critical">("all");
  const [downtime, setDowntime] = useState<LinacDowntimeStatus | null>(null);
  const [togglingDowntime, setTogglingDowntime] = useState(false);
  const [wardBoard, setWardBoard] = useState<WardBoardRow[]>([]);
  const [clockAction, setClockAction] = useState<string | null>(null);
  const [clockMessage, setClockMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDowntime();
  }, []);

  // Reload the live treatment clocks whenever the case list refreshes
  useEffect(() => {
    loadWardBoard();
  }, [cases]);

  const loadWardBoard = async () => {
    try {
      const res = await api.getWardBoard();
      setWardBoard(res.plans);
    } catch {
      // Offline fallback: rows show intake data only
    }
  };

  const handleLogSession = async (plan: WardBoardRow) => {
    setClockAction(plan.patient_token);
    setClockMessage(null);
    try {
      const res = await api.logNurseFraction({
        nurse_id: "NURSE-SPOKE-01",
        patient_token: plan.patient_token,
        fraction_number: plan.completed_sessions + 1,
      });
      setClockMessage(
        res.duplicate
          ? `${plan.patient_token}: session already recorded`
          : `${plan.patient_token}: session ${plan.completed_sessions + 1} recorded · Proj. Day ${res.clock?.projected_finish_day ?? "-"}`
      );
      await loadWardBoard();
    } catch (err) {
      setClockMessage(`${plan.patient_token}: ${err instanceof Error ? err.message : "Could not record session"}`);
    } finally {
      setClockAction(null);
    }
  };

  const handleNoShow = async (plan: WardBoardRow) => {
    setClockAction(plan.patient_token);
    setClockMessage(null);
    try {
      await api.recordNoShow(plan.patient_token, "NURSE-SPOKE-01");
      setClockMessage(`${plan.patient_token}: no-show recorded`);
      await loadWardBoard();
    } catch (err) {
      setClockMessage(`${plan.patient_token}: ${err instanceof Error ? err.message : "Could not record no-show"}`);
    } finally {
      setClockAction(null);
    }
  };

  const loadDowntime = async () => {
    try {
      const res = await api.getLinacDowntimeStatus("Mirzapur Spoke Clinic");
      setDowntime(res);
    } catch {
      // Offline fallback
    }
  };

  const handleToggleDowntime = async () => {
    setTogglingDowntime(true);
    try {
      await api.toggleLinacDowntime({
        facility_name: "Mirzapur Spoke Clinic",
        machine_id: "LINAC-SPOKE-01",
        reason: downtime?.is_downtime_active ? undefined : "Beam Steering Calibration / Scheduled Servicing",
      });
      await loadDowntime();
    } catch {
      // Ignored
    } finally {
      setTogglingDowntime(false);
    }
  };

  // Enriched clinical cohort registry with unmasked local identity and 3-lane status
  const patientRoster = [...WARD_COHORT];

  // Live cervical cases from the database, newest first, appended after the demo cohort
  const seenTokens = new Set(DEMO_TOKENS);
  const liveRows = cases
    .filter((c) => {
      const rec = c as PatientCase & Record<string, any>;
      const cancer = rec.cancer_type ?? rec.clinical_intake?.suspected_cancer_type;
      if (cancer !== "CERVICAL" || seenTokens.has(c.patient_token)) return false;
      seenTokens.add(c.patient_token);
      return true;
    })
    .slice(0, 10)
    .map((c) => caseToRosterRow(c, wardBoard.find((w) => w.patient_token === c.patient_token)));
  patientRoster.push(...liveRows);

  const filteredRoster = patientRoster.filter((p) => {
    if (activeLaneFilter === "all") return true;
    return p.lane === activeLaneFilter;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Greeting & Operational Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            Clinical Workstation &middot; Dr. Sharma (MD, Radiation Oncology)
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-gray-400" />
            <span>Mirzapur District Oncology Spoke &middot; Affiliated with RCC Varanasi Hub (~75 km)</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs font-medium text-gray-700"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Sync Registry
          </Button>

          <Button
            variant={downtime?.is_downtime_active ? "destructive" : "outline"}
            size="sm"
            onClick={handleToggleDowntime}
            disabled={togglingDowntime}
            className="text-xs font-medium gap-1.5"
          >
            <PowerOff className="size-3.5" />
            {downtime?.is_downtime_active ? "Resume LINAC-01" : "Report LINAC Downtime"}
          </Button>
        </div>
      </div>

      {/* LINAC Maintenance Downtime Banner */}
      {downtime?.is_downtime_active && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <PowerOff className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                  Spoke Machine Alert
                </span>
                <span className="text-sm font-bold text-amber-950">
                  Mirzapur Spoke LINAC-01 Under Scheduled Maintenance / Calibration
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                Biological Healing Clocks Paused Spoke-Wide &middot; Acute Overdue Timers Suspended to Prevent False ASHA/IVR Dispatches. Reason: {downtime.reason || "Scheduled Calibration"}.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleDowntime}
            disabled={togglingDowntime}
            className="shrink-0 bg-white border-amber-400 text-amber-900 hover:bg-amber-100 text-xs font-bold"
          >
            Clear Downtime &amp; Resume Clock
          </Button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>System Alert</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 4 KPI Metric Cards with 12x5 Dot-Matrix Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Patients */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Users className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Curative Cohort</div>
                  <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-0.5">
                    <ArrowUpRight className="size-3" /> 100% on GEC-ESTRO
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111418] tracking-tight">{patientRoster.length} Cases</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 1, 2, 1, 3, 2, 1, 2, 4, 3, 5, 4]}
              colorClass="bg-emerald-500"
            />
          </CardContent>
        </Card>

        {/* Card 2: Optimal Lane */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-[#DBFE87]/50 border border-[#DBFE87] flex items-center justify-center text-black">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Optimal Lane (&le;49d)</div>
                  <div className="text-xs font-medium text-emerald-700">GEC-ESTRO Target</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-black tracking-tight">
                {patientRoster.filter(p => p.lane === "optimal").length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[2, 1, 2, 3, 2, 4, 3, 2, 3, 4, 3, 2]}
              colorClass="bg-emerald-500"
            />
          </CardContent>
        </Card>

        {/* Card 3: Warning Lane */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-[#F19941]/15 border border-[#F19941]/30 flex items-center justify-center text-[#BA2D0B]">
                  <Clock className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Warning Lane (50-56d)</div>
                  <div className="text-xs font-medium text-amber-700">ABS Upper Margin</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-black tracking-tight">
                {patientRoster.filter(p => p.lane === "warning").length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 2, 1, 3, 2, 2, 3, 2, 1, 4, 5, 3]}
              colorClass="bg-[#F19941]"
            />
          </CardContent>
        </Card>

        {/* Card 4: Breach Risk Lane */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-[#BA2D0B]/10 border border-[#BA2D0B]/30 flex items-center justify-center text-[#BA2D0B]">
                  <Flame className="size-4 text-[#BA2D0B]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Breach Risk (&gt;56d)</div>
                  <div className="text-xs font-medium text-[#BA2D0B]">ASHA Escalated</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#BA2D0B] tracking-tight">
                {patientRoster.filter(p => p.lane === "critical").length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 2, 2, 3, 4, 3, 2, 4, 5, 4, 3, 2]}
              colorClass="bg-[#BA2D0B]"
            />
          </CardContent>
        </Card>
      </div>

      {/* Traffic-Light Ward Board */}
      <Card className="bg-white border-gray-200 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-[#111418]">
                Traffic-Light Curative Ward Board (NCG &amp; GEC-ESTRO 49/56-Day Biological Clock)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-gray-500">
              Unmasked point-of-care identity for attending clinicians &middot; AES-256 tokenization maintained for external sync
            </CardDescription>
          </div>

          {/* 3-Lane Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveLaneFilter("all")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeLaneFilter === "all" ? "bg-white text-black shadow-2xs" : "text-gray-600 hover:text-black"
              }`}
            >
              All Cases ({patientRoster.length})
            </button>
            <button
              onClick={() => setActiveLaneFilter("optimal")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeLaneFilter === "optimal" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Dot tone="green" /> Optimal (&le;49d)
            </button>
            <button
              onClick={() => setActiveLaneFilter("warning")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeLaneFilter === "warning" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <Dot tone="amber" /> Warning (50-56d)
            </button>
            <button
              onClick={() => setActiveLaneFilter("critical")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeLaneFilter === "critical" ? "bg-[#BA2D0B] text-white shadow-2xs" : "text-[#BA2D0B] hover:bg-rose-50"
              }`}
            >
              <Dot tone="red" /> Breach Risk (&gt;56d)
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {clockMessage && (
            <div className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
              {clockMessage}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Point-of-Care Patient Identity</TableHead>
                <TableHead>Biological Clock (OTT 49/56d)</TableHead>
                <TableHead>Acute Adherence &amp; ASHA Trigger</TableHead>
                <TableHead>Risk Profile</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoster.map((p) => {
                const isCriticalRow = p.lane === "critical";
                const isWarningRow = p.lane === "warning";
                const rowPlan = DEMO_TOKENS.has(p.token) ? undefined : wardBoard.find((w) => w.patient_token === p.token);

                return (
                  <TableRow
                    key={p.token}
                    className={`transition-colors ${
                      isCriticalRow
                        ? "bg-rose-50/40 hover:bg-rose-50/70"
                        : isWarningRow
                        ? "bg-amber-50/30 hover:bg-amber-50/60"
                        : "hover:bg-gray-50/80"
                    }`}
                  >
                    {/* Column 1: Unmasked POC Identity */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`size-9 rounded-lg font-bold text-sm flex items-center justify-center border ${p.avatarColor}`}>
                          {p.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-black">{p.name}</span>
                            <span className="text-xs text-gray-500 font-medium">{p.age}</span>
                          </div>
                          <div className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-xs text-[#BA2D0B] bg-[#BA2D0B]/10 px-1.5 py-0.2 rounded font-semibold border border-[#BA2D0B]/20">
                              {p.token}
                            </span>
                            <span>&middot;</span>
                            <span className="text-gray-700 font-medium">{p.village}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 font-medium">{p.stage}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Column 2: Biological Clock OTT */}
                    <TableCell>
                      <div>
                        <div className="text-xs font-bold text-gray-900"><StatusText text={p.ottBadge} /></div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.ottSub}</div>
                      </div>
                    </TableCell>

                    {/* Column 3: Acute Adherence & Tier */}
                    <TableCell>
                      <div>
                        <div className="text-xs font-semibold text-gray-900"><StatusText text={p.adhStatus} /></div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.adhDetail}</div>
                        <div className="mt-1">{getTierBadge(p.tier)}</div>
                      </div>
                    </TableCell>

                    {/* Column 4: Severity & Risk */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800">
                          {(p.severity * 100).toFixed(0)}%
                        </span>
                        {p.severity >= 0.8 && (
                          <Badge variant="destructive" size="xs">High Risk</Badge>
                        )}
                        {p.lane === "optimal" && (
                          <Badge variant="primary" size="xs">Optimal</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Column 5: Encounter Button */}
                    <TableCell className="text-right">
                      {rowPlan?.clock_state === "ACTIVE" && (
                        <div className="flex justify-end gap-1 mb-1">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={clockAction === p.token}
                            onClick={() => handleLogSession(rowPlan)}
                            className="text-xs"
                          >
                            Log Session
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={clockAction === p.token}
                            onClick={() => handleNoShow(rowPlan)}
                            className="text-xs"
                          >
                            No-show
                          </Button>
                        </div>
                      )}
                      {onSelectCase && (
                        <Button
                          variant="obsidian"
                          size="xs"
                          onClick={() => onSelectCase(p.token)}
                          className="text-xs font-semibold bg-black hover:bg-black/85 text-white gap-1"
                        >
                          <Stethoscope className="size-3" />
                          Open Encounter
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

