import { useState, useEffect } from "react";
import { api, type PatientCase, type AuditLog, type EscalationSimResult } from "./api/client";
import { DashboardLayout, type Tab } from "./components/DashboardLayout";
import { OverviewPanel } from "./components/OverviewPanel";
import { ClinicalIntake } from "./components/ClinicalIntake";
import { EscalationHeatmap } from "./components/EscalationHeatmap";
import { AshaCoordination } from "./components/AshaCoordination";
import { AuditLedger } from "./components/AuditLedger";
import { CareGateway } from "./components/CareGateway";
import { PatientCompanion } from "./components/PatientCompanion";
import { DualScreenDemo } from "./components/DualScreenDemo";
import { ClinicianEncounter } from "./components/ClinicianEncounter";
import { PreventionScreening } from "./components/PreventionScreening";
import { LandingPage } from "./components/LandingPage";
import { useRouter } from "./lib/router";

export default function App() {
  const { currentRoute, navigate } = useRouter();
  const [selectedPatientToken, setSelectedPatientToken] = useState<string>("PT-RURAL-7891");
  const [cases, setCases] = useState<PatientCase[]>([
    {
      patient_token: "PT-RURAL-7891",
      status: "ACTIVE",
      days_overdue: 8,
      cancer_severity_score: 0.88,
      current_escalation_tier: "Tier 4 · AUTHORITY",
    },
    {
      patient_token: "PT-RURAL-4421",
      status: "ACTIVE",
      days_overdue: 6,
      cancer_severity_score: 0.72,
      current_escalation_tier: "Tier 3 · ASHA",
    },
    {
      patient_token: "PT-RURAL-1102",
      status: "ACTIVE",
      days_overdue: 3,
      cancer_severity_score: 0.45,
      current_escalation_tier: "Tier 2 · IVR",
    },
    {
      patient_token: "PT-RURAL-9034",
      status: "ACTIVE",
      days_overdue: 1,
      cancer_severity_score: 0.35,
      current_escalation_tier: "Tier 1 · SMS",
    },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      event_id: "evt-001",
      timestamp: "2026-10-21 12:00:00",
      severity: "CRITICAL",
      action: "TIER_4_AUTHORITY_ESCALATION",
      actor: "ESCALATION_ENGINE",
      patient_token: "PT-RURAL-7891",
    },
    {
      event_id: "evt-002",
      timestamp: "2026-10-21 11:00:00",
      severity: "WARNING",
      action: "TIER_3_ASHA_DISPATCH",
      actor: "ESCALATION_ENGINE",
      patient_token: "PT-RURAL-4421",
    },
    {
      event_id: "evt-003",
      timestamp: "2026-10-21 10:00:00",
      severity: "INFO",
      action: "AES256_PII_TOKENIZED",
      actor: "INTAKE_AGENT",
      patient_token: "PT-RURAL-9034",
    },
  ]);
  const [lastSim, setLastSim] = useState<EscalationSimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      if (data?.cases && data.cases.length > 0) {
        setCases(data.cases);
      }
    } catch {
      // Backend may be offline during dev; keep mock state seamlessly
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      if (data?.audit_logs && data.audit_logs.length > 0) {
        setAuditLogs(data.audit_logs);
      }
    } catch {
      // Keep initial audit logs
    }
  };

  useEffect(() => {
    fetchCases();
    fetchAuditLogs();
  }, []);

  const handleCaseSubmitted = (newCase?: any) => {
    if (newCase && newCase.patient_token) {
      setCases((prev) => [newCase, ...prev]);
    }
    navigate({ view: "staff", tab: "overview-tab" });
  };

  // 0. Landing Page View (URL: / or /landing)
  if (currentRoute.view === "landing") {
    return (
      <LandingPage
        onLaunchWorkstation={() => navigate({ view: "staff", tab: "overview-tab" })}
        onOpenPatientCompanion={() => navigate("/patient/PT-RURAL-7891")}
        onOpenDualView={() => navigate("/demo")}
        onOpenGateway={() => navigate("/gateway")}
      />
    );
  }

  // 1. Initial / Logout Gateway View (URL: /gateway)
  if (currentRoute.view === "gateway") {
    return (
      <CareGateway
        onLoginStaff={() => navigate({ view: "staff", tab: "overview-tab" })}
        onLoginPatient={(token) => {
          navigate({ view: "patient", token: token || "PT-RURAL-7891" });
        }}
        onOpenDualView={() => navigate("/demo")}
        onOpenLanding={() => navigate("/landing")}
      />
    );
  }

  // 2. Direct Patient Care Web Portal View (URL: /patient or /patient/:token)
  if (currentRoute.view === "patient") {
    const activeToken = currentRoute.patientToken || "PT-RURAL-7891";
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans antialiased text-black">
        {/* Top Web Portal Header */}
        <header className="bg-white border-b border-slate-200/90 px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Logo in Burnt Terracotta Crimson */}
            <div className="size-8 rounded-xl bg-[#BA2D0B] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              CS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-black tracking-tight">cervisetu</span>
                <span className="text-xs bg-[#DBFE87] text-black border border-[#c4e872] px-2.5 py-0.5 rounded-full font-bold">
                  Patient Web Portal
                </span>
              </div>
              <span className="text-xs text-slate-500 block leading-tight">
                सर्वाइसेतु रोगी एवं परिजन वेब पोर्टल · Rural Oncology Pathway
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-slate-600 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer font-medium"
            >
              ← Gateway
            </button>
            <button
              onClick={() => {
                setSelectedPatientToken(activeToken);
                navigate({ view: "staff", tab: "encounter-tab" });
              }}
              className="text-xs text-[#BA2D0B] hover:text-white bg-[#BA2D0B]/10 hover:bg-[#BA2D0B] px-3.5 py-1.5 rounded-full border border-[#BA2D0B]/30 font-semibold transition-colors cursor-pointer"
            >
              Clinician Encounter ➔
            </button>
            <button
              onClick={() => navigate({ view: "staff", tab: "overview-tab" })}
              className="text-xs text-black hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full border border-slate-200 font-semibold transition-colors cursor-pointer"
            >
              Staff Workstation ➔
            </button>
            <button
              onClick={() => navigate("/demo")}
              className="text-xs text-white bg-black hover:bg-black/85 px-4 py-1.5 rounded-full font-semibold transition-colors cursor-pointer"
            >
              Dual View Demo ➔
            </button>
          </div>
        </header>

        {/* Responsive Patient Web Page Container */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 sm:px-8 py-8">
          <PatientCompanion
            patientToken={activeToken}
            onExitToGateway={() => navigate("/")}
          />
        </main>
      </div>
    );
  }

  // 3. Dual-Screen Demo View (URL: /demo or /dual)
  if (currentRoute.view === "dual") {
    return (
      <DualScreenDemo
        onBackToStaff={() => navigate({ view: "staff", tab: "overview-tab" })}
        onBackToGateway={() => navigate("/")}
      />
    );
  }

  // 4. Staff Workstation View (URL: /staff or /staff/:tab)
  const currentTab: Tab = currentRoute.tab || "overview-tab";

  return (
    <DashboardLayout
      activeTab={currentTab}
      onTabChange={(newTab) => navigate({ view: "staff", tab: newTab })}
      onLogoutToGateway={() => navigate("/")}
    >
      {currentTab === "overview-tab" && (
        <OverviewPanel
          cases={cases}
          loading={loading}
          error={error}
          onRefresh={fetchCases}
          onSelectCase={(token) => {
            setSelectedPatientToken(token);
            navigate({ view: "staff", tab: "encounter-tab" });
          }}
        />
      )}

      {currentTab === "prevention-tab" && (
        <PreventionScreening />
      )}

      {currentTab === "encounter-tab" && (
        <ClinicianEncounter
          patientToken={selectedPatientToken}
          onBackToDashboard={() => navigate({ view: "staff", tab: "overview-tab" })}
          onOpenPatientCompanion={(token) => navigate(`/patient/${token}`)}
        />
      )}

      {currentTab === "patient-tab" && (
        <div className="w-full max-w-6xl mx-auto py-2">
          <PatientCompanion patientToken={selectedPatientToken || "PT-RURAL-7891"} />
        </div>
      )}

      {currentTab === "dual-tab" && (
        <DualScreenDemo
          onBackToStaff={() => navigate({ view: "staff", tab: "overview-tab" })}
          onBackToGateway={() => navigate("/")}
          isInsideDashboard={true}
        />
      )}

      {currentTab === "intake-tab" && (
        <ClinicalIntake onCaseSubmitted={handleCaseSubmitted} />
      )}

      {currentTab === "tracker-tab" && (
        <EscalationHeatmap
          cases={cases}
          lastSim={lastSim}
          onSimulate={setLastSim}
        />
      )}

      {currentTab === "asha-tab" && (
        <AshaCoordination cases={cases} loading={loading} />
      )}

      {currentTab === "privacy-tab" && (
        <AuditLedger
          logs={auditLogs}
          loading={loading}
          onRefresh={fetchAuditLogs}
        />
      )}
    </DashboardLayout>
  );
}
