import { ScanToFill } from "../app/ScanToFill";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileText, Loader2, Sparkles, X } from "lucide-react";
import { referralApi, STATUS_LABELS, type AshaRegistration, type DuplicateMatch, type Referral } from "../../api/referrals";
import type { StaffProfile } from "../../api/staff";
import { Notice } from "../app/Status";
import { btn, ui } from "../app/ui";

/**
 * ASHA registers a woman screened at her own health post. The server sets the health post and the ASHA from her
 * session, routes the referral, and keeps findings from ASHA views. No clinical results are entered here.
 */
const STEPS = ["Patient", "Screening", "Consent", "Documents", "Review"];
const LANGS = [["hi", "Hindi"], ["mr", "Marathi"], ["bho", "Bhojpuri"], ["bn", "Bengali"], ["ta", "Tamil"], ["te", "Telugu"], ["en", "English"]];
const METHODS = [["VIA", "VIA (vinegar test)"], ["VILI", "VILI (iodine test)"], ["PAP", "Pap smear"], ["HPV", "HPV test"], ["OTHER", "Other"]];
const RESULTS = [["POSITIVE", "Positive"], ["SUSPICIOUS", "Suspicious"], ["INCONCLUSIVE", "Inconclusive"], ["NEGATIVE", "Negative"]];
const DOC_KINDS = [["SCREENING_REPORT", "Screening report"], ["REFERRAL_SLIP", "Referral slip"], ["OTHER_REPORT", "Other report"]];
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/png", "image/jpeg"];
const today = () => new Date().toISOString().slice(0, 10);
const label = (list: string[][], v: string) => list.find(([k]) => k === v)?.[1] ?? v;

const DEMO_PREFILL_POOL = [
  {
    patient_name: "Kavita Patil",
    age: "36",
    phone: "9820145672",
    preferred_language: "mr",
    area: "Malvani Sector 4",
    screening_method: "VIA",
    screening_result: "POSITIVE",
    refer: "yes",
    notes: "Prefers evening voice calls after 5:00 PM.",
    consent_contact: "GRANTED",
    consent_followup: "GRANTED",
  },
  {
    patient_name: "Sunita More",
    age: "42",
    phone: "9833214589",
    preferred_language: "mr",
    area: "Dharavi Kumbharwada",
    screening_method: "VIA",
    screening_result: "SUSPICIOUS",
    refer: "yes",
    notes: "Available on daughter phone post 4:30 PM.",
    consent_contact: "GRANTED",
    consent_followup: "GRANTED",
  },
  {
    patient_name: "Amina Shaikh",
    age: "39",
    phone: "9876543210",
    preferred_language: "hi",
    area: "Govandi Shivaji Nagar",
    screening_method: "PAP",
    screening_result: "POSITIVE",
    refer: "yes",
    notes: "Contact morning before household shift.",
    consent_contact: "GRANTED",
    consent_followup: "GRANTED",
  },
  {
    patient_name: "Pooja Jadhav",
    age: "34",
    phone: "9819876543",
    preferred_language: "mr",
    area: "Worli Koliwada",
    screening_method: "HPV",
    screening_result: "POSITIVE",
    refer: "yes",
    notes: "Prefers WhatsApp reminder in Marathi.",
    consent_contact: "GRANTED",
    consent_followup: "GRANTED",
  },
];

interface Doc { file: File; kind: string; state: "ready" | "saving" | "saved" | "failed"; error?: string }

function Field({ label: l, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className={ui.label}>{l}</span>{children}{hint && <span className="text-xs text-slate-500">{hint}</span>}</label>;
}

function Choice({ name, value, options, onChange, testid }: { name: string; value: string; options: string[][]; onChange: (v: string) => void; testid: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} data-testid={`${testid}-${v}`}
          className={`min-h-11 rounded-md border px-3 text-sm font-semibold cursor-pointer ${value === v ? "border-[#0369A1] bg-sky-50 text-[#075985]" : "border-black/10 bg-white text-slate-700"}`}>{l}</button>
      ))}
    </div>
  );
}

export function RegisterPatient({ staff, centre, onCancel, onOpen, onDone }: {
  staff: StaffProfile; centre: string | null; onCancel: () => void; onOpen: (referralId: string) => void; onDone: (r: Referral) => void;
}) {
  const [step, setStep] = useState(0);
  const [profileIdx, setProfileIdx] = useState(0);
  const sample = DEMO_PREFILL_POOL[profileIdx % DEMO_PREFILL_POOL.length];
  const [f, setF] = useState({
    patient_name: sample.patient_name,
    age: sample.age,
    phone: sample.phone,
    preferred_language: sample.preferred_language,
    area: sample.area,
    screening_date: today(),
    screening_method: sample.screening_method,
    screening_result: sample.screening_result,
    refer: sample.refer,
    referral_date: today(),
    notes: sample.notes,
    consent_contact: sample.consent_contact,
    consent_followup: sample.consent_followup,
  });

  const fillSample = (nextIdx?: number) => {
    const idx = nextIdx ?? (profileIdx + 1);
    const p = DEMO_PREFILL_POOL[idx % DEMO_PREFILL_POOL.length];
    setProfileIdx(idx);
    setF({
      patient_name: p.patient_name,
      age: p.age,
      phone: p.phone,
      preferred_language: p.preferred_language,
      area: p.area,
      screening_date: today(),
      screening_method: p.screening_method,
      screening_result: p.screening_result,
      refer: p.refer,
      referral_date: today(),
      notes: p.notes,
      consent_contact: p.consent_contact,
      consent_followup: p.consent_followup,
    });
    setMatches(null);
    setError(null);
  };

  const [docs, setDocs] = useState<Doc[]>([]);
  const [docKind, setDocKind] = useState("SCREENING_REPORT");
  const [docConsent, setDocConsent] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Referral | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const phoneOk = !f.phone || /^(\+91[ -]?)?[6-9]\d{9}$/.test(f.phone.replace(/\s/g, ""));
  const [consentAt, setConsentAt] = useState("");
  const answer = (k: "consent_contact" | "consent_followup", v: string) => { set(k, v); setConsentAt(new Date().toLocaleString()); };

  const problem = (i: number): string | null => {
    if (i === 0) {
      if (f.patient_name.trim().length < 2) return "Enter her full name.";
      if (f.age && (Number(f.age) < 9 || Number(f.age) > 110)) return "Age must be between 9 and 110.";
      if (!phoneOk) return "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";
      if (f.area.trim().length < 2) return "Enter her area or locality.";
    }
    if (i === 1) {
      if (!f.screening_date || f.screening_date > today()) return "Enter the screening date. It cannot be in the future.";
      if (!f.screening_method || !f.screening_result) return "Choose the screening method and result.";
      if (!f.refer) return "Choose whether a referral is needed.";
      if (f.refer === "yes" && !centre) return "Your health post has no referral centre set. Please ask the administrator.";
      if (f.refer === "yes" && (f.referral_date < f.screening_date || f.referral_date > today())) return "The referral date must be between the screening date and today.";
    }
    if (i === 2 && (!f.consent_contact || !f.consent_followup)) return "Ask her both questions and record her answers.";
    if (i === 3 && docs.length > 0 && !docConsent) return "Record her consent before attaching her documents, or remove them.";
    return null;
  };

  const next = async () => {
    const p = problem(step);
    setError(p);
    if (p) return;
    if (step === 0) {
      // Check for an existing record at this health post before creating another one
      setBusy(true);
      try {
        const found = (await referralApi.duplicates({ name: f.patient_name.trim(), phone: f.phone })).matches;
        if (found.length && matches === null) { setMatches(found); setBusy(false); return; }
      } catch { /* the server checks again on save; a failed check does not block registration */ }
      setBusy(false);
    }
    setStep((s) => s + 1);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const add: Doc[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPT.includes(file.type)) { setError(`${file.name}: only PDF, PNG or JPEG files are accepted.`); continue; }
      if (file.size > MAX_BYTES) { setError(`${file.name}: the file is larger than 10 MB.`); continue; }
      add.push({ file, kind: docKind, state: "ready" });
    }
    setDocs((d) => [...d, ...add].slice(0, 5));
  };

  const submit = async () => {
    for (let i = 0; i < 4; i++) { const p = problem(i); if (p) { setError(p); setStep(i); return; } }
    setBusy(true); setError(null);
    try {
      const body: AshaRegistration = { request_id: requestId, patient_name: f.patient_name.trim(), age: f.age ? Number(f.age) : null,
        phone: f.phone.replace(/\s/g, ""), preferred_language: f.preferred_language, area: f.area.trim(), screening_date: f.screening_date,
        screening_method: f.screening_method, screening_result: f.screening_result, refer: f.refer === "yes",
        referral_date: f.refer === "yes" ? f.referral_date : "", notes: f.notes.trim(), consent_contact: f.consent_contact, consent_followup: f.consent_followup };
      const rec = await referralApi.register(body);
      const results: Doc[] = [];
      for (const d of docs) {
        try { await referralApi.upload(rec.referral_id, d.kind, d.file, docConsent); results.push({ ...d, state: "saved" }); }
        catch (e) { results.push({ ...d, state: "failed", error: e instanceof Error ? e.message : "Not saved" }); }
      }
      setDocs(results);
      setSaved(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration could not be saved. Please try again.");
    } finally { setBusy(false); }
  };

  if (saved) {
    const failed = docs.filter((d) => d.state === "failed");
    return (
      <section className={`${ui.panel} p-5 flex flex-col gap-3`} data-testid="register-saved">
        <Check className="size-6 text-emerald-700" />
        <h2 className={ui.h2}>{`${saved.patient_name} is registered`}</h2>
        <p className="text-sm text-slate-700">{saved.status === "DECLINED"
          ? "She did not agree to follow-up, so no reminders will be sent. A doctor will review her decision."
          : saved.hospital ? `She is referred to ${saved.hospital} and is now in your follow-ups.` : "Her screening is recorded. No referral is needed."}</p>
        {docs.length > 0 && <p className="text-sm text-slate-700">{`${docs.length - failed.length} of ${docs.length} documents attached.`}</p>}
        {failed.map((d) => <Notice key={d.file.name} tone="attention">{`${d.file.name}: ${d.error}`}</Notice>)}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn("primary")} onClick={() => onDone(saved)} data-testid="register-open">Open her follow-up</button>
          <button type="button" className={btn("secondary")} onClick={onCancel}>Back to my list</button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${ui.panel} p-4 sm:p-5 flex flex-col gap-4`} data-testid="register-patient" aria-labelledby="register-title">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} aria-label="Close registration" className="p-1.5 -ml-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"><ArrowLeft className="size-5" /></button>
        <h2 id="register-title" className={ui.h2}>Register patient</h2>
      </div>

      <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-xs">
        <div className="flex items-center gap-2 text-sky-900 font-medium">
          <Sparkles className="size-4 text-[#0284C7] shrink-0" />
          <span>Demo profile loaded: <strong>{f.patient_name}</strong>. Advance through steps by clicking <strong>Continue</strong>.</span>
        </div>
        <button
          type="button"
          onClick={() => fillSample()}
          className="text-xs font-semibold text-[#0369A1] hover:underline px-2.5 py-1 rounded bg-white border border-sky-200 shrink-0 cursor-pointer shadow-2xs"
          data-testid="reg-next-sample"
        >
          🎲 Next Sample
        </button>
      </div>
      <ol className="flex gap-1" aria-label="Steps">
        {STEPS.map((s, i) => <li key={s} className={`flex-1 border-t-2 pt-1.5 text-[11px] font-semibold ${i < step ? "border-emerald-600 text-emerald-800" : i === step ? "border-[#0369A1] text-[#075985]" : "border-slate-200 text-slate-400"}`} aria-current={i === step ? "step" : undefined}>{s}</li>)}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><ScanToFill allowed={["patient_name", "age", "phone", "area", "preferred_language", "screening_date", "screening_method", "screening_result", "refer", "referral_date", "notes"]}
            onApply={(v) => {
              const resUpper = (v.screening_result || "").toUpperCase();
              const needsRefer = resUpper === "POSITIVE" || resUpper === "SUSPICIOUS" || resUpper === "INCONCLUSIVE";
              setF((cur) => ({
                ...cur,
                ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "screening_method" || k === "screening_result" ? x.toUpperCase() : k === "phone" ? x.replace(/\D/g, "").slice(-10) : x])),
                refer: v.refer || (needsRefer ? "yes" : (cur.refer || (v.screening_result ? "no" : "yes"))),
                referral_date: v.referral_date || v.screening_date || cur.referral_date,
                preferred_language: v.preferred_language || cur.preferred_language || "hi",
                consent_contact: "GRANTED",
                consent_followup: "GRANTED",
              }));
              setMatches(null);
            }} /></div>
          <div className="sm:col-span-2"><Field label="Full name"><input className={ui.input} value={f.patient_name} onChange={(e) => { set("patient_name", e.target.value); setMatches(null); }} data-testid="reg-name" autoComplete="off" /></Field></div>
          <Field label="Age (optional)"><input type="number" inputMode="numeric" min={9} max={110} className={ui.input} value={f.age} onChange={(e) => set("age", e.target.value)} data-testid="reg-age" /></Field>
          <Field label="Mobile number (optional)" hint="10 digits"><input type="tel" inputMode="tel" className={ui.input} value={f.phone} onChange={(e) => { set("phone", e.target.value); setMatches(null); }} data-testid="reg-phone" /></Field>
          <Field label="Preferred language"><select className={ui.input} value={f.preferred_language} onChange={(e) => set("preferred_language", e.target.value)} data-testid="reg-lang"><option value="">Choose</option>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Area or locality"><input className={ui.input} value={f.area} onChange={(e) => set("area", e.target.value)} data-testid="reg-area" /></Field>
          <Field label="Health post"><input readOnly className={`${ui.input} bg-slate-50`} value={staff.health_post ?? ""} /></Field>
          <Field label="ASHA worker"><input readOnly className={`${ui.input} bg-slate-50`} value={staff.name} /></Field>
          {matches && matches.length > 0 && (
            <div className="sm:col-span-2 flex flex-col gap-2" data-testid="reg-duplicates">
              <Notice tone="attention">She may already be registered at your health post. Check before adding her again.</Notice>
              <ul className="rounded-md border border-black/10 divide-y divide-black/[0.06]">
                {matches.map((m) => (
                  <li key={m.referral_id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0"><span className="font-semibold">{m.patient_name}</span><span className="block text-xs text-slate-500">{`${m.area} · ${STATUS_LABELS[m.status] ?? m.status}`}</span></span>
                    {m.yours ? <button type="button" className={btn("secondary")} onClick={() => onOpen(m.referral_id)}>Open her record</button>
                      : <span className="text-xs text-slate-500">Assigned to another worker. Ask your nurse.</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">If this is a different woman, press Continue to register her.</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Screening date"><input type="date" max={today()} className={ui.input} value={f.screening_date} onChange={(e) => set("screening_date", e.target.value)} data-testid="reg-screen-date" /></Field>
          <Field label="Screening method"><select className={ui.input} value={f.screening_method} onChange={(e) => set("screening_method", e.target.value)} data-testid="reg-method"><option value="">Choose</option>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Screening result"><select className={ui.input} value={f.screening_result} onChange={(e) => set("screening_result", e.target.value)} data-testid="reg-result"><option value="">Choose</option>{RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field></div>
          <div className="sm:col-span-2 flex flex-col gap-1.5"><span className={ui.label}>Referral needed?</span><Choice name="Referral needed" value={f.refer} onChange={(v) => set("refer", v)} options={[["yes", "Yes"], ["no", "No"]]} testid="reg-refer" /></div>
          {f.refer === "yes" && <>
            <Field label="Referral centre" hint="Set by your health post's route"><input readOnly className={`${ui.input} bg-slate-50`} value={centre ?? "No route set"} data-testid="reg-centre" /></Field>
            <Field label="Referral date"><input type="date" min={f.screening_date} max={today()} className={ui.input} value={f.referral_date} onChange={(e) => set("referral_date", e.target.value)} /></Field>
          </>}
          <div className="sm:col-span-2"><Field label="Notes for follow-up (optional)" hint="For example, the best time to call. Do not write a diagnosis."><textarea maxLength={400} rows={2} className={`${ui.input} py-2 h-auto`} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">Ask her in her language. Do not choose for her.</p>
          <div className="flex flex-col gap-1.5"><span className={ui.label}>May the care team contact her by phone or message?</span><Choice name="Contact consent" value={f.consent_contact} onChange={(v) => answer("consent_contact", v)} options={[["GRANTED", "She agreed"], ["WITHHELD", "She did not agree"]]} testid="reg-contact" /></div>
          <div className="flex flex-col gap-1.5"><span className={ui.label}>Does she agree to follow-up until she reaches the hospital?</span><Choice name="Follow-up consent" value={f.consent_followup} onChange={(v) => answer("consent_followup", v)} options={[["GRANTED", "She agreed"], ["WITHHELD", "She did not agree"]]} testid="reg-followup" /></div>
          {f.consent_contact === "WITHHELD" && <Notice tone="guidance">No reminder messages will be sent to her.</Notice>}
          {f.consent_followup === "WITHHELD" && <Notice tone="attention">Her referral will be marked as declined and a doctor will review it.</Notice>}
          {f.consent_contact && f.consent_followup && <p className="text-xs text-slate-500">{`Recorded by ${staff.name} on ${consentAt}.`}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">Optional. Attach her screening report or referral slip. PDF, PNG or JPEG, up to 10 MB each.</p>
          <label className="flex items-start gap-2 text-sm min-h-11"><input type="checkbox" className="size-4 mt-0.5" checked={docConsent} onChange={(e) => setDocConsent(e.target.checked)} data-testid="reg-doc-consent" />She agreed that her documents can be stored with her record.</label>
          <div className="flex flex-wrap gap-2 items-end">
            <Field label="Document type"><select className={`${ui.input} w-auto`} value={docKind} onChange={(e) => setDocKind(e.target.value)} data-testid="reg-doc-kind">{DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <label className={btn("secondary", docConsent ? "" : "opacity-50 pointer-events-none")}>Choose file<input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple disabled={!docConsent} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="reg-doc-file" /></label>
          </div>
          {docs.length > 0 && (
            <ul className="rounded-md border border-black/10 divide-y divide-black/[0.06]" data-testid="reg-doc-list">
              {docs.map((d, i) => (
                <li key={`${d.file.name}-${i}`} className="p-2.5 flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-slate-500 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{d.file.name}<span className="block text-xs text-slate-500">{`${label(DOC_KINDS, d.kind)} · ${(d.file.size / 1024).toFixed(0)} KB · ready to attach`}</span></span>
                  <button type="button" aria-label={`Remove ${d.file.name}`} onClick={() => setDocs((x) => x.filter((_, j) => j !== i))} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer" data-testid="reg-doc-remove"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 4 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm" data-testid="reg-review">
          {([
            ["Name", f.patient_name], ["Age", f.age], ["Mobile", f.phone], ["Language", label(LANGS, f.preferred_language)], ["Area", f.area],
            ["Health post", staff.health_post ?? ""], ["Screening", `${label(METHODS, f.screening_method)}, ${f.screening_date}`], ["Result", label(RESULTS, f.screening_result)],
            ["Referral", f.refer === "yes" ? `${centre}, ${f.referral_date}` : "Not needed"], ["Contact consent", f.consent_contact === "GRANTED" ? "She agreed" : "She did not agree"],
            ["Follow-up consent", f.consent_followup === "GRANTED" ? "She agreed" : "She did not agree"], ["Documents", docs.length ? docs.map((d) => d.file.name).join(", ") : "None"],
          ] as [string, string][]).map(([k, v]) => <div key={k} className="min-w-0"><dt className={ui.label}>{k}</dt><dd className={v ? "break-words" : "text-slate-400"}>{v || "Not entered"}</dd></div>)}
        </dl>
      )}

      {error && <Notice tone="critical" role="alert">{error}</Notice>}
      <div className="flex justify-between gap-2">
        <button type="button" className={btn("secondary")} disabled={busy} onClick={() => { setError(null); if (step === 0) onCancel(); else setStep((s) => s - 1); }}>{step === 0 ? "Cancel" : "Back"}</button>
        {step < STEPS.length - 1
          ? <button key="next" type="button" className={btn("primary")} disabled={busy} onClick={next} data-testid="reg-next">{busy && <Loader2 className="size-4 animate-spin" />}Continue</button>
          : <button key="save" type="button" className={btn("primary")} disabled={busy} onClick={submit} data-testid="reg-submit">{busy && <Loader2 className="size-4 animate-spin" />}Register her</button>}
      </div>
    </section>
  );
}
