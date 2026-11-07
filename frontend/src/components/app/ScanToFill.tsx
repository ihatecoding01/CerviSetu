import { useState } from "react";
import { FileScan } from "lucide-react";
import { apiFetch, BASE_URL } from "../../api/config";
import { Notice, Pill } from "./Status";
import { btn, ui } from "./ui";

export interface ScanRow { key: string; label: string; value: string; source_text: string; confidence: string; reasons: string[] }

/** Reads a screening slip and shows what it found as rows. Staff tick the rows to copy into the form; typing by hand still works. */
export function ScanToFill({ allowed, onApply }: { allowed: string[]; onApply: (values: Record<string, string>) => void }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const scan = async (file: File) => {
    setBusy(true); setError(null); setApplied(null); setRows(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch(`${BASE_URL}/api/referrals/scan-intake`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The document could not be read.");
      const found = (data.rows as ScanRow[]).filter((r) => allowed.includes(r.key));
      setRows(found);
      setWarnings(data.warnings ?? []);
      setValues(Object.fromEntries(found.map((r) => [r.key, r.value])));
      setChosen(Object.fromEntries(found.map((r) => [r.key, r.confidence === "High confidence"])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The document could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const picked = (rows ?? []).filter((r) => chosen[r.key]);

  return (
    <section className="rounded-xl border-2 border-[#0369A1]/30 bg-[#F4F9FC] p-3 sm:p-4 flex flex-col gap-3" data-testid="scan-to-fill">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Fill from a document</h3>
          <p className="text-xs text-slate-600">Upload her screening slip or referral form. The details found are shown below for you to check. Or type them in by hand.</p>
        </div>
        <label className={btn("primary", busy ? "opacity-60 pointer-events-none" : "")}>
          <FileScan className="size-4" />{busy ? "Reading..." : "Upload and read"}
          <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" data-testid="scan-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
        </label>
      </div>
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
      {warnings.map((w) => <Notice key={w} tone="attention">{w}</Notice>)}
      {rows && rows.length > 0 && (
        <>
          <div className="relative overflow-x-auto rounded-md border border-black/[0.08] bg-white">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-left text-xs text-slate-500 bg-slate-50"><th className="p-2 w-8"><span className="sr-only">Use</span></th><th className="p-2">Field</th><th className="p-2">Value found</th><th className="p-2">Check</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.key} className="border-t border-black/[0.06] align-top" data-testid={`scan-row-${r.key}`}>
                  <td className="p-2"><input type="checkbox" aria-label={`Use ${r.label}`} checked={!!chosen[r.key]} onChange={(e) => setChosen({ ...chosen, [r.key]: e.target.checked })} /></td>
                  <td className="p-2 font-medium">{r.label}</td>
                  <td className="p-2 min-w-40">
                    <input className={`${ui.input} !min-h-9`} aria-label={`${r.label} value`} value={values[r.key] ?? ""} onChange={(e) => setValues({ ...values, [r.key]: e.target.value })} />
                    <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer">Source</summary><q className="block mt-1 break-words">{r.source_text}</q></details>
                  </td>
                  <td className="p-2"><Pill tone={r.confidence === "High confidence" ? "neutral" : "attention"}>{r.confidence}</Pill>{r.reasons.map((x) => <div key={x} className="text-xs text-amber-800 mt-1">{x}</div>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn("primary")} disabled={picked.length === 0} data-testid="scan-apply"
              onClick={() => { onApply(Object.fromEntries(picked.map((r) => [r.key, (values[r.key] ?? "").trim()]))); setApplied(picked.length); }}>Put {picked.length} into the form</button>
            <span className="text-xs text-slate-500">Check every value against the slip. The file is not saved; attach it on the documents step if needed.</span>
          </div>
        </>
      )}
      {applied !== null && <p className="text-sm text-emerald-800" role="status" data-testid="scan-applied">{applied} field{applied === 1 ? "" : "s"} filled. Review them in the form.</p>}
    </section>
  );
}
