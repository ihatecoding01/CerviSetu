import React, { useEffect, useState } from "react";
import { ShieldCheck, ArrowLeft, Phone } from "lucide-react";
import { AbdmError, post } from "../api/abdm";
import { OtpBoxes } from "./OtpBoxes";

interface Props {
  onVerified: (patientToken: string) => void;
  onRegister: () => void;
}

// Demo patient login: mobile -> sandbox OTP -> patient token. Not production authentication.
export const MobileOtpLogin: React.FC<Props> = ({ onVerified, onRegister }) => {
  const [mobile, setMobile] = useState("");
  const [txnId, setTxnId] = useState<string | null>(null);
  const [sandboxOtp, setSandboxOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [otp, setOtp] = useState("");
  const [otpFocus, setOtpFocus] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const digits = mobile.replace(/\D/g, "").slice(-10);
  const mobileOk = /^[6-9]\d{9}$/.test(digits);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && txnId && !busy) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const fail = (e: unknown) => {
    setError((e as Error).message);
    setErrorCode((e as AbdmError).code);
  };

  const send = async () => {
    setError("");
    setErrorCode(undefined);
    setBusy(true);
    try {
      const r = await post<{ txn_id: string; sandbox_otp: string; otp_sent_to: string; resend_after_seconds: number }>(
        "/login/mobile/request",
        { mobile: digits },
      );
      setTxnId(r.txn_id);
      setSandboxOtp(r.sandbox_otp);
      setSentTo(r.otp_sent_to);
      setCountdown(r.resend_after_seconds);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
      fail(e);
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
      setOtp("");
      setOtpFocus((n) => n + 1);
    } catch (e) {
      fail(e);
    }
  };

  const verify = async () => {
    if (!txnId) return;
    setError("");
    setBusy(true);
    try {
      const r = await post<{ patient_token: string }>("/otp/verify", { txn_id: txnId, otp });
      onVerified(r.patient_token);
    } catch (e) {
      fail(e);
      setOtp("");
      setOtpFocus((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const primary =
    "w-full py-3 bg-black hover:bg-black/85 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-full shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5";
  const demoTag = <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-mono font-bold">Demo OTP</span>;
  const errorLine = error && (
    <div role="alert" className="text-xs text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-xl px-3 py-2">
      {error}
      {errorCode === "MOBILE_NOT_REGISTERED" && (
        <button type="button" onClick={onRegister} className="block mt-1 font-semibold underline text-black cursor-pointer">
          Register with ABHA →
        </button>
      )}
    </div>
  );
  const notice = (
    <div className="bg-[#DBFE87]/20 border border-[#DBFE87] rounded-xl p-3 text-xs text-black flex items-start gap-2">
      <ShieldCheck className="size-4 text-black shrink-0 mt-0.5" />
      <div>
        <span className="font-bold">Demo authentication:</span>
        <p className="text-xs text-slate-700 mt-0.5">
          {txnId ? (
            <>
              No SMS is sent; the sandbox code is shown here. Test code: <strong className="font-mono">{sandboxOtp}</strong>{" "}
              <button type="button" onClick={() => setOtp(sandboxOtp)} className="underline font-semibold cursor-pointer">
                Fill it
              </button>
            </>
          ) : (
            <>Sandbox OTP for the hackathon demo, not secure production login. Demo patient: 98765 43210.</>
          )}
        </p>
      </div>
    </div>
  );

  if (txnId) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm font-bold text-slate-900">Enter the OTP</p>
          {demoTag}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">6-Digit OTP:</label>
            <span className="text-xs font-mono text-slate-500">{sentTo}</span>
          </div>
          <OtpBoxes value={otp} onChange={setOtp} focusKey={`${txnId}-${otpFocus}`} />
          <div className="flex justify-between items-center text-xs mt-2">
            <button onClick={() => setTxnId(null)} className="text-slate-500 hover:text-black flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="size-3" /> Change number
            </button>
            {countdown > 0 ? (
              <span className="text-slate-500 font-mono">Resend OTP in {countdown}s</span>
            ) : (
              <button onClick={resend} className="font-semibold text-black underline cursor-pointer">Resend OTP</button>
            )}
          </div>
        </div>
        {notice}
        {errorLine}
        <button disabled={otp.length !== 6 || busy} onClick={verify} className={primary}>
          {busy ? "Verifying…" : "पोर्टल में प्रवेश करें (Enter Portal)"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-slate-900">Log in with your mobile</p>
        {demoTag}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">पंजीकृत मोबाइल (Registered Mobile):</label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && mobileOk && !busy && send()}
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          placeholder="10-digit mobile"
          className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-black ${
            mobile && !mobileOk && digits.length === 10 ? "border-[#BA2D0B]" : "border-slate-300"
          }`}
        />
        {mobile && !mobileOk && (
          <p className="text-xs mt-1 text-slate-500">{digits.length < 10 ? `${digits.length}/10 digits` : "Mobile must start with 6–9"}</p>
        )}
      </div>
      {notice}
      {errorLine}
      <button disabled={!mobileOk || busy} onClick={send} className={primary}>
        <Phone className="size-3.5" /> {busy ? "Sending…" : "OTP भेजें (Send OTP)"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        New patient?{" "}
        <button type="button" onClick={onRegister} className="font-semibold text-black underline cursor-pointer">
          Register with ABHA
        </button>
      </p>
    </div>
  );
};
