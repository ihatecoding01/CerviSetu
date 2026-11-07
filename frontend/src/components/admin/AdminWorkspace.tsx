import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminApi, type AdminAction, type DashboardCounts, type HealthPost, type Hospital, type StaffAccount } from "../../api/admin";
import type { StaffProfile } from "../../api/staff";
import { AdminHospitals } from "./AdminHospitals";
import { FieldShell } from "../field/FieldShell";

const TABS = [["dashboard", "Dashboard"], ["hospitals", "Hospitals"], ["routes", "Health posts and routes"], ["staff", "Staff"], ["actions", "My actions"]] as const;
type TabId = (typeof TABS)[number][0];
const field = "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm";
const dark = "h-10 rounded-lg bg-black text-white px-4 text-sm font-semibold cursor-pointer";
const light = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold cursor-pointer";
const COUNTS: [keyof DashboardCounts, string][] = [["referrals", "Total referrals"], ["in_follow_up", "In follow-up"], ["overdue", "Past day 14"], ["arrivals", "Arrived"], ["declined", "Declined"]];
const ROLES = [["DOCTOR", "Doctor"], ["NURSE", "Nurse"], ["ASHA", "ASHA Worker"], ["HOSPITAL", "Hospital Desk"], ["ADMIN", "Administrator"]];
const NO_STAFF = { staff_id: "", name: "", role: "NURSE", health_post: "", hospital: "", pin: "" };

function Routes({ onError }: { onError: (m: string) => void }) {
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [form, setForm] = useState({ name: "", area: "", hospital: "" });
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => { Promise.all([adminApi.posts(), adminApi.list()]).then(([p, h]) => { setPosts(p); setHospitals(h.filter((x) => x.active)); }).catch((e) => onError(e.message)); }, [onError]);
  useEffect(load, [load]);
  const act = (fn: () => Promise<unknown>, done: string) => fn().then(() => { setNote(done); load(); }).catch((e) => onError(e.message));
  const options = hospitals.map((h) => <option key={h.hospital_id}>{h.name}</option>);
  return (
    <div className="flex flex-col gap-3" data-testid="admin-routes">
      <p className="text-sm text-slate-600">A new route applies to new referrals. Existing referrals keep the hospital they were given.</p>
      {note && <p className="text-sm text-emerald-800">{note}</p>}
      {posts.map((p) => (
        <article key={p.name} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2" data-testid="route-row">
          <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="font-bold">{p.name}</div><div className="text-sm text-slate-600">{p.area}{p.active ? "" : " · Inactive"}</div></div>
            <button className={light} onClick={() => act(() => adminApi.setPostActive(p.name, !p.active), "Saved.")}>{p.active ? "Deactivate" : "Activate"}</button></div>
          <select className={field} value={p.hospital ?? ""} onChange={(e) => act(() => adminApi.setRoute(p.name, e.target.value), "Route saved.")}><option value="" disabled>No route</option>{options}</select>
        </article>
      ))}
      <form className="rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); void act(async () => { await adminApi.addPost(form); setForm({ name: "", area: "", hospital: "" }); }, "Health post added."); }}>
        <input required minLength={2} placeholder="Health post name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required minLength={2} placeholder="Area" className={field} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <select required className={field} value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })}><option value="">Referral hospital</option>{options}</select>
        <button className={`${dark} sm:col-span-3`}>Add health post</button>
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
  const load = useCallback(() => { Promise.all([adminApi.staff(), adminApi.posts(), adminApi.list()]).then(([s, p, h]) => { setRows(s); setPosts(p); setHospitals(h); }).catch((e) => onError(e.message)); }, [onError]);
  useEffect(load, [load]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { name: form.name, role: form.role, health_post: form.health_post || null, hospital: form.hospital || null, pin: form.pin || undefined };
    (editing ? adminApi.updateStaff(form.staff_id, body) : adminApi.addStaff({ ...body, staff_id: form.staff_id })).then(() => { setForm(NO_STAFF); setEditing(false); load(); }).catch((err) => onError(err.message));
  };
  return (
    <div className="flex flex-col gap-3" data-testid="admin-staff">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input required disabled={editing} pattern="[A-Z]{2}-[0-9]{3,6}" placeholder="Staff ID, like RN-2002" className={field} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value.toUpperCase() })} />
        <input required minLength={2} placeholder="Full name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6,12}" required={!editing} placeholder={editing ? "New PIN (optional)" : "PIN, 6 to 12 digits"} className={field} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        {(form.role === "NURSE" || form.role === "ASHA") && <select required className={`${field} sm:col-span-2`} value={form.health_post} onChange={(e) => setForm({ ...form, health_post: e.target.value })}><option value="">Health post</option>{posts.map((p) => <option key={p.name}>{p.name}</option>)}</select>}
        {form.role === "HOSPITAL" && <select required className={`${field} sm:col-span-2`} value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })}><option value="">Hospital</option>{hospitals.map((h) => <option key={h.hospital_id}>{h.name}</option>)}</select>}
        <button className={`${dark} sm:col-span-2`}>{editing ? "Save staff member" : "Add staff member"}</button>
      </form>
      {rows.map((s) => (
        <article key={s.staff_id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-2" data-testid="staff-row">
          <div className="min-w-0"><div className="font-bold">{s.name}</div><div className="text-sm text-slate-600 break-words">{s.staff_id} · {ROLES.find(([v]) => v === s.role)?.[1] ?? s.role}{s.health_post ? ` · ${s.health_post}` : ""}{s.hospital ? ` · ${s.hospital}` : ""}{s.active ? "" : " · Inactive"}</div></div>
          <div className="flex gap-2">
            <button className={light} onClick={() => { setForm({ ...NO_STAFF, ...s, health_post: s.health_post ?? "", hospital: s.hospital ?? "", pin: "" }); setEditing(true); window.scrollTo({ top: 0 }); }}>Edit</button>
            <button className={light} onClick={() => adminApi.setStaffActive(s.staff_id, !s.active).then(load).catch((e) => onError(e.message))}>{s.active ? "Deactivate" : "Activate"}</button>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Administrators run the directory and see counts only. The server refuses them patient records. */
export function AdminWorkspace({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (tab === "dashboard") adminApi.dashboard().then(setCounts).catch((e) => setError(e.message));
    if (tab === "actions") adminApi.myActions().then(setActions).catch((e) => setError(e.message));
  }, [tab]);
  return (
    <FieldShell staff={staff} onSignOut={onSignOut} title="Administration">
      <nav className="flex gap-2 overflow-x-auto pb-1" data-testid="admin-nav">
        {TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} data-testid={`admin-tab-${id}`} className={`h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold cursor-pointer ${tab === id ? "bg-black text-white border-black" : "bg-white border-slate-200"}`}>{label}</button>)}
      </nav>
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
      {tab === "dashboard" && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="admin-dashboard">{COUNTS.map(([k, label]) => <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-2xl font-bold">{counts?.[k] ?? "-"}</div><div className="text-sm text-slate-600">{label}</div></div>)}</div>}
      {tab === "hospitals" && <AdminHospitals isAdmin />}
      {tab === "routes" && <Routes onError={setError} />}
      {tab === "staff" && <Staff onError={setError} />}
      {tab === "actions" && (actions.length === 0 ? <p className="text-sm text-slate-600">No actions recorded yet.</p> : <ul className="flex flex-col gap-2" data-testid="admin-actions">{actions.map((a, i) => <li key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-sm break-words"><div className="font-semibold">{a.action.replace(/_/g, " ").toLowerCase()}</div><div className="text-xs text-slate-500">{a.timestamp}</div></li>)}</ul>)}
    </FieldShell>
  );
}
