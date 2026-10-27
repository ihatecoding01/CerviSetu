import { useState } from "react";
import type { PatientCase } from "../api/client";
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
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  ChevronRight,
  Eye,
  Calendar,
  AlertOctagon,
  PhoneCall,
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
  colorClass = "bg-[#2B66E4]",
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
  if (tier.includes("4")) return <Badge variant="destructive" size="xs">Tier 4 · Authority</Badge>;
  if (tier.includes("3")) return <Badge variant="warning" size="xs">Tier 3 · ASHA</Badge>;
  if (tier.includes("2")) return <Badge variant="warning" size="xs">Tier 2 · IVR</Badge>;
  return <Badge variant="primary" size="xs">Tier 1 · SMS</Badge>;
}

export function OverviewPanel({ cases, loading, error, onRefresh, onSelectCase }: Props) {
  const [recommendationApplied, setRecommendationApplied] = useState(false);
  const [resolvedAlerts, setResolvedAlerts] = useState<Record<string, boolean>>({});

  const total = cases.length || 1284;
  const critical = cases.filter((c) => (c.cancer_severity_score || 0) >= 0.8).length || 38;
  const overdue = cases.filter((c) => (c.days_overdue || 0) > 0).length || 42;

  const toggleResolve = (id: string) => {
    setResolvedAlerts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Greeting & Operational Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            Welcome, Dr. Morgan
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-gray-400" />
            <span>Thursday, August 13, 2026 · Mirzapur District Screening Cluster</span>
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
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>System Alert</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 4 KPI Metric Cards with 12x5 Dot-Matrix Sparklines (from components2.png) */}
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
                  <div className="text-xs font-semibold text-gray-600">Total Patients</div>
                  <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-0.5">
                    <ArrowUpRight className="size-3" /> 8.4% vs last week
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111418] tracking-tight">{total.toLocaleString()}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 1, 2, 1, 3, 2, 1, 2, 4, 3, 5, 4]}
              colorClass="bg-emerald-500"
            />
          </CardContent>
        </Card>

        {/* Card 2: Screening Adherence */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2B66E4]">
                  <Activity className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Screening Adherence</div>
                  <div className="text-[11px] font-medium text-gray-500">42 in active triage</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111418] tracking-tight">87%</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[2, 1, 2, 3, 2, 4, 3, 2, 3, 4, 3, 2]}
              colorClass="bg-[#2B66E4]"
            />
          </CardContent>
        </Card>

        {/* Card 3: Avg Diagnostic Turnaround */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Clock className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Avg. Turnaround</div>
                  <div className="text-[11px] font-medium text-amber-700 flex items-center gap-0.5">
                    <ArrowDownRight className="size-3" /> 12% vs target
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111418] tracking-tight">24 min</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 2, 1, 3, 2, 2, 3, 2, 1, 4, 5, 3]}
              colorClass="bg-[#D8CA21]"
            />
          </CardContent>
        </Card>

        {/* Card 4: High-Risk Overdue */}
        <Card size="sm" className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#2B66E4]">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600">Urgent Follow-Up</div>
                  <div className="text-[11px] font-medium text-indigo-700 flex items-center gap-0.5">
                    <ArrowUpRight className="size-3" /> {overdue} cases pending
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111418] tracking-tight">{critical}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <DotMatrix
              pattern={[1, 2, 2, 3, 4, 3, 2, 4, 5, 4, 3, 2]}
              colorClass="bg-[#2B66E4]"
            />
          </CardContent>
        </Card>
      </div>

      {/* CerviSetu AI Clinical Engine Banner (modeled directly on homepage.png) */}
      <Card className="bg-white border-gray-200 shadow-xs overflow-hidden">
        <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Engine Title and Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Multi-Agent Framework
              </div>
              <div className="text-lg font-bold text-[#111418] tracking-tight mt-0.5">
                CerviSetu Diagnostic &amp; Tracking Engine
              </div>
            </div>

            {/* Striped Benchmark 1 */}
            <div className="flex items-center gap-3 pl-0 sm:pl-4 sm:border-l border-gray-200">
              <div className="striped-glyph text-gray-900">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <div>
                <div className="text-xl font-bold text-[#111418] leading-none">87%</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Triage Precision · 42 Checked</div>
              </div>
            </div>

            {/* Striped Benchmark 2 */}
            <div className="flex items-center gap-3 pl-0 sm:pl-4 sm:border-l border-gray-200">
              <div className="striped-glyph text-gray-900">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <div>
                <div className="text-xl font-bold text-[#111418] leading-none">24m</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Avg Turnaround Time</div>
              </div>
            </div>
          </div>

          {/* AI Recommendation Pill + Action */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-[#2B66E4] text-white flex items-center justify-center shrink-0">
                <Activity className="size-4" />
              </div>
              <div className="text-xs text-gray-800">
                <span className="font-semibold text-gray-900">AI Clinical Insight: </span>
                {recommendationApplied
                  ? "Directive issued: Dispatch order assigned to Sector 4 ASHA lead."
                  : "PT-RURAL-7891 is 8 days overdue. Tier 4 District Authority dossier prepared."}
              </div>
            </div>

            <Button
              size="xs"
              variant={recommendationApplied ? "outline" : "obsidian"}
              onClick={() => setRecommendationApplied(!recommendationApplied)}
              className="shrink-0 text-xs gap-1 font-medium"
            >
              {recommendationApplied ? (
                <>
                  <Check className="size-3" /> Dispatched
                </>
              ) : (
                "Apply Directive"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Split Grid: Coverage Progress + Critical Alerts (from homepage.png & components3.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Oncology Screening & Staging Coverage */}
        <Card className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#111418]">Screening Coverage by Department</CardTitle>
              <CardDescription className="text-xs text-gray-500">Active screening clinics vs sector targets</CardDescription>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-[#111418]">94%</span>
              <span className="text-[11px] text-emerald-600 block font-medium">▲ 8.4% vs last cycle</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5 pt-1">
            {[
              { dept: "Cervical Colposcopy Unit", val: 88 },
              { dept: "Oral Biopsy Screening", val: 96 },
              { dept: "Histopathology Staging", val: 87 },
              { dept: "Rural Mobile ASHA Camps", val: 98 },
              { dept: "Primary Triage Clinic", val: 82 },
            ].map((item) => (
              <div key={item.dept} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{item.dept}</span>
                  <span className="font-semibold text-gray-900">{item.val}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                  <div
                    className="h-full bg-[#2B66E4] rounded-full transition-all"
                    style={{ width: `${item.val}%` }}
                  />
                  <div
                    className="h-full bg-hatch flex-1"
                  />
                </div>
              </div>
            ))}

            {/* Capacity Multi-Segment Bar */}
            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span>Rural Tracking Quota</span>
                <span>520 Cases Targeted</span>
              </div>
              <div className="w-full h-3 rounded-lg overflow-hidden flex bg-gray-100">
                <div style={{ width: "57%" }} className="bg-[#111418] text-[9px] text-white flex items-center justify-center font-bold">57%</div>
                <div style={{ width: "18%" }} className="bg-[#2B66E4] text-[9px] text-white flex items-center justify-center font-bold">18%</div>
                <div style={{ width: "15%" }} className="bg-[#4A91A7] text-[9px] text-white flex items-center justify-center font-bold">15%</div>
                <div style={{ width: "10%" }} className="bg-hatch" />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-1">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#111418]"></span> Active Checkups</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#2B66E4]"></span> Overdue Alerts</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#4A91A7]"></span> ASHA Dispatched</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Critical Follow-up Alerts (modeled on components3.png pastel cards) */}
        <Card className="bg-white border-gray-200 shadow-2xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#111418]">Critical Escalation Alerts</CardTitle>
              <CardDescription className="text-xs text-gray-500">Tier-gated patient non-responder triggers</CardDescription>
            </div>
            <button
              onClick={() => onSelectCase && onSelectCase("PT-RURAL-7891")}
              className="text-xs font-medium text-[#2B66E4] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              View Matrix <ChevronRight className="size-3" />
            </button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-1">
            {/* Alert 1: Critical Rose Pastel (Tier 4) */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                resolvedAlerts["alert-1"]
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-[#FFF1F0] border-[#FED7D7]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-[#E02424] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <AlertOctagon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#771D1D]">Critical Tier 4 · Emergency Directive</span>
                      <span className="text-[10px] text-gray-500">32 min ago</span>
                    </div>
                    <p className="text-xs text-[#991B1B] mt-0.5">
                       PT-RURAL-7891 (Stage III Oral Biopsy): 8 days overdue. AES-256 address unmasked for District Medical Officer.
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant={resolvedAlerts["alert-1"] ? "secondary" : "outline"}
                  onClick={() => toggleResolve("alert-1")}
                  className="shrink-0 text-xs bg-white/80 border-[#FED7D7] text-[#771D1D] hover:bg-white"
                >
                  {resolvedAlerts["alert-1"] ? "Resolved" : "Resolve"}
                </Button>
              </div>
            </div>

            {/* Alert 2: High Cream Pastel (Tier 3) */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                resolvedAlerts["alert-2"]
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-[#FEF9C3] border-[#FDE047]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#78350F]">High Tier 3 · ASHA Physical Visit</span>
                      <span className="text-[10px] text-gray-500">47 min ago</span>
                    </div>
                    <p className="text-xs text-[#92400E] mt-0.5">
                      PT-RURAL-4421: 6 days overdue post-colposcopy. Sunita Devi dispatched with sector GPS coordinates.
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant={resolvedAlerts["alert-2"] ? "secondary" : "outline"}
                  onClick={() => toggleResolve("alert-2")}
                  className="shrink-0 text-xs bg-white/80 border-[#FDE047] text-[#78350F] hover:bg-white"
                >
                  {resolvedAlerts["alert-2"] ? "Resolved" : "Resolve"}
                </Button>
              </div>
            </div>

            {/* Alert 3: Medium Seafoam Pastel (Tier 2/1) */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                resolvedAlerts["alert-3"]
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-[#F0FDF4] border-[#BBF7D0]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <PhoneCall className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#065F46]">Medium Tier 2 · Automated IVR Call</span>
                      <span className="text-[10px] text-gray-500">1 hr ago</span>
                    </div>
                    <p className="text-xs text-[#166534] mt-0.5">
                      PT-RURAL-1102: Bhojpuri dialect automated voice reminder delivered; primary guardian confirmed callback.
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant={resolvedAlerts["alert-3"] ? "secondary" : "outline"}
                  onClick={() => toggleResolve("alert-3")}
                  className="shrink-0 text-xs bg-white/80 border-[#BBF7D0] text-[#065F46] hover:bg-white"
                >
                  {resolvedAlerts["alert-3"] ? "Resolved" : "Resolve"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Cases Registry Table (modeled on componets.png Patient Queue) */}
      <Card className="bg-white border-gray-200 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[#111418]">Monitored Patient Registry</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              De-identified active surveillance cohort with progressive escalation triggers
            </CardDescription>
          </div>
          <Badge variant="neutral" size="sm">{cases.length} Tracked Cases</Badge>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
              <Users className="size-8 text-gray-300" />
              <p className="text-sm">No cases currently logged. Ingest a case via Clinical Intake.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient Token</TableHead>
                  <TableHead>Tracking Status</TableHead>
                  <TableHead>Cancer Severity Score</TableHead>
                  <TableHead>Overdue Window</TableHead>
                  <TableHead>Active Escalation Tier</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.patient_token}>
                    <TableCell className="font-mono text-xs font-semibold text-[#2B66E4]">
                      {c.patient_token}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" size="xs">
                        {c.status || "ACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800">
                          {c.cancer_severity_score ? `${(c.cancer_severity_score * 100).toFixed(0)}%` : "0%"}
                        </span>
                        {c.cancer_severity_score && c.cancer_severity_score >= 0.8 && (
                          <Badge variant="destructive" size="xs">High Risk</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={(c.days_overdue || 0) > 0 ? "text-amber-800 font-semibold text-xs" : "text-gray-500 text-xs"}>
                        {c.days_overdue ?? 0} days
                      </span>
                    </TableCell>
                    <TableCell>{getTierBadge(c.current_escalation_tier)}</TableCell>
                    <TableCell className="text-right">
                      {onSelectCase && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onSelectCase(c.patient_token)}
                          className="text-xs font-medium text-[#2B66E4] hover:bg-blue-50"
                        >
                          <Eye className="size-3 mr-1" />
                          Inspect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
