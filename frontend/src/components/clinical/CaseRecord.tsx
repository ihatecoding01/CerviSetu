import { useEffect, useState, type ReactNode } from "react";
import { Download, Hospital, Trash2, Upload, UserCheck } from "lucide-react";
import { referralApi, STATUS_LABELS, STATUS_ORDER, type Referral, type ReferralFile } from "../../api/referrals";
import { Notice, Pill, when } from "../app/Status";
import { DocumentReview } from "./DocumentReview";
import { btn, ui } from "../app/ui";

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
const FILE_KINDS: [string, string][] = [["PAP_REPORT", "Pap smear / cytology report"], ["HPV_REPORT", "HPV DNA report"], ["VIA_IMAGE", "VIA image"], ["SCREENING_REPORT", "Screening report"], ["REFERRAL_SLIP", "Referral slip"],
  ["COLPOSCOPY_REPORT", "Colposcopy report"], ["COLPOSCOPY_IMAGE", "Colposcopy image"], ["BIOPSY_REPORT", "Cervical biopsy report"], ["HISTOPATHOLOGY_REPORT", "Histopathology report"],
  ["LAB_REPORT", "Laboratory report"], ["CONSULT_NOTE", "Consultation note"], ["MRI_REPORT", "MRI report"], ["OTHER_REPORT", "Other medical record"]];
const REVIEW: Record<string, string> = { REFUSED: "She refused the referral", NO_CONTACT: "No contact by day 14" };

function Block({ title, tag, note, children }: { title: string; tag: string; note?: string; children: ReactNode }) {
  return (
    <section className={`${ui.panel} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className={ui.h3}>{title}</h2><span className="text-xs text-slate-500">{tag}</span></div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
const Field = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => (
  <label className={`flex flex-col gap-1.5 min-w-0 ${wide ? "sm:col-span-2" : ""}`}><span className={ui.label}>{label}</span>{children}</label>
);

/** The doctor's record. Screening, diagnostic findings, histopathology and the final diagnosis are kept apart; nothing is inferred. */
export function CaseRecord({ referral, onChanged }: { referral: Referral; onChanged: () => Promise<void> | void }) {
  const [findings, setFindings] = useState<Record<string, string>>(referral.colposcopy_findings ?? {});
  const [text, setText] = useState({ biopsy: referral.biopsy ?? "", histopathology: referral.histopathology ?? "", mri: referral.mri ?? "", final_diagnosis: referral.final_diagnosis ?? "", treatment_plan: referral.treatment_plan ?? "", remarks: referral.remarks ?? "", next_follow_up: referral.next_follow_up ?? "" });
  const [files, setFiles] = useState<ReferralFile[]>([]);
  const [kind, setKind] = useState("HISTOPATHOLOGY_REPORT");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [autoRead, setAutoRead] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const id = referral.referral_id;
  const arrived = STATUS_ORDER.indexOf(referral.status) >= 1;
  const select = `${ui.input}`;

  const loadFiles = () => referralApi.files(id).then((r) => setFiles(r.files)).catch((e) => setError(e.message));
  useEffect(() => { void loadFiles(); }, [id]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      await fn();
      setNote(done);
      setDirty(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const setF = (k: string, v: string) => { setFindings({ ...findings, [k]: v }); setDirty(true); };
  const setT = (k: keyof typeof text, v: string) => { setText({ ...text, [k]: v }); setDirty(true); };
  const nextStatuses = STATUS_ORDER.filter((s) => STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(referral.status) && STATUS_ORDER.indexOf(s) > 1);

  return (
    <div className="flex flex-col gap-4 max-w-4xl" data-testid="case-record">
      {referral.doctor_review && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2" data-testid="review-banner">
          <h2 className="text-sm font-semibold text-amber-950">Needs your review: {REVIEW[referral.doctor_review] ?? referral.doctor_review}</h2>
          {referral.doctor_review_note ? <p className="text-sm text-amber-900">Your decision: {referral.doctor_review_note}</p> : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input className={ui.input} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Your decision, for the record" />
              <button type="button" disabled={busy || !reviewNote.trim()} className={btn("primary", "shrink-0")} onClick={() => act(() => referralApi.resolveReview(id, reviewNote), "Review closed.")}>Close review</button>
            </div>
          )}
        </section>
      )}
      {!arrived && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-[#0284C7]/20 text-[#0284C7] flex items-center justify-center font-bold shrink-0">
              <Hospital className="size-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">Hospital Arrival Required</div>
              <div className="text-slate-600 mt-0.5">
                This patient is currently in <strong>Referred</strong> status. Confirm arrival to stop reminder cycles and unlock colposcopy, biopsy, and treatment documentation.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            className={`${btn("primary")} shrink-0 bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold text-xs gap-1.5 cursor-pointer`}
            onClick={() => act(() => referralApi.arrival(id), "Patient arrival confirmed. Clinical record unlocked.")}
            data-testid="confirm-arrival-btn"
          >
            <UserCheck className="size-3.5" />
            {busy ? "Confirming..." : "Confirm Arrival & Unlock Record"}
          </button>
        </div>
      )}

      <section className="relative z-20 rounded-xl border-2 border-[#0369A1]/30 bg-[#F4F9FC] p-4 sm:p-5" data-testid="ocr-panel">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className={ui.h3}>Upload and read a report</h2><span className="text-xs text-slate-500">OCR · decision support, not a diagnosis</span></div>
        <p className="mt-1 text-sm text-slate-600">Upload a Pap, HPV, colposcopy, biopsy, histopathology or lab report. CerviSetu reads it and proposes findings with the source text. Tick what is correct and confirm, and it is saved to her record. You can still enter everything by hand below.</p>
        <div className="mt-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <select className={`${ui.input} sm:w-auto text-xs !min-h-9`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="File type">{FILE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {kind.endsWith("IMAGE") && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} />She agreed to this photo</label>}
          <label className={btn("primary", "!min-h-9 text-xs cursor-pointer")}><Upload className="size-3.5" />Upload and read
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" data-testid="record-file" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void act(async () => { const saved = await referralApi.upload(id, kind, file, photoConsent); setAutoRead(saved.file_id); await loadFiles(); }, "File saved. Reading it now."); }} />
          </label>
          <button type="button" className={btn("secondary", "!min-h-9 text-xs")} disabled={busy} data-testid="load-sample-histo"
            onClick={() => void act(async () => { const res = await referralApi.loadSampleFile(id, "HISTOPATHOLOGY_REPORT"); setAutoRead(res.file.file_id); await loadFiles(); }, "Sample histopathology report attached and read.")}>
            Load sample histopathology
          </button>
          <button type="button" className={btn("secondary", "!min-h-9 text-xs")} disabled={busy} data-testid="load-sample-pap"
            onClick={() => void act(async () => { const res = await referralApi.loadSampleFile(id, "PAP_REPORT"); setAutoRead(res.file.file_id); await loadFiles(); }, "Sample Pap smear report attached and read.")}>
            Load sample Pap smear
          </button>
        </div>
        {files.length === 0 ? <p className={ui.muted}>No reports yet.</p> : (
          <ul className="flex flex-col gap-3">{files.map((f) => (
            <li key={f.file_id} className="rounded-md border border-black/[0.08] p-2 flex flex-col gap-2">
              {f.kind.endsWith("IMAGE") && f.content_type?.startsWith("image/") && <img src={referralApi.fileUrl(id, f.file_id) + "?inline=1"} alt={f.filename} className="max-h-56 w-full rounded object-contain bg-slate-50" data-testid="record-image" />}
              <div className="flex items-center justify-between gap-2 text-sm">
                <a className="flex items-center gap-1.5 font-medium text-[#0369A1] hover:underline break-all" href={referralApi.fileUrl(id, f.file_id)}><Download className="size-4 shrink-0" />{f.filename}</a>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill>{FILE_KINDS.find(([v]) => v === f.kind)?.[1] ?? f.kind}</Pill>
                  <button type="button" className={btn("ghost", "!min-h-8 !px-2 text-rose-700")} disabled={busy} aria-label={`Remove ${f.filename}`} data-testid="file-remove"
                    onClick={() => { if (window.confirm(`Remove ${f.filename}? The file and its reading are deleted. Findings you already confirmed stay in the record.`)) void act(async () => { await referralApi.removeFile(id, f.file_id); await loadFiles(); }, "File removed."); }}>
                    <Trash2 className="size-4" />Remove
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">{when(f.uploaded_at ?? f.created_at ?? "", true)}{f.uploaded_by ? ` · ${f.uploaded_by}` : ""}</p>
              {!f.kind.endsWith("IMAGE") ? <DocumentReview referralId={id} file={f} autoRead={f.file_id === autoRead} canConfirm={true} onSaved={async () => { await onChanged(); }} /> : null}
            </li>
          ))}</ul>
        )}
        </div>
      </section>

      <Block title="1. Screening at the health post" tag="Entered by the health post. Read only." note="Screening results are not a diagnosis.">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm" data-testid="intake-summary">
          {INTAKE_LABELS.map(([k, label]) => (
            <div key={k} className="min-w-0"><dt className={ui.label}>{label}</dt><dd className={`break-words ${referral.form?.[k] ? "" : "text-slate-400"}`}>{referral.form?.[k] || "Not entered"}</dd></div>
          ))}
        </dl>
      </Block>

      <Block title="2. Colposcopy" tag="Diagnostic findings. Entered by you.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FINDINGS.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.options ? (
                <select disabled={!arrived} className={select} value={findings[f.key] ?? ""} onChange={(e) => setF(f.key, e.target.value)}>
                  <option value="">Pending</option>{f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : <input disabled={!arrived} type={f.type ?? "text"} className={ui.input} value={findings[f.key] ?? ""} onChange={(e) => setF(f.key, e.target.value)} />}
            </Field>
          ))}
        </div>
      </Block>

      <Block title="3. Biopsy, histopathology and imaging" tag="Laboratory and imaging results." note="Histopathology confirms a tissue diagnosis. Leave it as pending until the report is in.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Biopsy">
            <select disabled={!arrived} className={select} value={text.biopsy} onChange={(e) => setT("biopsy", e.target.value)} data-testid="record-biopsy">
              <option value="">Pending</option>{["Yes", "No", "Not indicated"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Histopathology">
            <select disabled={!arrived} className={select} value={text.histopathology} onChange={(e) => setT("histopathology", e.target.value)} data-testid="record-histopathology">
              <option value="">Pending</option>{HISTOLOGY.map((o) => <option key={o}>{o}</option>)}
              {text.histopathology && !HISTOLOGY.includes(text.histopathology) && <option>{text.histopathology}</option>}
            </select>
          </Field>
          <Field label="MRI" wide><textarea disabled={!arrived} rows={2} placeholder="Pending" className={`${ui.input} py-2`} value={text.mri} onChange={(e) => setT("mri", e.target.value)} data-testid="record-mri" /></Field>
        </div>
      </Block>

      <Block title="4. Final diagnosis and plan" tag="Clinician-confirmed. Entered by you.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Final diagnosis" wide><textarea disabled={!arrived} rows={2} placeholder="Pending" className={`${ui.input} py-2`} value={text.final_diagnosis} onChange={(e) => setT("final_diagnosis", e.target.value)} data-testid="record-final_diagnosis" /></Field>
          {text.final_diagnosis.trim() && !text.histopathology && <div className="sm:col-span-2"><Notice tone="attention">Histopathology is still pending. Please make sure this final diagnosis is confirmed before saving.</Notice></div>}
          <Field label="Treatment plan" wide><textarea disabled={!arrived} rows={2} placeholder="Pending" className={`${ui.input} py-2`} value={text.treatment_plan} onChange={(e) => setT("treatment_plan", e.target.value)} data-testid="record-treatment_plan" /></Field>
          <Field label="Next follow-up date"><input disabled={!arrived} type="date" className={ui.input} value={text.next_follow_up} onChange={(e) => setT("next_follow_up", e.target.value)} /></Field>
          <Field label="Remarks" wide><textarea disabled={!arrived} rows={2} placeholder="Optional" className={`${ui.input} py-2`} value={text.remarks} onChange={(e) => setT("remarks", e.target.value)} data-testid="record-remarks" /></Field>
        </div>
      </Block>

      <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-[#FAFAFC]/95 backdrop-blur-sm border-t border-black/[0.06] flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!arrived || busy} className={btn("primary")} onClick={() => act(() => referralApi.clinical(id, { ...text, next_follow_up: text.next_follow_up || undefined, colposcopy: findings.impression ?? "", colposcopy_findings: findings }), "Record saved.")} data-testid="record-save">{busy ? "Saving..." : "Save record"}</button>
          {dirty && <span className="text-xs text-amber-800">Unsaved changes</span>}
          {arrived && nextStatuses.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Record step:</span>
              <select className={`${ui.input} !min-h-10 w-auto`} value="" disabled={busy} onChange={(e) => { const s = e.target.value; if (s) void act(() => referralApi.setStatus(id, { status: s }), `${STATUS_LABELS[s]} recorded.`); }} data-testid="record-step">
                <option value="">Choose</option>{nextStatuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
          )}
        </div>
        {note && <p className="text-sm text-emerald-800" role="status" data-testid="record-note">{note}</p>}
        {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
      </div>

    </div>
  );
}
