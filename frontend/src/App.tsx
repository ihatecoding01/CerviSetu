import { useState, useEffect } from "react";
import { api, type PatientCase, type AuditLog, type EscalationSimResult } from "./api/client";
import { DashboardLayout, type Tab } from "./components/DashboardLayout";
import { OverviewPanel } from "./components/OverviewPanel";
import { ClinicalIntake } from "./components/ClinicalIntake";
import { ImageQualityTriage } from "./components/ImageQualityTriage";
import { EscalationHeatmap } from "./components/EscalationHeatmap";
import { AshaCoordination } from "./components/AshaCoordination";
import { AuditLedger } from "./components/AuditLedger";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overview-tab");
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
    setActiveTab("overview-tab");
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "overview-tab" && (
        <OverviewPanel
          cases={cases}
          loading={loading}
          error={error}
          onRefresh={fetchCases}
          onSelectCase={(_token) => {
            setActiveTab("tracker-tab");
          }}
        />
      )}

      {activeTab === "intake-tab" && (
        <ClinicalIntake onCaseSubmitted={handleCaseSubmitted} />
      )}

      {activeTab === "image-tab" && <ImageQualityTriage />}

      {activeTab === "tracker-tab" && (
        <EscalationHeatmap
          cases={cases}
          lastSim={lastSim}
          onSimulate={setLastSim}
        />
      )}

      {activeTab === "asha-tab" && (
        <AshaCoordination cases={cases} loading={loading} />
      )}

      {activeTab === "privacy-tab" && (
        <AuditLedger
          logs={auditLogs}
          loading={loading}
          onRefresh={fetchAuditLogs}
        />
      )}
    </DashboardLayout>
  );
}
