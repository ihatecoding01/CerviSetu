import React, { useEffect, useState } from "react";
import { ShieldCheck, Fingerprint, UserCheck, KeyRound, CheckCircle2, ArrowLeft, Printer } from "lucide-react";
import { AbdmError, errorText, post, printAbhaCard } from "../../api/abdm";
import { usePatientLang, type PatientKey } from "../../i18n/patient";
import { OtpBoxes } from "./OtpBoxes";

const CONSENT_KEYS = [
  "share_identity_with_nha",
  "link_health_records",
  "share_records_with_providers",
  "anonymised_public_health_use",
  "admin_explained_consent",
] as const;

const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const verhoeff = (n: string) => n.split("").reverse().reduce((c, ch, i) => VD[c][VP[i % 8][+ch]], 0) === 0;
const group4 = (d: string) => d.replace(/(\d{4})(?=\d)/g, "$1 ");

type IdCheck = { ok: boolean; key?: PatientKey; vars?: Record<string, number>; error?: boolean };

// Live identifier feedback; the server repeats every check
function checkIdentifier(mode: "GENERATE" | "LINK", value: string): IdCheck {
  const d = value.replace(/[\s-]/g, "");
  if (!value.trim()) return { ok: false };
  if (mode === "LINK") {
    if (/^\d{14}$/.test(d)) return { ok: true, key: "abha.id.okAbhaNumber" };
    if (/^[a-z0-9._]{4,32}@(sbx|abdm)$/i.test(value.trim())) return { ok: true, key: "abha.id.okAbhaAddress" };
    if (/^\d+$/.test(d)) return { ok: false, key: "abha.id.digits", vars: { n: d.length, of: 14 } };
    return { ok: false, key: "abha.id.badLink" };
  }
  if (!/^\d+$/.test(d)) return { ok: false, key: "abha.id.digitsOnly", error: true };
  if (d.length === 16) return { ok: true, key: "abha.id.okVid" };
  if (d.length < 12) return { ok: false, key: "abha.id.digits", vars: { n: d.length, of: 12 } };
  if (d.length === 12)
    return /^[01]/.test(d) || !verhoeff(d)
      ? { ok: false, key: "abha.id.badAadhaar", error: true }
      : { ok: true, key: "abha.id.okAadhaar" };
  return { ok: false, key: "abha.id.digits", vars: { n: d.length, of: 16 } };
}

type Card = {
  abha_number: string;
  abha_address: string;
  full_name: string;
  mobile_masked: string | null;
  id_verified_via: string;
};

interface Props {
  onVerified: (patientToken: string) => void;
  onUseMobileLogin?: () => void;
}

export const AbhaRegistration: React.FC<Props> = ({ onVerified, onUseMobileLogin }) => {
  const { t } = usePatientLang();
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
  const [otpFocus, setOtpFocus] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [card, setCard] = useState<(Card & { token: string; returning: boolean }) | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"ID" | "CONSENT">("ID");

  const idCheck = checkIdentifier(mode, identifier);
  const mobileDigits = mobile.replace(/\D/g, "").slice(-10);
  const mobileOk = !mobile.trim() || /^[6-9]\d{9}$/.test(mobileDigits);
  const idReady = idCheck.ok && mobileOk;
  const consentCount = CONSENT_KEYS.filter((k) => consents[k]).length;
  const allConsented = consentCount === 5 && name.trim().length >= 2 && idReady;
  const errorCode = (error as AbdmError | null)?.code;

  useEffect(() => {
    if (otp.length === 6 && txnId && !busy && !card) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const requestOtp = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await post<{ txn_id: string; sandbox_otp: string; resend_after_seconds: number }>("/otp/request", {
        mode,
        identifier,
        mobile: mobile || null,
        beneficiary_name: name,
        consents,
        method: "OTP",
        link_token: mode === "LINK" && linkToken ? linkToken : null,
      });
      setTxnId(r.txn_id);
      setSandboxOtp(r.sandbox_otp);
      setSentTo(mobileDigits ? `******${mobileDigits.slice(-4)}` : "");
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
        setError(e);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!txnId) return;
    setError(null);
    try {
      const r = await post<{ sandbox_otp: string; resend_after_seconds: number }>("/otp/resend", { txn_id: txnId });
      setSandboxOtp(r.sandbox_otp);
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
      setError(e);
    }
  };

  const verify = async () => {
    if (!txnId) return;
    setError(null);
    setBusy(true);
    try {
      const r = await post<{ patient_token: string; abha_card: Card; returning: boolean }>("/otp/verify", { txn_id: txnId, otp });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("cervisetu_patient_session", r.patient_token);
      }
      setCard({ ...r.abha_card, token: r.patient_token, returning: r.returning });
    } catch (e) {
      setError(e);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full min-h-12 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black";
  const primary =
    "w-full min-h-12 py-3 bg-black hover:bg-black/85 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-full shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

  const note = (title: string, body: React.ReactNode) => (
    <div className="bg-[#DBFE87]/20 border border-[#DBFE87] rounded-xl p-3 text-xs text-black flex items-start gap-2">
      <ShieldCheck className="size-4 text-black shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <span className="font-bold">{title}</span>
        <p className="text-xs text-slate-700 mt-0.5">{body}</p>
      </div>
    </div>
  );

  const stepIndex = card ? 3 : txnId ? 2 : step === "CONSENT" ? 1 : 0;
  const STEPS: { label: PatientKey; title: PatientKey; help: PatientKey }[] = [
    { label: "abha.step1", title: "abha.step1.title", help: "abha.step1.help" },
    { label: "abha.step2", title: "abha.step2.title", help: "abha.step2.help" },
    { label: "abha.step3", title: "abha.step3.title", help: "abha.step3.help" },
    { label: "abha.step4", title: "abha.step4.title", help: "abha.step4.help" },
  ];
  // Completed steps are tappable to go back (not after the ABHA is issued)
  const goTo = (i: number) => {
    if (card || i >= stepIndex) return;
    setError(null);
    setTxnId(null);
    setOtp("");
    setStep(i === 0 ? "ID" : "CONSENT");
  };
  const progress = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <ol className="flex flex-wrap gap-1.5" aria-label={t("abha.step", { n: stepIndex + 1 })}>
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={!done || !!card}
                  aria-current={i === stepIndex ? "step" : undefined}
                  className={`text-xs min-h-8 px-2.5 rounded-full font-semibold flex items-center gap-1 ${
                    i === stepIndex
                      ? "bg-black text-white"
                      : done
                        ? "bg-[#DBFE87] text-black hover:bg-[#cdf26f] cursor-pointer"
                        : "bg-slate-100 text-slate-500"
                  } disabled:cursor-default`}
                >
                  {done ? <CheckCircle2 className="size-3" aria-hidden="true" /> : `${i + 1}.`} {t(s.label)}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap">{t("abha.sandboxTag")}</span>
      </div>
      <div>
        <h4 className="text-base font-bold text-slate-900">
          {t("abha.step", { n: stepIndex + 1 })} · {t(STEPS[stepIndex].title)}
        </h4>
        <p className="text-xs text-slate-600">{t(STEPS[stepIndex].help)}</p>
      </div>
    </div>
  );

  const hint = (text: string) => <p className="text-xs text-slate-600 text-center -mt-2">{text}</p>;

  const errorLine = error ? (
    <div role="alert" className="text-sm text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-xl px-3 py-2">
      {errorText(t, error)}
      {errorCode === "ALREADY_REGISTERED" && onUseMobileLogin && (
        <button type="button" onClick={onUseMobileLogin} className="block mt-1 font-semibold underline text-black cursor-pointer">
          {t("err.loginWithMobile")}
        </button>
      )}
    </div>
  ) : null;

  if (card) {
    const rows: [string, string | null][] = [
      [t("abha.card.number"), card.abha_number],
      [t("abha.card.address"), card.abha_address],
      [t("abha.card.name"), card.full_name],
      [t("abha.card.mobile"), card.mobile_masked],
      [t("abha.card.via"), card.id_verified_via.replace("(simulated)", t("abha.card.simulated"))],
    ];
    return (
      <div className="space-y-4">
        {progress}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-black" aria-hidden="true" /> {card.returning ? t("abha.welcomeBack") : t("abha.card")}
            </h5>
            <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-bold">{t("abha.sandboxTag")}</span>
          </div>
          <p className="text-xs font-semibold text-[#BA2D0B]">{t("abha.cardLabel")}</p>
          <dl>
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-t border-slate-200 py-2 text-xs">
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="font-mono font-semibold text-slate-900 text-right break-all">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
        {note(t("abha.tokenNoteTitle"), t("abha.tokenNote", { token: card.token }))}
        <button
          onClick={() => printAbhaCard(rows, t("abha.cardLabel"))}
          className="w-full min-h-12 py-2.5 border border-slate-300 hover:border-black text-slate-800 font-semibold text-sm rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer className="size-4" aria-hidden="true" /> {t("abha.print")}
        </button>
        <button onClick={() => onVerified(card.token)} className={primary}>
          {t("abha.enter")}
        </button>
      </div>
    );
  }

  if (txnId) {
    const left = 6 - otp.length;
    return (
      <div className="space-y-4">
        {progress}
        <div>
          <div className="flex justify-between items-center mb-1 gap-2">
            <span className="text-xs font-semibold text-slate-700">{t("otp.label")}</span>
            {sentTo && <span className="text-xs font-mono text-slate-500">{t("otp.sentTo", { to: sentTo })}</span>}
          </div>
          <OtpBoxes
            value={otp}
            onChange={setOtp}
            focusKey={`${txnId}-${otpFocus}`}
            groupLabel={t("otp.label")}
            digitLabel={(n) => t("otp.digit", { n })}
            invalid={errorCode === "OTP_INVALID"}
          />
          <div className="flex justify-between items-center text-xs mt-2">
            <button onClick={() => goTo(1)} className="min-h-10 text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="size-3" aria-hidden="true" /> {t("abha.changeDetails")}
            </button>
            {countdown > 0 ? (
              <span className="text-slate-500 font-mono">{t("otp.resendIn", { s: countdown })}</span>
            ) : (
              <button onClick={resend} className="min-h-10 font-semibold text-black underline cursor-pointer">{t("otp.resend")}</button>
            )}
          </div>
        </div>
        {note(
          t("otp.sandboxTitle"),
          <>
            {t("otp.sandboxBody")} <strong className="font-mono">{sandboxOtp}</strong>{" "}
            <button type="button" onClick={() => setOtp(sandboxOtp)} className="underline font-semibold cursor-pointer">
              {t("otp.fill")}
            </button>
          </>,
        )}
        {errorLine}
        <button disabled={otp.length !== 6 || busy} onClick={verify} className={primary}>
          {busy ? t("otp.verifying") : t("abha.verifyOtp")}
        </button>
        {left > 0 && hint(left === 1 ? t("otp.moreDigit") : t("otp.moreDigits", { n: left }))}
      </div>
    );
  }

  if (step === "CONSENT") {
    return (
      <div className="space-y-4">
        {progress}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700" aria-live="polite">{t("abha.accepted", { n: consentCount })}</span>
          <button
            type="button"
            onClick={() => setConsents(Object.fromEntries(CONSENT_KEYS.map((k) => [k, consentCount < 5])))}
            className="min-h-10 font-semibold text-black underline cursor-pointer"
          >
            {consentCount < 5 ? t("abha.tickAll") : t("abha.clearAll")}
          </button>
        </div>
        <fieldset className="space-y-1">
          <legend className="sr-only">{t("abha.step2.title")}</legend>
          {CONSENT_KEYS.map((k) => (
            <label
              key={k}
              className={`flex items-start gap-2.5 text-sm leading-snug cursor-pointer rounded-xl p-2.5 border transition-colors ${
                consents[k] ? "border-[#c6ea6d] bg-[#DBFE87]/15 text-slate-900" : "border-transparent hover:bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={!!consents[k]}
                onChange={(e) => setConsents({ ...consents, [k]: e.target.checked })}
                className="mt-0.5 size-4 accent-black shrink-0"
              />
              <span>{t(`abha.consent.${k}` as PatientKey)}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="abha-name" className="text-xs font-semibold text-slate-700 block mb-1">{t("abha.name")}</label>
          <input
            id="abha-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && allConsented && requestOtp()}
            placeholder={t("abha.namePlaceholder")}
            className={input}
          />
          {name.trim() && <p className="text-xs text-slate-600 mt-1">{t("abha.nameConsent", { name: name.trim() })}</p>}
        </div>
        {errorLine}
        <button disabled={!allConsented || busy} onClick={requestOtp} className={primary}>
          <KeyRound className="size-4" aria-hidden="true" /> {busy ? t("abha.sendingOtp") : t("abha.verifyOtp")}
        </button>
        {!allConsented && hint(consentCount < 5 ? t("abha.needConsents", { n: 5 - consentCount }) : t("abha.needName"))}
        <div className="grid grid-cols-2 gap-2">
          <button disabled title={t("abha.methodsTitle")} className="min-h-11 border border-slate-200 text-slate-500 text-xs rounded-full flex items-center justify-center gap-1 cursor-not-allowed">
            <UserCheck className="size-3.5" aria-hidden="true" /> {t("abha.demographics")}
          </button>
          <button disabled title={t("abha.methodsTitle")} className="min-h-11 border border-slate-200 text-slate-500 text-xs rounded-full flex items-center justify-center gap-1 cursor-not-allowed">
            <Fingerprint className="size-3.5" aria-hidden="true" /> {t("abha.biometrics")}
          </button>
        </div>
        <p className="text-xs text-slate-600">{t("abha.methodsNote")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {progress}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-sm font-semibold" role="radiogroup">
        {(["GENERATE", "LINK"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => {
              setMode(m);
              setIdentifier("");
              setError(null);
            }}
            className={`min-h-10 rounded-lg transition-all ${mode === m ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            {m === "GENERATE" ? t("abha.mode.generate") : t("abha.mode.link")}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="abha-id" className="text-xs font-semibold text-slate-700 block mb-1">
          {mode === "GENERATE" ? t("abha.id.generate") : t("abha.id.link")}
        </label>
        <input
          id="abha-id"
          value={identifier}
          onChange={(e) => {
            const v = e.target.value;
            setIdentifier(/^[\d\s-]*$/.test(v) ? group4(v.replace(/\D/g, "").slice(0, 16)) : v);
          }}
          onKeyDown={(e) => e.key === "Enter" && idReady && setStep("CONSENT")}
          autoFocus
          autoComplete="off"
          aria-invalid={!!idCheck.error}
          aria-describedby="abha-id-hint"
          placeholder={mode === "GENERATE" ? t("abha.id.placeholder.generate") : t("abha.id.placeholder.link")}
          className={`${input} font-mono tracking-wider ${idCheck.error ? "border-[#BA2D0B]" : ""}`}
        />
        <p id="abha-id-hint" aria-live="polite" className={`text-xs mt-1 flex items-center gap-1 ${idCheck.ok ? "text-black" : idCheck.error ? "text-[#BA2D0B]" : "text-slate-600"}`}>
          {idCheck.ok && <CheckCircle2 className="size-3" aria-hidden="true" />} {idCheck.key ? t(idCheck.key, idCheck.vars) : ""}
        </p>
      </div>
      <div>
        <label htmlFor="abha-mobile" className="text-xs font-semibold text-slate-700 block mb-1">{t("abha.mobile")}</label>
        <input
          id="abha-mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && idReady && setStep("CONSENT")}
          inputMode="tel"
          placeholder={t("mobile.placeholder")}
          aria-invalid={!mobileOk}
          className={`${input} font-mono ${!mobileOk ? "border-[#BA2D0B]" : ""}`}
        />
        {!mobileOk && <p className="text-xs mt-1 text-[#BA2D0B]">{t("err.INVALID_MOBILE")}</p>}
      </div>
      {mode === "LINK" && (
        <div>
          <label htmlFor="abha-link-token" className="text-xs font-semibold text-slate-700 block mb-1">{t("abha.linkToken")}</label>
          <input id="abha-link-token" value={linkToken} onChange={(e) => setLinkToken(e.target.value)} placeholder="PT-CASE-NISHI" className={`${input} font-mono`} />
        </div>
      )}
      {note(t("abha.simulatedTitle"), t("abha.simulatedBody"))}
      <button disabled={!idReady} onClick={() => setStep("CONSENT")} className={primary}>
        {t("abha.continue")}
      </button>
      {!idReady && hint(mode === "GENERATE" ? t("abha.needId") : t("abha.needLinkId"))}
    </div>
  );
};
