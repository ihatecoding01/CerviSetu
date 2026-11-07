import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";

const input = "mt-1 w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";
const label = "block text-sm font-semibold text-slate-800";
const TYPES = ["Hospital", "Health post or clinic", "NGO", "Municipal or government body", "Other"];
const STEPS = ["Tell us about your organisation", "We discuss your screening and referral needs", "We plan the rollout with your team"];

/** Page for organisations that want to join the programme. Front end only: nothing entered here is sent or stored. */
export function BookScreening({ onBack }: { onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><CerviSetuLogo className="size-9" /><span className="font-bold">CerviSetu</span></div>
          <button type="button" onClick={onBack} className="min-h-11 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold cursor-pointer" data-testid="book-back"><ArrowLeft className="size-4" aria-hidden="true" />Back to Home</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 lg:gap-12">
        <section>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">Bring CerviSetu to your organisation</h1>
          <p className="mt-4 text-slate-600">Join the programme to connect cervical screening, hospital referral and 14-day follow-up for the women you serve.</p>
          <h2 className="mt-8 text-sm font-bold">How it works</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-slate-700"><span className="size-7 shrink-0 rounded-full bg-[#E0F2FE] text-[#0369A1] font-bold flex items-center justify-center">{i + 1}</span><span className="pt-1">{step}</span></li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-bold">Join the Programme</h2>
          <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="book-form">
            <label className={`${label} sm:col-span-2`}>Organisation name<input required minLength={2} maxLength={120} className={input} data-testid="book-org" /></label>
            <label className={label}>Organisation type
              <select required defaultValue="" className={input}><option value="" disabled>Select</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className={label}>City<input required maxLength={80} className={input} /></label>
            <label className={label}>Contact person<input required maxLength={120} className={input} /></label>
            <label className={label}>Work email<input required type="email" maxLength={120} className={input} /></label>
            <label className={`${label} sm:col-span-2`}>What would you like to do?<textarea rows={3} maxLength={500} className={`${input} py-2`} /></label>
            <button type="submit" className="sm:col-span-2 min-h-12 rounded-xl bg-[#9D174D] px-4 text-sm font-semibold text-white cursor-pointer" data-testid="book-submit">Send Request</button>
          </form>
          {submitted && <p role="status" className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900" data-testid="book-note">Online requests are not open yet, so this was not sent or saved.</p>}
        </section>
      </main>
    </div>
  );
}
