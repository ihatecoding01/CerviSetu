import { useState, useEffect } from "react";
import { api, type PatientCase, type AuditLog, type EscalationSimResult } from "./api/client";
import { DashboardLayout, type Tab } from "./components/DashboardLayout";
import { OverviewPanel } from "./components/OverviewPanel";
import { ClinicalIntake } from "./components/ClinicalIntake";
import { EscalationHeatmap } from "./components/EscalationHeatmap";
import { AshaCoordination } from "./components/AshaCoordination";
import { AuditLedger } from "./components/AuditLedger";
import { CareGateway, PATIENT_LOGIN_FLAG } from "./components/CareGateway";
import { PatientPortal } from "./components/PatientPortal";
import { PatientSessionRedirect } from "./components/PatientSessionRedirect";
import { PatientCompanion } from "./components/PatientCompanion";
import { DualScreenDemo } from "./components/DualScreenDemo";
import { ClinicianEncounter } from "./components/ClinicianEncounter";
import { PreventionScreening } from "./components/PreventionScreening";
import { LandingPage } from "./components/LandingPage";
import { useRouter } from "./lib/router";
import { StaffSignIn } from "./components/StaffSignIn";
import { staffApi, type StaffProfile } from "./api/staff";

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

  // Staff session: undefined = still checking, null = signed out.
  const [staff, setStaff] = useState<StaffProfile | null | undefined>(undefined);

  useEffect(() => {
    staffApi.session().then((s) => setStaff(s));
  }, []);

  useEffect(() => {
    if (!staff) return;
    fetchCases();
    fetchAuditLogs();
  }, [staff?.staff_id]);

  const signOutStaff = async () => {
    await staffApi.logout();
    setStaff(null);
    navigate("/gateway");
  };

  const handleCaseSubmitted = (newCase?: any) => {
    if (newCase && newCase.patient_token) {
      setCases((prev) => [newCase, ...prev]);
    }
    // Stay on the intake screen so the clinician can review the AI output and sign off
  };

  // 0. Landing Page View (URL: / or /landing)
  if (currentRoute.view === "landing") {
    return (
      <LandingPage
        onLaunchWorkstation={() => navigate({ view: "staff", tab: "overview-tab" })}
        onOpenPatientCompanion={() => navigate("/patient")}
        onOpenDualView={() => navigate("/demo")}
        onOpenGateway={() => navigate("/gateway")}
      />
    );
  }

  // 1. Initial / Logout Gateway View (URL: /gateway)
  if (currentRoute.view === "gateway") {
    return (
      <CareGateway
        onLoginStaff={async () => {
          // Always show the sign-in screen from the gateway, even if a session is still open.
          await staffApi.logout();
          setStaff(null);
          navigate({ view: "staff", tab: "overview-tab" });
        }}
        onLoginAsha={async () => {
          await staffApi.logout();
          setStaff(null);
          navigate({ view: "staff", tab: "asha-tab" });
        }}
        onLoginPatient={(token) => {
          if (token) navigate(`/patient/${token}`);
        }}
        onOpenDualView={() => navigate("/demo")}
        onOpenLanding={() => navigate("/landing")}
      />
    );
  }

  // 2. Patient portal (URL: /patient or /patient/:token). Session-scoped; never falls back to a demo patient.
  if (currentRoute.view === "patient") {
    const requireLogin = () => {
      try {
        sessionStorage.setItem(PATIENT_LOGIN_FLAG, "1");
      } catch {
        // storage unavailable: the gateway still opens, just without the modal
      }
      navigate("/gateway");
    };
    if (!currentRoute.patientToken) {
      return <PatientSessionRedirect onFound={(tok) => navigate(`/patient/${tok}`)} onMissing={requireLogin} />;
    }
    return (
      <PatientPortal
        key={currentRoute.patientToken}
        token={currentRoute.patientToken}
        onRequireLogin={requireLogin}
        onOpenOwnRecord={(tok) => navigate(`/patient/${tok}`)}
      />
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

  // 4. Staff Workstation View (URL: /staff or /staff/:tab), only after staff sign-in
  const currentTab: Tab = currentRoute.tab || "overview-tab";

  if (staff === undefined) {
    return <div className="min-h-screen bg-[#FAFAFA]" />;
  }
  if (!staff) {
    return (
      <StaffSignIn
        preferredRole={currentTab === "asha-tab" ? "ASHA" : undefined}
        onSignedIn={(s) => {
          setStaff(s);
          if (s.role === "ASHA" && currentTab !== "asha-tab") navigate({ view: "staff", tab: "asha-tab" });
        }}
        onBack={() => navigate("/gateway")}
      />
    );
  }

  return (
    <DashboardLayout
      activeTab={currentTab}
      onTabChange={(newTab) => navigate({ view: "staff", tab: newTab })}
      onLogoutToGateway={() => navigate("/")}
      staff={staff}
      onSignOut={signOutStaff}
      onOpenPatient={(token) => {
        setSelectedPatientToken(token);
        navigate({ view: "staff", tab: "encounter-tab" });
      }}
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
        staff?.role === "ASHA" ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" data-testid="role-notice">
            Prevention and screening records are open to doctors, nurses and administrators. Your field work is in ASHA Network.
          </p>
        ) : (
          <PreventionScreening />
        )
      )}

      {currentTab === "encounter-tab" && (
        <ClinicianEncounter
          patientToken={selectedPatientToken}
          cases={cases}
          onSelectPatient={(token) => setSelectedPatientToken(token)}
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
          canReview={staff?.role === "DOCTOR" || staff?.role === "ADMIN"}
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
