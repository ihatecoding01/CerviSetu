import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { referralApi, STATUS_LABELS, STATUS_ORDER, type Referral, type ReferralFile } from "../../api/referrals";

const PA = ["Present", "Absent"];
const FINDINGS: { key: string; label: string; options?: string[]; type?: string }[] = [
  { key: "date", label: "Colposcopy date", type: "date" },
  { key: "colposcope", label: "Colposcope type", options: ["Digital", "Handheld", "Other"] },
  { key: "colposcope_other", label: "Other colposcope type" },
  { key: "scj", label: "SCJ visibility", options: ["Complete", "Partial", "Not visible"] },
  { key: "acetowhite", label: "Acetowhite areas", options: PA },
  { key: "mosaicism", label: "Mosaicism or punctation", options: PA },
  { key: "vessels", label: "Atypical vessels", options: PA },
  { key: "reid", label: "Reid index", options: ["0-2 Low grade", "3-4 Indeterminate", "5-8 High grade"] },
  { key: "impression", label: "Colposcopy impression", options: ["Normal", "CIN I", "CIN II", "CIN III", "Invasive lesion", "Unsatisfactory"] },
];
const HISTOLOGY = ["Metaplasia", "CIN 1", "CIN 2", "CIN 3", "CIS", "Invasive cancer", "Other"];
const INTAKE_LABELS: [string, string][] = [["presenting_complaints", "Presenting complaints"], ["other_complaint", "Other complaint"], ["parity", "Parity (G P L A)"], ["previous_procedures", "Previous cervical procedures"], ["medical_history", "Medical history"], ["pap_result", "Pap result"], ["hpv_dna", "HPV DNA"], ["via_findings", "Cervical examination / VIA findings"], ["working_diagnosis", "Working impression (not a diagnosis)"], ["action_taken", "Action taken"]];
const FILE_KINDS: [string, string][] = [["VIA_IMAGE", "VIA image"], ["COLPOSCOPY_IMAGE", "Colposcopy image"], ["HISTOPATHOLOGY_REPORT", "Histopathology report"], ["MRI_REPORT", "MRI report"], ["OTHER_REPORT", "Other report"]];
const field = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm";
const REVIEW: Record<string, string> = { REFUSED: "She refused the referral", NO_CONTACT: "No contact by day 14" };

/** The doctor's record. Nothing here is inferred: an empty field reads as pending. */
export function CaseRecord({ referral, onChanged }: { referral: Referral; onChanged: () => Promise<void> | void }) {
  const [findings, setFindings] = useState<Record<string, string>>(referral.colposcopy_findings ?? {});
  const [text, setText] = useState({ biopsy: referral.biopsy ?? "", histopathology: referral.histopathology ?? "", mri: referral.mri ?? "", final_diagnosis: referral.final_diagnosis ?? "", treatment_plan: referral.treatment_plan ?? "", remarks: referral.remarks ?? "", next_follow_up: referral.next_follow_up ?? "" });
  const [files, setFiles] = useState<ReferralFile[]>([]);
  const [kind, setKind] = useState("HISTOPATHOLOGY_REPORT");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = referral.referral_id;
  const arrived = STATUS_ORDER.indexOf(referral.status) >= 1;

  const loadFiles = () => referralApi.files(id).then((r) => setFiles(r.files)).catch((e) => setError(e.message));
  useEffect(() => { void loadFiles(); }, [id]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    setNote(null);
    try {
      await fn();
      setNote(done);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This could not be saved.");
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl" data-testid="case-record">
      {referral.doctor_review && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-2" data-testid="review-banner">
          <h2 className="text-sm font-bold text-amber-950">Needs your review: {REVIEW[referral.doctor_review] ?? referral.doctor_review}</h2>
          <input className={`${field} h-10`} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Your decision" />
          <button className="self-start h-9 rounded-lg bg-black text-white px-3 text-xs font-semibold cursor-pointer" onClick={() => act(() => referralApi.resolveReview(id, reviewNote), "Review closed.")}>Close review</button>
        </section>
      )}
      {!arrived && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">The record opens after the hospital confirms her arrival.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="intake-summary">
        <h2 className="text-sm font-bold mb-3">Health post intake</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">{INTAKE_LABELS.map(([k, label]) => (
          <div key={k} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="break-words">{referral.form?.[k] || "Not entered"}</dd></div>
        ))}</dl>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold mb-3">Colposcopy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FINDINGS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">{f.label}
              {f.options ? (
                <select className={`${field} h-10`} value={findings[f.key] ?? ""} onChange={(e) => setFindings({ ...findings, [f.key]: e.target.value })}>
                  <option value="">Pending</option>{f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : <input type={f.type ?? "text"} className={`${field} h-10`} value={findings[f.key] ?? ""} onChange={(e) => setFindings({ ...findings, [f.key]: e.target.value })} />}
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <h2 className="sm:col-span-2 text-sm font-bold">Reports and plan</h2>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">Biopsy
          <select className={`${field} h-10`} value={text.biopsy} onChange={(e) => setText({ ...text, biopsy: e.target.value })} data-testid="record-biopsy">
            <option value="">Pending</option>{["Yes", "No", "Not indicated"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">Next follow-up date
          <input type="date" className={`${field} h-10`} value={text.next_follow_up} onChange={(e) => setText({ ...text, next_follow_up: e.target.value })} />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-slate-700">Histopathology
          <select className={`${field} h-10`} value={text.histopathology} onChange={(e) => setText({ ...text, histopathology: e.target.value })} data-testid="record-histopathology">
            <option value="">Pending</option>{HISTOLOGY.map((o) => <option key={o}>{o}</option>)}
            {text.histopathology && !HISTOLOGY.includes(text.histopathology) && <option>{text.histopathology}</option>}
          </select>
        </label>
        {([["mri", "MRI"], ["final_diagnosis", "Final diagnosis"], ["treatment_plan", "Treatment plan"], ["remarks", "Remarks"]] as const).map(([k, label]) => (
          <label key={k} className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-slate-700">{label}
            <textarea rows={2} placeholder="Pending" className={`${field} py-2`} value={text[k]} onChange={(e) => setText({ ...text, [k]: e.target.value })} data-testid={`record-${k}`} />
          </label>
        ))}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <button disabled={!arrived} className="h-10 rounded-lg bg-black text-white px-4 text-sm font-semibold cursor-pointer disabled:opacity-50" onClick={() => act(() => referralApi.clinical(id, { ...text, next_follow_up: text.next_follow_up || undefined, colposcopy: findings.impression ?? "", colposcopy_findings: findings }), "Record saved.")} data-testid="record-save">Save record</button>
          {STATUS_ORDER.filter((s) => STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(referral.status) && STATUS_ORDER.indexOf(s) > 1).map((s) => (
            <button key={s} disabled={!arrived} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50" onClick={() => act(() => referralApi.setStatus(id, { status: s }), `${STATUS_LABELS[s]} recorded.`)}>Record: {STATUS_LABELS[s]}</button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col gap-3">
        <h2 className="text-sm font-bold">Files</h2>
        {files.length === 0 ? <p className="text-sm text-slate-500">No files yet.</p> : (
          <ul className="flex flex-col gap-1.5">{files.map((f) => (
            <li key={f.file_id} className="flex flex-col gap-2">{f.kind.endsWith("IMAGE") && <img src={referralApi.fileUrl(id, f.file_id) + "?inline=1"} alt={f.filename} className="max-h-72 w-full max-w-md rounded-lg border border-slate-200 object-contain" data-testid="record-image" />}<a className="flex items-center gap-2 text-sm underline break-all" href={referralApi.fileUrl(id, f.file_id)}><Download className="size-4 shrink-0" />{f.filename}</a></li>
          ))}</ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <select className={`${field} h-10 sm:w-auto`} value={kind} onChange={(e) => setKind(e.target.value)}>{FILE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {kind.endsWith("IMAGE") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} />She agreed to this photo</label>}
          <label className="h-10 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold cursor-pointer"><Upload className="size-4" />Choose file
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" data-testid="record-file" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void act(async () => { await referralApi.upload(id, kind, file, photoConsent); await loadFiles(); }, "File saved."); }} />
          </label>
        </div>
      </section>
      {note && <p className="text-sm text-emerald-800" data-testid="record-note">{note}</p>}
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
    </div>
  );
}
