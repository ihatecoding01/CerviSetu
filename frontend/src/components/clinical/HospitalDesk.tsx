import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { referralApi, STATUS_LABELS, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { AppShell, type NavItem } from "../app/AppShell";
import { staffGenie } from "../app/genieConfigs";
import { Empty, Notice, Pill, when } from "../app/Status";
import { btn, ui } from "../app/ui";

const NAV: NavItem[] = [{ id: "incoming", label: "Incoming referrals", icon: Inbox }];

/** Incoming list for one hospital. Confirming arrival closes follow-up. */
export function HospitalDesk({ staff, onSignOut }: { staff: StaffProfile; onSignOut: () => void }) {
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => { try { setRows((await referralApi.board()).referrals); } catch (e) { setError(e instanceof Error ? e.message : "Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = (rows ?? []).filter((r) => r.patient_name.toLowerCase().includes(query.trim().toLowerCase()));
  const incoming = shown.filter((r) => r.status === "REFERRED").sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.follow_up_day - a.follow_up_day);
  const arrived = shown.filter((r) => r.status !== "REFERRED");
  const confirm = async (id: string) => {
    setError(null);
    try { await referralApi.arrival(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : "This could not be saved."); }
  };
  return (
    <AppShell staff={staff} portal="Hospital desk" nav={NAV} active="incoming" title="Incoming referrals" onNavigate={() => undefined} onSignOut={onSignOut} genie={staffGenie("HOSPITAL")}>
      <div data-testid="hospital-desk" className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className={ui.h1}>{staff.facility}</h1><p className={`${ui.muted} mt-1`}>Confirm arrival when the patient reaches the hospital. This stops her reminders.</p></div>
          <input type="search" aria-label="Search by name" className={`${ui.input} w-full sm:w-64`} placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </header>
        {error && <Notice tone="critical" role="alert">{error}</Notice>}
        <section className="flex flex-col gap-2">
          <h2 className={ui.h3}>{`Expected (${incoming.length})`}</h2>
          {rows && incoming.length === 0 && <div className={ui.panel}><Empty title="Nobody is waiting to be confirmed" /></div>}
          {incoming.map((r) => (
            <article key={r.referral_id} className={`${ui.panel} p-4 flex flex-wrap items-center justify-between gap-3`} data-testid="hospital-row">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{r.patient_name}{r.age ? `, ${r.age}` : ""}</span>{r.urgent && <Pill tone="critical">Urgent</Pill>}</div>
                <div className="text-sm text-slate-600">{r.health_post} · {`Day ${r.follow_up_day} since referral`}</div>
              </div>
              <button type="button" className={btn("primary")} onClick={() => confirm(r.referral_id)} data-testid="confirm-arrival">Confirm arrival</button>
            </article>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className={ui.h3}>{`Arrived (${arrived.length})`}</h2>
          {arrived.length > 0 && (
            <div className={`${ui.panel} divide-y divide-black/[0.06]`}>
              {arrived.map((r) => <div key={r.referral_id} className="p-3 flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold">{r.patient_name}</span><span className="text-slate-600">{STATUS_LABELS[r.status] ?? r.status}{r.arrived_on ? ` · ${when(r.arrived_on)}` : ""}</span></div>)}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
