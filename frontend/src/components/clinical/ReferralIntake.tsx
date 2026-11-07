import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { referralApi, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { DocumentWorkspace } from "../dashboard/DocumentWorkspace";

type Field = { key: string; label: string; options?: string[]; type?: string; wide?: boolean };

const GAPS = ["Not done", "Not available", "Not applicable", "Pending"];
const SECTIONS: { title: string; note?: string; fields: Field[] }[] = [
  { title: "Background", fields: [
    { key: "opd_number", label: "OPD number" },
    { key: "address", label: "Address", wide: true },
    { key: "occupation", label: "Occupation" },
    { key: "socioeconomic_status", label: "Socioeconomic status" },
  ] },
  { title: "History", fields: [
    { key: "age_at_menarche", label: "Age at menarche", type: "number" },
    { key: "menstrual_pattern", label: "Menstrual pattern", options: ["Regular", "Irregular", "Other"] },
    { key: "lmp", label: "Last menstrual period", type: "date" },
    { key: "parity", label: "Parity (G P L A)" },
    { key: "contraceptive_use", label: "Contraceptive use", options: ["Yes", "No"] },
    { key: "contraceptive_type", label: "Contraceptive type" },
    { key: "presenting_complaints", label: "Presenting complaints", options: ["AUB", "Vaginal discharge", "Pelvic pain", "Dyspareunia", "None", "Other"] },
    { key: "other_complaint", label: "Other complaint" },
    { key: "previous_procedures", label: "Previous cervical procedures", options: ["None", "Colposcopy", "Cervical biopsy", "ECC", "Cone biopsy"] },
    { key: "medical_history", label: "Medical history", options: ["None", "HTN", "Diabetes", "TB", "HIV or immunosuppression", "Other"] },
    { key: "other_medical_history", label: "Other medical history" },
    { key: "prior_cancer", label: "Prior cancer", options: ["Yes", "No"] },
    { key: "prior_cancer_detail", label: "Prior cancer details" },
    { key: "family_cancer_history", label: "Family cancer history", options: ["Yes", "No"] },
    { key: "family_cancer_detail", label: "Family cancer details" },
  ] },
  { title: "Screening", fields: [
    { key: "pap_taken", label: "Pap smear taken", options: ["Yes", "No"] },
    { key: "pap_result", label: "Pap result", options: ["NILM", "ASC-US", "LSIL", "HSIL", "Invasive carcinoma", "Other"] },
    { key: "hpv_dna", label: "HPV DNA", options: ["Positive", "Negative"] },
    { key: "visit_date", label: "Visit date", type: "date" },
    { key: "via_findings", label: "Cervical examination / VIA findings", wide: true },
    { key: "pregnancy_status", label: "Pregnancy status", options: ["Not pregnant", "Pregnant"] },
    { key: "working_diagnosis", label: "Working impression (not a diagnosis)" },
    { key: "action_taken", label: "Action taken", wide: true },
  ] },
  { title: "Image reference", fields: [
    { key: "image_id", label: "Image ID" },
    { key: "image_capture_date", label: "Capture date", type: "date" },
    { key: "image_file_reference", label: "File reference" },
  ] },
];

const input = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm min-w-0";

function Box({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 min-w-0">{label}{children}</label>;
}

/** The spreadsheet as a form. A blank stays blank, which the record shows as not entered, never as negative. */
export function ReferralIntake({ staff }: { staff: StaffProfile }) {
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [core, setCore] = useState({ patient_name: "", age: "", phone: "", family_phone: "", area: "", health_post: staff.health_post ?? "", red_flags: "" });
  const [form, setForm] = useState<Record<string, string>>({});
  const [messageConsent, setMessageConsent] = useState<"" | "GRANTED" | "WITHHELD">("");
  const [familyConsent, setFamilyConsent] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [refer, setRefer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Referral | null>(null);

  useEffect(() => { referralApi.board().then((b) => setRoutes(b.routes)).catch((e) => setError(e.message)); }, []);

  const finding = useMemo(() => {
    const parts = [form.via_findings && `VIA: ${form.via_findings}`, form.pap_result && `Pap: ${form.pap_result}`, form.hpv_dna && `HPV DNA: ${form.hpv_dna}`].filter(Boolean);
    return parts.join("; ");
  }, [form.via_findings, form.pap_result, form.hpv_dna]);
  const posts = staff.health_post ? [staff.health_post] : Object.keys(routes);
  const hospital = routes[core.health_post];
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!finding) return setError("Enter the VIA or Pap result before referring.");
    if (refer && !hospital) return setError("This health post has no route. Please ask the administrator to set one.");
    setBusy(true);
    try {
      const entered = Object.fromEntries(Object.entries(form).filter(([, v]) => v));
      setSaved(await referralApi.create({
        patient_name: core.patient_name, age: core.age ? Number(core.age) : null, area: core.area, phone: core.phone,
        family_phone: core.family_phone, health_post: core.health_post, screening_finding: finding, red_flags: core.red_flags,
        urgent, refer, message_consent: messageConsent || null, family_consent: familyConsent, form: entered,
      }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The referral could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-3" data-testid="intake-saved">
        <CheckCircle2 className="size-6 text-emerald-700" />
        <h1 className="text-lg font-bold">Referral saved</h1>
        <p className="text-sm text-slate-600">{saved.hospital ? `${saved.patient_name} is referred to ${saved.hospital}. Follow-up starts today and closes when the hospital confirms arrival.` : `Screening recorded for ${saved.patient_name}. Routine rescreening, no referral.`}</p>
        {saved.hospital && saved.message_consent !== "GRANTED" && <p className="text-sm text-amber-800">No reminders will go out, because message consent was not recorded.</p>}
        <button className="self-start h-10 rounded-lg bg-black text-white px-4 text-sm font-semibold cursor-pointer" onClick={() => { setSaved(null); setForm({}); setCore((c) => ({ ...c, patient_name: "", age: "", phone: "", family_phone: "", red_flags: "" })); setMessageConsent(""); setFamilyConsent(false); setUrgent(false); }}>New intake</button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" data-testid="referral-intake">
      <header>
        <h1 className="text-xl font-bold">Screening intake</h1>
        <p className="text-sm text-slate-500 mt-1">Fill what you have. Blank fields stay as not entered. The health post decides the hospital.</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <h2 className="sm:col-span-2 text-sm font-bold">Patient</h2>
        <Box label="Full name"><input required minLength={2} className={input} value={core.patient_name} onChange={(e) => setCore({ ...core, patient_name: e.target.value })} data-testid="intake-name" /></Box>
        <Box label="Age"><input type="number" min={9} max={110} className={input} value={core.age} onChange={(e) => setCore({ ...core, age: e.target.value })} /></Box>
        <Box label="Contact number"><input inputMode="tel" className={input} value={core.phone} onChange={(e) => setCore({ ...core, phone: e.target.value })} /></Box>
        <Box label="Area"><input className={input} value={core.area} onChange={(e) => setCore({ ...core, area: e.target.value })} /></Box>
        <Box label="Health post">
          <select required className={input} value={core.health_post} disabled={!!staff.health_post} onChange={(e) => setCore({ ...core, health_post: e.target.value })} data-testid="intake-post">
            <option value="">Choose</option>{posts.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Box>
        <Box label="Referral hospital (fixed route)"><input readOnly className={`${input} bg-slate-50`} value={hospital ?? ""} data-testid="intake-hospital" /></Box>
      </section>
      {SECTIONS.map((s) => (
        <details key={s.title} open={s.title === "Screening"} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <summary className="text-sm font-bold cursor-pointer">{s.title}</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {s.fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                <Box label={f.label}>
                  {f.options ? (
                    <select className={input} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} data-testid={`field-${f.key}`}>
                      <option value="">Not entered</option>
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                      {GAPS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type ?? "text"} className={input} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} data-testid={`field-${f.key}`} />
                  )}
                </Box>
              </div>
            ))}
          </div>
        </details>
      ))}
      <DocumentWorkspace onUseInIntake={(summary) => set("document_summary", summary)} />
      {form.document_summary && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 break-words">{form.document_summary}</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold">Red flags and consent</h2>
        <Box label="Red flags"><input className={input} value={core.red_flags} onChange={(e) => setCore({ ...core, red_flags: e.target.value })} /></Box>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Mark as urgent</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!refer} onChange={(e) => setRefer(!e.target.checked)} data-testid="intake-routine" />Routine screening, no referral needed</label>
        <Box label="Consent for reminder messages">
          <select className={input} value={messageConsent} onChange={(e) => setMessageConsent(e.target.value as typeof messageConsent)} data-testid="intake-consent">
            <option value="">Not asked</option><option value="GRANTED">She agreed</option><option value="WITHHELD">She did not agree</option>
          </select>
        </Box>
        <Box label="Family contact number"><input inputMode="tel" className={input} value={core.family_phone} onChange={(e) => setCore({ ...core, family_phone: e.target.value })} /></Box>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={familyConsent} onChange={(e) => setFamilyConsent(e.target.checked)} />She separately agreed to reminders to this family contact</label>
      </section>
      {error && <p className="text-sm text-rose-800" role="alert">{error}</p>}
      <button disabled={busy} className="h-12 rounded-lg bg-black text-white text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" data-testid="intake-submit">
        {busy && <Loader2 className="size-4 animate-spin" />}{refer ? "Save and refer" : "Save screening"}
      </button>
    </form>
  );
}
