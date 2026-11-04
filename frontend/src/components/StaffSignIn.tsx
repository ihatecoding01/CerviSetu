import { useState } from "react";
import { ArrowLeft, HeartHandshake, KeyRound, Loader2, ShieldCheck, Stethoscope, User, UserCog } from "lucide-react";
import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { staffApi, StaffLoginError, DEMO_STAFF, PRELOADED_PIN, type StaffProfile, type StaffRole } from "../api/staff";

interface Props {
  /** Role to highlight first (e.g. ASHA when coming from the ASHA login card). */
  preferredRole?: StaffRole;
  onSignedIn: (staff: StaffProfile) => void;
  onBack: () => void;
}

const DEMO_ROLES: { role: StaffRole; label: string; hint: string; icon: typeof User; color: string }[] = [
  { role: "DOCTOR", label: "Doctor", hint: "Chemo clearance, discharge sign-off", icon: Stethoscope, color: "#000000" },
  { role: "NURSE", label: "Nurse", hint: "Ward board, clocks, nursing logs", icon: User, color: "#BA2D0B" },
  { role: "ASHA", label: "ASHA Worker", hint: "Home visits and field follow-up", icon: HeartHandshake, color: "#0F766E" },
  { role: "ADMIN", label: "Administrator", hint: "Everything, plus the audit ledger", icon: UserCog, color: "#475569" },
];

export function StaffSignIn({ preferredRole, onSignedIn, onBack }: Props) {
  const firstRole: StaffRole = preferredRole ?? "DOCTOR";
  const [selectedRole, setSelectedRole] = useState<StaffRole>(firstRole);
  const [staffId, setStaffId] = useState(DEMO_STAFF[firstRole].staff_id);
  const [pin, setPin] = useState(PRELOADED_PIN);

  const chooseRole = (role: StaffRole) => {
    setSelectedRole(role);
    setStaffId(DEMO_STAFF[role].staff_id);
    setPin(PRELOADED_PIN);
    setError(null);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roles = preferredRole
    ? [...DEMO_ROLES.filter((r) => r.role === preferredRole), ...DEMO_ROLES.filter((r) => r.role !== preferredRole)]
    : DEMO_ROLES;

  const run = async (key: string, fn: () => Promise<StaffProfile>) => {
    setBusy(key);
    setError(null);
    try {
      onSignedIn(await fn());
    } catch (e) {
      setError(e instanceof StaffLoginError ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-black font-sans antialiased flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-slate-200 bg-white">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-black cursor-pointer">
          <ArrowLeft className="size-4" />
          <span>Back to CARE Gateway</span>
        </button>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <CerviSetuLogo size={30} />
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* One-click demo sign-in */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h1 className="text-lg font-bold">Staff sign-in</h1>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Choose your role. Each role only sees and does what it is allowed to.
            </p>
            <div className="flex flex-col gap-2.5">
              {roles.map(({ role, label, hint, icon: Icon, color }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => chooseRole(role)}
                  disabled={busy !== null}
                  aria-pressed={role === selectedRole}
                  data-testid={`role-${role.toLowerCase()}`}
                  className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-60 ${
                    role === selectedRole ? "border-black bg-slate-50 ring-1 ring-black" : "border-slate-200 hover:border-black"
                  }`}
                >
                  <span className="size-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: color }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-slate-500 truncate">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Staff ID + PIN */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4" />
              <h2 className="text-sm font-bold">Sign in with Staff ID and PIN</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {DEMO_STAFF[selectedRole].name} · {DEMO_STAFF[selectedRole].facility}
            </p>

            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (staffId.trim() && pin) run("pin", () => staffApi.login(staffId.trim(), pin));
              }}
            >
              <label className="text-xs font-semibold text-slate-600">
                Staff ID
                <input
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="DR-1001"
                  autoComplete="username"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black focus:outline-none focus:border-black"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                PIN
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black focus:outline-none focus:border-black"
                />
              </label>
              {error && (
                <p role="alert" className="text-xs text-[#BA2D0B]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy !== null || !staffId.trim() || !pin}
                className="mt-1 w-full py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-black/85 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {busy === "pin" && <Loader2 className="size-3.5 animate-spin" />}
                Log in
              </button>
            </form>
            <div className="mt-5 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <ShieldCheck className="size-3.5 mt-0.5 shrink-0 text-[#0F766E]" />
              <span>Sessions expire after 30 minutes. Five wrong PINs lock the account for 5 minutes. Every sign-in and sign-out is written to the audit ledger.</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
