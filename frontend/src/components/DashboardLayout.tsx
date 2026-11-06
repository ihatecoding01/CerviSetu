import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { GeniePanel, WhatsNewPanel } from "./GeniePanel";
import type { StaffProfile } from "../api/staff";
import {
  LayoutDashboard,
  ClipboardList,
  Activity,
  Users,
  ShieldCheck,
  Search,
  Plus,
  ChevronRight,
  LogOut,
  Building2,
  Stethoscope,
  Bell,
  PanelLeft,
  Home,
  ShieldPlus,
  Sparkles,
} from "lucide-react";

export type Tab =
  | "prevention-tab"
  | "asha-tab"
  | "specialist-tab"
  | "overview-tab"
  | "encounter-tab"
  | "intake-tab"
  | "tracker-tab"
  | "privacy-tab";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogoutToGateway?: () => void;
  staff?: StaffProfile | null;
  onSignOut?: () => void;
  onOpenPatient?: (token: string) => void;
  children: ReactNode;
}

interface NavItem {
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  category: "home" | "clinical" | "diagnostics" | "coordination";
}

const NAV_ITEMS: NavItem[] = [
  { id: "prevention-tab", label: "Prevention & Immunization", icon: ShieldPlus, category: "home" },
  { id: "asha-tab", label: "ASHA Field Network", icon: Users, category: "coordination" },
  { id: "specialist-tab", label: "Specialist Review Portal", icon: Stethoscope, category: "clinical" },
  { id: "overview-tab", label: "Ward & Population Overview", icon: Home, category: "home" },
  { id: "encounter-tab", label: "Clinical Encounter", icon: Activity, category: "clinical" },
  { id: "intake-tab", label: "Clinical Intake", icon: ClipboardList, category: "diagnostics" },
  { id: "tracker-tab", label: "Rural Tracker", icon: Building2, category: "diagnostics" },
  { id: "privacy-tab", label: "Security & Audit", icon: ShieldCheck, category: "coordination" },
];

export function DashboardLayout({ activeTab, onTabChange, onLogoutToGateway, staff, onSignOut, onOpenPatient, children }: Props) {
  const initials = staff
    ? staff.name.replace(/^(Dr|Sister)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "DM";
  // Phones have no room for the navigation panel beside the page, so it starts closed there.
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
  const [panel, setPanel] = useState<"genie" | "whats-new" | null>(null);
  const [search, setSearch] = useState("");
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCollapsed(false);
        setTimeout(() => searchBox.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goTo = (tab: Tab) => {
    setPanel(null);
    setSearch("");
    if (window.innerWidth < 768) setCollapsed(true);
    onTabChange(tab);
  };
  const matches = (item: NavItem) => item.label.toLowerCase().includes(search.trim().toLowerCase());
  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  const clinicalItems = NAV_ITEMS.filter((i) => i.category === "clinical" && matches(i));
  const diagnosticItems = NAV_ITEMS.filter((i) => i.category === "diagnostics" && matches(i));
  const coordinationItems = NAV_ITEMS.filter((i) => i.category === "coordination" && matches(i));

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-[#FAFAFA] text-black font-sans antialiased`}>
      {/* Mobile Drawer Backdrop */}
      {!collapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-20 backdrop-blur-xs transition-opacity"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Unified Single Responsive Navigation Sidebar */}
      <aside
        className={`h-full bg-white border-r border-slate-200/90 flex flex-col justify-between z-30 select-none transition-all duration-200 ease-in-out ${
          collapsed
            ? "w-16 min-w-16 items-center py-4 px-2"
            : "w-64 min-w-64 p-4 max-md:fixed max-md:left-0 max-md:top-0 max-md:h-screen max-md:shadow-2xl"
        }`}
      >
        {collapsed ? (
          /* ================= Collapsed Icon-Only Mode ================= */
          <>
            <div className="flex flex-col items-center gap-3 w-full">
              {/* Brand Logo & Expand toggle */}
              <div className="flex flex-col items-center gap-2">
                <div
                  onClick={() => onTabChange("overview-tab")}
                  className="size-10 rounded-xl bg-white border border-teal-600/30 flex items-center justify-center shadow-xs cursor-pointer hover:bg-slate-50 transition-colors p-1"
                  title="CerviSetu Clinical Platform"
                >
                  <CerviSetuLogo size={28} />
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Expand navigation (Ctrl+K)"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="size-4" />
                </button>
              </div>

              <div className="w-8 h-px bg-slate-200 my-1" />

              {/* Quick Nav Icons */}
              <div className="flex flex-col items-center gap-1.5 w-full">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => goTo(item.id)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
                        isActive
                          ? "bg-teal-50 text-teal-700 shadow-xs"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <Icon className="size-5" />
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-600 rounded-r-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsed Footer: Gateway, Sign Out, Avatar */}
            <div className="flex flex-col items-center gap-2.5 w-full pt-3 border-t border-slate-100">
              {onLogoutToGateway && (
                <button
                  onClick={onLogoutToGateway}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Return to CARE Gateway"
                  aria-label="Return to CARE Gateway"
                >
                  <Building2 className="size-4.5" />
                </button>
              )}

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="p-2 rounded-xl text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                  data-testid="staff-sign-out"
                >
                  <LogOut className="size-4.5" />
                </button>
              )}

              <div
                className="relative cursor-default"
                title={staff ? `${staff.name} · ${staff.role_label} · ${staff.facility}` : "Signed in"}
                data-testid="staff-avatar"
              >
                <div className="size-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
            </div>
          </>
        ) : (
          /* ================= Expanded Navigation Mode ================= */
          <>
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => goTo("overview-tab")}>
                  <div className="size-8 rounded-lg bg-teal-50 border border-teal-600/30 flex items-center justify-center p-1">
                    <CerviSetuLogo size={22} />
                  </div>
                  <div>
                    <h1 className="font-bold text-sm text-slate-900 tracking-tight leading-none">
                      CerviSetu
                    </h1>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                      District Spoke Clinic
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeft className="size-4" />
                </button>
              </div>

              {/* Quick Search */}
              <div className="mb-4">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 size-3.5 text-slate-400" />
                  <input
                    ref={searchBox}
                    type="text"
                    placeholder="Search workflows..."
                    value={search}
                    data-testid="nav-search"
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearch("");
                      const first = NAV_ITEMS.find(matches);
                      if (e.key === "Enter" && search.trim() && first) goTo(first.id);
                    }}
                    className="w-full pl-8.5 pr-12 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600 transition-colors"
                  />
                  <span className="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
                    Ctrl+K
                  </span>
                </div>
              </div>

              {/* Home */}
              <div className="mb-3">
                <button
                  onClick={() => goTo("overview-tab")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "overview-tab"
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Home className={`size-4 shrink-0 ${activeTab === "overview-tab" ? "text-teal-600" : "text-slate-400"}`} />
                  <span>Ward Dashboard</span>
                </button>
              </div>

              {/* Group 1: Clinical Care */}
              <div className="mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                  Clinical Care
                </span>
                <div className="space-y-0.5">
                  {clinicalItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-teal-50 text-teal-800 font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Diagnostics & AI */}
              <div className="mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                  Diagnostics & AI
                </span>
                <div className="space-y-0.5">
                  {diagnosticItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-teal-50 text-teal-800 font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: Coordination */}
              <div className="mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                  Coordination
                </span>
                <div className="space-y-0.5">
                  {coordinationItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-teal-50 text-teal-800 font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* What's New Item */}
              <div className="mt-auto pt-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPanel("whats-new")}
                  data-testid="whats-new"
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="size-3.5 text-amber-500" />
                    <span>What's new</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    New
                  </span>
                </button>
              </div>
            </div>

            {/* Expanded Footer: Status, Gateway, Profile & Sign Out */}
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                  <span className="text-xs font-semibold text-slate-700">Mirzapur Spoke</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Online
                </span>
              </div>

              {onLogoutToGateway && (
                <button
                  onClick={onLogoutToGateway}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                >
                  <Building2 className="size-3.5" />
                  <span>Switch to Gateway</span>
                </button>
              )}

              {/* Profile Card & Sign out */}
              <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="relative cursor-default"
                    title={staff ? `${staff.name} · ${staff.role_label} · ${staff.facility}` : "Signed in"}
                    data-testid="staff-avatar"
                  >
                    <div className="size-7 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 border border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate leading-tight">
                      {staff ? staff.name : "Staff User"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">
                      {staff ? staff.role_label : "Clinical Officer"}
                    </p>
                  </div>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                    data-testid="staff-sign-out"
                  >
                    <LogOut className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* 3. Main Workspace Area */}
      <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#FAFAFA]">
        {/* Top Header Bar Matching Image 1 */}
        <header className="h-14 min-h-14 bg-white border-b border-slate-200/90 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 z-10">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-2.5 min-w-0 text-xs text-slate-500 font-medium">
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                title="Expand navigation panel"
              >
                <PanelLeft className="size-4" />
              </button>
            )}
            <span
              onClick={() => onTabChange("overview-tab")}
              className="hidden lg:inline cursor-pointer hover:text-black transition-colors"
            >
              Home
            </span>
            <ChevronRight className="hidden lg:block size-3 text-slate-400" />
            <span className="hidden sm:inline truncate text-black font-semibold text-sm">{currentNav.label}</span>
          </div>

          {/* Right Action Controls: Pill Buttons matching Image 1 */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {staff && (
              <div
                className="hidden md:flex items-center gap-2 border border-slate-200 rounded-full pl-1 pr-3 py-1 text-xs"
                data-testid="staff-chip"
              >
                <span className="size-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {initials}
                </span>
                <span className="font-semibold text-slate-800 max-w-40 truncate">{staff.name}</span>
                <span className="text-slate-500">{staff.role_label}</span>
                {staff.offline && <span className="text-[10px] text-amber-600 font-semibold">offline</span>}
              </div>
            )}
            <LanguageSwitch className="max-sm:w-[88px] max-sm:[&>select]:w-full" />
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "genie" ? null : "genie"))}
              data-testid="ask-genie"
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Ask Genie</span>
            </button>

            {/* Black Pill Button: New Patient Case (Inspired by "Build your voice agent") */}
            <button
              onClick={() => onTabChange("intake-tab")}
              aria-label="New Patient Case"
              className="flex items-center gap-1.5 bg-black hover:bg-black/85 text-white rounded-full px-2 sm:px-4 py-1.5 whitespace-nowrap text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Patient Case</span>
            </button>
          </div>
        </header>

        {/* Tab Viewport with Adaptive Layout (Full-bleed for clinical encounter) */}
        <main className={`staff-main flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden ${
          activeTab === "encounter-tab" ? "p-0" : "p-4 sm:p-8 lg:p-10"
        }`}>
          <div className={`w-full ${
            activeTab === "encounter-tab" ? "h-full" : "max-w-5xl mx-auto"
          }`}>
            {children}
          </div>
        </main>
      </div>
      <ErrorBoundary
        name="genie"
        fallback={
          <button type="button" onClick={() => window.location.reload()} data-testid="genie-failed" className="fixed bottom-4 right-4 z-50 rounded-full bg-white border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-lg cursor-pointer">
            Genie stopped. Reload
          </button>
        }
      >
        <GeniePanel
          open={panel === "genie"}
          staffName={staff?.name}
          onClose={() => setPanel(null)}
          onOpenTab={goTo}
          onOpenPatient={(token) => {
            if (window.innerWidth < 640) setPanel(null);
            onOpenPatient?.(token);
          }}
        />
      </ErrorBoundary>
      {panel === "whats-new" && <WhatsNewPanel onClose={() => setPanel(null)} onOpenTab={goTo} />}
    </div>
  );
}
