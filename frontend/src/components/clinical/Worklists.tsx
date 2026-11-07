import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, ClipboardPlus, FileText, ListChecks, RefreshCw, Search, Stethoscope } from "lucide-react";
import { referralApi, STATUS_LABELS, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { Empty, FollowUpPill, Notice, Pill } from "../app/Status";
import { btn, ui } from "../app/ui";

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

      <dl className={`${ui.panel} grid grid-cols-2 lg:grid-cols-4 divide-black/[0.06] max-lg:[&>div:nth-child(odd)]:border-r lg:divide-x max-lg:[&>div:nth-child(-n+2)]:border-b`}>
        {numbers.map(([label, n, hint]) => (
          <div key={label} className="p-4 border-black/[0.06]">
            <dt className="text-xs font-semibold text-slate-600">{label}</dt>
            <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{rows ? n : "–"}</dd>
            <dd className="text-xs text-slate-500">{hint}</dd>
          </div>
        ))}
      </dl>

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
