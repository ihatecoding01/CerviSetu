import React, { useEffect, useState } from "react";
import { ShieldCheck, Fingerprint, UserCheck, KeyRound, CheckCircle2, ArrowLeft, Printer } from "lucide-react";

import { AbdmError, post, printAbhaCard } from "../api/abdm";
import { OtpBoxes } from "./OtpBoxes";

const CONSENTS: { key: string; text: string }[] = [
  { key: "share_identity_with_nha", text: "I voluntarily share my Aadhaar / Virtual ID and demographic details with UIDAI and NHA to create my ABHA number and ABHA address." },
  { key: "link_health_records", text: "I consent to my ABHA address / number being used to link my legacy and future government health records." },
  { key: "share_records_with_providers", text: "I authorise sharing my health records with healthcare providers for this treatment encounter." },
  { key: "anonymised_public_health_use", text: "I consent to anonymised use of my health records for public health purposes." },
  { key: "admin_explained_consent", text: "I, the health worker, confirm I have informed and explained the above consents to the beneficiary in a language they understand." },
];

const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const verhoeff = (n: string) => n.split("").reverse().reduce((c, ch, i) => VD[c][VP[i % 8][+ch]], 0) === 0;
const group4 = (d: string) => d.replace(/(\d{4})(?=\d)/g, "$1 ");

// Returns [ok, message]; message explains what is wrong or confirms what was recognised
function checkIdentifier(mode: "GENERATE" | "LINK", value: string): [boolean, string] {
  const d = value.replace(/[\s-]/g, "");
  if (!value.trim()) return [false, ""];
  if (mode === "LINK") {
    if (/^\d{14}$/.test(d)) return [true, "ABHA number recognised"];
    if (/^[a-z0-9._]{4,32}@(sbx|abdm)$/i.test(value.trim())) return [true, "ABHA address recognised"];
    if (/^\d+$/.test(d)) return [false, `${d.length}/14 digits`];
    return [false, "Use a 14-digit ABHA number or name@sbx"];
  }
  if (!/^\d+$/.test(d)) return [false, "Digits only"];
  if (d.length === 16) return [true, "Virtual ID recognised"];
  if (d.length < 12) return [false, `${d.length}/12 digits`];
  if (d.length === 12) return /^[01]/.test(d) || !verhoeff(d) ? [false, "This Aadhaar number looks mistyped — please re-check"] : [true, "Aadhaar number looks valid"];
  return [false, `${d.length}/16 digits for Virtual ID`];
}

type Card = { label: string; abha_number: string; abha_address: string; full_name: string; mobile_masked: string | null; id_verified_via: string };

interface Props {
  onVerified: (patientToken: string) => void;
  onUseMobileLogin?: () => void;
}

export const AbhaRegistration: React.FC<Props> = ({ onVerified, onUseMobileLogin }) => {
  const [mode, setMode] = useState<"GENERATE" | "LINK">("GENERATE");
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [txnId, setTxnId] = useState<string | null>(null);
  const [sandboxOtp, setSandboxOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [card, setCard] = useState<(Card & { token: string; returning: boolean }) | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"ID" | "CONSENT">("ID");
  const [otpFocus, setOtpFocus] = useState(0);

  useEffect(() => {
    if (otp.length === 6 && txnId && !busy && !card) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const [idOk, idMsg] = checkIdentifier(mode, identifier);
  const mobileDigits = mobile.replace(/\D/g, "").slice(-10);
  const mobileOk = !mobile.trim() || /^[6-9]\d{9}$/.test(mobileDigits);
  const idReady = idOk && mobileOk;
  const consentCount = CONSENTS.filter((c) => consents[c.key]).length;
  const allConsented = CONSENTS.every((c) => consents[c.key]) && name.trim().length >= 2 && idReady;

  const requestOtp = async (method: "OTP" | "DEMOGRAPHICS" | "BIOMETRICS") => {
    setError("");
    setBusy(true);
    try {
      const r = await post<{ txn_id: string; sandbox_otp: string; otp_sent_to: string; resend_after_seconds: number }>("/otp/request", {
        mode, identifier, mobile: mobile || null, beneficiary_name: name, consents, method,
        link_token: mode === "LINK" && linkToken ? linkToken : null,
      });
      setTxnId(r.txn_id);
      setSandboxOtp(r.sandbox_otp);
      setSentTo(r.otp_sent_to);
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!txnId) return;
    setError("");
    try {
      const r = await post<{ sandbox_otp: string; resend_after_seconds: number }>("/otp/resend", { txn_id: txnId });
      setSandboxOtp(r.sandbox_otp);
      setCountdown(r.resend_after_seconds);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const verify = async () => {
    if (!txnId) return;
    setError("");
    setBusy(true);
    try {
      const r = await post<{ patient_token: string; abha_card: Card; returning: boolean }>("/otp/verify", { txn_id: txnId, otp });
      setCard({ ...r.abha_card, token: r.patient_token, returning: r.returning });
    } catch (e) {
      setError((e as Error).message);
      setErrorCode((e as AbdmError).code);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-black";
  const primary = "w-full py-3 bg-black hover:bg-black/85 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-full shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5";

  // Same lime privacy note used by the other login tabs
  const note = (title: string, body: React.ReactNode) => (
    <div className="bg-[#DBFE87]/20 border border-[#DBFE87] rounded-xl p-3 text-xs text-black flex items-start gap-2">
      <ShieldCheck className="size-4 text-black shrink-0 mt-0.5" />
      <div>
        <span className="font-bold">{title}</span>
        <p className="text-xs text-slate-700 mt-0.5">{body}</p>
      </div>
    </div>
  );

  const sandboxTag = (
    <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-mono font-bold">ABDM Sandbox</span>
  );

  const stepIndex = card ? 3 : txnId ? 2 : step === "CONSENT" ? 1 : 0;
  const STEPS = [
    { label: "पहचान", title: "Identify the beneficiary", help: "Enter the Aadhaar / Virtual ID (or existing ABHA) and mobile number." },
    { label: "सहमति", title: "Explain & record consent", help: "Read each item aloud to the beneficiary, then tick it." },
    { label: "OTP", title: "Enter the OTP", help: "Ask the beneficiary for the 6-digit code sent to their Aadhaar-linked mobile." },
    { label: "ABHA", title: "Synthetic ABHA ready", help: "Demo sandbox ID, not issued by ABDM. Check details with the beneficiary, then enter the portal." },
  ];
  // Completed steps are tappable to go back (not after the ABHA is issued)
  const goTo = (i: number) => {
    if (card || i >= stepIndex) return;
    setError("");
    setTxnId(null);
    setOtp("");
    setStep(i === 0 ? "ID" : "CONSENT");
  };
  const progress = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <ol className="flex gap-1.5" aria-label="Registration steps">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={!done || !!card}
                  aria-current={i === stepIndex ? "step" : undefined}
                  className={`text-[11px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 ${
                    i === stepIndex ? "bg-black text-white" : done ? "bg-[#DBFE87] text-black hover:bg-[#cdf26f] cursor-pointer" : "bg-slate-100 text-slate-400"
                  } disabled:cursor-default`}
                >
                  {done ? <CheckCircle2 className="size-3" /> : `${i + 1}.`} {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        {sandboxTag}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">
          Step {stepIndex + 1} of 4 · {STEPS[stepIndex].title}
        </p>
        <p className="text-xs text-slate-500">{STEPS[stepIndex].help}</p>
      </div>
    </div>
  );

  const hint = (text: string) => <p className="text-xs text-slate-500 text-center -mt-2">{text}</p>;

  const errorLine = error && (
    <div role="alert" className="text-xs text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-xl px-3 py-2">
      {error}
      {errorCode === "ALREADY_REGISTERED" && onUseMobileLogin && (
        <button type="button" onClick={onUseMobileLogin} className="block mt-1 font-semibold underline text-black cursor-pointer">
          Log in with Mobile OTP →
        </button>
      )}
    </div>
  );

  if (card) {
    return (
      <div className="space-y-4">
        {progress}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-black" /> {card.returning ? "Welcome back" : "ABHA कार्ड (ABHA Card)"}
            </span>
            <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-bold">Sandbox</span>
          </div>
          <p className="text-[11px] font-semibold text-[#BA2D0B]">{card.label}</p>
          {[
            ["ABHA Number", card.abha_number],
            ["ABHA Address", card.abha_address],
            ["Full Name", card.full_name],
            ["Mobile", card.mobile_masked],
            ["Verified via", card.id_verified_via],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono font-semibold text-slate-900 text-right">{v}</span>
              </div>
            ))}
        </div>
        {note("DPDP Act 2023 Token Isolation:", <>Your record maps to token <strong>{card.token}</strong>. Name and mobile are stored only in the encrypted vault.</>)}
        <button
          onClick={() =>
            printAbhaCard(
              [
                ["ABHA Number", card.abha_number],
                ["ABHA Address", card.abha_address],
                ["Full Name", card.full_name],
                ["Mobile", card.mobile_masked],
                ["Verified via", card.id_verified_via],
              ],
              card.label,
            )
          }
          className="w-full py-2.5 border border-slate-300 hover:border-black text-slate-800 font-semibold text-xs rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer className="size-3.5" /> Print / Save Demo ABHA Card
        </button>
        <button onClick={() => onVerified(card.token)} className={primary}>
          पोर्टल में प्रवेश करें (Enter Portal)
        </button>
      </div>
    );
  }

  if (txnId) {
    return (
      <div className="space-y-4">
        {progress}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">6-Digit OTP:</label>
            <span className="text-xs font-mono text-slate-500">{sentTo}</span>
          </div>
          <OtpBoxes value={otp} onChange={setOtp} focusKey={`${txnId}-${otpFocus}`} />
          <div className="flex justify-between items-center text-xs mt-2">
            <button onClick={() => goTo(1)} className="text-slate-500 hover:text-black flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="size-3" /> Change details
            </button>
            {countdown > 0 ? (
              <span className="text-slate-500 font-mono">Resend OTP in {countdown}s</span>
            ) : (
              <button onClick={resend} className="font-semibold text-black underline cursor-pointer">Resend OTP</button>
            )}
          </div>
        </div>
        {note("Sandbox OTP:", <>No SMS is sent until NHA gateway credentials are configured. Test code: <strong className="font-mono">{sandboxOtp}</strong>{" "}
          <button type="button" onClick={() => setOtp(sandboxOtp)} className="underline font-semibold cursor-pointer">Fill it</button></>)}
        {errorLine}
        <button disabled={otp.length !== 6 || busy} onClick={verify} className={primary}>
          {busy ? "Verifying…" : "OTP सत्यापित करें (Verify OTP)"}
        </button>
        {otp.length !== 6 && hint(`${6 - otp.length} more digit${6 - otp.length === 1 ? "" : "s"} — it verifies automatically`)}
      </div>
    );
  }

  if (step === "CONSENT") {
    return (
      <div className="space-y-4">
        {progress}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{consentCount}/5 accepted</span>
          <button
            type="button"
            onClick={() => setConsents(Object.fromEntries(CONSENTS.map((c) => [c.key, consentCount < 5])))}
            className="font-semibold text-black underline cursor-pointer"
          >
            {consentCount < 5 ? "Tick all (after explaining)" : "Clear all"}
          </button>
        </div>
        <div className="space-y-1">
          {CONSENTS.map((c) => (
            <label key={c.key} className={`flex items-start gap-2.5 text-xs leading-snug cursor-pointer rounded-xl p-2 border transition-colors ${consents[c.key] ? "border-[#DBFE87] bg-[#DBFE87]/15 text-slate-900" : "border-transparent hover:bg-slate-50 text-slate-700"}`}>
              <input
                type="checkbox"
                checked={!!consents[c.key]}
                onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })}
                className="mt-0.5 size-3.5 accent-black shrink-0"
              />
              <span>{c.text}</span>
            </label>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">लाभार्थी का नाम (Beneficiary Name):</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && allConsented && requestOtp("OTP")}
            placeholder="Name as on Aadhaar"
            className={input}
          />
          {name.trim() && (
            <p className="text-xs text-slate-500 mt-1">I, {name.trim()}, have been explained the above and hereby give my consent.</p>
          )}
        </div>
        {errorLine}
        <button disabled={!allConsented || busy} onClick={() => requestOtp("OTP")} className={primary}>
          <KeyRound className="size-3.5" /> {busy ? "Sending OTP…" : "Verify with OTP"}
        </button>
        {!allConsented && hint(consentCount < 5 ? `Tick ${5 - consentCount} more consent${5 - consentCount === 1 ? "" : "s"} to continue` : "Enter the beneficiary's name to continue")}
        <div className="grid grid-cols-2 gap-2">
          <button disabled title="Requires ABDM facility approval" className="py-2 border border-slate-200 text-slate-400 text-xs rounded-full flex items-center justify-center gap-1 cursor-not-allowed">
            <UserCheck className="size-3.5" /> Demographics
          </button>
          <button disabled title="Requires a UIDAI-certified RD device and ABDM approval" className="py-2 border border-slate-200 text-slate-400 text-xs rounded-full flex items-center justify-center gap-1 cursor-not-allowed">
            <Fingerprint className="size-3.5" /> Biometrics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {progress}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
        {(["GENERATE", "LINK"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setIdentifier(""); setError(""); }}
            className={`py-2 rounded-lg transition-all ${mode === m ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            {m === "GENERATE" ? "नया ABHA (Generate)" : "ABHA जोड़ें (Link)"}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">
          {mode === "GENERATE" ? "Aadhaar Number / Virtual ID:" : "ABHA Number / ABHA Address:"}
        </label>
        <input
          value={identifier}
          onChange={(e) => {
            const v = e.target.value;
            setIdentifier(/^[\d\s-]*$/.test(v) ? group4(v.replace(/\D/g, "").slice(0, 16)) : v);
          }}
          onKeyDown={(e) => e.key === "Enter" && idReady && setStep("CONSENT")}
          autoFocus
          autoComplete="off"
          aria-invalid={!!identifier && !idOk}
          placeholder={mode === "GENERATE" ? "12-digit Aadhaar or 16-digit VID" : "14-digit ABHA or name@sbx"}
          className={`${input} font-mono tracking-wider ${identifier && !idOk && idMsg.includes("re-check") ? "border-[#BA2D0B]" : ""}`}
        />
        {idMsg && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${idOk ? "text-black" : idMsg.includes("re-check") ? "text-[#BA2D0B]" : "text-slate-500"}`}>
            {idOk && <CheckCircle2 className="size-3" />} {idMsg}
          </p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Aadhaar-linked Mobile (optional):</label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && idReady && setStep("CONSENT")}
          inputMode="tel"
          placeholder="10-digit mobile"
          className={`${input} font-mono ${!mobileOk ? "border-[#BA2D0B]" : ""}`}
        />
        {!mobileOk && <p className="text-xs mt-1 text-[#BA2D0B]">Enter a 10-digit mobile starting with 6–9</p>}
      </div>
      {mode === "LINK" && (
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Existing CerviSetu Token (optional):</label>
          <input value={linkToken} onChange={(e) => setLinkToken(e.target.value)} placeholder="PT-RURAL-7891" className={`${input} font-mono`} />
        </div>
      )}
      {note("Simulated verification:", "This sandbox does not contact UIDAI or ABDM. Use test numbers only; Aadhaar is never stored (keyed hash + last 4 digits).")}
      <button disabled={!idReady} onClick={() => setStep("CONSENT")} className={primary}>
        आगे बढ़ें (Continue to Consent)
      </button>
      {!idReady && hint(mode === "GENERATE" ? "Enter a valid Aadhaar or Virtual ID to continue" : "Enter a valid ABHA number or address to continue")}
    </div>
  );
};
