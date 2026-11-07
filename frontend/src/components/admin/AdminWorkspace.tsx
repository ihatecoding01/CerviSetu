import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Calculator, History, Home, MapPinned, Users } from "lucide-react";
import { adminApi, type AdminAction, type DashboardCounts, type HealthPost, type Hospital, type StaffAccount } from "../../api/admin";
import type { StaffProfile } from "../../api/staff";
import { AdminHospitals } from "./AdminHospitals";
import { AppShell, type NavItem } from "../app/AppShell";
import { staffGenie } from "../app/genieConfigs";
import { Empty, Notice, when } from "../app/Status";
import { btn, ui } from "../app/ui";
import { Card } from "../careui/card";
import { CostPlanner } from "./CostPlanner";

const NAV: NavItem[] = [
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "hospitals", label: "Hospitals", icon: Building2 },
  { id: "routes", label: "Health posts and routes", icon: MapPinned },
  { id: "staff", label: "Staff", icon: Users },
  { id: "actions", label: "Activity log", icon: History },
  { id: "cost", label: "Cost planning", icon: Calculator },
];
const COUNTS: [keyof DashboardCounts, string, string][] = [
  ["referrals", "Total referrals", "All referrals recorded"],
  ["in_follow_up", "In follow-up", "Referred, not yet arrived"],
  ["overdue", "Past day 14", "Not arrived after 14 days"],
  ["arrivals", "Arrived", "Hospital confirmed arrival"],
  ["declined", "Declined", "Patient chose not to go"],
];
const ROLES = [["DOCTOR", "Doctor"], ["NURSE", "Nurse"], ["ASHA", "ASHA worker"], ["HOSPITAL", "Hospital desk"], ["ADMIN", "Administrator"]];
const NO_STAFF = { staff_id: "", name: "", role: "NURSE", health_post: "", hospital: "", pin: "" };
const roleName = (r: string) => ROLES.find(([v]) => v === r)?.[1] ?? r;
const readable = (a: string) => { const s = a.replace(/_/g, " ").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

const COUNT_CONFIG: Record<keyof DashboardCounts, { variant: "subtle" | "blue" | "pink" | "warm"; traceColor: string; labelColor?: string }> = {
  referrals: { variant: "subtle", traceColor: "#0369A1", labelColor: "text-slate-700" },
  in_follow_up: { variant: "blue", traceColor: "#0284C7", labelColor: "text-[#0284C7]" },
  overdue: { variant: "pink", traceColor: "#9D174D", labelColor: "text-[#9D174D]" },
  arrivals: { variant: "subtle", traceColor: "#059669", labelColor: "text-emerald-800" },
  declined: { variant: "warm", traceColor: "#E11D48", labelColor: "text-rose-800" },
};

function Overview({ onError, go }: { onError: (m: string) => void; go: (id: string) => void }) {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [dir, setDir] = useState<{ hospitals: number; posts: number; unrouted: number; staff: number } | null>(null);
  const [actions, setActions] = useState<AdminAction[]>([]);
  useEffect(() => {
    adminApi.dashboard().then(setCounts).catch((e) => onError(e.message));
    Promise.all([adminApi.list(), adminApi.posts(), adminApi.staff(), adminApi.myActions()]).then(([h, p, s, a]) => {
      setDir({ hospitals: h.filter((x) => x.active).length, posts: p.filter((x) => x.active).length, unrouted: p.filter((x) => x.active && !x.hospital).length, staff: s.filter((x) => x.active).length });
      setActions(a.slice(-5).reverse());
    }).catch((e) => onError(e.message));
  }, [onError]);
  return (
    <div className="flex flex-col gap-6" data-testid="admin-dashboard">
      <header><h1 className={ui.h1}>Programme overview</h1><p className={`${ui.muted} mt-1`}>Counts only. Administrators never see patient records.</p></header>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {COUNTS.map(([k, label, hint]) => {
          const cfg = COUNT_CONFIG[k] ?? { variant: "subtle", traceColor: "#0369A1" };
          return (
            <Card
              key={k}
              variant={cfg.variant}
              traceColor={cfg.traceColor}
              className="p-4 border-slate-200/80 shadow-2xs hover:shadow-sm transition-all"
            >
              <div className="font-heading text-2xl font-bold font-mono-data text-slate-900">{counts?.[k] ?? "–"}</div>
              <div className={`text-sm font-semibold mt-1 ${cfg.labelColor ?? "text-slate-800"}`}>{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
            </Card>
          );
        })}
      </div>
      {dir && dir.unrouted > 0 && <Notice tone="attention">{`${dir.unrouted} active health post${dir.unrouted > 1 ? "s have" : " has"} no referral hospital. Nurses there cannot refer until a route is set.`}</Notice>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`${ui.panel} p-4`}>
          <h2 className={ui.h3}>Directory</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            {[["Active hospitals", dir?.hospitals, "hospitals"], ["Active health posts", dir?.posts, "routes"], ["Active staff", dir?.staff, "staff"]].map(([l, v, id]) => (
              <button key={l as string} type="button" onClick={() => go(id as string)} className="text-left rounded-md p-2 hover:bg-slate-50 cursor-pointer"><dd className="font-heading text-xl font-semibold tabular-nums">{v ?? "–"}</dd><dt className="text-xs text-slate-600">{l}</dt></button>
            ))}
          </dl>
        </section>
        <section className={`${ui.panel} p-4`}>
          <div className="flex items-center justify-between"><h2 className={ui.h3}>Your recent actions</h2><button type="button" className={btn("ghost")} onClick={() => go("actions")}>View all</button></div>
          {actions.length === 0 ? <p className={`${ui.muted} mt-3`}>No actions recorded yet.</p> : (
            <ul className="mt-2 divide-y divide-black/[0.06] text-sm">{actions.map((a, i) => <li key={i} className="py-2 flex justify-between gap-3"><span className="min-w-0 break-words">{readable(a.action)}</span><span className="text-xs text-slate-500 shrink-0">{when(a.timestamp)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Routes({ onError }: { onError: (m: string) => void }) {
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [form, setForm] = useState({ name: "", area: "", hospital: "" });
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<{ post: HealthPost; hospital: string } | null>(null);
  const load = useCallback(() => { Promise.all([adminApi.posts(), adminApi.list()]).then(([p, h]) => { setPosts(p); setHospitals(h.filter((x) => x.active)); }).catch((e) => onError(e.message)); }, [onError]);
  useEffect(load, [load]);
  const act = (fn: () => Promise<unknown>, done: string) => fn().then(() => { setNote(done); load(); }).catch((e) => onError(e.message));
  const options = hospitals.map((h) => <option key={h.hospital_id}>{h.name}</option>);
  return (
    <div className="flex flex-col gap-5" data-testid="admin-routes">
      <header><h1 className={ui.h1}>Health posts and routes</h1><p className={`${ui.muted} mt-1`}>Each health post refers to one hospital. A route change applies to new referrals only.</p></header>
      {note && <Notice tone="routine">{note}</Notice>}
      <div className={`${ui.panel} relative overflow-x-auto`}>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr><th className={ui.th}>Health post</th><th className={ui.th}>Area</th><th className={ui.th}>Referral hospital</th><th className={ui.th}>Status</th><th className={ui.th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.name} data-testid="route-row" className={p.active ? "" : "text-slate-400"}>
                <td className={`${ui.td} font-semibold`}>{p.name}</td>
                <td className={ui.td}>{p.area}</td>
                <td className={ui.td}>
                  <select aria-label={`Referral hospital for ${p.name}`} className={`${ui.input} h-9`} value={p.hospital ?? ""} onChange={(e) => setPending({ post: p, hospital: e.target.value })}>
                    <option value="" disabled>No route</option>{options}
                  </select>
                </td>
                <td className={ui.td}>{p.active ? "Active" : "Inactive"}</td>
                <td className={`${ui.td} text-right`}><button type="button" className={btn("secondary")} onClick={() => act(() => adminApi.setPostActive(p.name, !p.active), "Saved.")}>{p.active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending && (
        <div role="dialog" aria-modal="true" aria-labelledby="route-confirm" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30" data-testid="route-confirm">
          <div className={`${ui.panel} p-5 max-w-md w-full flex flex-col gap-3 bg-white`}>
            <h2 id="route-confirm" className={ui.h3}>Change the route for {pending.post.name}?</h2>
            <p className="text-sm text-slate-700">New referrals from this health post will go to <strong>{pending.hospital}</strong>{pending.post.hospital ? ` instead of ${pending.post.hospital}` : ""}. Patients already referred keep the hospital they were given.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn("secondary")} onClick={() => setPending(null)}>Cancel</button>
              <button type="button" className={btn("primary")} data-testid="route-confirm-save" onClick={() => { const p = pending; setPending(null); void act(() => adminApi.setRoute(p.post.name, p.hospital), "Route saved."); }}>Change route</button>
            </div>
          </div>
        </div>
      )}
      <form className={`${ui.panel} p-4 flex flex-col gap-3`} onSubmit={(e: FormEvent) => { e.preventDefault(); void act(async () => { await adminApi.addPost(form); setForm({ name: "", area: "", hospital: "" }); }, "Health post added."); }}>
        <h2 className={ui.h3}>Add a health post</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5"><span className={ui.label}>Name</span><input required minLength={2} className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5"><span className={ui.label}>Area</span><input required minLength={2} className={ui.input} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5"><span className={ui.label}>Referral hospital</span><select required className={ui.input} value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })}><option value="">Choose</option>{options}</select></label>
        </div>
        <button className={btn("primary", "self-start")}>Add health post</button>
      </form>
    </div>
  );
}

function Staff({ onError }: { onError: (m: string) => void }) {
  const [rows, setRows] = useState<StaffAccount[]>([]);
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [form, setForm] = useState(NO_STAFF);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const load = useCallback(() => { Promise.all([adminApi.staff(), adminApi.posts(), adminApi.list()]).then(([s, p, h]) => { setRows(s); setPosts(p); setHospitals(h); }).catch((e) => onError(e.message)); }, [onError]);
  useEffect(load, [load]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { name: form.name, role: form.role, health_post: form.health_post || null, hospital: form.hospital || null, pin: form.pin || undefined };
    (editing ? adminApi.updateStaff(form.staff_id, body) : adminApi.addStaff({ ...body, staff_id: form.staff_id })).then(() => { setForm(NO_STAFF); setEditing(false); setOpen(false); load(); }).catch((err) => onError(err.message));
  };
  const shown = rows.filter((s) => !role || s.role === role);
  return (
    <div className="flex flex-col gap-5" data-testid="admin-staff">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className={ui.h1}>Staff</h1><p className={`${ui.muted} mt-1`}>Accounts sign in with a staff ID and PIN.</p></div>
        <div className="flex gap-2">
          <select aria-label="Filter by role" className={`${ui.input} h-10 w-auto`} value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button type="button" className={btn("primary")} onClick={() => { setForm(NO_STAFF); setEditing(false); setOpen(true); }}>Add staff member</button>
        </div>
      </header>
      {open && (
        <form onSubmit={submit} className={`${ui.panel} p-4 flex flex-col gap-3`}>
          <h2 className={ui.h3}>{editing ? `Edit ${form.name}` : "New staff member"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className={ui.label}>Staff ID</span><input required disabled={editing} pattern="[A-Z]{2}-[0-9]{3,6}" placeholder="RN-2002" className={ui.input} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value.toUpperCase() })} /></label>
            <label className="flex flex-col gap-1.5"><span className={ui.label}>Full name</span><input required minLength={2} className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="flex flex-col gap-1.5"><span className={ui.label}>Role</span><select className={ui.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="flex flex-col gap-1.5"><span className={ui.label}>{editing ? "New PIN (optional)" : "PIN, 6 to 12 digits"}</span><input type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6,12}" required={!editing} className={ui.input} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></label>
            {(form.role === "NURSE" || form.role === "ASHA") && <label className="flex flex-col gap-1.5 sm:col-span-2"><span className={ui.label}>Health post</span><select required className={ui.input} value={form.health_post} onChange={(e) => setForm({ ...form, health_post: e.target.value })}><option value="">Choose</option>{posts.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>}
            {form.role === "HOSPITAL" && <label className="flex flex-col gap-1.5 sm:col-span-2"><span className={ui.label}>Hospital</span><select required className={ui.input} value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })}><option value="">Choose</option>{hospitals.map((h) => <option key={h.hospital_id}>{h.name}</option>)}</select></label>}
          </div>
          <div className="flex gap-2"><button className={btn("primary")}>{editing ? "Save changes" : "Add staff member"}</button><button type="button" className={btn("secondary")} onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
      <div className={`${ui.panel} relative overflow-x-auto`}>
        <table className="w-full text-sm min-w-[600px]">
          <thead><tr><th className={ui.th}>Name</th><th className={ui.th}>Staff ID</th><th className={ui.th}>Role</th><th className={ui.th}>Posting</th><th className={ui.th}>Status</th><th className={ui.th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.staff_id} data-testid="staff-row" className={s.active ? "" : "text-slate-400"}>
                <td className={`${ui.td} font-semibold`}>{s.name}</td>
                <td className={`${ui.td} ${ui.mono}`}>{s.staff_id}</td>
                <td className={ui.td}>{roleName(s.role)}</td>
                <td className={ui.td}>{s.health_post ?? s.hospital ?? "–"}</td>
                <td className={ui.td}>{s.active ? "Active" : "Inactive"}</td>
                <td className={`${ui.td} text-right whitespace-nowrap`}>
                  <button type="button" className={btn("ghost")} onClick={() => { setForm({ ...NO_STAFF, ...s, health_post: s.health_post ?? "", hospital: s.hospital ?? "", pin: "" }); setEditing(true); setOpen(true); window.scrollTo({ top: 0 }); }}>Edit</button>
                  <button type="button" className={btn("ghost")} onClick={() => adminApi.setStaffActive(s.staff_id, !s.active).then(load).catch((e) => onError(e.message))}>{s.active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title="No staff for this filter" />}
      </div>
    </div>
  );
}

function Activity({ onError }: { onError: (m: string) => void }) {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { adminApi.myActions().then((a) => setActions([...a].reverse())).catch((e) => onError(e.message)); }, [onError]);
  const shown = useMemo(() => actions.filter((a) => readable(a.action).toLowerCase().includes(q.toLowerCase())), [actions, q]);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className={ui.h1}>Activity log</h1><p className={`${ui.muted} mt-1`}>Every change you make to the directory is recorded here, newest first.</p></div>
        <input type="search" aria-label="Filter actions" placeholder="Filter" className={`${ui.input} h-10 w-full sm:w-56`} value={q} onChange={(e) => setQ(e.target.value)} />
      </header>
      <div className={`${ui.panel} relative overflow-x-auto`} data-testid="admin-actions">
        <table className="w-full text-sm">
          <thead><tr><th className={ui.th}>When</th><th className={ui.th}>Action</th></tr></thead>
          <tbody>{shown.map((a, i) => <tr key={i}><td className={`${ui.td} whitespace-nowrap text-slate-600`}>{when(a.timestamp, true)}</td><td className={`${ui.td} break-words`}>{readable(a.action)}</td></tr>)}</tbody>
        </table>
        {shown.length === 0 && <Empty title={actions.length ? "Nothing matches this filter" : "No actions recorded yet"} />}
      </div>
    </div>
  );
}

/** Administrators run the directory and see counts only. The server refuses them patient records. */
export function AdminWorkspace({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((m: string) => setError(m), []);
  const go = (id: string) => { setError(null); setTab(id); };
  const title = NAV.find((n) => n.id === tab)?.label ?? "Overview";
  return (
    <AppShell staff={staff} portal="Administrator" nav={NAV} active={tab} title={title} onNavigate={go} onSignOut={onSignOut}
      genie={staffGenie("ADMIN", { onOpenTab: go, tabNames: Object.fromEntries(NAV.map((n) => [n.id, n.label])) })}>
      {error && <div className="mb-4"><Notice tone="critical" role="alert">{error}</Notice></div>}
      {tab === "dashboard" && <Overview onError={onError} go={go} />}
      {tab === "hospitals" && <div className="flex flex-col gap-5"><header><h1 className={ui.h1}>Hospitals</h1><p className={`${ui.muted} mt-1`}>Referral hospitals, their services and contact details.</p></header><AdminHospitals isAdmin /></div>}
      {tab === "routes" && <Routes onError={onError} />}
      {tab === "staff" && <Staff onError={onError} />}
      {tab === "actions" && <Activity onError={onError} />}
      {tab === "cost" && <CostPlanner />}
    </AppShell>
  );
}
