import { useEffect, useState } from "react";
import { Notice } from "../app/Status";
import { btn, ui } from "../app/ui";

/**
 * Planning sheet for the programme's running cost, using the categories in the project deck.
 * No price is filled in: the team has not agreed any, so every blank stays visibly missing
 * and totals that depend on it are not shown. Values stay in this browser only.
 */
type Key = "facilities" | "doctors" | "referrals" | "messages" | "months"
  | "setup" | "training" | "review" | "perMessage" | "perFacility" | "perDoctor";
type Values = Record<Key, string>;

const KEY = "cervisetu_cost_plan";
const BLANK: Values = { facilities: "", doctors: "", referrals: "", messages: "", months: "12", setup: "", training: "", review: "", perMessage: "", perFacility: "", perDoctor: "" };

const VOLUME: [Key, string, string][] = [
  ["facilities", "Facilities", "Health posts and hospitals using the system"],
  ["doctors", "Doctors", "Doctors with an account"],
  ["referrals", "Referrals per month", "Across all facilities"],
  ["messages", "Messages per referral", "Reminders and calls, on average"],
  ["months", "Months to plan for", "Period of the estimate"],
];
const PRICES: [Key, string, string][] = [
  ["setup", "One-time setup", "Per programme"],
  ["training", "One-time training", "Per programme"],
  ["review", "Message script review", "One-time, per language set"],
  ["perMessage", "Per message", "SMS, WhatsApp or voice"],
  ["perFacility", "Monthly per facility", "Hosting and support"],
  ["perDoctor", "Monthly per doctor", "Licence or seat"],
];

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function load(): Values {
  try { return { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return BLANK; }
}

export function CostPlanner() {
  const [v, setV] = useState<Values>(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* per-viewer convenience only */ } }, [v]);
  const n = (k: Key) => num(v[k]);

  const product = (label: string, parts: Key[]): { label: string; formula: string; value: number | null; missing: string[] } => {
    const names = Object.fromEntries([...VOLUME, ...PRICES].map(([k, l]) => [k, l.toLowerCase()]));
    const missing = parts.filter((k) => n(k) === null).map((k) => names[k]);
    return { label, formula: parts.map((k) => names[k]).join(" × "), value: missing.length ? null : parts.reduce((a, k) => a * (n(k) as number), 1), missing };
  };
  const oneTime = [product("Setup", ["setup"]), product("Training", ["training"]), product("Script review", ["review"])];
  const monthly = [
    product("Messages", ["referrals", "messages", "perMessage"]),
    product("Facilities", ["facilities", "perFacility"]),
    product("Doctors", ["doctors", "perDoctor"]),
  ];
  const sum = (rows: typeof oneTime) => (rows.every((r) => r.value !== null) ? rows.reduce((a, r) => a + (r.value as number), 0) : null);
  const oneTotal = sum(oneTime);
  const monthTotal = sum(monthly);
  const months = n("months");
  const period = oneTotal !== null && monthTotal !== null && months !== null ? oneTotal + monthTotal * months : null;
  const perReferral = monthTotal !== null && n("referrals") ? monthTotal / (n("referrals") as number) : null;
  const missingPrices = PRICES.filter(([k]) => n(k) === null).length;

  const field = ([k, label, hint]: [Key, string, string], money: boolean) => (
    <label key={k} className="flex flex-col gap-1.5 min-w-0">
      <span className={ui.label}>{label}</span>
      <div className="relative">
        {money && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>}
        <input type="number" min={0} inputMode="decimal" className={`${ui.input} ${money ? "pl-7" : ""} ${v[k] === "" ? "border-amber-300 bg-amber-50/40" : ""}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} data-testid={`cost-${k}`} placeholder="Not set" />
      </div>
      <span className="text-xs text-slate-500">{hint}</span>
    </label>
  );
  const table = (title: string, rows: typeof oneTime, total: number | null, unit: string) => (
    <section className={`${ui.panel} relative overflow-x-auto`}>
      <h2 className={`${ui.h3} px-4 pt-4`}>{title}</h2>
      <table className="w-full text-sm mt-2 min-w-[480px]">
        <thead><tr><th className={ui.th}>Item</th><th className={ui.th}>Formula</th><th className={`${ui.th} text-right`}>Estimate</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={`${ui.td} font-semibold`}>{r.label}</td>
              <td className={`${ui.td} text-slate-600`}>{r.formula}</td>
              <td className={`${ui.td} text-right tabular-nums`}>{r.value !== null ? inr(r.value) : <span className="text-amber-800 text-xs">Missing: {r.missing.join(", ")}</span>}</td>
            </tr>
          ))}
          <tr><td className={`${ui.td} font-semibold`} colSpan={2}>Total {unit}</td><td className={`${ui.td} text-right font-semibold tabular-nums`}>{total !== null ? inr(total) : <span className="text-amber-800 text-xs">Incomplete</span>}</td></tr>
        </tbody>
      </table>
    </section>
  );

  return (
    <div className="flex flex-col gap-6" data-testid="cost-planner">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={ui.h1}>Cost planning</h1>
          <p className={`${ui.muted} mt-1 max-w-2xl`}>An estimate, not a quote. No price has been agreed yet, so every price starts empty. Enter figures from vendor quotes to see the totals. Values are kept in this browser only.</p>
        </div>
        <button type="button" className={btn("secondary")} onClick={() => setV(BLANK)}>Clear all</button>
      </header>
      {missingPrices > 0 && <Notice tone="attention">{`${missingPrices} of ${PRICES.length} prices are not set. Totals that depend on them are left blank rather than guessed.`}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`${ui.panel} p-4 flex flex-col gap-3`}><h2 className={ui.h3}>Scale</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{VOLUME.map((f) => field(f, false))}</div></section>
        <section className={`${ui.panel} p-4 flex flex-col gap-3`}><h2 className={ui.h3}>Prices</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{PRICES.map((f) => field(f, true))}</div></section>
      </div>

      {table("One-time costs", oneTime, oneTotal, "one-time")}
      {table("Recurring costs, per month", monthly, monthTotal, "per month")}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`${ui.panel} p-4`}><div className="text-xs text-slate-600">{`Total for ${months ?? "?"} months`}</div><div className="font-heading text-2xl font-semibold tabular-nums mt-1" data-testid="cost-period">{period !== null ? inr(period) : "Incomplete"}</div><div className="text-xs text-slate-500 mt-1">One-time total + monthly total × months</div></div>
        <div className={`${ui.panel} p-4`}><div className="text-xs text-slate-600">Recurring cost per referral</div><div className="font-heading text-2xl font-semibold tabular-nums mt-1">{perReferral !== null ? inr(perReferral) : "Incomplete"}</div><div className="text-xs text-slate-500 mt-1">Monthly total ÷ referrals per month</div></div>
      </section>
    </div>
  );
}
