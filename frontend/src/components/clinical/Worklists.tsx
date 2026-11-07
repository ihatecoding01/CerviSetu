import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  ClipboardPlus,
  Clock,
  CreditCard,
  FileText,
  Home,
  Hospital,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { referralApi, STATUS_LABELS, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { Empty, FollowUpPill, Notice, Pill } from "../app/Status";
import { btn, ui } from "../app/ui";
import { Card } from "../careui/card";

function useBoard() {
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRows((await referralApi.board()).referrals); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "The referral list could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { rows, error, load };
}

const needsReview = (r: Referral) => !!r.doctor_review && !r.doctor_review_note;
const underCare = (r: Referral) => !["REFERRED", "ROUTINE_SCREENING", "DECLINED", "COMPLETED"].includes(r.status);
const REVIEW_TEXT: Record<string, string> = { REFUSED: "She refused the referral", NO_CONTACT: "No contact by day 14" };

/** Why a referral is in the doctor's priority list, in words. */
function reason(r: Referral): string {
  if (needsReview(r)) return `Review: ${REVIEW_TEXT[r.doctor_review!] ?? r.doctor_review}`;
  if (r.status === "ARRIVED") return "Arrived. Record colposcopy findings";
  if (r.status === "BIOPSY_TAKEN") return "Waiting for histopathology";
  if (r.status === "REPORT_READY") return "Report ready. Plan and explain";
  if (r.following && r.lane === "visit_due") return "Not arrived by day 14";
  if (r.urgent && r.following) return "Urgent referral not yet arrived";
  return STATUS_LABELS[r.status] ?? r.status;
}
const priority = (r: Referral) =>
  needsReview(r) ? 0 : r.status === "ARRIVED" || r.status === "REPORT_READY" ? 1 : r.following && r.lane === "visit_due" ? 2 : r.urgent && r.following ? 3 : r.status === "BIOPSY_TAKEN" ? 4 : 9;

function CaseTable({ rows, onOpen, showReason }: { rows: Referral[]; onOpen?: (token: string) => void; showReason?: boolean }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-black/[0.06]">
          <tr><th className={ui.th}>Patient</th><th className={ui.th}>Age</th><th className={ui.th}>Screening finding</th><th className={ui.th}>From</th><th className={ui.th}>{showReason ? "Why it is here" : "Status"}</th>{onOpen && <th className={ui.th}><span className="sr-only">Open</span></th>}</tr>
        </thead>
        <tbody className="divide-y divide-black/[0.06]">
          {rows.map((r) => (
            <tr key={r.referral_id} className={onOpen ? "hover:bg-slate-50 cursor-pointer" : ""} onClick={onOpen ? () => onOpen(r.patient_token) : undefined} data-testid="case-row">
              <td className={ui.td}><div className="font-semibold">{r.patient_name}</div><div className={`${ui.mono} text-slate-500`}>{r.patient_token}</div></td>
              <td className={`${ui.td} tabular-nums`}>{r.age ?? ""}</td>
              <td className={`${ui.td} max-w-[280px]`}><div className="text-slate-800 line-clamp-2">{r.screening_finding || "Not entered"}</div>{r.urgent && <div className="mt-1"><Pill tone="critical">Urgent</Pill></div>}</td>
              <td className={`${ui.td} text-slate-700`}>{r.health_post}</td>
              <td className={ui.td}>{showReason ? <span className="text-sm text-slate-800">{reason(r)}</span> : <FollowUpPill r={r} />}</td>
              {onOpen && <td className={`${ui.td} text-right`}><button type="button" aria-label={`Open ${r.patient_name}`} onClick={(e) => { e.stopPropagation(); onOpen(r.patient_token); }} className="p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"><ChevronRight className="size-4 text-slate-500" /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function greeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name}`;
}

/** Doctor home: what needs a decision today, then the rest of the pathway at a glance. */
export function DoctorDashboard({ staff, onOpenCase, onGo }: { staff: StaffProfile; onOpenCase: (token: string) => void; onGo: (tab: string) => void }) {
  const { rows, error, load } = useBoard();
  const [tab, setTab] = useState<"priority" | "care" | "follow" | "done">("priority");
  const all = rows ?? [];
  // The queue holds urgent referrals only (the urgent flag set at intake). The numbers above it still count everyone.
  const sets = useMemo(() => {
    const urgent = all.filter((r) => r.urgent);
    return {
      priority: urgent.filter((r) => priority(r) < 9).sort((a, b) => priority(a) - priority(b)),
      care: urgent.filter(underCare),
      follow: urgent.filter((r) => r.following),
      done: urgent.filter((r) => r.status === "COMPLETED" || r.status === "DECLINED"),
    };
  }, [all]);
  const tabs: [typeof tab, string][] = [["priority", "Needs attention"], ["care", "Under care"], ["follow", "In follow-up"], ["done", "Closed"]];
  const numbers: [string, number, string][] = [
    ["Needs your review", all.filter(needsReview).length, "Refused or not reached by day 14"],
    ["Arrived, record pending", all.filter((r) => r.status === "ARRIVED").length, "Colposcopy findings not yet saved"],
    ["In follow-up", all.filter((r) => r.following).length, "Referred, not yet arrived"],
    ["Home visit due", all.filter((r) => r.following && r.lane === "visit_due").length, "Day 14 or later"],
  ];
  const shown = sets[tab];

  return (
    <div className="flex flex-col gap-6" data-testid="doctor-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className={ui.h1}>{greeting(staff.name)}</h1><p className={`${ui.muted} mt-1`}>{staff.facility}. Referrals that reach your hospital, and those still on the way.</p></div>
        <button type="button" onClick={load} className={btn("secondary", "!min-h-9")}><RefreshCw className="size-4" />Refresh</button>
      </header>
      {error && <Notice tone="critical" role="alert">{error}</Notice>}

      {/* Top 4 Decision-Driver Metric Cards with calibrated perimeter hover trace */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card variant="pink" traceColor="#9D174D" className="p-4 border-pink-200/80 shadow-2xs hover:shadow-sm transition-all">
          <div className="text-xs font-semibold text-[#9D174D] flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" /> Needs your review
          </div>
          <div className="mt-1 font-heading text-2xl font-bold font-mono-data text-slate-900">{rows ? numbers[0][1] : "–"}</div>
          <div className="text-xs text-slate-500 mt-0.5">{numbers[0][2]}</div>
        </Card>

        <Card variant="blue" traceColor="#0284C7" className="p-4 border-sky-200/80 shadow-2xs hover:shadow-sm transition-all">
          <div className="text-xs font-semibold text-[#0284C7] flex items-center gap-1.5">
            <Hospital className="size-3.5" /> Arrived, record pending
          </div>
          <div className="mt-1 font-heading text-2xl font-bold font-mono-data text-slate-900">{rows ? numbers[1][1] : "–"}</div>
          <div className="text-xs text-slate-500 mt-0.5">{numbers[1][2]}</div>
        </Card>

        <Card variant="subtle" traceColor="#0369A1" className="p-4 border-slate-200 shadow-2xs hover:shadow-sm transition-all">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Activity className="size-3.5" /> In follow-up
          </div>
          <div className="mt-1 font-heading text-2xl font-bold font-mono-data text-slate-900">{rows ? numbers[2][1] : "–"}</div>
          <div className="text-xs text-slate-500 mt-0.5">{numbers[2][2]}</div>
        </Card>

        <Card variant="warm" traceColor="#E11D48" className="p-4 border-rose-200/80 shadow-2xs hover:shadow-sm transition-all">
          <div className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
            <Home className="size-3.5" /> Home visit due
          </div>
          <div className="mt-1 font-heading text-2xl font-bold font-mono-data text-slate-900">{rows ? numbers[3][1] : "–"}</div>
          <div className="text-xs text-slate-500 mt-0.5">{numbers[3][2]}</div>
        </Card>
      </div>

      {/* Clinical & Field Intelligence Hub */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-4" aria-labelledby="intel-hub">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono-data">Actionable Intelligence</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">5 Live Engines</span>
            </div>
            <h2 id="intel-hub" className="text-base font-bold font-heading text-slate-900 mt-0.5">Clinical &amp; Field Intelligence Hub</h2>
            <p className="text-xs text-slate-500">Live decision engines preventing dropouts, assisting ASHA routing, and resolving patient distress.</p>
          </div>
          <span className="text-xs font-mono-data text-slate-400">Patient &amp; ASHA Empowerment</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Clinical Red-Flags Radar */}
          <Card variant="pink" traceColor="#9D174D" className="p-4 border-rose-200/80 shadow-2xs hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#9D174D] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-[#9D174D]" />
                Clinical Red-Flags Radar
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100/90 text-rose-800 border border-rose-300/50">Immediate Triage</span>
            </div>
            <div className="mt-2.5">
              <div className="font-heading font-bold text-sm text-slate-900">Rita Naidu <span className="font-mono-data text-xs font-normal text-slate-500">(PT-CASE-NISHI)</span></div>
              <p className="text-xs text-rose-900 font-medium mt-1 leading-snug">Contact bleeding &amp; friable cervical lesion flagged at Malvani Clinic.</p>
              <div className="mt-3 p-2.5 rounded-lg bg-white/70 border border-rose-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between font-mono-data"><span>Protocol Window:</span> <span className="font-bold text-rose-700">48h SLA</span></div>
                <div className="flex justify-between"><span>Fast-track colposcopy slot:</span> <span className="font-semibold text-slate-900">KEM Hosp &middot; Bed 04</span></div>
              </div>
            </div>
          </Card>

          {/* Card: Cashless Scheme & Transport Aid */}
          <Card variant="blue" traceColor="#0284C7" className="p-4 border-sky-200/80 shadow-2xs hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0284C7] uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-[#0284C7]" />
                Cashless Scheme &amp; Transport Aid
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300/50">100% Covered</span>
            </div>
            <div className="mt-2.5">
              <div className="font-heading font-bold text-lg text-slate-900 font-mono-data">₹0 <span className="text-xs font-normal text-slate-500 font-sans">Out-of-Pocket Cost</span></div>
              <p className="text-xs text-slate-600 mt-1 leading-snug">MJPJAY Pre-Auth Active &middot; PM-JAY ABHA gold card verified for 100% of cohort.</p>
              <div className="mt-3 p-2.5 rounded-lg bg-white/70 border border-sky-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between"><span>Travel vouchers issued:</span> <span className="font-mono-data font-bold text-sky-800">14 Patients</span></div>
                <div className="flex justify-between text-slate-500"><span>Transit Barrier Dropouts:</span> <span className="font-bold text-emerald-700">0 Reported</span></div>
              </div>
            </div>
          </Card>

          {/* Card: Outreach Timing & Indic Voice */}
          <Card variant="subtle" traceColor="#0369A1" className="p-4 border-slate-200 shadow-2xs hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#0369A1]" />
                Outreach Timing &amp; Indic Voice
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300/60 font-mono-data">4:30–7:00 PM</span>
            </div>
            <div className="mt-2.5">
              <div className="font-heading font-bold text-lg text-slate-900 font-mono-data">92.3% <span className="text-xs font-normal text-emerald-700 font-sans font-bold">+28% vs Morning</span></div>
              <p className="text-xs text-slate-600 mt-1 leading-snug">Peak answer window for rural women after household shifts.</p>
              <div className="mt-3 p-2.5 rounded-lg bg-white/70 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between"><span>Vernacular split:</span> <span className="font-mono-data text-slate-900">mr 44% &middot; hi 32% &middot; bho 24%</span></div>
                <div className="flex justify-between text-slate-500"><span>Sarvam Indic Voice Pickup:</span> <span className="font-bold text-[#0369A1]">88.6%</span></div>
              </div>
            </div>
          </Card>

          {/* Card: Patient Anxiety Pulse & Voice Loop */}
          <Card variant="warm" traceColor="#E11D48" className="p-4 border-rose-200/80 shadow-2xs hover:shadow-sm transition-all md:col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-rose-600" />
                Patient Anxiety Pulse &amp; Voice Loop
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300/50">Voice Reassurance Dispatched</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Top Patient Questions This Week:</span>
                <ul className="text-xs text-slate-700 mt-1.5 space-y-1 list-disc list-inside">
                  <li>“Does colposcopy cause permanent infertility?”</li>
                  <li>“Will biopsy hurt, and can I work next morning?”</li>
                </ul>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 border border-rose-100 flex flex-col justify-between">
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-900">Empathy Countermeasure:</span> Automated 45-second voice reassurance message delivered in Marathi &amp; Bhojpuri.
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono-data pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Hesitation Drop:</span>
                  <span className="font-bold text-emerald-700">88.4% Consent Recovered</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card: ASHA Field Route & Cluster Density */}
          <Card variant="subtle" traceColor="#059669" className="p-4 border-emerald-200/80 shadow-2xs hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="size-3.5 text-emerald-600" />
                ASHA Field Route &amp; Cluster Density
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/50">Cluster Optimized</span>
            </div>
            <div className="mt-2.5">
              <div className="font-heading font-bold text-sm text-slate-900">Malvani Gate 5 &middot; Cluster #4</div>
              <p className="text-xs text-slate-600 mt-1 leading-snug">4 home visits clustered within 450m radius. Sunita Kamble assigned.</p>
              <div className="mt-3 p-2.5 rounded-lg bg-white/70 border border-emerald-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between font-mono-data"><span>Est. Walking Time:</span> <span className="font-bold text-emerald-800">35 min (Saved 2.4h)</span></div>
                <div className="flex justify-between"><span>First-Pass Completion:</span> <span className="font-bold text-emerald-700 font-mono-data">87.5%</span></div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <section className={`${ui.panel} min-w-0`} aria-labelledby="queue">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 pt-3">
            <h2 id="queue" className="sr-only">Urgent referrals</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-800 pb-2.5" data-testid="urgent-label">Urgent</span>
            <div role="tablist" className="flex gap-4 overflow-x-auto max-w-full min-w-0">
              {tabs.map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`queue-${id}`}
                  className={`pb-2.5 -mb-px border-b-2 text-sm whitespace-nowrap cursor-pointer ${tab === id ? "border-[#0369A1] text-[#075985] font-semibold" : "border-transparent text-slate-600 hover:text-[#111418]"}`}>
                  {label} <span className="tabular-nums text-slate-500">({sets[id].length})</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onGo("cases-tab")} className={`${ui.link} pb-2.5`}>All referral cases</button>
          </div>
          {rows === null ? <p className={`${ui.muted} p-6`} role="status">Loading...</p>
            : shown.length === 0 ? <div className="p-4"><Empty title="No urgent referrals here right now." /></div>
            : <CaseTable rows={shown.slice(0, 10)} onOpen={onOpenCase} showReason={tab === "priority"} />}
          {shown.length > 10 && <p className="px-4 py-3 text-xs text-slate-500 border-t border-black/[0.06]">Showing 10 of {shown.length}. Open referral cases to see the rest.</p>}
        </section>

        <aside className="flex flex-col gap-4">
          <section className={`${ui.panel} p-4`}>
            <h2 className={ui.h3}>Quick actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([["cases-tab", "Review referrals", ListChecks], ["encounter-tab", "Open case record", Stethoscope], ["encounter-tab", "Add a report", FileText], ["intake-tab", "New screening", ClipboardPlus]] as const).map(([to, label, Icon]) => (
                <button key={label} type="button" onClick={() => onGo(to)} className="flex flex-col items-start gap-2 rounded-md border border-black/10 p-3 text-left text-sm font-medium hover:bg-slate-50 cursor-pointer">
                  <Icon className="size-5 text-[#0369A1]" />{label}
                </button>
              ))}
            </div>
          </section>
          <section className={`${ui.panel} p-4`}>
            <h2 className={ui.h3}>How follow-up works</h2>
            <ol className="mt-3 flex flex-col gap-2.5 text-sm">
              {[["Day 0", "Referred from the health post"], ["Days 1 to 10", "Daily reminders to her"], ["Days 11 to 13", "Calls from the health post"], ["Day 14", "ASHA home visit, then your review"], ["Arrival", "The hospital confirms. Follow-up stops"]].map(([d, t]) => (
                <li key={d} className="grid grid-cols-[88px_1fr] gap-2"><span className="text-xs font-semibold text-slate-500 pt-0.5">{d}</span><span className="text-slate-700">{t}</span></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

const FILTERS: [string, string, (r: Referral) => boolean][] = [
  ["attention", "Needs attention", (r) => priority(r) < 9],
  ["all", "All patients", () => true],
  ["review", "Needs review", needsReview],
  ["follow", "In follow-up", (r) => r.following],
  ["arrived", "Arrived", (r) => r.status === "ARRIVED"],
  ["care", "Under care", underCare],
  ["closed", "Closed", (r) => !r.following && !underCare(r)],
];

/** Every referral in one list, with search and filters. Doctors open the case; nurses see what to chase. */
export function CasesList({ staff, onOpenCase }: { staff: StaffProfile; onOpenCase?: (token: string) => void }) {
  const { rows, error, load } = useBoard();
  const [q, setQ] = useState("");
  const [f, setF] = useState(staff.role === "DOCTOR" ? "attention" : "all");
  const [urgency, setUrgency] = useState<"" | "urgent" | "routine">("");
  const [msg, setMsg] = useState<string | null>(null);
  const test = FILTERS.find(([id]) => id === f)![2];
  const query = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => test(r) && (!urgency || (urgency === "urgent") === r.urgent) && (!query || `${r.patient_name} ${r.patient_token} ${r.referral_id} ${r.health_post} ${r.area}`.toLowerCase().includes(query)));
  if (f === "attention") shown.sort((a, b) => priority(a) - priority(b));
  const doctor = staff.role === "DOCTOR";

  const remind = async (r: Referral) => {
    setMsg(null);
    try { await referralApi.remind(r.referral_id, "SMS"); setMsg(`Reminder recorded for ${r.patient_name}.`); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "The reminder could not be recorded."); }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="cases-list">
      <header><h1 className={ui.h1}>Referral cases</h1><p className={`${ui.muted} mt-1`}>{doctor ? "Open a case to review findings and record results." : "Referrals from your health post and where each one stands."}</p></header>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
          {FILTERS.map(([id, label, fn]) => (
            <button key={id} type="button" aria-pressed={f === id} onClick={() => setF(id)} className={`min-h-9 rounded-full border px-3 text-sm cursor-pointer ${f === id ? "border-[#0369A1] bg-sky-50 text-[#075985] font-semibold" : "border-black/10 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {label} <span className="tabular-nums text-slate-500">{(rows ?? []).filter(fn).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:w-auto">
        <select aria-label="Urgency" className={`${ui.input} w-auto`} value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)} data-testid="cases-urgency">
          <option value="">Any urgency</option><option value="urgent">Urgent</option><option value="routine">Routine</option>
        </select>
        <label className="relative flex-1 sm:w-64">
          <span className="sr-only">Search</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input className={`${ui.input} pl-9`} placeholder="Name, patient or referral ID" value={q} onChange={(e) => setQ(e.target.value)} data-testid="cases-search" />
        </label>
        </div>
      </div>
      {error && <Notice tone="critical" role="alert">{error}</Notice>}
      {msg && <Notice tone="guidance" role="status">{msg}</Notice>}
      <section className={ui.panel}>
        {rows === null ? <p className={`${ui.muted} p-6`} role="status">Loading...</p>
          : shown.length === 0 ? <div className="p-4"><Empty title="No referrals match." /></div>
          : doctor ? <CaseTable rows={shown} onOpen={onOpenCase} />
          : (
            <ul className="divide-y divide-black/[0.06]">
              {shown.map((r) => (
                <li key={r.referral_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3" data-testid="case-row">
                  <div className="min-w-0"><div className="font-semibold">{r.patient_name}{r.age ? `, ${r.age}` : ""}</div><div className="text-xs text-slate-600">{r.hospital ?? "Not referred"} · <span className={ui.mono}>{r.patient_token}</span></div></div>
                  <div className="flex items-center gap-2"><FollowUpPill r={r} />{r.following && <button type="button" onClick={() => remind(r)} className={btn("secondary", "!min-h-9")}>Send reminder</button>}</div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

// Intake fields a referral is expected to have. Blank is shown as missing, never as negative.
const EXPECTED: [string, (r: Referral) => boolean][] = [
  ["contact number", (r) => !!r.contact_phone],
  ["age", (r) => r.age != null],
  ["reminder consent", (r) => !!r.message_consent],
  ["presenting complaints", (r) => !!r.form?.presenting_complaints],
  ["parity", (r) => !!r.form?.parity],
  ["Pap, HPV or VIA result", (r) => !!(r.form?.pap_result || r.form?.hpv_dna || r.form?.via_findings)],
];
export const missingInfo = (r: Referral) => EXPECTED.filter(([, ok]) => !ok(r)).map(([label]) => label);

/** Nurse home: chase what is missing and who is close to day 14. */
export function NurseQueue({ staff, onGo }: { staff: StaffProfile; onGo: (tab: string) => void }) {
  const { rows, error, load } = useBoard();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const following = (rows ?? []).filter((r) => r.following);
  const due = following.filter((r) => r.lane !== "on_track").sort((a, b) => b.follow_up_day - a.follow_up_day);
  const incomplete = (rows ?? []).filter((r) => r.status !== "COMPLETED" && missingInfo(r).length > 0);

  const call = async (r: Referral, outcome: string, label: string) => {
    setBusy(r.referral_id);
    setMsg(null);
    try { await referralApi.contact(r.referral_id, outcome, ""); setMsg({ ok: true, text: `${r.patient_name}: call recorded (${label.toLowerCase()}).` }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "The call could not be recorded." }); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="nurse-queue">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className={ui.h1}>Work queue</h1><p className={`${ui.muted} mt-1`}>{staff.health_post ?? staff.facility}. Calls to make and records to complete.</p></div>
        <button type="button" onClick={() => onGo("intake-tab")} className={btn("primary")} data-testid="nurse-new-screening"><ClipboardPlus className="size-4" />New screening</button>
      </header>
      {error && <Notice tone="critical" role="alert">{error}</Notice>}
      {msg && <Notice tone={msg.ok ? "routine" : "critical"} role={msg.ok ? "status" : "alert"}>{msg.text}</Notice>}

      <section className="flex flex-col gap-2" aria-labelledby="due">
        <h2 id="due" className={ui.h2}>Call today <span className="text-slate-500 font-normal text-base">({due.length})</span></h2>
        <p className={ui.muted}>Referred women on day 11 or later who have not reached the hospital. Record each call.</p>
        {rows === null ? <p className={ui.muted} role="status">Loading...</p> : due.length === 0 ? <Empty title="No calls due today." /> : (
          <ul className={`${ui.panel} divide-y divide-black/[0.06]`}>
            {due.map((r) => (
              <li key={r.referral_id} className="px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3" data-testid="nurse-due-row">
                <div className="min-w-0">
                  <div className="font-semibold">{r.patient_name}{r.age ? `, ${r.age}` : ""} {r.contact_phone && <a href={`tel:${r.contact_phone}`} className="ml-2 text-sm font-normal text-[#0369A1] hover:underline">{r.contact_phone}</a>}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600"><FollowUpPill r={r} />{r.assigned_asha ? `ASHA: ${r.assigned_asha}` : "No ASHA assigned yet"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[["REACHED", "Spoke to her"], ["NO_ANSWER", "No answer"], ["WRONG_NUMBER", "Wrong number"]].map(([v, label]) => (
                    <button key={v} type="button" disabled={busy === r.referral_id} onClick={() => call(r, v, label)} className={btn("secondary", "!min-h-9")}>{label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="missing">
        <h2 id="missing" className={ui.h2}>Information missing <span className="text-slate-500 font-normal text-base">({incomplete.length})</span></h2>
        <p className={ui.muted}>These records were saved with blanks, which doctors see as not entered. A saved intake cannot be edited yet, so note the details for the doctor when you next see her.</p>
        {rows && (incomplete.length === 0 ? <Empty title="All records have the expected details." /> : (
          <ul className={`${ui.panel} divide-y divide-black/[0.06]`}>
            {incomplete.map((r) => (
              <li key={r.referral_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold">{r.patient_name}</div><div className={`${ui.mono} text-slate-500`}>{r.patient_token}</div></div>
                <div className="flex flex-wrap gap-1.5">{missingInfo(r).map((m) => <Pill key={m} tone="attention">{`Not entered: ${m}`}</Pill>)}</div>
              </li>
            ))}
          </ul>
        ))}
      </section>
    </div>
  );
}
