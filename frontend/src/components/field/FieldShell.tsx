import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import { LanguageSwitch } from "../common/LanguageSwitch";
import type { StaffProfile } from "../../api/staff";

/** Phone-first page for roles that do not use the clinical workspace. */
export function FieldShell({ staff, onSignOut, title, children }: { staff: StaffProfile; onSignOut: () => void; title: string; children: ReactNode }) {
  return (
    <div className="h-screen overflow-y-auto bg-[#FAFAFA] text-black font-sans antialiased">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0"><CerviSetuLogo size={28} /><div className="min-w-0"><div className="text-sm font-bold truncate">{title}</div><div className="text-xs text-slate-500 truncate">{staff.name} · {staff.facility}</div></div></div>
        <div className="flex items-center gap-1 shrink-0"><LanguageSwitch /><button aria-label="Sign out" title="Sign out" onClick={onSignOut} className="p-2 rounded-lg cursor-pointer hover:bg-slate-100" data-testid="sign-out"><LogOut className="size-4" /></button></div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4 flex flex-col gap-3">{children}</main>
    </div>
  );
}
