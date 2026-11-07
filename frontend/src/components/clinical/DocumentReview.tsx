import { useEffect, useState } from "react";
import { referralApi, type DocumentReading, type ReferralFile } from "../../api/referrals";
import { Notice, Pill } from "../app/Status";
import { btn, ui } from "../app/ui";

const STATUS_TEXT: Record<string, string> = {
  COMPLETED: "Read", OCR_DISABLED: "Reading is switched off", OCR_FAILED: "Could not be read", OCR_EMPTY: "No text found",
  QUALITY_REJECTED: "Unreadable", REJECTED: "File not accepted",
};
const REVIEW_TEXT: Record<string, string> = { UNREVIEWED: "Extracted, not reviewed", CONFIRMED: "Clinician-confirmed", REJECTED: "Rejected by clinician" };

/** Reads one attached document and lets the doctor confirm findings field by field. Nothing is saved without a tick. */
export function DocumentReview({ referralId, file, canConfirm, onSaved, autoRead }: { referralId: string; file: ReferralFile; canConfirm: boolean; onSaved: () => Promise<void> | void; autoRead?: boolean }) {
  const [reading, setReading] = useState<DocumentReading | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = (r: DocumentReading | null) => {
    setReading(r);
    setValues(Object.fromEntries((r?.fields ?? []).map((f) => [f.key, f.value])));
    setChosen({});
  };
  useEffect(() => {
    referralApi.reading(referralId, file.file_id).then((r) => {
      if (r.reading || !autoRead) load(r.reading);
      else void read();  // a report just uploaded is read straight away
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralId, file.file_id]);

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true); setError(null); setNote(null);
    try { await fn(); if (done) setNote(done); } catch (e) { setError(e instanceof Error ? e.message : "This did not work."); } finally { setBusy(false); }
  };
  const read = () => run(async () => load(await referralApi.readDocument(referralId, file.file_id)));
  const picked = Object.keys(chosen).filter((k) => chosen[k]);
  const confirm = () => run(async () => {
    const r = await referralApi.confirmReading(referralId, file.file_id, Object.fromEntries(picked.map((k) => [k, values[k] ?? ""])));
    load(r.reading);
    await onSaved();
  }, `${picked.length} confirmed finding${picked.length === 1 ? "" : "s"} saved to the record.`);
  const reject = () => run(async () => load((await referralApi.rejectReading(referralId, file.file_id)).reading), "Extraction rejected. Nothing was saved.");

  const locked = reading?.review_status !== "UNREVIEWED";
  return (
    <div className="flex flex-col gap-3" data-testid="document-review">
      <div className="flex flex-wrap items-center gap-2">
        {!reading ? (
          <button type="button" className={btn("secondary")} disabled={busy} onClick={read} data-testid="doc-read">{busy ? "Reading..." : "Read document"}</button>
        ) : (
          <>
            <Pill tone={reading.status === "COMPLETED" ? "neutral" : "attention"}>{STATUS_TEXT[reading.status] ?? reading.status}</Pill>
            {reading.status === "COMPLETED" && <Pill tone={reading.review_status === "CONFIRMED" ? "routine" : "guidance"}>{REVIEW_TEXT[reading.review_status]}</Pill>}
            <button type="button" className={btn("ghost")} disabled={busy} onClick={read} data-testid="doc-retry">{busy ? "Reading..." : "Read again"}</button>
          </>
        )}
      </div>
      {reading?.warnings.map((w) => <Notice key={w} tone="attention">{w}</Notice>)}
      {reading?.summary && <p className="text-sm text-slate-700 border-l-2 border-slate-300 pl-3" data-testid="doc-summary"><span className="text-xs font-semibold text-slate-500 block">AI-generated summary of this document</span>{reading.summary}</p>}
      {reading && reading.fields.length > 0 && (
        <div className="relative overflow-x-auto rounded-md border border-black/[0.08]">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-slate-500 bg-slate-50">
              <th className="p-2 w-8"><span className="sr-only">Choose</span></th><th className="p-2">Field</th><th className="p-2">Extracted value</th><th className="p-2">In the record now</th><th className="p-2">Review</th>
            </tr></thead>
            <tbody>
              {reading.fields.map((f) => {
                const done = reading.confirmed?.includes(f.key);
                return (
                  <tr key={f.key} className="border-t border-black/[0.06] align-top" data-testid={`doc-field-${f.key}`}>
                    <td className="p-2"><input type="checkbox" aria-label={`Confirm ${f.label}`} disabled={locked || !canConfirm} checked={!!chosen[f.key] || !!done} onChange={(e) => setChosen({ ...chosen, [f.key]: e.target.checked })} /></td>
                    <td className="p-2"><div className="font-medium">{f.label}</div><div className="text-xs text-slate-500">{f.group}{f.target ? "" : " · saved to remarks"}</div></td>
                    <td className="p-2 min-w-48">
                      <input className={`${ui.input} !min-h-9`} value={values[f.key] ?? ""} disabled={locked || !canConfirm} aria-label={`${f.label} value`} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                      <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer">Source{f.page ? `, page ${f.page}` : ""}</summary><q className="block mt-1 break-words">{f.source_text}</q></details>
                    </td>
                    <td className="p-2 text-slate-600">{f.target ? (f.current || "Not stated") : "—"}</td>
                    <td className="p-2">
                      <Pill tone={done ? "routine" : f.confidence === "High confidence" ? "neutral" : "attention"}>{done ? "Confirmed" : f.confidence}</Pill>
                      {f.reasons.map((r) => <div key={r} className="text-xs text-amber-800 mt-1">{r}</div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {reading && reading.status === "COMPLETED" && !locked && canConfirm && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn("primary")} disabled={busy || picked.length === 0} onClick={confirm} data-testid="doc-confirm">Confirm selected ({picked.length})</button>
          <button type="button" className={btn("secondary")} disabled={busy} onClick={reject} data-testid="doc-reject">Reject extraction</button>
          <span className="text-xs text-slate-500">Extracted values are not verified until you confirm them. Status, diagnosis and treatment are never changed here.</span>
        </div>
      )}
      {note && <p className="text-sm text-emerald-800" role="status" data-testid="doc-note">{note}</p>}
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
    </div>
  );
}
