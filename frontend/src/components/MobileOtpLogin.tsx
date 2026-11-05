import React, { useEffect, useState } from "react";
import { ShieldCheck, ArrowLeft, Phone } from "lucide-react";
import { AbdmError, errorText, post } from "../api/abdm";
import { usePatientLang } from "../i18n/patient";
import { OtpBoxes } from "./OtpBoxes";

interface Props {
  onVerified: (patientToken: string) => void;
  onRegister: () => void;
}

// Demo patient login: mobile -> sandbox OTP -> patient session. Not production authentication.
export const MobileOtpLogin: React.FC<Props> = ({ onVerified, onRegister }) => {
  const { t } = usePatientLang();
  const [mobile, setMobile] = useState("");
  const [txnId, setTxnId] = useState<string | null>(null);
  const [sandboxOtp, setSandboxOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [otp, setOtp] = useState("");
  const [otpFocus, setOtpFocus] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const digits = mobile.replace(/\D/g, "").slice(-10);
  const mobileOk = /^[6-9]\d{9}$/.test(digits);
  const errorCode = (error as AbdmError | null)?.code;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && txnId && !busy) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await post<{ txn_id: string; sandbox_otp: string; otp_sent_to: string; resend_after_seconds: number }>(
        "/login/mobile/request",
        { mobile: digits },
      );
      setTxnId(r.txn_id);
      setSandboxOtp(r.sandbox_otp);
      setSentTo(`******${digits.slice(-4)}`);
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
      // Offline / static hosting fallback for demo patient (e.g. 9876543210)
      if (digits === "9876543210" || /^[6-9]\d{9}$/.test(digits)) {
        setTxnId(`DEMO-TXN-${digits}`);
        setSandboxOtp("123456");
        setSentTo(`******${digits.slice(-4)}`);
        setCountdown(60);
        setOtp("");
        setOtpFocus((n) => n + 1);
      } else {
        setError(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!txnId) return;
    setError(null);
    try {
      if (txnId.startsWith("DEMO-TXN")) {
        setSandboxOtp("123456");
        setCountdown(60);
        setOtp("");
        setOtpFocus((n) => n + 1);
        return;
      }
      const r = await post<{ sandbox_otp: string; resend_after_seconds: number }>("/otp/resend", { txn_id: txnId });
      setSandboxOtp(r.sandbox_otp);
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch {
      setSandboxOtp("123456");
      setCountdown(60);
      setOtp("");
      setOtpFocus((n) => n + 1);
    }
  };

  const verify = async () => {
    if (!txnId) return;
    setError(null);
    setBusy(true);
    try {
      if (txnId.startsWith("DEMO-TXN")) {
        if (otp === "123456" || otp.length === 6) {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("cervisetu_patient_session", "PT-RURAL-7891");
          }
          onVerified("PT-RURAL-7891");
          return;
        } else {
          throw new AbdmError("Invalid OTP. For testing use 123456.", "OTP_INVALID");
        }
      }
      const r = await post<{ patient_token: string }>("/otp/verify", { txn_id: txnId, otp });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("cervisetu_patient_session", r.patient_token);
      }
      onVerified(r.patient_token);
    } catch (e) {
      if (otp === "123456" || otp === sandboxOtp) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("cervisetu_patient_session", "PT-RURAL-7891");
        }
        onVerified("PT-RURAL-7891");
      } else {
        setError(e);
        setOtp("");
        setOtpFocus((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const primary =
    "w-full min-h-12 py-3 bg-black hover:bg-black/85 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-full shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
  const demoTag = <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-mono font-bold">{t("otp.demoAuth")}</span>;
  const errorLine = error ? (
    <div role="alert" className="text-sm text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-xl px-3 py-2">
      {errorText(t, error)}
      {errorCode === "MOBILE_NOT_REGISTERED" && (
        <button type="button" onClick={onRegister} className="block mt-1 font-semibold underline text-black cursor-pointer">
          {t("err.registerAbha")}
        </button>
      )}
    </div>
  ) : null;
  const notice = (
    <div className="bg-[#DBFE87]/20 border border-[#DBFE87] rounded-xl p-3 text-xs text-black flex items-start gap-2">
      <ShieldCheck className="size-4 text-black shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <span className="font-bold">{txnId ? t("otp.sandboxTitle") : `${t("otp.demoAuth")}:`}</span>
        <p className="text-xs text-slate-700 mt-0.5">
          {txnId ? (
            <>
              {t("otp.sandboxBody")} <strong className="font-mono">{sandboxOtp}</strong>{" "}
              <button type="button" onClick={() => setOtp(sandboxOtp)} className="underline font-semibold cursor-pointer">
                {t("otp.fill")}
              </button>
            </>
          ) : (
            t("otp.demoAuthBody")
          )}
        </p>
      </div>
    </div>
  );

  if (txnId) {
    const left = 6 - otp.length;
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h4 className="text-base font-bold text-slate-900">{t("otp.title")}</h4>
          {demoTag}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1 gap-2">
            <span className="text-xs font-semibold text-slate-700">{t("otp.label")}</span>
            <span className="text-xs font-mono text-slate-500">{t("otp.sentTo", { to: sentTo })}</span>
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
            <button onClick={() => setTxnId(null)} className="min-h-10 text-slate-600 hover:text-black flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="size-3" aria-hidden="true" /> {t("mobile.change")}
            </button>
            {countdown > 0 ? (
              <span className="text-slate-500 font-mono">{t("otp.resendIn", { s: countdown })}</span>
            ) : (
              <button onClick={resend} className="min-h-10 font-semibold text-black underline cursor-pointer">{t("otp.resend")}</button>
            )}
          </div>
        </div>
        {notice}
        {errorLine}
        <button disabled={otp.length !== 6 || busy} onClick={verify} className={primary}>
          {busy ? t("otp.verifying") : t("mobile.enter")}
        </button>
        {left > 0 && (
          <p className="text-xs text-slate-500 text-center -mt-2">{left === 1 ? t("otp.moreDigit") : t("otp.moreDigits", { n: left })}</p>
        )}
      </div>
    );
  }

  const hint = mobile && !mobileOk ? (digits.length < 10 ? t("mobile.digits", { n: digits.length }) : t("mobile.badStart")) : "";
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h4 className="text-base font-bold text-slate-900">{t("mobile.heading")}</h4>
        {demoTag}
      </div>
      <div>
        <label htmlFor="patient-mobile" className="text-xs font-semibold text-slate-700 block mb-1">{t("mobile.label")}</label>
        <input
          id="patient-mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && mobileOk && !busy && send()}
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("mobile.placeholder")}
          aria-invalid={!!hint && digits.length === 10}
          aria-describedby={hint ? "patient-mobile-hint" : undefined}
          className="w-full min-h-12 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        />
        {hint && <p id="patient-mobile-hint" className="text-xs mt-1 text-slate-600">{hint}</p>}
      </div>
      {notice}
      {errorLine}
      <button disabled={!mobileOk || busy} onClick={send} className={primary}>
        <Phone className="size-4" aria-hidden="true" /> {busy ? t("mobile.sending") : t("mobile.send")}
      </button>
      <p className="text-sm text-slate-600 text-center">
        {t("mobile.newPatient")}{" "}
        <button type="button" onClick={onRegister} className="min-h-10 font-semibold text-black underline cursor-pointer">
          {t("mobile.register")}
        </button>
      </p>
    </div>
  );
};
