import { useCallback, useEffect, useState } from "react";
import { referralApi, STATUS_LABELS, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { FieldShell } from "../field/FieldShell";

/** Incoming list for one hospital. Confirming arrival closes follow-up. */
export function HospitalDesk({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => { try { setRows((await referralApi.board()).referrals); } catch (e) { setError(e instanceof Error ? e.message : "Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = (rows ?? []).filter((r) => r.patient_name.toLowerCase().includes(query.trim().toLowerCase()));
  const incoming = shown.filter((r) => r.status === "REFERRED");
  const arrived = shown.filter((r) => r.status !== "REFERRED");
  const confirm = async (id: string) => {
    setError(null);
    try { await referralApi.arrival(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : "This could not be saved."); }
  };
  return (
    <FieldShell staff={staff} onSignOut={onSignOut} title="Incoming Referrals">
      <div data-testid="hospital-desk" className="flex flex-col gap-3">
        <input className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
        <h2 className="text-sm font-bold">{`Expected (${incoming.length})`}</h2>
        {rows && incoming.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Nobody is waiting to be confirmed.</p>}
        {incoming.map((r) => (
          <article key={r.referral_id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3" data-testid="hospital-row">
            <div className="min-w-0"><div className="font-bold">{r.patient_name}{r.age ? `, ${r.age}` : ""}</div><div className="text-sm text-slate-600">{r.health_post} · Day {r.follow_up_day}</div>{r.urgent && <div className="text-sm font-semibold text-rose-800">Urgent</div>}</div>
            <button className="h-11 rounded-lg bg-black text-white px-4 text-sm font-semibold cursor-pointer" onClick={() => confirm(r.referral_id)} data-testid="confirm-arrival">Confirm arrival</button>
          </article>
        ))}
        <h2 className="text-sm font-bold mt-2">{`Arrived (${arrived.length})`}</h2>
        {arrived.map((r) => (
          <article key={r.referral_id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-bold">{r.patient_name}</div><div className="text-sm text-slate-600">{STATUS_LABELS[r.status] ?? r.status}{r.arrived_on ? ` · ${r.arrived_on}` : ""}</div></article>
        ))}
      </div>
    </FieldShell>
  );
}
