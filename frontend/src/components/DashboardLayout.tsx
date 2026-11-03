import { useState, type ReactNode } from "react";
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
  Tablet,
  Building2,
  Stethoscope,
  HeartHandshake,
  Bell,
  PanelLeft,
  Home,
  HeartPulse,
} from "lucide-react";

export type Tab =
  | "intake-tab"
  | "tracker-tab"
  | "privacy-tab"
  | "asha-tab"
  | "overview-tab"
  | "patient-tab"
  | "dual-tab"
  | "encounter-tab";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogoutToGateway?: () => void;
  children: ReactNode;
}

interface NavItem {
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  category: "home" | "clinical" | "diagnostics" | "coordination";
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview-tab", label: "Dashboard", icon: Home, category: "home" },
  { id: "encounter-tab", label: "Clinical Encounter", icon: Stethoscope, category: "clinical" },
  { id: "patient-tab", label: "Patient Portal", icon: HeartHandshake, category: "clinical" },
  { id: "dual-tab", label: "Dual-Screen Demo", icon: Tablet, category: "clinical" },
  { id: "intake-tab", label: "Clinical Intake", icon: ClipboardList, category: "diagnostics" },
  { id: "tracker-tab", label: "Rural Tracker", icon: Activity, category: "diagnostics" },
  { id: "asha-tab", label: "ASHA Network", icon: Users, category: "coordination" },
  { id: "privacy-tab", label: "Security & Audit", icon: ShieldCheck, category: "coordination" },
];

export function DashboardLayout({ activeTab, onTabChange, onLogoutToGateway, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  const clinicalItems = NAV_ITEMS.filter((i) => i.category === "clinical");
  const diagnosticItems = NAV_ITEMS.filter((i) => i.category === "diagnostics");
  const coordinationItems = NAV_ITEMS.filter((i) => i.category === "coordination");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA] text-black font-sans antialiased">
      {/* 1. Far-Left Slim Icon Rail (Inspired by Sarvam Voice Agents Left Rail) */}
      <aside className="w-14 min-w-14 h-full bg-white border-r border-slate-200/90 flex flex-col justify-between items-center py-4 z-30 select-none">
        {/* Top Brand Hexagon */}
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => onTabChange("overview-tab")}
            className="size-9 rounded-xl bg-[#BA2D0B] text-white flex items-center justify-center shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
            title="CerviSetu Clinical Platform"
          >
            <HeartPulse className="size-5 text-white" />
          </div>

          <div className="w-7 h-px bg-slate-200/90 my-1" />

          {/* Quick Clinical Task Shortcuts (Task-relevant oncology icons) */}
          <div className="flex flex-col items-center gap-1.5 text-slate-500">
            <button
              onClick={() => onTabChange("overview-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "overview-tab" ? "bg-slate-100 text-black" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Overview Dashboard"
            >
              <LayoutDashboard className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("encounter-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "encounter-tab" ? "bg-slate-100 text-[#BA2D0B]" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Clinical Encounter"
            >
              <Stethoscope className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("intake-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "intake-tab" ? "bg-slate-100 text-black" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Clinical Intake & OCR"
            >
              <ClipboardList className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("patient-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "patient-tab" ? "bg-slate-100 text-[#BA2D0B]" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Patient Care Portal"
            >
              <HeartHandshake className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("dual-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "dual-tab" ? "bg-slate-100 text-[#F19941]" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Dual-Screen Demo"
            >
              <Tablet className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("tracker-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "tracker-tab" ? "bg-slate-100 text-[#BA2D0B]" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Rural Adherence Tracker"
            >
              <Activity className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("asha-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "asha-tab" ? "bg-slate-100 text-black" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="ASHA Coordination Network"
            >
              <Users className="size-4.5" />
            </button>

            <button
              onClick={() => onTabChange("privacy-tab")}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeTab === "privacy-tab" ? "bg-slate-100 text-black" : "hover:bg-slate-50 hover:text-black"
              }`}
              title="Security & Audit Ledger"
            >
              <ShieldCheck className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Bottom Avatar & Status */}
        <div className="flex flex-col items-center gap-3">
          {onLogoutToGateway && (
            <button
              onClick={onLogoutToGateway}
              className="p-2 rounded-xl text-slate-400 hover:text-black hover:bg-slate-100 transition-colors cursor-pointer"
              title="Return to CARE Gateway"
            >
              <Building2 className="size-4.5" />
            </button>
          )}

          {/* User Initial Avatar with Lime Active Dot */}
          <div className="relative cursor-pointer" title="Logged in as Clinician (Dr. Morgan)">
            <div className="size-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
              DM
            </div>
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[#DBFE87] border-2 border-white" />
          </div>
        </div>
      </aside>

      {/* 2. Main Navigation Panel with Generous Whitespace (Collapsible) */}
      {!collapsed && (
        <aside className="w-60 min-w-60 h-full bg-white border-r border-slate-200/90 flex flex-col justify-between p-4 z-20 select-none">
          <div className="overflow-y-auto pr-1">
            {/* Header: Title + Plan + Collapse Toggle */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <h1 className="font-bold text-base text-black tracking-tight leading-none">
                  CerviSetu
                </h1>
                <span className="text-xs text-slate-500 font-medium block mt-1">
                  District Spoke Clinic
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <PanelLeft className="size-4" />
              </button>
            </div>

            {/* Quick Search Ctrl+K */}
            <div className="mb-5">
              <div className="relative flex items-center">
                <Search className="absolute left-3 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full pl-8.5 pr-12 py-2 text-xs bg-slate-50/80 border border-slate-200/80 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-black transition-colors"
                />
                <span className="absolute right-2.5 px-1.5 py-0.5 text-xs font-mono text-slate-400 bg-white border border-slate-200 rounded">
                  Ctrl+K
                </span>
              </div>
            </div>

            {/* Home Navigation */}
            <div className="mb-4">
              <button
                onClick={() => onTabChange("overview-tab")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === "overview-tab"
                    ? "bg-slate-100 text-black"
                    : "text-slate-600 hover:text-black hover:bg-slate-50"
                }`}
              >
                <Home className="size-4" />
                <span>Home</span>
              </button>
            </div>

            {/* Group 1: Clinical Care */}
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 block mb-1.5">
                Clinical Care
              </span>
              <div className="space-y-0.5">
                {clinicalItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                        isActive
                          ? "bg-slate-100 text-black font-semibold"
                          : "text-slate-600 hover:text-black hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <Icon className={`size-4 shrink-0 ${isActive ? "text-[#BA2D0B]" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group 2: Diagnostics & AI */}
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 block mb-1.5">
                Diagnostics & AI
              </span>
              <div className="space-y-0.5">
                {diagnosticItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                        isActive
                          ? "bg-slate-100 text-black font-semibold"
                          : "text-slate-600 hover:text-black hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <Icon className={`size-4 shrink-0 ${isActive ? "text-[#F19941]" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group 3: Coordination */}
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 block mb-1.5">
                Coordination
              </span>
              <div className="space-y-0.5">
                {coordinationItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                        isActive
                          ? "bg-slate-100 text-black font-semibold"
                          : "text-slate-600 hover:text-black hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <Icon className={`size-4 shrink-0 ${isActive ? "text-[#90C3CB]" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What's New Item */}
            <div className="pt-2 mb-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Bell className="size-4 text-[#F19941]" />
                  <span>What's new</span>
                </div>
                <span className="text-xs font-bold bg-[#DBFE87] text-black px-2 py-0.5 rounded-full">
                  New
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Panel Status & Switcher */}
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#DBFE87] ring-2 ring-[#DBFE87]/50" />
                <span className="text-xs font-semibold text-slate-700">Mirzapur Spoke</span>
              </div>
              <span className="text-xs font-bold bg-[#DBFE87] text-black px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            {onLogoutToGateway && (
              <button
                onClick={onLogoutToGateway}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-black hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
              >
                <LogOut className="size-3.5" />
                <span>Switch to Gateway</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#FAFAFA]">
        {/* Top Header Bar Matching Image 1 */}
        <header className="h-14 min-h-14 bg-white border-b border-slate-200/90 px-6 lg:px-8 flex items-center justify-between z-10">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
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
              className="cursor-pointer hover:text-black transition-colors"
            >
              Home
            </span>
            <ChevronRight className="size-3 text-slate-400" />
            <span className="text-black font-semibold text-sm">{currentNav.label}</span>
          </div>

          {/* Right Action Controls: Pill Buttons matching Image 1 */}
          <div className="flex items-center gap-3">
            {/* Ask Genie / AI Pill Button with Secondary Orange Dot */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800 transition-colors cursor-pointer">
              <span className="size-2 rounded-full bg-[#F19941]" />
              <span>Ask Genie</span>
            </div>

            {/* Black Pill Button: New Patient Case (Inspired by "Build your voice agent") */}
            <button
              onClick={() => onTabChange("intake-tab")}
              className="flex items-center gap-1.5 bg-black hover:bg-black/85 text-white rounded-full px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Patient Case</span>
            </button>
          </div>
        </header>

        {/* Tab Viewport with Generous Whitespace */}
        <main className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden p-6 sm:p-8 lg:p-10">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
