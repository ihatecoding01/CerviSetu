import { useState, useEffect } from "react";
import { api, type PatientCase, type AuditLog } from "./api/client";
import {
  DashboardLayout,
  type Tab,
  OverviewPanel,
  ReferralIntake,
  AshaHome,
  HospitalDesk,
  AdminWorkspace,
  EscalationHeatmap,
  AshaCoordination,
  AuditLedger,
  CareGateway,
  PATIENT_LOGIN_FLAG,
  PatientPortal,
  PatientSessionRedirect,
  PatientCompanion,
  ClinicianEncounter,
  PreventionScreening,
  LandingPage,
  StaffSignIn,
} from "./components";
import { useRouter } from "./lib/router";
import { staffApi, type StaffProfile } from "./api/staff";

const NURSE_TABS: Tab[] = ["overview-tab", "prevention-tab", "intake-tab", "tracker-tab"];

function RedirectTab({ onGo }: { onGo: () => void }) {
  useEffect(onGo, []);
  return null;
}

export default function App() {
  const { currentRoute, navigate } = useRouter();
  const [selectedPatientToken, setSelectedPatientToken] = useState<string>("");
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      setCases(data?.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cases could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setAuditLogs(data?.audit_logs ?? []);
    } catch {
      setAuditLogs([]);
    }
  };

  // Staff session: undefined = still checking, null = signed out.
  const [staff, setStaff] = useState<StaffProfile | null | undefined>(undefined);

  useEffect(() => {
    staffApi.session().then((s) => setStaff(s));
  }, []);

  const [sessionEnded, setSessionEnded] = useState(false);
  useEffect(() => {
    const onEnded = () => {
      setStaff((current) => {
        if (current && !current.offline) {
          setSessionEnded(true);
          return null;
        }
        return current;
      });
    };
    window.addEventListener("cervisetu:staff-session-ended", onEnded);
    return () => window.removeEventListener("cervisetu:staff-session-ended", onEnded);
  }, []);

  useEffect(() => {
    if (!staff || staff.role !== "DOCTOR" && staff.role !== "NURSE") return;
    fetchCases();
    fetchAuditLogs();
  }, [staff?.staff_id]);

  const signOutStaff = async () => {
    await staffApi.logout();
    setStaff(null);
    navigate("/gateway");
  };

  // 0. Landing Page View (URL: / or /landing)
  if (currentRoute.view === "landing") {
    return (
      <LandingPage
        onLaunchWorkstation={() => navigate({ view: "staff", tab: "overview-tab" })}
        onOpenPatientCompanion={() => navigate("/patient")}
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
        onLoginAdmin={async () => {
          await staffApi.logout();
          setStaff(null);
          navigate({ view: "staff", tab: "admin-tab" });
        }}
        onLoginPatient={(token) => {
          if (token) navigate(`/patient/${token}`);
        }}
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

  // 3. Staff Workstation View (URL: /staff or /staff/:tab), only after staff sign-in
  // Administrators only ever see their own page, whatever the address says.
  const currentTab: Tab = staff?.role === "ADMIN" ? "admin-tab" : currentRoute.tab || "overview-tab";

  if (staff === undefined) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-sm text-slate-500" data-testid="app-loading">
        Loading CerviSetu...
      </div>
    );
  }
  if (!staff) {
    return (
      <StaffSignIn
        sessionEnded={sessionEnded}
        preferredRole={currentTab === "asha-tab" ? "ASHA" : currentTab === "admin-tab" ? "ADMIN" : undefined}
        onSignedIn={(s) => {
          setStaff(s);
          if (s.role === "ASHA") navigate({ view: "staff", tab: "asha-tab" });
          if (s.role === "ADMIN") navigate({ view: "staff", tab: "admin-tab" });
          if (s.role === "NURSE") navigate({ view: "staff", tab: "intake-tab" });
        }}
        onBack={() => navigate("/gateway")}
      />
    );
  }

  if (staff.role === "ASHA") return <AshaHome staff={staff} onSignOut={signOutStaff} />;
  if (staff.role === "HOSPITAL") return <HospitalDesk staff={staff} onSignOut={signOutStaff} />;
  if (staff.role === "ADMIN") return <AdminWorkspace staff={staff} onSignOut={signOutStaff} />;
  if (staff.role === "NURSE" && !NURSE_TABS.includes(currentTab)) {
    return <RedirectTab onGo={() => navigate({ view: "staff", tab: "intake-tab" })} />;
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

      {currentTab === "prevention-tab" && <PreventionScreening />}

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
          <PatientCompanion patientToken={selectedPatientToken} />
        </div>
      )}

      {currentTab === "intake-tab" && (
        <ReferralIntake staff={staff} />
      )}

      {currentTab === "tracker-tab" && (
        <EscalationHeatmap
          canReview={staff?.role === "DOCTOR"}
        />
      )}

      {currentTab === "asha-tab" && (
        <AshaCoordination />
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
