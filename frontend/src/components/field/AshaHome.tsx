import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { referralApi, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { FieldShell } from "./FieldShell";

const btn = "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold cursor-pointer disabled:opacity-50";

function Card({ r, onDone }: { r: Referral; onDone: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [met, setMet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); setNote(""); setMet(false); await onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "This could not be saved."); }
    finally { setBusy(false); }
  };
  const id = r.referral_id;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3" data-testid="asha-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h2 className="font-bold">{r.patient_name}</h2><p className="text-sm text-slate-600">{r.area} · Day {r.follow_up_day}</p><p className="text-sm text-slate-600">Hospital: {r.hospital}</p></div>
        {r.contact_phone && <a href={`tel:${r.contact_phone}`} className="h-11 rounded-lg border border-slate-200 px-3 inline-flex items-center gap-1.5 text-sm font-semibold shrink-0"><Phone className="size-4" />Call</a>}
      </div>
      {!r.following ? <p className="text-sm text-slate-600">Follow-up closed.</p> : (
        <>
          <input className="h-11 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} className={btn} onClick={() => act(() => referralApi.contact(id, "NO_ANSWER", note))}>Call: no answer</button>
            <button disabled={busy} className={btn} onClick={() => act(() => referralApi.contact(id, "REACHED", note))}>Call: spoke to her</button>
            <button disabled={busy} className={btn} onClick={() => act(() => referralApi.visit(id, "NOT_AT_HOME", null, note))}>Visit: not at home</button>
            <button disabled={busy} className={btn} onClick={() => act(() => referralApi.visit(id, "UNREACHABLE", null, note))}>Visit: unreachable</button>
            <button disabled={busy} className={`${btn} col-span-2`} onClick={() => setMet(!met)} data-testid="asha-met">Visit: met her</button>
          </div>
          {met && (
            <div className="grid grid-cols-2 gap-2">
              <button disabled={busy} className={`${btn} border-emerald-300`} onClick={() => act(() => referralApi.visit(id, "MET_PATIENT", "POSITIVE", note))} data-testid="asha-agree">She will go</button>
              <button disabled={busy} className={`${btn} border-rose-300`} onClick={() => act(() => referralApi.visit(id, "MET_PATIENT", "NEGATIVE", note))} data-testid="asha-refuse">She refuses</button>
            </div>
          )}
        </>
      )}
      {r.visit_outcome && <p className="text-xs text-slate-500">Last visit recorded.</p>}
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
    </article>
  );
}

/** Only referrals assigned to this ASHA. No findings, reports or treatment here, by server rule too. */
export function AshaHome({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { setRows((await referralApi.board()).referrals); } catch (e) { setError(e instanceof Error ? e.message : "Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <FieldShell staff={staff} onSignOut={onSignOut} title="My Home Visits">
      <div data-testid="asha-home" className="flex flex-col gap-3">
        {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
        {rows === null && !error && <p className="text-sm text-slate-500">Loading...</p>}
        {rows?.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No referrals are assigned to you right now.</p>}
        {rows?.map((r) => <Card key={r.referral_id} r={r} onDone={load} />)}
      </div>
    </FieldShell>
  );
}
