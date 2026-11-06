import { useState, useEffect } from "react";
import {
  api,
  type AdolescentBeneficiary,
  type ScreeningCase,
} from "../api/client";
import { Card, CardContent } from "./careui/card";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./careui/table";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import {
  ShieldCheck,
  Syringe,
  CheckCircle2,
  Plus,
  Activity,
  HeartPulse,
  Clock,
  AlertTriangle,
  FileText,
  Check,
  RefreshCw,
} from "lucide-react";

export function PreventionScreening() {
  const [activeCohort, setActiveCohort] = useState<"cohort-1" | "cohort-2">("cohort-1");

  // ==========================================
  // Cohort 1 State: Girls Under 14
  // ==========================================
  const [adolescents, setAdolescents] = useState<AdolescentBeneficiary[]>([]);
  const [adoLoading, setAdoLoading] = useState(false);
  const [adoSuccessMsg, setAdoSuccessMsg] = useState<string | null>(null);
  const [adoErrorMsg, setAdoErrorMsg] = useState<string | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [selectedAdo, setSelectedAdo] = useState<AdolescentBeneficiary | null>(null);

  // Enrollment Form
  const [regForm, setRegForm] = useState({
    full_name: "",
    age: 12,
    dob: "2014-05-10",
    guardian_name: "",
    guardian_phone: "+91 ",
    village: "Gram Pipra, Mirzapur",
    school_or_camp: "Mirzapur Girls Middle School",
    prior_vaccine_audit: "NONE",
  });

  // Dose Form
  const [doseForm, setDoseForm] = useState({
    dose_number: 1,
    batch_number: "CERV-2026-A1",
    admin_site: "Left Deltoid",
    center: "Primary Health Centre Mirzapur",
    administered_date: new Date().toISOString().split("T")[0],
    aefi_reported: false,
    aefi_notes: "",
  });

  // ==========================================
  // Cohort 2 State: Women Aged 35–45
  // ==========================================
  const [screeningCases, setScreeningCases] = useState<ScreeningCase[]>([]);
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenSuccessMsg, setScreenSuccessMsg] = useState<string | null>(null);
  const [screenErrorMsg, setScreenErrorMsg] = useState<string | null>(null);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedScreenCase, setSelectedScreenCase] = useState<ScreeningCase | null>(null);

  // Point-of-Care Intake Form
  const [screenForm, setScreenForm] = useState({
    patient_name: "",
    age: 38,
    screening_type: "VIA" as "VIA" | "PAP_SMEAR" | "COMBINED",
    test_date: new Date().toISOString().split("T")[0],
    findings_classification: "BENIGN_CERVICITIS",
    uploaded_image_or_doc: "/static/samples/via_acetowhite_lesion.jpg",
    symptom_notes: "Excessive foul-smelling discharge, mild pelvic pressure",
    prescribed_local_therapy: "Metronidazole 400mg BD x 7d + Clotrimazole 1% vaginal gel",
    tertiary_facility: "Varanasi Regional Cancer Centre (Hub)",
  });

  // Check-in Form
  const [checkinForm, setCheckinForm] = useState({
    outcome: "SYMPTOMS_RESOLVED" as "SYMPTOMS_RESOLVED" | "PERSISTENT_REFERRED",
    checkin_notes: "Patient confirms all symptoms and discharge resolved following 7-day therapy.",
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setAdoLoading(true);
    setScreenLoading(true);
    try {
      const resAdo = await api.getAdolescents();
      if (resAdo?.beneficiaries) {
        setAdolescents(resAdo.beneficiaries);
      }
    } catch {
      // offline fallback handled by seeded backend
    } finally {
      setAdoLoading(false);
    }

    try {
      const resScreen = await api.getScreeningCases();
      if (resScreen?.cases) {
        setScreeningCases(resScreen.cases);
      }
    } catch {
      // offline fallback
    } finally {
      setScreenLoading(false);
    }
  };

  // Cohort 1 Handlers
  const handleRegisterAdolescent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdoErrorMsg(null);
    setAdoSuccessMsg(null);
    try {
      const res = await api.registerAdolescent(regForm);
      if (res?.beneficiary) {
        setAdolescents([res.beneficiary, ...adolescents]);
        setAdoSuccessMsg(`Beneficiary ${res.beneficiary.full_name} enrolled successfully into Adolescent Registry (Dose 0/2).`);
        setShowRegModal(false);
      }
    } catch (err: any) {
      setAdoErrorMsg(err?.message || "Failed to register adolescent beneficiary.");
    }
  };

  const handleAdministerDose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdo) return;
    setAdoErrorMsg(null);
    setAdoSuccessMsg(null);

    try {
      const res = await api.recordAdolescentDose(selectedAdo.beneficiary_id, doseForm);
      if (res?.beneficiary) {
        setAdolescents(adolescents.map((a) => (a.beneficiary_id === selectedAdo.beneficiary_id ? res.beneficiary : a)));
        setAdoSuccessMsg(
          `Dose ${doseForm.dose_number} recorded for ${selectedAdo.full_name}. Current status: ${res.beneficiary.status} (${res.beneficiary.dose_count}/2).`
        );
        setShowDoseModal(false);
      }
    } catch (err: any) {
      setAdoErrorMsg(err?.message || "Failed to record dose administration.");
    }
  };

  const handleCadenceAlert = async (ado: AdolescentBeneficiary, alertType: "14_DAY_PRE_DUE" | "14_DAY_OVERDUE") => {
    setAdoErrorMsg(null);
    setAdoSuccessMsg(null);
    try {
      const notes =
        alertType === "14_DAY_PRE_DUE"
          ? `14-day pre-due alert for ${ado.full_name}: Parent alerted via SMS; ASHA prompt issued to verify PHC vaccine vial stock.`
          : `14-day overdue escalation for ${ado.full_name}: Priority ASHA task + automated regional voice outreach dispatched.`;
      const res = await api.sendAdolescentCadenceAlert(ado.beneficiary_id, {
        alert_type: alertType,
        notes,
      });
      if (res?.beneficiary) {
        setAdolescents(adolescents.map((a) => (a.beneficiary_id === ado.beneficiary_id ? res.beneficiary : a)));
        setAdoSuccessMsg(res.message);
      }
    } catch (err: any) {
      setAdoErrorMsg(err?.message || "Failed to dispatch cadence alert.");
    }
  };

  // Cohort 2 Handlers
  const handleRecordScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    setScreenErrorMsg(null);
    setScreenSuccessMsg(null);
    try {
      const res = await api.recordScreeningTriage(screenForm);
      if (res?.case) {
        setScreeningCases([res.case, ...screeningCases]);
        setScreenSuccessMsg(
          `Point-of-care screening recorded for ${res.case.patient_name}. AI Triaging routed to: ${res.triage_track} (${res.care_action_status}).`
        );
        setShowScreenModal(false);
      }
    } catch (err: any) {
      setScreenErrorMsg(err?.message || "Failed to record screening.");
    }
  };

  const handleCommunityCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScreenCase) return;
    setScreenErrorMsg(null);
    setScreenSuccessMsg(null);

    try {
      const res = await api.submitCommunityCheckin({
        case_id: selectedScreenCase.case_id,
        outcome: checkinForm.outcome,
        checkin_notes: checkinForm.checkin_notes,
      });
      if (res?.case) {
        setScreeningCases(screeningCases.map((c) => (c.case_id === selectedScreenCase.case_id ? res.case : c)));
        setScreenSuccessMsg(
          `14-day symptom check-in logged for ${selectedScreenCase.patient_name}. Case updated to: ${res.case.care_action_status}.`
        );
        setShowCheckinModal(false);
      }
    } catch (err: any) {
      setScreenErrorMsg(err?.message || "Failed to submit community check-in.");
    }
  };

  // Telemetry Calculations
  const cohort1Unvac = adolescents.filter((a) => a.dose_count === 0).length;
  const cohort1Partial = adolescents.filter((a) => a.dose_count === 1).length;
  const cohort1Immunized = adolescents.filter((a) => a.dose_count === 2).length;
  const cohort1Overdue = adolescents.filter((a) => a.overdue_alert_count > 0).length;

  const cohort2Normal = screeningCases.filter((c) => c.triage_track === "ROUTINE_3_5Y_RECALL").length;
  const cohort2Community = screeningCases.filter((c) => c.triage_track === "ASHA_COMMUNITY_MANAGEMENT").length;
  const cohort2Tertiary = screeningCases.filter((c) => c.triage_track === "TERTIARY_SPECIALIST_REFERRAL").length;

  return (
    <div className="space-y-6">
      {/* Header & Cohort Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            National Cervical Cancer Elimination Protocol
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-teal-700" />
            Prevention, Immunization & Screening Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Coordinated early prevention engine: Adolescent HPV Immunization (Girls 9–14) and Point-of-Care Adult Screening (Women 35–45).
          </p>
        </div>

        {/* High-Contrast Segmented Cohort Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveCohort("cohort-1")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeCohort === "cohort-1"
                ? "bg-white text-teal-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Syringe className="w-4 h-4 text-teal-700" />
            Cohort 1: Girls Under 14
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-900">
              {adolescents.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCohort("cohort-2")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeCohort === "cohort-2"
                ? "bg-white text-teal-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4 text-teal-700" />
            Cohort 2: Women 35–45
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-900">
              {screeningCases.length}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COHORT 1: GIRLS UNDER 14 VIEW */}
      {/* ======================================================== */}
      {activeCohort === "cohort-1" && (
        <div className="space-y-6">
          {adoSuccessMsg && (
            <Alert variant="default" className="bg-emerald-50 border-emerald-200 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertTitle>Immunization Update Confirmed</AlertTitle>
              <AlertDescription className="text-xs">{adoSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {adoErrorMsg && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Action Failed</AlertTitle>
              <AlertDescription className="text-xs">{adoErrorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Cohort 1 Telemetry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Registered</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{adolescents.length}</div>
                <span className="text-[10px] text-slate-500">Ages 9–14 Beneficiaries</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-amber-700 tracking-wider">Unvaccinated (0/2)</span>
                <div className="text-2xl font-bold text-amber-900 mt-1">{cohort1Unvac}</div>
                <span className="text-[10px] text-amber-700">Awaiting Baseline Dose 1</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-blue-700 tracking-wider">Partial (1/2)</span>
                <div className="text-2xl font-bold text-blue-900 mt-1">{cohort1Partial}</div>
                <span className="text-[10px] text-blue-700">Dose 2 Scheduled (+6m)</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-emerald-700 tracking-wider">Fully Immunized (2/2)</span>
                <div className="text-2xl font-bold text-emerald-900 mt-1">{cohort1Immunized}</div>
                <span className="text-[10px] text-emerald-700">Protected & ABDM Synced</span>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-red-700 tracking-wider">Overdue Alerts</span>
                <div className="text-2xl font-bold text-red-900 mt-1">{cohort1Overdue}</div>
                <span className="text-[10px] text-red-700">14-Day Overdue & Escalated</span>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Adolescent Beneficiary Registry & 2-Dose Tracker</h3>
              <p className="text-xs text-slate-500">
                Standard 2-Dose Regimen: Dose 1 (T0) &rarr; Dose 2 (T0 + 6 months), with 14-day pre-due vial readiness &amp; overdue escalation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllData}
                disabled={adoLoading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adoLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowRegModal(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Register Adolescent (ASHA App)
              </Button>
            </div>
          </div>

          {/* Beneficiaries Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Dose Counter</TableHead>
                    <TableHead>Beneficiary / Age</TableHead>
                    <TableHead>Guardian & Location</TableHead>
                    <TableHead>Dose 1 (T0)</TableHead>
                    <TableHead>Dose 2 Due (+6m)</TableHead>
                    <TableHead>14-Day Alerts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adolescents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                        No adolescent beneficiaries registered. Click "Register Adolescent" to enroll.
                      </TableCell>
                    </TableRow>
                  ) : (
                    adolescents.map((ado) => {
                      const doseCount = ado.dose_count;
                      return (
                        <TableRow key={ado.beneficiary_id}>
                          <TableCell>
                            {/* Visual Dose Counter Chip */}
                            <div className="flex items-center">
                              <span
                                className={`inline-flex items-center justify-center font-bold font-mono text-xs px-2.5 py-1 rounded-lg border ${
                                  doseCount === 2
                                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                    : doseCount === 1
                                    ? "bg-blue-100 text-blue-900 border-blue-300"
                                    : "bg-amber-100 text-amber-900 border-amber-300"
                                }`}
                              >
                                {doseCount}/2
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-slate-900 text-sm">{ado.full_name}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              Age {ado.age} Y · {ado.school_or_camp}
                            </div>
                            {ado.abdm_logged ? (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-teal-700 font-medium">
                                <ShieldCheck className="w-3 h-3" />
                                ABDM Synced
                              </span>
                            ) : null}
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-medium text-slate-800">{ado.guardian_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{ado.guardian_phone}</div>
                            <div className="text-[11px] text-slate-400">{ado.village}</div>
                          </TableCell>

                          <TableCell>
                            {ado.dose_1_date ? (
                              <div>
                                <span className="font-mono text-xs font-semibold text-slate-800">{ado.dose_1_date}</span>
                                <div className="text-[10px] text-slate-500">{ado.dose_1_batch || "Cervavac"}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Pending</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {ado.dose_2_due_date ? (
                              <div>
                                <span className="font-mono text-xs font-semibold text-teal-800">
                                  {ado.dose_2_due_date}
                                </span>
                                {ado.dose_2_date ? (
                                  <div className="text-[10px] text-emerald-700 font-medium">
                                    Done on {ado.dose_2_date}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-500">6-Month Milestone</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">After Dose 1</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              {ado.pre_due_alert_sent ? (
                                <Badge variant="neutral" size="xs" className="bg-blue-50 text-blue-800 border-blue-200">
                                  Pre-Due Vial Alert Sent
                                </Badge>
                              ) : null}
                              {ado.overdue_alert_count > 0 ? (
                                <Badge variant="destructive" size="xs">
                                  {ado.overdue_alert_count}x Overdue Escalated
                                </Badge>
                              ) : null}
                              {!ado.pre_due_alert_sent && ado.overdue_alert_count === 0 && (
                                <span className="text-slate-400 text-[11px]">Routine Schedule</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {doseCount < 2 && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => {
                                    setSelectedAdo(ado);
                                    setDoseForm({
                                      ...doseForm,
                                      dose_number: (doseCount + 1) as 1 | 2,
                                    });
                                    setShowDoseModal(true);
                                  }}
                                  className="text-teal-700 border-teal-200 hover:bg-teal-50"
                                >
                                  Administer Dose {doseCount + 1}
                                </Button>
                              )}

                              {doseCount === 1 && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => handleCadenceAlert(ado, "14_DAY_PRE_DUE")}
                                    title="14-Day Pre-Due: Alert parent and prompt ASHA vial stock check"
                                    className="text-xs"
                                  >
                                    14d Pre-Due
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="xs"
                                    onClick={() => handleCadenceAlert(ado, "14_DAY_OVERDUE")}
                                    title="14-Day Overdue: Trigger ASHA priority task and regional voice outreach"
                                  >
                                    14d Overdue
                                  </Button>
                                </>
                              )}

                              {doseCount === 2 && (
                                <span className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Complete
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* COHORT 2: WOMEN AGED 35–45 VIEW */}
      {/* ======================================================== */}
      {activeCohort === "cohort-2" && (
        <div className="space-y-6">
          {screenSuccessMsg && (
            <Alert variant="default" className="bg-emerald-50 border-emerald-200 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertTitle>Screening Triage Processed</AlertTitle>
              <AlertDescription className="text-xs">{screenSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {screenErrorMsg && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Action Failed</AlertTitle>
              <AlertDescription className="text-xs">{screenErrorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Cohort 2 Telemetry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Total Screened</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{screeningCases.length}</div>
                <span className="text-[10px] text-slate-500">Women Aged 35–45</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-emerald-700 tracking-wider">Normal (3–5y Recall)</span>
                <div className="text-2xl font-bold text-emerald-900 mt-1">{cohort2Normal}</div>
                <span className="text-[10px] text-emerald-700">Community Education</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-blue-700 tracking-wider">ASHA Community Track</span>
                <div className="text-2xl font-bold text-blue-900 mt-1">{cohort2Community}</div>
                <span className="text-[10px] text-blue-700">Benign + 14-day Check-in</span>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <span className="text-[11px] font-semibold uppercase text-amber-900 tracking-wider">Tertiary Referrals</span>
                <div className="text-2xl font-bold text-amber-900 mt-1">{cohort2Tertiary}</div>
                <span className="text-[10px] text-amber-800">Specialist Review Queue</span>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Secondary Prevention & Dual-Track Care Manager</h3>
              <p className="text-xs text-slate-500">
                Point-of-care VIA & Pap smear digitization, AI normal vs abnormal segregation, and 14-day community check-ins.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllData}
                disabled={screenLoading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${screenLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowScreenModal(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Point-of-Care VIA/Pap Intake
              </Button>
            </div>
          </div>

          {/* Dual-Track Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient / Age</TableHead>
                    <TableHead>Test & Date</TableHead>
                    <TableHead>Findings & Classification</TableHead>
                    <TableHead>Triage Pathway</TableHead>
                    <TableHead>14-Day Action Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {screeningCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                        No screening records documented. Click "New Point-of-Care Intake" to add.
                      </TableCell>
                    </TableRow>
                  ) : (
                    screeningCases.map((c) => {
                      const isNormal = c.triage_track === "ROUTINE_3_5Y_RECALL";
                      const isCommunity = c.triage_track === "ASHA_COMMUNITY_MANAGEMENT";
                      const isTertiary = c.triage_track === "TERTIARY_SPECIALIST_REFERRAL";

                      return (
                        <TableRow key={c.case_id}>
                          <TableCell>
                            <div className="font-semibold text-slate-900 text-sm">{c.patient_name}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              Age {c.age} Y · {c.patient_token}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="neutral" size="xs">
                              {c.screening_type}
                            </Badge>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.test_date}</div>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-semibold text-slate-900">{c.findings_classification}</div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[240px]">
                              {c.symptom_notes || "No additional symptoms logged"}
                            </div>
                          </TableCell>

                          <TableCell>
                            {isNormal && (
                              <Badge variant="success" size="xs">
                                Routine 3–5Y Recall
                              </Badge>
                            )}
                            {isCommunity && (
                              <Badge variant="neutral" size="xs" className="bg-blue-50 text-blue-900 border-blue-200">
                                ASHA Community Management
                              </Badge>
                            )}
                            {isTertiary && (
                              <Badge variant="destructive" size="xs">
                                Tertiary Specialist Referral
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-slate-800 block">
                                {c.care_action_status}
                              </span>
                              {c.fourteen_day_milestone_date && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  14d Due: {c.fourteen_day_milestone_date}
                                </span>
                              )}
                              {c.prescribed_local_therapy && (
                                <div className="text-[10px] text-blue-700 font-medium">
                                  Tx: {c.prescribed_local_therapy}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            {isCommunity && c.care_action_status === "14_DAY_CHECKIN_PENDING" && (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setSelectedScreenCase(c);
                                  setShowCheckinModal(true);
                                }}
                                className="text-blue-700 border-blue-200 hover:bg-blue-50"
                              >
                                Log 14d Check-in
                              </Button>
                            )}

                            {isTertiary && (
                              <Badge variant="destructive" size="xs" className="bg-amber-100 text-amber-900 border-amber-300">
                                In Specialist Queue
                              </Badge>
                            )}

                            {isNormal && (
                              <span className="text-emerald-700 text-xs font-medium">
                                Closed
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: REGISTER ADOLESCENT (COHORT 1) */}
      {/* ======================================================== */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-teal-700" />
                Register Adolescent Girl (Ages 9–14)
              </h3>
              <button
                onClick={() => setShowRegModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterAdolescent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Beneficiary Full Name</label>
                <input
                  type="text"
                  required
                  value={regForm.full_name}
                  onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                  placeholder="e.g. Aditi Kumari"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Age (Target 9–14 Y)</label>
                  <input
                    type="number"
                    min={9}
                    max={14}
                    required
                    value={regForm.age}
                    onChange={(e) => setRegForm({ ...regForm, age: parseInt(e.target.value, 10) || 12 })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={regForm.dob}
                    onChange={(e) => setRegForm({ ...regForm, dob: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Parent / Guardian Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.guardian_name}
                    onChange={(e) => setRegForm({ ...regForm, guardian_name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Guardian Mobile Phone</label>
                  <input
                    type="text"
                    required
                    value={regForm.guardian_phone}
                    onChange={(e) => setRegForm({ ...regForm, guardian_phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Village / Ward</label>
                  <input
                    type="text"
                    required
                    value={regForm.village}
                    onChange={(e) => setRegForm({ ...regForm, village: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">School or Community Camp</label>
                  <input
                    type="text"
                    required
                    value={regForm.school_or_camp}
                    onChange={(e) => setRegForm({ ...regForm, school_or_camp: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Prior Vaccination History Audit</label>
                <select
                  value={regForm.prior_vaccine_audit}
                  onChange={(e) => setRegForm({ ...regForm, prior_vaccine_audit: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                >
                  <option value="NONE">None / Unvaccinated (0/2)</option>
                  <option value="ROUTINE_DRIVE">Received Dose 1 in Routine Immunization Drive</option>
                  <option value="OUTSIDE_PRIVATE">Received Dose 1 at Private Clinic</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={() => setShowRegModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white">
                  Save to Registry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADMINISTER DOSE (COHORT 1) */}
      {/* ======================================================== */}
      {showDoseModal && selectedAdo && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-teal-700" />
                Administer Dose {doseForm.dose_number} for {selectedAdo.full_name}
              </h3>
              <button
                onClick={() => setShowDoseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdministerDose} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Vaccine Vial Batch #</label>
                  <input
                    type="text"
                    required
                    value={doseForm.batch_number}
                    onChange={(e) => setDoseForm({ ...doseForm, batch_number: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Administration Site</label>
                  <select
                    value={doseForm.admin_site}
                    onChange={(e) => setDoseForm({ ...doseForm, admin_site: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  >
                    <option value="Left Deltoid">Left Deltoid</option>
                    <option value="Right Deltoid">Right Deltoid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Administration Date</label>
                <input
                  type="date"
                  required
                  value={doseForm.administered_date}
                  onChange={(e) => setDoseForm({ ...doseForm, administered_date: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Health Center / PHC</label>
                <input
                  type="text"
                  required
                  value={doseForm.center}
                  onChange={(e) => setDoseForm({ ...doseForm, center: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              {/* AEFI Reporting Checkbox */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doseForm.aefi_reported}
                    onChange={(e) => setDoseForm({ ...doseForm, aefi_reported: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Report Adverse Events Following Immunization (AEFI)
                  </span>
                </label>
                {doseForm.aefi_reported && (
                  <textarea
                    rows={2}
                    value={doseForm.aefi_notes}
                    onChange={(e) => setDoseForm({ ...doseForm, aefi_notes: e.target.value })}
                    placeholder="Describe any fever, rash, or injection site reaction..."
                    className="w-full p-2 rounded-lg border border-slate-300 mt-2 text-xs"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={() => setShowDoseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white">
                  Confirm Dose {doseForm.dose_number}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: NEW POINT-OF-CARE INTAKE (COHORT 2) */}
      {/* ======================================================== */}
      {showScreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" />
                Point-of-Care VIA / Pap Intake (Women 35–45)
              </h3>
              <button
                onClick={() => setShowScreenModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordScreening} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={screenForm.patient_name}
                    onChange={(e) => setScreenForm({ ...screenForm, patient_name: e.target.value })}
                    placeholder="e.g. Urmila Devi"
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Age (Target 35–45 Y)</label>
                  <input
                    type="number"
                    min={30}
                    max={65}
                    required
                    value={screenForm.age}
                    onChange={(e) => setScreenForm({ ...screenForm, age: parseInt(e.target.value, 10) || 38 })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Screening Test Type</label>
                  <select
                    value={screenForm.screening_type}
                    onChange={(e) =>
                      setScreenForm({
                        ...screenForm,
                        screening_type: e.target.value as "VIA" | "PAP_SMEAR" | "COMBINED",
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  >
                    <option value="VIA">VIA (Visual Inspection with Acetic Acid)</option>
                    <option value="PAP_SMEAR">Pap Smear (Cytology)</option>
                    <option value="COMBINED">Combined (VIA + HPV DNA / Pap)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Test Date</label>
                  <input
                    type="date"
                    required
                    value={screenForm.test_date}
                    onChange={(e) => setScreenForm({ ...screenForm, test_date: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Point-of-Care Visual Findings & Classification
                </label>
                <select
                  value={screenForm.findings_classification}
                  onChange={(e) =>
                    setScreenForm({ ...screenForm, findings_classification: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white font-semibold"
                >
                  <option value="NORMAL">Normal Squamous Epithelium (3–5Y Routine Recall)</option>
                  <option value="BENIGN_CERVICITIS">
                    Benign Cervicitis / Inflammation (ASHA Community Management + 14d Check-in)
                  </option>
                  <option value="ABNORMAL_VIA_POSITIVE">
                    Abnormal Dense Acetowhite Lesion (Tertiary Specialist Referral)
                  </option>
                  <option value="ABNORMAL_SUSPICIOUS_BLEEDING">
                    Abnormal Suspicious Contact Bleeding / Ulceration (Tertiary Referral)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Primary Symptoms & Clinical Notes</label>
                <textarea
                  rows={2}
                  value={screenForm.symptom_notes}
                  onChange={(e) => setScreenForm({ ...screenForm, symptom_notes: e.target.value })}
                  placeholder="Detail symptoms, discharge characteristics, or bleeding history..."
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={() => setShowScreenModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white">
                  Ingest & AI Triage
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: 14-DAY COMMUNITY CHECKIN (COHORT 2) */}
      {/* ======================================================== */}
      {showCheckinModal && selectedScreenCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-700" />
                ASHA 14-Day Symptom Resolution Check-in
              </h3>
              <button
                onClick={() => setShowCheckinModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCommunityCheckin} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                <div className="font-semibold text-xs">{selectedScreenCase.patient_name}</div>
                <div className="text-[11px] text-blue-700 mt-0.5">
                  Initial Finding: {selectedScreenCase.findings_classification}
                </div>
                <div className="text-[10px] text-blue-600 mt-1">
                  Prescription: {selectedScreenCase.prescribed_local_therapy}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Check-in Resolution Outcome</label>
                <select
                  value={checkinForm.outcome}
                  onChange={(e) =>
                    setCheckinForm({
                      ...checkinForm,
                      outcome: e.target.value as "SYMPTOMS_RESOLVED" | "PERSISTENT_REFERRED",
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white font-semibold"
                >
                  <option value="SYMPTOMS_RESOLVED">
                    Symptoms Fully Resolved (Mark Episode Resolved)
                  </option>
                  <option value="PERSISTENT_REFERRED">
                    Persistent Symptoms / Worsening (Auto-Escalate to Tertiary Specialist Referral)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">ASHA Field Observations</label>
                <textarea
                  rows={3}
                  value={checkinForm.checkin_notes}
                  onChange={(e) => setCheckinForm({ ...checkinForm, checkin_notes: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={() => setShowCheckinModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white">
                  Confirm Check-in
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
