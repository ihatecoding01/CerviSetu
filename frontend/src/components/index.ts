// ============================================================================
// CerviSetu Components Directory (Codename Drake Architecture)
// ============================================================================

// 1. Auth & Access Gateways
export * from "./auth/CareGateway";
export * from "./auth/StaffSignIn";
export * from "./auth/MobileOtpLogin";
export * from "./auth/AbhaRegistration";
export * from "./auth/OtpBoxes";

// 2. Patient & Care Companion
export * from "./patient/PatientPortal";
export * from "./patient/PatientCompanion";
export * from "./patient/PatientGenie";
export * from "./patient/ReferralJourney";
export * from "./patient/PatientSessionRedirect";

// 3. Frontline & ASHA Field Coordination
export * from "./field/AshaHome";
export * from "./field/FieldShell";
export * from "./field/AshaCoordination";

// 4. Clinical & Hospital Workstations
export { ClinicianEncounter, type EncounterTab } from "./clinical/ClinicianEncounter";
export * from "./clinical/CaseRecord";
export * from "./clinical/HospitalDesk";
export * from "./clinical/ReferralIntake";
export * from "./clinical/PreventionScreening";
export * from "./clinical/SpecialistReviewPortal";
export * from "./clinical/WhoTargetsProtocolElement";

// 5. Administration & Governance
export * from "./admin/AdminWorkspace";
export * from "./admin/AdminHospitals";
export * from "./admin/AuditLedger";

// 6. Dashboard, Analytics & Intelligence
export * from "./dashboard/DashboardLayout";
export * from "./dashboard/OverviewPanel";
export * from "./dashboard/EscalationHeatmap";
export * from "./dashboard/DocumentWorkspace";
export * from "./dashboard/GeniePanel";
export * from "./dashboard/MessageCenter";

// 7. Landing & 3D Interactive Hero
export * from "./landing/LandingPage";

// 8. Shared Common Utilities
export * from "./common/LanguageSwitch";
export * from "./common/ErrorBoundary";
