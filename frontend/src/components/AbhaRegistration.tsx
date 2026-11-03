import React, { useEffect, useState } from "react";
import { ShieldCheck, Fingerprint, UserCheck, KeyRound, CheckCircle2 } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const CONSENTS: { key: string; text: string }[] = [
  { key: "share_identity_with_nha", text: "I voluntarily share my Aadhaar / Virtual ID and demographic details with UIDAI and NHA to create my ABHA number and ABHA address." },
  { key: "link_health_records", text: "I consent to my ABHA address / number being used to link my legacy and future government health records." },
  { key: "share_records_with_providers", text: "I authorise sharing my health records with healthcare providers for this treatment encounter." },
  { key: "anonymised_public_health_use", text: "I consent to anonymised use of my health records for public health purposes." },
  { key: "admin_explained_consent", text: "I, the health worker, confirm I have informed and explained the above consents to the beneficiary in a language they understand." },
];

type Card = { abha_number: string; abha_address: string; full_name: string; mobile_masked: string | null; id_verified_via: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/abdm${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail?.message || data?.detail || "Request failed");
  return data as T;
}

interface Props {
  onVerified: (patientToken: string) => void;
}

export const AbhaRegistration: React.FC<Props> = ({ onVerified }) => {
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
  const [card, setCard] = useState<(Card & { token: string }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const allConsented = CONSENTS.every((c) => consents[c.key]) && name.trim().length >= 2 && identifier.trim().length > 0;

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
      const r = await post<{ patient_token: string; abha_card: Card }>("/otp/verify", { txn_id: txnId, otp });
      setCard({ ...r.abha_card, token: r.patient_token });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sandboxBanner = (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900">
      <strong>ABDM Sandbox (simulated):</strong> no real Aadhaar OTP is sent and the ABHA issued is a test <code>@sbx</code> identity.
      Live mode needs NHA gateway credentials.
    </div>
  );

  if (card) {
    return (
      <div className="space-y-3">
        {sandboxBanner}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#DBFE87]/30 to-white p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <CheckCircle2 className="size-4 text-green-700" /> ABHA verified
          </div>
          <div><span className="text-slate-500">ABHA Number:</span> <span className="font-mono font-semibold">{card.abha_number}</span></div>
          <div><span className="text-slate-500">ABHA Address:</span> <span className="font-mono font-semibold">{card.abha_address}</span></div>
          <div><span className="text-slate-500">Full Name:</span> {card.full_name}</div>
          {card.mobile_masked && <div><span className="text-slate-500">Mobile:</span> {card.mobile_masked}</div>}
          <div><span className="text-slate-500">Verified via:</span> {card.id_verified_via}</div>
          <div><span className="text-slate-500">CerviSetu token:</span> <span className="font-mono">{card.token}</span></div>
        </div>
        <button
          onClick={() => onVerified(card.token)}
          className="w-full py-2.5 bg-black hover:bg-black/85 text-white font-semibold text-xs rounded-full cursor-pointer"
        >
          Proceed to Portal
        </button>
      </div>
    );
  }

  if (txnId) {
    return (
      <div className="space-y-3">
        {sandboxBanner}
        <p className="text-xs text-slate-600">Enter the 6-digit OTP sent to your {sentTo}.</p>
        <div className="text-xs bg-slate-100 rounded-lg px-3 py-2 font-mono">Sandbox OTP: <strong>{sandboxOtp}</strong></div>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="••••••"
          className="w-full px-3.5 py-2 text-center bg-slate-50 border border-slate-300 rounded-xl text-lg font-mono tracking-[0.5em] focus:outline-none focus:border-black"
        />
        <div className="flex justify-between items-center text-xs">
          <button onClick={() => setTxnId(null)} className="text-slate-500 hover:text-black cursor-pointer">← Back</button>
          {countdown > 0 ? (
            <span className="text-slate-500">Resend OTP in {countdown}s</span>
          ) : (
            <button onClick={resend} className="font-semibold text-black underline cursor-pointer">Resend OTP</button>
          )}
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button
          disabled={otp.length !== 6 || busy}
          onClick={verify}
          className="w-full py-2.5 bg-black disabled:bg-slate-300 text-white font-semibold text-xs rounded-full cursor-pointer"
        >
          Verify OTP
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sandboxBanner}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
        {(["GENERATE", "LINK"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`py-2 rounded-lg ${mode === m ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}
          >
            {m === "GENERATE" ? "Generate new ABHA" : "Link existing ABHA"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">
          {mode === "GENERATE" ? "Aadhaar Number (12 digits) / Virtual ID (16 digits)" : "ABHA Number (14 digits) / ABHA Address"}
        </label>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="off"
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-black"
        />
        {mode === "GENERATE" && <p className="text-[11px] text-slate-500 mt-1">Aadhaar number is never stored by CerviSetu.</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Number</label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          inputMode="tel"
          placeholder="10-digit mobile"
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-black"
        />
      </div>

      {mode === "LINK" && (
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Existing CerviSetu token (optional)</label>
          <input
            value={linkToken}
            onChange={(e) => setLinkToken(e.target.value)}
            placeholder="e.g. PT-RURAL-7891"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-black"
          />
        </div>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {CONSENTS.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-[11px] text-slate-700 leading-snug cursor-pointer">
            <input
              type="checkbox"
              checked={!!consents[c.key]}
              onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })}
              className="mt-0.5 accent-black"
            />
            <span>{c.text}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Beneficiary Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name as on Aadhaar"
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-black"
        />
        {name.trim() && (
          <p className="text-[11px] text-slate-500 mt-1">I, {name.trim()}, have been explained the above and hereby give my consent.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="grid gap-2">
        <button
          disabled={!allConsented || busy}
          onClick={() => requestOtp("OTP")}
          className="w-full py-2.5 bg-black disabled:bg-slate-300 text-white font-semibold text-xs rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <KeyRound className="size-3.5" /> Verify with OTP
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled
            title="Requires ABDM facility approval"
            className="py-2 border border-slate-200 text-slate-400 text-[11px] rounded-full flex items-center justify-center gap-1"
          >
            <UserCheck className="size-3.5" /> Demographics
          </button>
          <button
            disabled
            title="Requires a UIDAI-certified RD device and ABDM approval"
            className="py-2 border border-slate-200 text-slate-400 text-[11px] rounded-full flex items-center justify-center gap-1"
          >
            <Fingerprint className="size-3.5" /> Biometrics
          </button>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <ShieldCheck className="size-3" /> Demographic and biometric verification need ABDM approval and are not enabled yet.
        </p>
      </div>
    </div>
  );
};
