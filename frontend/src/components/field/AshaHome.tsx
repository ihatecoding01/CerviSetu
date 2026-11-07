import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Home,
  Phone,
  Search,
  Users,
  UserPlus,
} from "lucide-react";
import { RegisterPatient } from "./RegisterPatient";
import { referralApi, type Referral, type ReferralEvent } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { AppShell } from "../app/AppShell";
import { staffGenie } from "../app/genieConfigs";
import { Empty, FollowUpPill, Notice, Pill, laneTone, when } from "../app/Status";
import { btn, ui } from "../app/ui";
import { Card } from "../careui/card";

const CONTACT: [string, string][] = [["REACHED", "Spoke to her"], ["NO_ANSWER", "No answer"], ["WRONG_NUMBER", "Wrong number"]];
const VISIT: [string, string][] = [["MET_PATIENT", "Met her"], ["NOT_AT_HOME", "Not at home"], ["UNREACHABLE", "Could not find the house"]];
const EVENT_TEXT: Record<string, string> = {
  REGISTERED_BY_ASHA: "Registered by you", CONTACT_REACHED: "Call: spoke to her", CONTACT_NO_ANSWER: "Call: no answer", CONTACT_WRONG_NUMBER: "Call: wrong number",
  VISIT_MET_PATIENT: "Visit: met her", VISIT_NOT_AT_HOME: "Visit: not at home", VISIT_UNREACHABLE: "Visit: house not found",
  CONSENT_POSITIVE: "She agreed to go", CONSENT_NEGATIVE: "She does not want to go",
};

/** What the ASHA should do next for this woman, from server fields only. */
function nextAction(r: Referral): string {
  if (!r.following) return r.status === "DECLINED" ? "Closed. A doctor reviews her decision." : "Closed. She reached the hospital.";
  if (r.consent === "POSITIVE") return "She agreed to go. Remind her until the hospital confirms she arrived.";
  if (r.lane === "visit_due") return "Home visit due. Visit her and record what happened.";
  if (r.lane === "attention") return "Call her today. Visit if you cannot reach her.";
  return "Reminders are going out. Call her if she has not replied.";
}

function Followup({ r, onSaved, onBack }: { r: Referral; onSaved: (next: Referral) => void; onBack: () => void }) {
  const [events, setEvents] = useState<ReferralEvent[] | null>(null);
  const [note, setNote] = useState("");
  const [met, setMet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = r.referral_id;
  const load = useCallback(() => referralApi.events(id).then((e) => setEvents(e.events.filter((x) => x.kind in EVENT_TEXT))).catch(() => setEvents([])), [id]);
  useEffect(() => { void load(); setMet(false); setNote(""); setMsg(null); }, [load]);

  const save = async (fn: () => Promise<Referral>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const next = await fn();
      setMsg({ ok: true, text: done });
      setNote("");
      setMet(false);
      onSaved(next);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "This could not be saved. Please try again." });
    } finally {
      setBusy(false);
    }
  };
  const last = events?.[events.length - 1];
  const open = r.following;

  return (
    <div className="flex flex-col gap-4" data-testid="asha-detail">
      <button type="button" onClick={onBack} className={`${ui.link} lg:hidden self-start inline-flex items-center gap-1`}><ArrowLeft className="size-4" />All follow-ups</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={ui.h2}>{r.patient_name}{r.age ? `, ${r.age}` : ""}</h2>
          <p className="text-sm text-slate-600">{r.area} · Referred to {r.hospital}</p>
        </div>
        <FollowUpPill r={r} />
      </div>
      <Notice tone={laneTone(r) === "critical" ? "attention" : "guidance"}>{nextAction(r)}</Notice>
      {r.urgent && <Notice tone="critical">Marked urgent by the health post. Please contact her today.</Notice>}

      {open && (
        <ol className="flex flex-col gap-3">
          <li className={`${ui.panel} p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={ui.h3}>1. Call her</h3>
              {r.contact_phone && <a href={`tel:${r.contact_phone}`} className={btn("secondary", "!min-h-10")}><Phone className="size-4" />Call</a>}
            </div>
            <p className="text-xs text-slate-500">After the call, choose what happened.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CONTACT.map(([v, label]) => (
                <button key={v} type="button" disabled={busy} onClick={() => save(() => referralApi.contact(id, v, note), `Call recorded: ${label.toLowerCase()}.`)} className={btn("secondary")} data-testid={`asha-call-${v}`}>{label}</button>
              ))}
            </div>
          </li>
          <li className={`${ui.panel} p-4 flex flex-col gap-3`}>
            <h3 className={ui.h3}>2. Home visit</h3>
            <p className="text-xs text-slate-500">If you cannot meet her, a doctor is asked to review her follow-up.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VISIT.map(([v, label]) => v === "MET_PATIENT" ? (
                <button key={v} type="button" disabled={busy} onClick={() => setMet(true)} aria-pressed={met} className={btn(met ? "primary" : "secondary")} data-testid="asha-met">{label}</button>
              ) : (
                <button key={v} type="button" disabled={busy} onClick={() => save(() => referralApi.visit(id, v, null, note), `Visit recorded: ${label.toLowerCase()}. A doctor will review.`)} className={btn("secondary")} data-testid={`asha-visit-${v}`}>{label}</button>
              ))}
            </div>
            {met && (
              <div className="rounded-md bg-slate-50 p-3 flex flex-col gap-2">
                <p className="text-sm font-semibold">3. What did she decide?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => save(() => referralApi.visit(id, "MET_PATIENT", "POSITIVE", note), "Recorded: she will go to the hospital.")} className={btn("secondary", "border-emerald-300")} data-testid="asha-agree">She will go</button>
                  <button type="button" disabled={busy} onClick={() => save(() => referralApi.visit(id, "MET_PATIENT", "NEGATIVE", note), "Recorded: she does not want to go. A doctor will review.")} className={btn("secondary", "border-rose-300")} data-testid="asha-refuse">She does not want to go</button>
                </div>
              </div>
            )}
          </li>
          <li>
            <label className="flex flex-col gap-1.5">
              <span className={ui.label}>Note (optional, saved with your next entry)</span>
              <input className={ui.input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="For example: will go on Monday with her husband" data-testid="asha-note" />
            </label>
          </li>
        </ol>
      )}
      {msg && <Notice tone={msg.ok ? "routine" : "critical"} role={msg.ok ? "status" : "alert"}>{msg.text}</Notice>}

      <section className="flex flex-col gap-2">
        <h3 className={ui.h3}>Contact history</h3>
        {events === null ? <p className={ui.muted}>Loading...</p> : events.length === 0 ? <p className={ui.muted}>No calls or visits recorded yet.</p> : (
          <ol className={`${ui.panel} divide-y divide-black/[0.06]`}>
            {[...events].reverse().map((e) => (
              <li key={e.event_id} className="px-3 py-2.5 text-sm flex flex-wrap justify-between gap-x-3">
                <span className="font-medium">{EVENT_TEXT[e.kind]}{e.detail ? <span className="font-normal text-slate-600"> · {e.detail}</span> : null}</span>
                <span className="text-xs text-slate-500">{when(e.event_date)} · day {e.follow_up_day}</span>
              </li>
            ))}
          </ol>
        )}
        {last && <p className="text-xs text-slate-500">Last entry: {EVENT_TEXT[last.kind]}.</p>}
      </section>
    </div>
  );
}

function Row({ r, active, onOpen }: { r: Referral; active: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} aria-current={active ? "true" : undefined} data-testid="asha-card"
        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 cursor-pointer ${active ? "bg-sky-50" : "hover:bg-slate-50"}`}>
        <span className="min-w-0">
          <span className="block font-semibold truncate">{r.patient_name}</span>
          <span className="block text-xs text-slate-600 truncate">{r.area}{r.visit_outcome ? " · visit recorded" : ""}</span>
        </span>
        <span className="flex flex-col items-end gap-1 shrink-0">
          {r.following ? <Pill tone={laneTone(r)}>{`Day ${r.follow_up_day}`}</Pill> : <Pill tone="neutral">Closed</Pill>}
          {r.urgent && <span className="text-[11px] font-semibold text-rose-800">Urgent</span>}
        </span>
      </button>
    </li>
  );
}

/** Only referrals assigned to this ASHA. No findings, reports or treatment here, by server rule too. */
export function AshaHome({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [view, setView] = useState<"today" | "patients" | "closed">("today");
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<"all" | "following" | "visit" | "arrived" | "closed">("all");
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { const b = await referralApi.board(); setRows(b.referrals); setRoutes(b.routes ?? {}); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load your follow-ups."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const all = rows ?? [];
    const following = all.filter((r) => r.following);
    return {
      visit: following.filter((r) => r.lane === "visit_due"),
      call: following.filter((r) => r.lane === "attention"),
      watch: following.filter((r) => r.lane === "on_track"),
      closed: all.filter((r) => !r.following),
    };
  }, [rows]);

  const filteredPatients = useMemo(() => {
    let list = rows ?? [];
    if (patientFilter === "following") {
      list = list.filter((r) => r.following);
    } else if (patientFilter === "visit") {
      list = list.filter((r) => r.following && r.lane === "visit_due");
    } else if (patientFilter === "arrived") {
      list = list.filter((r) => r.status === "ARRIVED" || (!r.following && r.status !== "DECLINED"));
    } else if (patientFilter === "closed") {
      list = list.filter((r) => !r.following);
    }
    if (patientSearch.trim()) {
      const q = patientSearch.toLowerCase().trim();
      list = list.filter((r) =>
        r.patient_name.toLowerCase().includes(q) ||
        (r.patient_token && r.patient_token.toLowerCase().includes(q)) ||
        (r.area && r.area.toLowerCase().includes(q)) ||
        (r.hospital && r.hospital.toLowerCase().includes(q)) ||
        (r.contact_phone && r.contact_phone.includes(q))
      );
    }
    return list;
  }, [rows, patientFilter, patientSearch]);

  const selected = rows?.find((r) => r.referral_id === openId) ?? null;
  const open = (r: Referral) => { setRegistering(false); setOpenId(r.referral_id); };
  const side = registering || !!selected;

  const list = (title: string, hint: string, items: Referral[]) => items.length > 0 && (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-1"><h2 className={ui.h3}>{title} <span className="text-slate-500 font-normal">({items.length})</span></h2><span className="text-xs text-slate-500">{hint}</span></div>
      <ul className={`${ui.panel} divide-y divide-black/[0.06] overflow-hidden`}>{items.map((r) => <Row key={r.referral_id} r={r} active={r.referral_id === openId} onOpen={() => open(r)} />)}</ul>
    </section>
  );

  return (
    <AppShell
      staff={staff}
      portal="ASHA worker"
      title={view === "today" ? "My follow-ups" : view === "patients" ? "All catchment patients" : "Closed referrals"}
      active={view}
      nav={[
        { id: "today", label: "My follow-ups", icon: ClipboardList, count: (rows ?? []).filter((r) => r.following).length },
        { id: "patients", label: "All patients", icon: Users, count: (rows ?? []).length },
        { id: "closed", label: "Closed", icon: CheckCircle2, count: (rows ?? []).filter((r) => !r.following).length },
      ]}
      onNavigate={(id) => { setView(id as "today" | "patients" | "closed"); setOpenId(null); setRegistering(false); }}
      onSignOut={onSignOut}
      genie={staffGenie("ASHA")}
    >
      {view === "patients" && !side ? (
        <div className="flex flex-col gap-6" data-testid="asha-all-patients">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className={ui.h1}>All Catchment Patients</h1>
              <p className={`${ui.muted} mt-1`}>
                Complete roster of screened patients assigned to {staff.health_post || "your health post"} and community network
              </p>
            </div>
            <button
              type="button"
              className={btn("primary", "!min-h-10")}
              onClick={() => { setOpenId(null); setRegistering(true); }}
              data-testid="register-patient-open-roster"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Register patient
            </button>
          </header>

          {/* Metric KPI cards with subtle gradient and trace */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Card variant="blue" traceColor="#0284C7" className="border-sky-200/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">Total Registered</p>
              <p className="text-2xl font-bold font-mono-data text-slate-900 mt-1">{(rows ?? []).length}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Across all local wards</p>
            </Card>
            <Card variant="subtle" traceColor="#0369A1" className="border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">In Follow-Up</p>
              <p className="text-2xl font-bold font-mono-data text-slate-900 mt-1">{(rows ?? []).filter((r) => r.following).length}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Active community care</p>
            </Card>
            <Card variant="warm" traceColor="#E11D48" className="border-rose-200/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">Home Visit Due</p>
              <p className="text-2xl font-bold font-mono-data text-rose-950 mt-1">{(rows ?? []).filter((r) => r.following && r.lane === "visit_due").length}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Day 14+ unconfirmed</p>
            </Card>
            <Card variant="subtle" traceColor="#059669" className="border-emerald-200/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Reached Hospital</p>
              <p className="text-2xl font-bold font-mono-data text-emerald-950 mt-1">{(rows ?? []).filter((r) => r.status === "ARRIVED" || (!r.following && r.status !== "DECLINED")).length}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Care pathway connected</p>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by patient name, token, area, or hospital..."
                className={`${ui.input} pl-9 text-xs`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: "all", label: `All (${(rows ?? []).length})` },
                { id: "following", label: `In follow-up (${(rows ?? []).filter((r) => r.following).length})` },
                { id: "visit", label: `Visit due (${(rows ?? []).filter((r) => r.following && r.lane === "visit_due").length})` },
                { id: "arrived", label: `Hospital reached (${(rows ?? []).filter((r) => r.status === "ARRIVED" || (!r.following && r.status !== "DECLINED")).length})` },
                { id: "closed", label: `Closed (${(rows ?? []).filter((r) => !r.following).length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPatientFilter(tab.id as any)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    patientFilter === tab.id
                      ? "bg-[#0369A1] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full Patients Roster Table */}
          <div className={`${ui.panel} overflow-x-auto shadow-2xs`}>
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-black/[0.06] bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-3">Token</th>
                  <th className="py-2.5 px-3">Area / Locality</th>
                  <th className="py-2.5 px-3">Referred Centre</th>
                  <th className="py-2.5 px-3">Status / Lane</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {rows === null ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Loading catchment patients...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No patients match your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((r) => (
                    <tr
                      key={r.referral_id}
                      onClick={() => open(r)}
                      className="hover:bg-sky-50/50 cursor-pointer transition-colors"
                      data-testid="roster-patient-row"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-sky-100 text-[#0369A1] font-bold text-xs flex items-center justify-center shrink-0">
                            {r.patient_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {r.patient_name}
                              {r.urgent && <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">Urgent</span>}
                            </div>
                            <div className="text-[11px] text-slate-500">{r.age ? `${r.age} yrs` : "Age not recorded"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono-data text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {r.patient_token || r.referral_id}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{r.area || "—"}</td>
                      <td className="py-3 px-3 text-slate-600">{r.hospital || staff.health_post || "—"}</td>
                      <td className="py-3 px-3">
                        <FollowUpPill r={r} />
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {r.contact_phone && (
                            <a
                              href={`tel:${r.contact_phone}`}
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-[#0369A1] transition-colors"
                              title={`Call ${r.patient_name}`}
                            >
                              <Phone className="size-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => open(r)}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-[#0369A1] hover:border-sky-300 transition-colors cursor-pointer shadow-2xs"
                          >
                            Follow-up
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div data-testid="asha-home" className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
          <div className={`flex flex-col gap-5 ${side ? "max-lg:hidden" : ""}`}>
            {view === "patients" ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={ui.h2}>Catchment Roster</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{filteredPatients.length} patients in list</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOpenId(null); setRegistering(false); }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 bg-white"
                  >
                    Full table
                  </button>
                </div>
                <div className="relative">
                  <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patients..."
                    className={`${ui.input} pl-9 text-xs`}
                  />
                </div>
                <ul className={`${ui.panel} divide-y divide-black/[0.06] overflow-hidden`}>
                  {filteredPatients.map((r) => (
                    <Row key={r.referral_id} r={r} active={r.referral_id === openId} onOpen={() => open(r)} />
                  ))}
                </ul>
              </>
            ) : (
              <>
                <header className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className={ui.h1}>{view === "today" ? "Who needs you today" : "Closed referrals"}</h1>
                    {view === "today" && (
                      <button
                        type="button"
                        className={btn("primary", "!min-h-10")}
                        onClick={() => { setOpenId(null); setRegistering(true); }}
                        data-testid="register-patient-open"
                      >
                        <UserPlus className="size-4" aria-hidden="true" />
                        Register patient
                      </button>
                    )}
                  </div>
                  <p className={`${ui.muted} mt-1`}>
                    {view === "today"
                      ? "Women referred from your health post who have not yet reached the hospital."
                      : "She reached the hospital, or a doctor is reviewing her decision."}
                  </p>
                </header>
                {error && <Notice tone="critical" role="alert">{error}</Notice>}
                {rows === null && !error && <p className={ui.muted} role="status">Loading...</p>}
                {rows && view === "today" && (groups.visit.length + groups.call.length + groups.watch.length === 0
                  ? <Empty title="No follow-ups assigned to you right now.">New referrals appear here when your health post assigns them.</Empty>
                  : <>
                      {list("Home visit due", "Day 14 or later", groups.visit)}
                      {list("Call today", "Days 11 to 13", groups.call)}
                      {list("Reminders running", "Days 1 to 10", groups.watch)}
                    </>)}
                {rows && view === "closed" && (groups.closed.length === 0 ? <Empty title="Nothing closed yet." /> : list("Closed", "", groups.closed))}
              </>
            )}
          </div>
          <div className={side ? "" : "max-lg:hidden"}>
            {registering
              ? <RegisterPatient
                  staff={staff}
                  centre={staff.health_post ? routes[staff.health_post] ?? null : null}
                  onCancel={() => setRegistering(false)}
                  onOpen={(id) => { setRegistering(false); setOpenId(id); }}
                  onDone={(r) => { setRegistering(false); void load().then(() => setOpenId(r.referral_id)); }}
                />
              : selected
              ? <div className="lg:sticky lg:top-0">
                  <Followup
                    key={selected.referral_id}
                    r={selected}
                    onBack={() => setOpenId(null)}
                    onSaved={(next) => setRows((rs) => rs?.map((x) => x.referral_id === next.referral_id ? { ...x, ...next } : x) ?? rs)}
                  />
                </div>
              : <div className="hidden lg:flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 py-16 text-center">
                  <Home className="size-6 text-slate-400" />
                  <p className={ui.muted}>Choose a woman from the list to record a call or visit.</p>
                </div>}
          </div>
        </div>
      )}
    </AppShell>
  );
}
