import React, { useEffect, useState } from "react";
import { Heart, MapPin, Volume2 } from "lucide-react";
import { referralApi, type Referral } from "../../api/referrals";
import { ReferralJourney } from "./ReferralJourney";
import { LanguageSwitch } from "../common/LanguageSwitch";

interface Props {
  patientToken?: string;
  onExitToGateway?: () => void;
}

const EXPECT = [
  { title: "Colposcopy", body: "A doctor looks closely at the cervix. It usually takes a short time in the outpatient clinic." },
  { title: "Biopsy, if needed", body: "A small tissue sample may be taken. The report confirms what the finding means." },
  { title: "Your plan", body: "The hospital team explains the result and the next step with you and your family." },
];

export const PatientCompanion: React.FC<Props> = ({ patientToken, onExitToGateway }) => {
  const [referral, setReferral] = useState<Referral | null>(null);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [currentToken, setCurrentToken] = useState(patientToken || "");
  const [state, setState] = useState<"loading" | "ready" | "missing" | "login">("loading");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setState("loading");
    referralApi.board()
      .then((b) => {
        setAllReferrals(b.referrals);
        const target = currentToken || patientToken || b.referrals[0]?.patient_token || "PT-CASE-BINDU";
        const found = b.referrals.find((r) => r.patient_token === target) ?? b.referrals[0] ?? null;
        if (found) {
          setCurrentToken(found.patient_token);
          setReferral(found);
          setState("ready");
        } else {
          setState("missing");
        }
      })
      .catch(() => setState("login"));
  }, [patientToken, currentToken]);

  const selectPatient = (tok: string) => {
    setCurrentToken(tok);
    const found = allReferrals.find((r) => r.patient_token === tok) ?? null;
    if (found) setReferral(found);
  };

  const listen = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("नमस्ते। आपकी अस्पताल की जाँच बाकी है। कृपया जल्द अस्पताल जाएँ। मदद चाहिए तो अपनी स्वास्थ्य कार्यकर्ता से बात करें।");
    u.lang = "hi-IN";
    window.speechSynthesis.speak(u);
  };

  const reply = async (id: string, label: string) => {
    if (!referral) return;
    try {
      await referralApi.reply(referral.referral_id, id);
      setNotice(`${label}: your care team can see this.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "This could not be saved.");
    }
  };

  const wrap = (body: React.ReactNode) => (
    <div className="min-h-screen bg-[#FAFAFA] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">{body}</div>
    </div>
  );

  if (state !== "ready" || !referral) {
    return wrap(
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center text-sm text-slate-700">
        {state === "loading" ? "Loading..." : state === "login" ? "Please log in to see this record." : "No referral record was found for this patient."}
        {state !== "loading" && onExitToGateway && (
          <button onClick={onExitToGateway} className="block mx-auto mt-4 px-5 py-2 rounded-full bg-black text-white text-xs font-semibold">Go to Log In</button>
        )}
      </div>,
    );
  }

  return wrap(
    <>
      {allReferrals.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-black/10 shadow-2xs text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-900">Clinician Preview:</span>
            <span>Switch patient perspective:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {allReferrals.slice(0, 5).map((r) => (
              <button
                key={r.referral_id}
                type="button"
                onClick={() => selectPatient(r.patient_token)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  referral.patient_token === r.patient_token
                    ? "bg-[#0369A1] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {r.patient_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-[#9D174D]/10 flex items-center justify-center shrink-0"><Heart className="size-6 text-[#9D174D]" /></div>
          <div>
            <p className="text-lg font-bold text-black">Namaste, {referral.patient_name}</p>
            <p className="text-xs font-mono text-slate-600 mt-1">{referral.patient_token}</p>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5"><MapPin className="size-3.5 text-slate-400" />{referral.health_post}</p>
            {referral.fictional && <p className="text-xs font-semibold text-[#9D174D] mt-1">Fictional patient record</p>}
          </div>
        </div>
        <LanguageSwitch />
      </div>

      <section className="bg-white rounded-3xl border border-slate-200/90 p-6">
        <h2 className="text-base font-bold text-black mb-4">Your Care Journey</h2>
        <ReferralJourney referral={referral} />
      </section>

      {referral.following && (
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6">
          <h2 className="text-base font-bold text-black mb-1">Tell Your Care Team</h2>
          <p className="text-xs text-slate-600 mb-4">The same three choices are in your reminder call.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[["VISITED", "I Have Visited"], ["NEEDS_HELP", "I Need Help"], ["NURSE_CALL_BACK", "Call Me Back"]].map(([id, label]) => (
              <button key={id} onClick={() => reply(id, label)} className="min-h-12 px-4 rounded-xl border-2 border-[#9D174D] text-sm font-semibold text-black hover:bg-[#9D174D]/5 cursor-pointer">{label}</button>
            ))}
          </div>
          {notice && <p role="status" className="text-xs font-medium text-emerald-800 mt-3">{notice}</p>}
          <button onClick={listen} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-black underline cursor-pointer"><Volume2 className="size-4" /> Listen to the Reminder in Hindi</button>
        </section>
      )}

      <section className="bg-white rounded-3xl border border-slate-200/90 p-6">
        <h2 className="text-base font-bold text-black mb-4">What to Expect at the Hospital</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EXPECT.map((e) => (
            <div key={e.title} className="rounded-xl bg-[#F8F9FA] border border-slate-200 p-3.5">
              <div className="text-sm font-bold text-black">{e.title}</div>
              <p className="text-xs text-slate-600 mt-1">{e.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>,
  );
};
