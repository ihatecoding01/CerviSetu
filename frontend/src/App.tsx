import { useState, useEffect } from "react";
import { api, type PatientCase, type AuditLog, type EscalationSimResult } from "./api/client";
import { DashboardLayout, type Tab } from "./components/DashboardLayout";
import { OverviewPanel } from "./components/OverviewPanel";
import { ClinicalIntake } from "./components/ClinicalIntake";
import { ImageQualityTriage } from "./components/ImageQualityTriage";
import { EscalationHeatmap } from "./components/EscalationHeatmap";
import { AshaCoordination } from "./components/AshaCoordination";
import { AuditLedger } from "./components/AuditLedger";
import { CareGateway } from "./components/CareGateway";
import { PatientCompanion } from "./components/PatientCompanion";
import { DualScreenDemo } from "./components/DualScreenDemo";
import { useRouter } from "./lib/router";

export default function App() {
  const { currentRoute, navigate } = useRouter();
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

  // 1. Initial / Logout Gateway View (URL: / or /gateway)
  if (currentRoute.view === "gateway") {
    return (
      <CareGateway
        onLoginStaff={() => navigate({ view: "staff", tab: "overview-tab" })}
        onLoginPatient={(token) => {
          navigate({ view: "patient", token: token || "PT-RURAL-7891" });
        }}
        onOpenDualView={() => navigate("/demo")}
      />
    );
  }

  // 2. Direct Patient Mobile Companion View (URL: /patient or /patient/:token)
  if (currentRoute.view === "patient") {
    const activeToken = currentRoute.patientToken || "PT-RURAL-7891";
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            ← CARE Gateway
          </button>
          <button
            onClick={() => navigate({ view: "staff", tab: "overview-tab" })}
            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800 transition-colors cursor-pointer"
          >
            Switch to Staff Workstation ➔
          </button>
          <button
            onClick={() => navigate("/demo")}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 px-3 py-1.5 rounded-lg border border-indigo-800 transition-colors cursor-pointer"
          >
            Dual View (Tablet | Phone) ➔
          </button>
        </div>

        <PatientCompanion
          patientToken={activeToken}
          onExitToGateway={() => navigate("/")}
        />
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
            navigate(`/patient/${token}`);
          }}
        />
      )}

      {currentTab === "patient-tab" && (
        <div className="flex flex-col items-center justify-center py-2">
          <div className="mb-4 text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Patient-Side Vernacular Co-Pilot (70% Functional Weight)
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Testing active session for Token: <strong className="font-mono text-slate-700">PT-RURAL-7891</strong>
            </p>
          </div>
          <PatientCompanion patientToken="PT-RURAL-7891" />
        </div>
      )}

      {currentTab === "dual-tab" && (
        <DualScreenDemo
          onBackToStaff={() => navigate({ view: "staff", tab: "overview-tab" })}
          onBackToGateway={() => navigate("/")}
        />
      )}

      {currentTab === "intake-tab" && (
        <ClinicalIntake onCaseSubmitted={handleCaseSubmitted} />
      )}

      {currentTab === "image-tab" && <ImageQualityTriage />}

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
