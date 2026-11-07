import { useState } from "react";
import { FileScan } from "lucide-react";
import { apiFetch, BASE_URL } from "../../api/config";
import { Notice, Pill } from "./Status";
import { btn, ui } from "./ui";

export interface ScanRow { key: string; label: string; value: string; source_text: string; confidence: string; reasons: string[] }

export const SAMPLE_PATIENTS: {
  id: string;
  label: string;
  rows: ScanRow[];
}[] = [
  {
    id: "kavita",
    label: "Kavita Jadhav · 34 Y · VIA Positive",
    rows: [
      { key: "patient_name", label: "Full name", value: "Kavita Jadhav", source_text: "1 Kavita Jadhav 34 9876501234 Malvani Gate 3 2026-11-05 VIA Positive", confidence: "High confidence", reasons: [] },
      { key: "age", label: "Age", value: "34", source_text: "Age: 34", confidence: "High confidence", reasons: [] },
      { key: "phone", label: "Contact number", value: "9876501234", source_text: "Mobile: 9876501234", confidence: "High confidence", reasons: [] },
      { key: "area", label: "Area / address", value: "Malvani Gate 3", source_text: "Area: Malvani Gate 3", confidence: "High confidence", reasons: [] },
      { key: "preferred_language", label: "Preferred language", value: "hi", source_text: "Language: Hindi", confidence: "High confidence", reasons: [] },
      { key: "health_post", label: "Health post", value: "Malavani Health Post", source_text: "Centre: Malavani Health Post", confidence: "High confidence", reasons: [] },
      { key: "screening_date", label: "Screening date", value: "2026-11-05", source_text: "Screening date: 2026-11-05", confidence: "High confidence", reasons: [] },
      { key: "screening_method", label: "Screening method", value: "VIA", source_text: "Method: VIA", confidence: "High confidence", reasons: [] },
      { key: "screening_result", label: "Screening result", value: "POSITIVE", source_text: "Result: Positive", confidence: "High confidence", reasons: [] },
      { key: "refer", label: "Referral needed", value: "yes", source_text: "Refer: Yes", confidence: "High confidence", reasons: [] },
      { key: "referral_date", label: "Referral date", value: "2026-11-05", source_text: "Referral date: 2026-11-05", confidence: "High confidence", reasons: [] },
      { key: "pap_result", label: "Pap result", value: "LSIL", source_text: "Pap: LSIL", confidence: "High confidence", reasons: [] },
      { key: "hpv_dna", label: "HPV DNA", value: "not done", source_text: "HPV DNA: not done", confidence: "High confidence", reasons: [] },
      { key: "via_findings", label: "VIA findings", value: "acetowhite area at 3 o'clock", source_text: "VIA: acetowhite area at 3 o'clock", confidence: "High confidence", reasons: [] },
      { key: "parity", label: "Parity (G P L A)", value: "G2 P2 L2 A0", source_text: "Parity: G2 P2 L2 A0", confidence: "High confidence", reasons: [] },
      { key: "presenting_complaints", label: "Presenting complaints", value: "Vaginal discharge", source_text: "Complaints: Vaginal discharge", confidence: "High confidence", reasons: [] },
      { key: "menstrual_pattern", label: "Menstrual pattern", value: "Regular", source_text: "Menstrual pattern: Regular", confidence: "High confidence", reasons: [] },
      { key: "contraceptive_use", label: "Contraceptive use", value: "No", source_text: "Contraceptive use: No", confidence: "High confidence", reasons: [] },
      { key: "pregnancy_status", label: "Pregnancy status", value: "Not pregnant", source_text: "Pregnancy status: Not pregnant", confidence: "High confidence", reasons: [] },
      { key: "working_diagnosis", label: "Working impression", value: "Suspected CIN (cervical intraepithelial neoplasia)", source_text: "Impression: Suspected CIN", confidence: "High confidence", reasons: [] },
      { key: "action_taken", label: "Action taken", value: "Referred to Siddharth Hospital for colposcopy", source_text: "Action: Referred to Siddharth Hospital", confidence: "High confidence", reasons: [] },
      { key: "notes", label: "Notes for follow-up", value: "Best time to call: 11 AM to 1 PM. Husband is aware of referral.", source_text: "Notes: Best time to call 11 AM", confidence: "High confidence", reasons: [] },
    ],
  },
  {
    id: "farida",
    label: "Farida Shaikh · 38 Y · Pap Suspicious",
    rows: [
      { key: "patient_name", label: "Full name", value: "Farida Shaikh", source_text: "3 Farida Shaikh 38 9876503456 Ambujwadi 2026-11-06 Pap Suspicious", confidence: "High confidence", reasons: [] },
      { key: "age", label: "Age", value: "38", source_text: "Age: 38", confidence: "High confidence", reasons: [] },
      { key: "phone", label: "Contact number", value: "9876503456", source_text: "Mobile: 9876503456", confidence: "High confidence", reasons: [] },
      { key: "area", label: "Area / address", value: "Ambujwadi", source_text: "Area: Ambujwadi", confidence: "High confidence", reasons: [] },
      { key: "preferred_language", label: "Preferred language", value: "hi", source_text: "Language: Hindi", confidence: "High confidence", reasons: [] },
      { key: "health_post", label: "Health post", value: "Malavani Health Post", source_text: "Centre: Malavani Health Post", confidence: "High confidence", reasons: [] },
      { key: "screening_date", label: "Screening date", value: "2026-11-06", source_text: "Screening date: 2026-11-06", confidence: "High confidence", reasons: [] },
      { key: "screening_method", label: "Screening method", value: "PAP", source_text: "Method: Pap", confidence: "High confidence", reasons: [] },
      { key: "screening_result", label: "Screening result", value: "SUSPICIOUS", source_text: "Result: Suspicious", confidence: "High confidence", reasons: [] },
      { key: "refer", label: "Referral needed", value: "yes", source_text: "Refer: Yes", confidence: "High confidence", reasons: [] },
      { key: "referral_date", label: "Referral date", value: "2026-11-06", source_text: "Referral date: 2026-11-06", confidence: "High confidence", reasons: [] },
      { key: "pap_result", label: "Pap result", value: "HSIL", source_text: "Pap: HSIL", confidence: "High confidence", reasons: [] },
      { key: "hpv_dna", label: "HPV DNA", value: "Positive", source_text: "HPV DNA: Positive", confidence: "High confidence", reasons: [] },
      { key: "via_findings", label: "VIA findings", value: "dense acetowhite lesion, Reid score 6", source_text: "VIA: dense acetowhite lesion, Reid score 6", confidence: "High confidence", reasons: [] },
      { key: "parity", label: "Parity (G P L A)", value: "G4 P3 L3 A1", source_text: "Parity: G4 P3 L3 A1", confidence: "High confidence", reasons: [] },
      { key: "presenting_complaints", label: "Presenting complaints", value: "AUB", source_text: "Complaints: AUB", confidence: "High confidence", reasons: [] },
      { key: "menstrual_pattern", label: "Menstrual pattern", value: "Regular", source_text: "Menstrual pattern: Regular", confidence: "High confidence", reasons: [] },
      { key: "contraceptive_use", label: "Contraceptive use", value: "No", source_text: "Contraceptive use: No", confidence: "High confidence", reasons: [] },
      { key: "pregnancy_status", label: "Pregnancy status", value: "Not pregnant", source_text: "Pregnancy status: Not pregnant", confidence: "High confidence", reasons: [] },
      { key: "working_diagnosis", label: "Working impression", value: "Suspected HSIL / high-grade lesion", source_text: "Impression: Suspected HSIL", confidence: "High confidence", reasons: [] },
      { key: "action_taken", label: "Action taken", value: "Urgent referral to Siddharth Hospital for colposcopy & biopsy", source_text: "Action: Urgent referral", confidence: "High confidence", reasons: [] },
      { key: "notes", label: "Notes for follow-up", value: "High-grade cytology. Urgent colposcopy and directed biopsy needed.", source_text: "Notes: Urgent biopsy needed", confidence: "High confidence", reasons: [] },
    ],
  },
  {
    id: "lata",
    label: "Lata Kamble · 45 Y · VIA Positive",
    rows: [
      { key: "patient_name", label: "Full name", value: "Lata Kamble", source_text: "4 Lata Kamble 45 9876504567 Malvani Gate 7 2026-11-06 VIA Positive", confidence: "High confidence", reasons: [] },
      { key: "age", label: "Age", value: "45", source_text: "Age: 45", confidence: "High confidence", reasons: [] },
      { key: "phone", label: "Contact number", value: "9876504567", source_text: "Mobile: 9876504567", confidence: "High confidence", reasons: [] },
      { key: "area", label: "Area / address", value: "Malvani Gate 7", source_text: "Area: Malvani Gate 7", confidence: "High confidence", reasons: [] },
      { key: "preferred_language", label: "Preferred language", value: "mr", source_text: "Language: Marathi", confidence: "High confidence", reasons: [] },
      { key: "health_post", label: "Health post", value: "Malavani Health Post", source_text: "Centre: Malavani Health Post", confidence: "High confidence", reasons: [] },
      { key: "screening_date", label: "Screening date", value: "2026-11-06", source_text: "Screening date: 2026-11-06", confidence: "High confidence", reasons: [] },
      { key: "screening_method", label: "Screening method", value: "VIA", source_text: "Method: VIA", confidence: "High confidence", reasons: [] },
      { key: "screening_result", label: "Screening result", value: "POSITIVE", source_text: "Result: Positive", confidence: "High confidence", reasons: [] },
      { key: "refer", label: "Referral needed", value: "yes", source_text: "Refer: Yes", confidence: "High confidence", reasons: [] },
      { key: "referral_date", label: "Referral date", value: "2026-11-06", source_text: "Referral date: 2026-11-06", confidence: "High confidence", reasons: [] },
      { key: "pap_result", label: "Pap result", value: "ASC-US", source_text: "Pap: ASC-US", confidence: "High confidence", reasons: [] },
      { key: "hpv_dna", label: "HPV DNA", value: "Positive", source_text: "HPV DNA: Positive", confidence: "High confidence", reasons: [] },
      { key: "via_findings", label: "VIA findings", value: "punctation and acetowhitening at 12 o'clock", source_text: "VIA: punctation and acetowhitening at 12 o'clock", confidence: "High confidence", reasons: [] },
      { key: "parity", label: "Parity (G P L A)", value: "G2 P2 L2 A0", source_text: "Parity: G2 P2 L2 A0", confidence: "High confidence", reasons: [] },
      { key: "presenting_complaints", label: "Presenting complaints", value: "Pelvic pain", source_text: "Complaints: Pelvic pain", confidence: "High confidence", reasons: [] },
      { key: "menstrual_pattern", label: "Menstrual pattern", value: "Regular", source_text: "Menstrual pattern: Regular", confidence: "High confidence", reasons: [] },
      { key: "contraceptive_use", label: "Contraceptive use", value: "No", source_text: "Contraceptive use: No", confidence: "High confidence", reasons: [] },
      { key: "pregnancy_status", label: "Pregnancy status", value: "Not pregnant", source_text: "Pregnancy status: Not pregnant", confidence: "High confidence", reasons: [] },
      { key: "working_diagnosis", label: "Working impression", value: "Acetowhite lesion at 12 o'clock, rule out CIN 2+", source_text: "Impression: Acetowhite lesion", confidence: "High confidence", reasons: [] },
      { key: "action_taken", label: "Action taken", value: "Referred to Siddharth Hospital for colposcopy", source_text: "Action: Referred to Siddharth Hospital", confidence: "High confidence", reasons: [] },
      { key: "notes", label: "Notes for follow-up", value: "Referred for colposcopy. Available on phone in evenings.", source_text: "Notes: Phone evenings", confidence: "High confidence", reasons: [] },
    ],
  },
  {
    id: "sunita",
    label: "Sunita Waghmare · 41 Y · VIA Negative",
    rows: [
      { key: "patient_name", label: "Full name", value: "Sunita Waghmare", source_text: "2 Sunita Waghmare 41 9876502345 Malvani Gate 5 2026-11-05 VIA Negative", confidence: "High confidence", reasons: [] },
      { key: "age", label: "Age", value: "41", source_text: "Age: 41", confidence: "High confidence", reasons: [] },
      { key: "phone", label: "Contact number", value: "9876502345", source_text: "Mobile: 9876502345", confidence: "High confidence", reasons: [] },
      { key: "area", label: "Area / address", value: "Malvani Gate 5", source_text: "Area: Malvani Gate 5", confidence: "High confidence", reasons: [] },
      { key: "preferred_language", label: "Preferred language", value: "mr", source_text: "Language: Marathi", confidence: "High confidence", reasons: [] },
      { key: "health_post", label: "Health post", value: "Malavani Health Post", source_text: "Centre: Malavani Health Post", confidence: "High confidence", reasons: [] },
      { key: "screening_date", label: "Screening date", value: "2026-11-05", source_text: "Screening date: 2026-11-05", confidence: "High confidence", reasons: [] },
      { key: "screening_method", label: "Screening method", value: "VIA", source_text: "Method: VIA", confidence: "High confidence", reasons: [] },
      { key: "screening_result", label: "Screening result", value: "NEGATIVE", source_text: "Result: Negative", confidence: "High confidence", reasons: [] },
      { key: "refer", label: "Referral needed", value: "no", source_text: "Refer: No", confidence: "High confidence", reasons: [] },
      { key: "referral_date", label: "Referral date", value: "2026-11-05", source_text: "Referral date: 2026-11-05", confidence: "High confidence", reasons: [] },
      { key: "pap_result", label: "Pap result", value: "NILM", source_text: "Pap: NILM", confidence: "High confidence", reasons: [] },
      { key: "hpv_dna", label: "HPV DNA", value: "Negative", source_text: "HPV DNA: Negative", confidence: "High confidence", reasons: [] },
      { key: "via_findings", label: "VIA findings", value: "no acetowhite lesion, squamocolumnar junction fully visible", source_text: "VIA: no acetowhite lesion", confidence: "High confidence", reasons: [] },
      { key: "parity", label: "Parity (G P L A)", value: "G3 P3 L3 A0", source_text: "Parity: G3 P3 L3 A0", confidence: "High confidence", reasons: [] },
      { key: "presenting_complaints", label: "Presenting complaints", value: "None", source_text: "Complaints: None", confidence: "High confidence", reasons: [] },
      { key: "menstrual_pattern", label: "Menstrual pattern", value: "Regular", source_text: "Menstrual pattern: Regular", confidence: "High confidence", reasons: [] },
      { key: "contraceptive_use", label: "Contraceptive use", value: "No", source_text: "Contraceptive use: No", confidence: "High confidence", reasons: [] },
      { key: "pregnancy_status", label: "Pregnancy status", value: "Not pregnant", source_text: "Pregnancy status: Not pregnant", confidence: "High confidence", reasons: [] },
      { key: "working_diagnosis", label: "Working impression", value: "Normal screening examination", source_text: "Impression: Normal", confidence: "High confidence", reasons: [] },
      { key: "action_taken", label: "Action taken", value: "Screening normal. Advised routine rescreening in 5 years", source_text: "Action: Routine rescreening", confidence: "High confidence", reasons: [] },
      { key: "notes", label: "Notes for follow-up", value: "Routine screening negative. Advised follow-up if symptoms occur.", source_text: "Notes: Follow-up if symptoms", confidence: "High confidence", reasons: [] },
    ],
  },
  {
    id: "meena",
    label: "Meena Gaikwad · 29 Y · HPV Inconclusive",
    rows: [
      { key: "patient_name", label: "Full name", value: "Meena Gaikwad", source_text: "5 Meena Gaikwad 29 9876505678 Rathodi 2026-11-07 HPV Inconclusive", confidence: "High confidence", reasons: [] },
      { key: "age", label: "Age", value: "29", source_text: "Age: 29", confidence: "High confidence", reasons: [] },
      { key: "phone", label: "Contact number", value: "9876505678", source_text: "Mobile: 9876505678", confidence: "High confidence", reasons: [] },
      { key: "area", label: "Area / address", value: "Rathodi", source_text: "Area: Rathodi", confidence: "High confidence", reasons: [] },
      { key: "preferred_language", label: "Preferred language", value: "mr", source_text: "Language: Marathi", confidence: "High confidence", reasons: [] },
      { key: "health_post", label: "Health post", value: "Malavani Health Post", source_text: "Centre: Malavani Health Post", confidence: "High confidence", reasons: [] },
      { key: "screening_date", label: "Screening date", value: "2026-11-07", source_text: "Screening date: 2026-11-07", confidence: "High confidence", reasons: [] },
      { key: "screening_method", label: "Screening method", value: "HPV", source_text: "Method: HPV", confidence: "High confidence", reasons: [] },
      { key: "screening_result", label: "Screening result", value: "INCONCLUSIVE", source_text: "Result: Inconclusive", confidence: "High confidence", reasons: [] },
      { key: "refer", label: "Referral needed", value: "yes", source_text: "Refer: Yes", confidence: "High confidence", reasons: [] },
      { key: "referral_date", label: "Referral date", value: "2026-11-07", source_text: "Referral date: 2026-11-07", confidence: "High confidence", reasons: [] },
      { key: "pap_result", label: "Pap result", value: "ASC-US", source_text: "Pap: ASC-US", confidence: "High confidence", reasons: [] },
      { key: "hpv_dna", label: "HPV DNA", value: "Inconclusive", source_text: "HPV DNA: Inconclusive", confidence: "High confidence", reasons: [] },
      { key: "via_findings", label: "VIA findings", value: "faint acetowhite area near transformation zone", source_text: "VIA: faint acetowhite area", confidence: "High confidence", reasons: [] },
      { key: "parity", label: "Parity (G P L A)", value: "G1 P1 L1 A0", source_text: "Parity: G1 P1 L1 A0", confidence: "High confidence", reasons: [] },
      { key: "presenting_complaints", label: "Presenting complaints", value: "None", source_text: "Complaints: None", confidence: "High confidence", reasons: [] },
      { key: "menstrual_pattern", label: "Menstrual pattern", value: "Regular", source_text: "Menstrual pattern: Regular", confidence: "High confidence", reasons: [] },
      { key: "contraceptive_use", label: "Contraceptive use", value: "No", source_text: "Contraceptive use: No", confidence: "High confidence", reasons: [] },
      { key: "pregnancy_status", label: "Pregnancy status", value: "Not pregnant", source_text: "Pregnancy status: Not pregnant", confidence: "High confidence", reasons: [] },
      { key: "working_diagnosis", label: "Working impression", value: "Borderline transformation zone changes, repeat triage", source_text: "Impression: Borderline changes", confidence: "High confidence", reasons: [] },
      { key: "action_taken", label: "Action taken", value: "Referred to Siddharth Hospital for HPV repeat and colposcopic triage", source_text: "Action: Referred for HPV repeat", confidence: "High confidence", reasons: [] },
      { key: "notes", label: "Notes for follow-up", value: "Borderline HPV finding. Contact after 2 PM.", source_text: "Notes: Contact after 2 PM", confidence: "High confidence", reasons: [] },
    ],
  },
];

/** Reads a screening slip and shows what it found as rows. Staff tick the rows to copy into the form; typing by hand still works. */
export function ScanToFill({ allowed, onApply }: { allowed: string[]; onApply: (values: Record<string, string>) => void }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const loadSample = (sampleId: string) => {
    setError(null);
    setWarnings([]);
    const item = SAMPLE_PATIENTS.find((p) => p.id === sampleId) ?? SAMPLE_PATIENTS[0];
    const found = item.rows.filter((r) => allowed.includes(r.key));
    setRows(found);
    const vals = Object.fromEntries(found.map((r) => [r.key, r.value]));
    setValues(vals);
    setChosen(Object.fromEntries(found.map((r) => [r.key, true])));
    onApply(vals);
    setApplied(found.length);
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${ui.input} !min-h-9 !py-1 text-xs w-auto cursor-pointer`}
            aria-label="Choose sample patient from screening register"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                loadSample(e.target.value);
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>Choose sample from register...</option>
            {SAMPLE_PATIENTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            className={btn("secondary", "!min-h-9 text-xs")}
            data-testid="load-sample-slip"
            onClick={() => loadSample("kavita")}
          >
            Load sample slip (Kavita)
          </button>
          <label className={btn("primary", "!min-h-9 text-xs cursor-pointer" + (busy ? " opacity-60 pointer-events-none" : ""))}>
            <FileScan className="size-3.5" />{busy ? "Reading..." : "Upload and read"}
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" data-testid="scan-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
          </label>
        </div>
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
