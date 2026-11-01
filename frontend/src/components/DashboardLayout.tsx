import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ScanLine,
  Flame,
  Users,
  ShieldCheck,
  Search,
  Bell,
  Plus,
  ArrowLeft,
  ChevronRight,
  Activity,
  LogOut,
  Smartphone,
  Tablet,
  Building2,
} from "lucide-react";
import { Button } from "./careui/button";

export type Tab =
  | "intake-tab"
  | "image-tab"
  | "tracker-tab"
  | "privacy-tab"
  | "asha-tab"
  | "overview-tab"
  | "patient-tab"
  | "dual-tab";

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
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview-tab", label: "Dashboard", icon: LayoutDashboard, description: "Real-time case stats & triage" },
  { id: "patient-tab", label: "Patient Companion", icon: Smartphone, description: "29-Step clock & vouchers (70%)" },
  { id: "dual-tab", label: "Dual-Screen Demo", icon: Tablet, description: "Clinic Tablet | Patient Phone" },
  { id: "intake-tab", label: "Clinical Intake", icon: FileSpreadsheet, description: "Multi-agent LangGraph engine" },
  { id: "image-tab", label: "Image Quality Triage", icon: ScanLine, description: "Laplacian blur & FFT check" },
  { id: "tracker-tab", label: "Rural Tracker", icon: Flame, description: "Tier 1-4 escalation matrix" },
  { id: "asha-tab", label: "ASHA Coordination", icon: Users, description: "Worker alerts & field dispatch" },
  { id: "privacy-tab", label: "Security & Audit", icon: ShieldCheck, description: "AES-256 Vault & SHA-256 log" },
];

export function DashboardLayout({ activeTab, onTabChange, onLogoutToGateway, children }: Props) {
  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] text-[#111418] font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 min-w-64 h-full bg-white border-r border-gray-200 flex flex-col justify-between p-3.5 z-20 shadow-2xs">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2 py-2.5 mb-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#111418] text-white shadow-xs">
              <Activity className="size-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#111418] block leading-none">CerviSetu</span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mt-1">Clinical AI Platform</span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="px-1 mb-4">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search cases, tokens..."
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50/80 border border-gray-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2B66E4] focus:bg-white transition-colors"
              />
              <span className="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-white border border-gray-200 rounded">⌘K</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#111418] text-white shadow-xs font-medium"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${isActive ? "text-white" : "text-gray-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-tight truncate">{item.label}</div>
                    <div className={`text-[10px] leading-tight truncate mt-0.5 ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-gray-100 pt-3 px-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-medium text-gray-600">Live Network</span>
            </div>
            <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">v1.0</span>
          </div>

          {onLogoutToGateway && (
            <button
              onClick={onLogoutToGateway}
              className="flex items-center gap-2 text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 py-1.5 px-2 rounded-lg border border-emerald-200/60 transition-colors cursor-pointer font-medium"
            >
              <Building2 className="size-3.5" />
              <span>CARE Gateway Login</span>
            </button>
          )}

          <button
            onClick={() => onTabChange("overview-tab")}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors pt-0.5 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Switch Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#F8F9FA]">
        {/* Top Clinical Header Bar */}
        <header className="h-14 min-h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between z-10 shadow-2xs">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <button
              onClick={() => onTabChange("overview-tab")}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-600 cursor-pointer"
              title="Back to Overview"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <span>Home</span>
            <ChevronRight className="size-3 text-gray-400" />
            <span className="text-gray-900 font-semibold">{currentNav.label}</span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => onTabChange("intake-tab")}
              size="sm"
              className="bg-[#2B66E4] hover:bg-[#2052C0] text-white gap-1.5 shadow-xs font-medium"
            >
              <Plus className="size-3.5" />
              <span>New Patient Case</span>
            </Button>

            <button
              className="size-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="size-3.5" />
              <span className="absolute top-1.5 right-1.5 size-1.5 bg-[#2B66E4] rounded-full"></span>
            </button>

            {/* Clinician Profile Tile */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200">
              <div className="size-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-semibold text-[#2B66E4]">
                DM
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-gray-900 leading-none">Dr. Morgan</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-none">Oncology Lead</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Viewport */}
        <main className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden p-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
