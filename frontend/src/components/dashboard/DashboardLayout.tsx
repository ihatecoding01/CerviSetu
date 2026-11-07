import type { ReactNode } from "react";
import { Activity, ClipboardList, Eye, Home, ListChecks, ShieldCheck, ShieldPlus, Stethoscope, Users } from "lucide-react";
import type { StaffProfile } from "../../api/staff";
import { AppShell, type NavItem } from "../app/AppShell";
import { staffGenie } from "../app/genieConfigs";

export type Tab =
  | "intake-tab"
  | "tracker-tab"
  | "privacy-tab"
  | "asha-tab"
  | "overview-tab"
  | "cases-tab"
  | "patient-tab"
  | "encounter-tab"
  | "prevention-tab"
  | "admin-tab";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogoutToGateway?: () => void;
  staff: StaffProfile;
  onSignOut: () => void;
  onOpenPatient?: (token: string) => void;
  children: ReactNode;
}

const DOCTOR_NAV: NavItem[] = [
  { id: "overview-tab", label: "Dashboard", icon: Home },
  { id: "cases-tab", label: "Referral cases", icon: ListChecks },
  { id: "intake-tab", label: "Register patient", icon: ClipboardList },
  { id: "encounter-tab", label: "Case record", icon: Stethoscope },
  { id: "tracker-tab", label: "Follow-up tracker", icon: Activity },
  { id: "asha-tab", label: "ASHA network", icon: Users },
  { id: "prevention-tab", label: "Prevention and screening", icon: ShieldPlus },
  { id: "privacy-tab", label: "Audit and privacy", icon: ShieldCheck },
  { id: "patient-tab", label: "Patient view", icon: Eye },
];
export const NURSE_NAV: NavItem[] = [
  { id: "overview-tab", label: "Work queue", icon: Home },
  { id: "intake-tab", label: "New screening", icon: ClipboardList },
  { id: "cases-tab", label: "Referrals", icon: ListChecks },
  { id: "tracker-tab", label: "Follow-up tracker", icon: Activity },
  { id: "prevention-tab", label: "Prevention and screening", icon: ShieldPlus },
];

/** Doctor and nurse workspace on the shared shell. Each role gets only its own pages. */
export function DashboardLayout({ activeTab, onTabChange, staff, onSignOut, onOpenPatient, children }: Props) {
  const nurse = staff.role === "NURSE";
  const nav = nurse ? NURSE_NAV : DOCTOR_NAV;
  const current = nav.find((n) => n.id === activeTab) ?? nav[0];
  const tabNames = Object.fromEntries(nav.map((n) => [n.id, n.label]));
  return (
    <AppShell staff={staff} portal={nurse ? "Nurse" : "Doctor"} nav={nav} active={activeTab} title={current.label}
      onNavigate={(id) => onTabChange(id as Tab)} onSignOut={onSignOut} wide={activeTab === "encounter-tab"}
      genie={staffGenie(nurse ? "NURSE" : "DOCTOR", { onOpenPatient: nurse ? undefined : onOpenPatient, onOpenTab: (t) => onTabChange(t as Tab), tabNames })}>
      {children}
    </AppShell>
  );
}
