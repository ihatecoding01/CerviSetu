import { useCallback, useEffect, useState } from "react";
import { referralApi, STEP_LABELS, type Referral } from "../../api/referrals";

/** Staff view of field work: who is assigned and what the last visit found. ASHAs use their own home page. */
export function AshaCoordination() {
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => referralApi.board().then((b) => setRows(b.referrals.filter((r) => r.following || r.doctor_review))).catch((e) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  const assign = (id: string) => { setError(null); referralApi.assignAsha(id).then(load).catch((e) => setError(e.message)); };
  return (
    <div className="flex flex-col gap-3" data-testid="asha-network">
      <header><h1 className="text-xl font-bold">ASHA Network</h1><p className="text-sm text-slate-500 mt-1">An ASHA is assigned on day 14, or earlier here. Only the assigned ASHA sees the referral.</p></header>
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
      {rows?.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Nobody is in follow-up.</p>}
      {rows?.map((r) => (
        <article key={r.referral_id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><div className="font-bold">{r.patient_name}</div><div className="text-sm text-slate-600">{r.health_post} · Day {r.follow_up_day} · {STEP_LABELS[r.follow_up_step]}</div><div className="text-sm text-slate-600">{r.assigned_asha ? `Assigned: ${r.assigned_asha}` : "Not assigned"}{r.visit_outcome ? ` · Visit recorded` : ""}</div></div>
          {!r.assigned_asha && <button className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold cursor-pointer" onClick={() => assign(r.referral_id)}>Assign ASHA</button>}
        </article>
      ))}
    </div>
  );
}
