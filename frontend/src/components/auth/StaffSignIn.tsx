import { useState } from "react";
import { ArrowLeft, Building2, HeartHandshake, KeyRound, Loader2, ShieldCheck, Stethoscope, User, UserCog } from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import { LanguageSwitch } from "../common/LanguageSwitch";
import { staffApi, StaffLoginError, DEMO_STAFF, PRELOADED_PIN, type StaffProfile, type StaffRole } from "../../api/staff";

interface Props {
  /** Role to highlight first (e.g. ASHA when coming from the ASHA login card). */
  preferredRole?: StaffRole;
  sessionEnded?: boolean;
  onSignedIn: (staff: StaffProfile) => void;
  onBack: () => void;
}

const DEMO_ROLES: { role: StaffRole; label: string; hint: string; icon: typeof User; color: string }[] = [
  { role: "DOCTOR", label: "Doctor", hint: "Case records, reports and treatment plans", icon: Stethoscope, color: "#0F172A" },
  { role: "NURSE", label: "Nurse", hint: "Screening intake, referrals and reminders", icon: User, color: "#0284C7" },
  { role: "ASHA", label: "ASHA Worker", hint: "Assigned referrals and home visits", icon: HeartHandshake, color: "#9D174D" },
  { role: "HOSPITAL", label: "Hospital Desk", hint: "Incoming referrals and arrivals", icon: Building2, color: "#0369A1" },
  { role: "ADMIN", label: "Administrator", hint: "Hospitals and the services they offer", icon: UserCog, color: "#475569" },
];

export function StaffSignIn({ preferredRole, sessionEnded, onSignedIn, onBack }: Props) {
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

  // Administrators sign in through their own entry; clinical and field staff never see that role here.
  const clinicalRoles = DEMO_ROLES.filter((r) => r.role !== "ADMIN");
  const roles =
    preferredRole === "ADMIN"
      ? DEMO_ROLES.filter((r) => r.role === "ADMIN")
      : preferredRole
        ? [...clinicalRoles.filter((r) => r.role === preferredRole), ...clinicalRoles.filter((r) => r.role !== preferredRole)]
        : clinicalRoles;

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
    <div className="min-h-screen w-full bg-[#FAFAFC] text-slate-900 font-sans antialiased flex flex-col relative">
      {/* Codename orion Ambient Backdrop */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full bg-radial from-pink-200/25 via-sky-100/20 to-transparent blur-3xl opacity-70 absolute top-6 left-1/2 -translate-x-1/2" />
      </div>

      <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-black/10 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-heading font-semibold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-black/15 shadow-2xs transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="size-3.5 text-[#0369A1]" />
          <span>Back to CARE Gateway</span>
        </button>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <div className="size-8 rounded-lg bg-white border border-black/15 flex items-center justify-center p-1 shadow-2xs">
            <CerviSetuLogo size={22} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* One-click demo role selection */}
          <section className="card-base card-gradient-warm rounded-xl border border-black/12 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <h1 className="font-heading text-base font-bold text-slate-900">Staff Workstation Sign-in</h1>
            </div>
            <p className="text-xs text-slate-500 font-sans mb-4">
              Select authorized staff role. Scoped permissions strictly enforced.
            </p>
            <div className="flex flex-col gap-2">
              {roles.map(({ role, label, hint, icon: Icon, color }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => chooseRole(role)}
                  disabled={busy !== null}
                  aria-pressed={role === selectedRole}
                  data-testid={`role-${role.toLowerCase()}`}
                  className={`flex items-center gap-3 w-full rounded-lg border px-3.5 py-2.5 text-left transition-all cursor-pointer disabled:opacity-60 ${role === selectedRole
                      ? "border-[#0284C7] bg-white ring-2 ring-[#0284C7]/20 shadow-2xs"
                      : "border-black/10 bg-white/80 hover:bg-white hover:border-black/25"
                    }`}
                >
                  <span
                    className="size-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                    style={{ background: color }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-heading font-bold text-slate-900">{label}</span>
                    <span className="block text-[11px] text-slate-500 truncate font-sans">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Staff ID + PIN Form */}
          <section className="card-base card-gradient-subtle rounded-xl border border-black/12 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="size-5 rounded-md bg-white border border-black/15 flex items-center justify-center text-[#0369A1] shadow-2xs">
                  <KeyRound size={12} />
                </div>
                <h2 className="font-heading text-sm font-bold text-slate-900">
                  Staff ID &amp; Clinical PIN
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-sans mb-4">
                Enter your registered spoke staff identifier.
              </p>

              {sessionEnded && (
                <p role="status" data-testid="session-ended" className="mb-4 rounded-md bg-pink-50 border border-pink-200 px-3 py-2 text-xs font-mono-data text-[#9D174D] shadow-2xs">
                  Your session has ended. Please log in again to continue.
                </p>
              )}

              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (staffId.trim() && pin) run("pin", () => staffApi.login(staffId.trim(), pin));
                }}
              >
                <label className="text-xs font-heading font-semibold text-slate-700">
                  Staff ID
                  <input
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="DR-1001"
                    autoComplete="username"
                    className="mt-1 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-mono-data text-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 shadow-2xs"
                  />
                </label>
                <label className="text-xs font-heading font-semibold text-slate-700">
                  PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-mono-data text-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 shadow-2xs"
                  />
                </label>
                {error && (
                  <p role="alert" className="text-xs font-mono-data text-[#9D174D] bg-pink-50 border border-pink-200 rounded-md px-2.5 py-1.5 shadow-2xs">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy !== null || !staffId.trim() || !pin}
                  className="mt-2 w-full py-2.5 rounded-md bg-[#0F172A] hover:bg-black text-white text-xs font-heading font-bold shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  {busy === "pin" && <Loader2 className="size-3.5 animate-spin text-[#0284C7]" />}
                  <span>Sign in to Workstation</span>
                </button>
              </form>
            </div>

            <div className="mt-5 pt-3 border-t border-black/8 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed font-sans">
              <ShieldCheck className="size-3.5 mt-0.5 shrink-0 text-[#0284C7]" />
              <span>Session remains active during clinical shift. Audit ledger immutable trace on login.</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
