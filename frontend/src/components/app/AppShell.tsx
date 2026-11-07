import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import { LanguageSwitch } from "../common/LanguageSwitch";
import { ErrorBoundary } from "../common/ErrorBoundary";
import type { StaffProfile } from "../../api/staff";
import { GeniePopup, GenieTrigger, type GenieConfig } from "./Genie";

export interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number | null;
}

interface Props {
  staff: StaffProfile;
  portal: string;
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  onSignOut: () => void;
  genie: GenieConfig;
  title: string;
  /** Full-width pages (case record) skip the reading-width container. */
  wide?: boolean;
  children: ReactNode;
}

const KEY = "cervisetu_nav_collapsed";

/** Shared staff shell: navigation on the left (collapse control at its top-left), Genie at the top-right. */
export function AppShell({ staff, portal, nav, active, onNavigate, onSignOut, genie, title, wide, children }: Props) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  const [drawer, setDrawer] = useState(false);
  const [genieOpen, setGenieOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch { /* per-viewer convenience only */ } }, [collapsed]);
  useEffect(() => { document.title = `${title} · CerviSetu`; }, [title]);

  const go = (id: string) => { setDrawer(false); onNavigate(id); };
  const initials = staff.name.replace(/^(Dr|Sister)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const links = (compact: boolean) => (
    <nav aria-label={`${portal} navigation`} className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const on = item.id === active;
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" onClick={() => go(item.id)} title={compact ? item.label : undefined} aria-current={on ? "page" : undefined}
            data-testid={`nav-${item.id}`}
            className={`flex items-center gap-3 rounded-md px-3 min-h-10 text-sm transition-colors cursor-pointer ${compact ? "justify-center px-0" : ""} ${on ? "bg-sky-50 text-[#075985] font-semibold" : "text-slate-700 hover:bg-slate-100"}`}>
            <Icon className={`size-[18px] shrink-0 ${on ? "text-[#0369A1]" : "text-slate-500"}`} />
            {!compact && <span className="flex-1 text-left truncate">{item.label}</span>}
            {!compact && item.count != null && item.count > 0 && <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700 tabular-nums">{item.count}</span>}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 min-w-0">
      <CerviSetuLogo size={30} alt="" />
      <div className="min-w-0 leading-tight">
        <div className="font-heading text-[15px] font-semibold text-[#111418]">CerviSetu</div>
        <div className="text-xs text-slate-500 truncate">{portal}</div>
      </div>
    </div>
  );

  const account = (compact: boolean) => (
    <div className={`border-t border-black/[0.06] pt-3 flex items-center gap-2 ${compact ? "flex-col" : ""}`}>
      <span className="size-8 shrink-0 rounded-full bg-[#0F172A] text-white text-xs font-semibold flex items-center justify-center" title={`${staff.name} · ${staff.facility}`} data-testid="staff-avatar">{initials}</span>
      {!compact && <div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-semibold truncate">{staff.name}</div><div className="text-xs text-slate-500 truncate">{staff.facility}</div></div>}
      <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" data-testid="staff-sign-out" className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#111418] cursor-pointer"><LogOut className="size-4" /></button>
    </div>
  );

  return (
    <div className="h-[100dvh] flex bg-[#FAFAFC] text-[#111418] font-sans antialiased overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-black/[0.08] bg-white p-3 transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-60"}`}>
        <div className={`flex items-center gap-2 mb-5 ${collapsed ? "flex-col" : "justify-between"}`}>
          <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} data-testid="nav-collapse"
            className={`p-2 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer ${collapsed ? "" : "order-first"}`}>
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
          {collapsed ? <CerviSetuLogo size={28} alt="CerviSetu" /> : <div className="flex-1 min-w-0">{brand}</div>}
        </div>
        <div className="flex-1 overflow-y-auto">{links(collapsed)}</div>
        {account(collapsed)}
      </aside>

      {/* Phone drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-3 flex flex-col shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="p-2 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="size-[18px]" /></button>
              {brand}
            </div>
            <div className="flex-1 overflow-y-auto">{links(false)}</div>
            {account(false)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-black/[0.08] bg-white px-3 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" data-testid="nav-open" className="md:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"><Menu className="size-5" /></button>
            <span className="text-sm font-semibold truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitch className="max-sm:w-[92px] max-sm:[&>select]:w-full" />
            <GenieTrigger open={genieOpen} onClick={() => setGenieOpen((o) => !o)} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="portal-main">
          <div className={wide ? "h-full" : "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8"}>{children}</div>
        </main>
      </div>

      <ErrorBoundary name="genie" fallback={null}>
        <GeniePopup open={genieOpen} onClose={() => setGenieOpen(false)} config={genie} />
      </ErrorBoundary>
    </div>
  );
}
