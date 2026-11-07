import { useCallback, useEffect, useState } from "react";
import { Dot } from "../icons/Sym";
import type { PatientCase } from "../../api/client";
import { referralApi, STATUS_LABELS, STEP_LABELS, type Lane, type Referral } from "../../api/referrals";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../careui/card";
import { Badge } from "../careui/badge";
import { Button } from "../careui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../careui/table";
import { Alert, AlertTitle, AlertDescription } from "../careui/alert";
import { RefreshCw, AlertTriangle, Users, Clock, Calendar, Stethoscope, ShieldCheck, Flame, Send } from "lucide-react";

interface Props {
  cases: PatientCase[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectCase?: (patientToken: string) => void;
}

// Each column is a span of follow-up days; each lit dot is one woman in that span.
function DotMatrix({ rows, colorClass }: { rows: Referral[]; colorClass: string }) {
  const counts = Array.from({ length: 14 }, (_, i) => rows.filter((r) => Math.min(r.follow_up_day, 14) === i + 1).length);
  return (
    <div className="grid grid-cols-14 gap-1 pt-3 w-full" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
      {counts.map((height, col) => (
        <div key={col} className="flex flex-col-reverse gap-1 items-center">
          {[1, 2, 3, 4, 5].map((level) => (
            <span key={level} className={`size-1.5 rounded-full ${level <= height ? colorClass : "bg-gray-200"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function stepBadge(r: Referral) {
  if (!r.following) return <Badge variant="neutral" size="xs">{STATUS_LABELS[r.status] ?? r.status}</Badge>;
  if (r.lane === "visit_due") return <Badge variant="destructive" size="xs">{STEP_LABELS[r.follow_up_step]}</Badge>;
  if (r.lane === "attention") return <Badge variant="warning" size="xs">{STEP_LABELS[r.follow_up_step]}</Badge>;
  return <Badge variant="primary" size="xs">{STEP_LABELS[r.follow_up_step]}</Badge>;
}

export function OverviewPanel({ error, onRefresh, onSelectCase, loading }: Props) {
  const [filter, setFilter] = useState<"all" | Lane>("all");
  const [rows, setRows] = useState<Referral[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await referralApi.board()).referrals);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The referral board could not be loaded.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (r: Referral, fn: () => Promise<unknown>, done: string) => {
    setBusy(r.referral_id);
    setMessage(null);
    try {
      await fn();
      setMessage(`${r.patient_name}: ${done}`);
      await load();
    } catch (e) {
      setMessage(`${r.patient_name}: ${e instanceof Error ? e.message : "The action failed."}`);
    } finally {
      setBusy(null);
    }
  };

  const inLane = (l: Lane) => rows.filter((r) => r.following && r.lane === l);
  const shown = rows.filter((r) => filter === "all" || (r.following && r.lane === filter));
  const kpis = [
    { title: "All Records", sub: "Screening and referral", value: rows.length, icon: Users, tone: "bg-emerald-50 border-emerald-100 text-emerald-600", dot: "bg-emerald-500", rows },
    { title: "On Track", sub: "Days 1 to 10", value: inLane("on_track").length, icon: ShieldCheck, tone: "bg-[#DBFE87]/50 border-[#DBFE87] text-black", dot: "bg-emerald-500", rows: inLane("on_track") },
    { title: "Needs Attention", sub: "Days 11 to 13", value: inLane("attention").length, icon: Clock, tone: "bg-[#F19941]/15 border-[#F19941]/30 text-[#BA2D0B]", dot: "bg-[#F19941]", rows: inLane("attention") },
    { title: "Home Visit Due", sub: "Day 14 or later", value: inLane("visit_due").length, icon: Flame, tone: "bg-[#BA2D0B]/10 border-[#BA2D0B]/30 text-[#BA2D0B]", dot: "bg-[#BA2D0B]", rows: inLane("visit_due") },
  ];
  const tabs: { id: "all" | Lane; label: string; tone?: "green" | "amber" | "red"; on: string; off: string }[] = [
    { id: "all", label: `All Cases (${rows.length})`, on: "bg-white text-black shadow-2xs", off: "text-gray-600 hover:text-black" },
    { id: "on_track", label: "On Track", tone: "green", on: "bg-emerald-600 text-white shadow-2xs", off: "text-emerald-700 hover:bg-emerald-50" },
    { id: "attention", label: "Needs Attention", tone: "amber", on: "bg-amber-500 text-white shadow-2xs", off: "text-amber-800 hover:bg-amber-50" },
    { id: "visit_due", label: "Home Visit Due", tone: "red", on: "bg-[#BA2D0B] text-white shadow-2xs", off: "text-[#BA2D0B] hover:bg-rose-50" },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">Referral Board</h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-gray-400" />
            <span>From abnormal screening to hospital care, across Mumbai health posts</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => { onRefresh(); load(); }} disabled={loading} className="text-xs font-medium text-gray-700">
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Board
          </Button>
        </div>
      </div>

      {(error || loadError) && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>System Alert</AlertTitle>
          <AlertDescription>{loadError || error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.title} size="sm" className="bg-white border-gray-200 shadow-2xs">
              <CardHeader className="pb-1">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`size-8 rounded-lg border flex items-center justify-center ${k.tone}`}><Icon className="size-4" /></div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600">{k.title}</div>
                      <div className="text-xs font-medium text-gray-500">{k.sub}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-black tracking-tight">{k.value}</div>
                </div>
              </CardHeader>
              <CardContent className="pt-2"><DotMatrix rows={k.rows} colorClass={k.dot} /></CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-white border-gray-200 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
          <div>
            <CardTitle className="text-base font-bold text-[#111418]">Patients in the Pathway</CardTitle>
            <CardDescription className="text-xs text-gray-500">Names are visible to signed-in staff. External services receive coded tokens.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-lg">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setFilter(t.id)} className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${filter === t.id ? t.on : t.off}`}>
                {t.tone && <Dot tone={t.tone} />} {t.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {message && <div className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">{message}</div>}
          {shown.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No patients in this view.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.referral_id} className={r.following && r.lane === "visit_due" ? "bg-rose-50/40 hover:bg-rose-50/70" : r.following && r.lane === "attention" ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-gray-50/80"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg font-bold text-sm flex items-center justify-center border bg-white text-[#BA2D0B] border-[#BA2D0B]/40">{r.patient_name[0]}</div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-black">{r.patient_name}</span>
                            {r.age && <span className="text-xs text-gray-500 font-medium">{r.age}Y</span>}
                            {r.fictional && <Badge variant="neutral" size="xs">Fictional</Badge>}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">{r.health_post}</div>
                          <div className="font-mono text-[11px] text-[#BA2D0B] mt-0.5">{r.patient_token}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-gray-900">{r.screening_finding}</div>
                      {r.histopathology && <div className="text-xs text-gray-500 mt-0.5">{r.histopathology}</div>}
                      {r.urgent && <div className="mt-1"><Badge variant="destructive" size="xs">Urgent</Badge></div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-gray-900">{r.hospital ?? "Not referred"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{STATUS_LABELS[r.status] ?? r.status}</div>
                    </TableCell>
                    <TableCell>
                      {r.following && <div className="text-xs font-bold text-gray-900 mb-1">Day {r.follow_up_day} of 14</div>}
                      {stepBadge(r)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.following && (
                        <div className="flex justify-end gap-1 mb-1">
                          <Button variant="outline" size="xs" disabled={busy === r.referral_id} className="text-xs gap-1"
                            onClick={() => act(r, () => referralApi.remind(r.referral_id, "SMS"), "reminder recorded")}>
                            <Send className="size-3" /> Remind
                          </Button>
                          <Button variant="outline" size="xs" disabled={busy === r.referral_id} className="text-xs"
                            onClick={() => act(r, () => referralApi.setStatus(r.referral_id, { status: "ARRIVED" }), "marked as arrived")}>
                            Mark Arrived
                          </Button>
                        </div>
                      )}
                      {onSelectCase && (
                        <Button variant="obsidian" size="xs" onClick={() => onSelectCase(r.patient_token)} className="text-xs font-semibold bg-black hover:bg-black/85 text-white gap-1">
                          <Stethoscope className="size-3" /> Open Case
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
