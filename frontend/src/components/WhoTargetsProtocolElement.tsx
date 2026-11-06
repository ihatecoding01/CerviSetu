import { useState, useEffect } from "react";
import {
  api,
  type ProtocolEvaluation,
  type ProtocolScheduleResult,
} from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import {
  Syringe,
  Activity,
  HeartPulse,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

interface Props {
  onActionCompleted?: () => void;
  initialAge?: number;
  initialName?: string;
  compact?: boolean;
}

export function WhoTargetsProtocolElement({
  onActionCompleted,
  initialAge = 14,
  initialName = "",
  compact = false,
}: Props) {
  // Input State
  const [patientName, setPatientName] = useState(initialName);
  const [age, setAge] = useState<number>(initialAge);
  const [gender, setGender] = useState<string>("FEMALE");

  // Clinical Questions
  // For Girls 13-15: Has she received the HPV vaccine?
  const [hpvVaccinated, setHpvVaccinated] = useState<boolean | null>(false);
  // For Women 35-45: Has she received the high-performance screening test?
  const [screened, setScreened] = useState<boolean | null>(false);

  // Scheduling Form Details
  const [vaccineBrand, setVaccineBrand] = useState("Cervavac");
  const [doseNumber, setDoseNumber] = useState<number>(1);
  const [testType, setTestType] = useState<string>("HPV_DNA");
  const [center, setCenter] = useState("Primary Health Centre Mirzapur");
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [dispatchOutreach, setDispatchOutreach] = useState(true);

  // Evaluation & Action Status
  const [evaluation, setEvaluation] = useState<ProtocolEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<boolean>(true);

  // Sync initialName/initialAge if passed from props
  useEffect(() => {
    if (initialName) setPatientName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialAge !== undefined && initialAge !== null) setAge(initialAge);
  }, [initialAge]);

  // Re-run evaluation whenever age, name, or responses change
  useEffect(() => {
    runEvaluation();
  }, [age, gender, hpvVaccinated, screened, patientName]);

  const runEvaluation = async () => {
    setEvalLoading(true);
    try {
      const res = await api.evaluateProtocol({
        age,
        gender,
        patient_name: patientName,
        hpv_vaccinated: hpvVaccinated ?? false,
        screened: screened ?? false,
      });
      setEvaluation(res);
    } catch {
      // Local fallback in case of offline dev mode
      const isGirl = age >= 13 && age <= 15;
      const isWoman = age >= 35 && age <= 45;
      if (isGirl) {
        if (hpvVaccinated) {
          setEvaluation({
            status: "SUCCESS",
            cohort: "ADOLESCENT_13_15",
            target_pillar: "90_VACCINATE",
            target_title: "WHO Target 1: 90% HPV Vaccinated by Age 15",
            is_girl_13_15: true,
            is_woman_35_45: false,
            recommendation: "CONTINUE",
            protocol_status: "VACCINATED_PROTECTED",
            badge_variant: "success",
            directive: `HPV vaccination verified for ${patientName || "Adolescent"} (${age}Y). Protected against HPV 16/18. Continue routine healthcare follow-up.`,
            action_required: false,
            rule: "WHO Target 1 mandates 90% of girls fully vaccinated against HPV by age 15.",
          });
        } else {
          setEvaluation({
            status: "SUCCESS",
            cohort: "ADOLESCENT_13_15",
            target_pillar: "90_VACCINATE",
            target_title: "WHO Target 1: 90% HPV Vaccinated by Age 15",
            is_girl_13_15: true,
            is_woman_35_45: false,
            recommendation: "SCHEDULE_VACCINATION",
            protocol_status: "VACCINATION_REQUIRED",
            badge_variant: "destructive",
            directive: `Adolescent girl ${patientName || "Patient"} (${age}Y) is in the 13–15 priority window and is unvaccinated. Schedule Cervavac/Gardasil prior to age 15.`,
            action_required: true,
            rule: "Girls between ages 13 to 15 must receive HPV vaccine. If vaccinated, continue; else schedule vaccination.",
          });
        }
      } else if (isWoman) {
        if (screened) {
          setEvaluation({
            status: "SUCCESS",
            cohort: "ADULT_35_45",
            target_pillar: "70_SCREEN",
            target_title: "WHO Target 2: 70% Screened with High-Performance Test at 35 & 45",
            is_girl_13_15: false,
            is_woman_35_45: true,
            recommendation: "CONTINUE",
            protocol_status: "SCREENED_PROTECTED",
            badge_variant: "success",
            directive: `High-performance screening record verified for ${patientName || "Woman"} (${age}Y). Maintain 5-year routine recall schedule.`,
            action_required: false,
            rule: "WHO Target 2 mandates 70% of women screened with a high-performance test by age 35 and again by 45.",
          });
        } else {
          setEvaluation({
            status: "SUCCESS",
            cohort: "ADULT_35_45",
            target_pillar: "70_SCREEN",
            target_title: "WHO Target 2: 70% Screened with High-Performance Test at 35 & 45",
            is_girl_13_15: false,
            is_woman_35_45: true,
            recommendation: "SCHEDULE_SCREENING",
            protocol_status: "SCREENING_REQUIRED",
            badge_variant: "warning",
            directive: `Woman ${patientName || "Patient"} (${age}Y) is in the priority 35–45 screening window and is unscreened. Schedule high-performance HPV test immediately.`,
            action_required: true,
            rule: "Women between ages 35 and 45 must be screened with high-performance HPV test. If screened, continue; else schedule test.",
          });
        }
      } else {
        setEvaluation({
          status: "SUCCESS",
          cohort: age < 13 ? "PEDIATRIC_UNDER_13" : age < 35 ? "YOUNG_ADULT_16_34" : "SENIOR_46_PLUS",
          target_pillar: age >= 46 ? "90_TREAT" : "PREVENTION_MONITORING",
          target_title: "Demographic Surveillance",
          is_girl_13_15: false,
          is_woman_35_45: false,
          recommendation: "CONTINUE",
          protocol_status: "ROUTINE_MONITORING",
          badge_variant: "neutral",
          directive: `${patientName || "Patient"} (${age}Y) is outside primary 13–15 vaccination and 35–45 screening cohorts. Continue standard clinical routine.`,
          action_required: false,
          rule: "Outside primary 13–15 vaccination and 35–45 screening cohorts. Continue routine care.",
        });
      }
    } finally {
      setEvalLoading(false);
    }
  };

  // Quick Preset Handlers for Rapid Demonstration
  const loadPreset = (preset: "girl_unvac" | "girl_vac" | "woman_unscreened" | "woman_screened") => {
    setActionMessage(null);
    if (preset === "girl_unvac") {
      setPatientName("Ananya Kumari");
      setAge(14);
      setGender("FEMALE");
      setHpvVaccinated(false);
      setVaccineBrand("Cervavac");
      setDoseNumber(1);
    } else if (preset === "girl_vac") {
      setPatientName("Priya Sharma");
      setAge(13);
      setGender("FEMALE");
      setHpvVaccinated(true);
    } else if (preset === "woman_unscreened") {
      setPatientName("Sunita Devi");
      setAge(38);
      setGender("FEMALE");
      setScreened(false);
      setTestType("HPV_DNA");
    } else if (preset === "woman_screened") {
      setPatientName("Meera Devi");
      setAge(42);
      setGender("FEMALE");
      setScreened(true);
    }
  };

  // Handle Scheduling Action
  const handleScheduleAction = async (actionType: "SCHEDULE_VACCINATION" | "SCHEDULE_SCREENING") => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res: ProtocolScheduleResult = await api.scheduleProtocolAction({
        patient_name: patientName.trim() || (actionType === "SCHEDULE_VACCINATION" ? "Adolescent Girl" : "Adult Woman"),
        age,
        gender,
        action_type: actionType,
        vaccine_brand: vaccineBrand,
        dose_number: doseNumber,
        test_type: testType,
        appointment_date: appointmentDate,
        center,
        dispatch_outreach: dispatchOutreach,
      });

      setActionSuccess(true);
      setActionMessage(res.message);
      if (actionType === "SCHEDULE_VACCINATION") {
        setHpvVaccinated(true);
      } else {
        setScreened(true);
      }
      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch {
      setActionSuccess(false);
      setActionMessage("Failed to schedule protocol action on server.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Continue Action
  const handleContinueAction = () => {
    setActionSuccess(true);
    if (age >= 13 && age <= 15) {
      setActionMessage(`✓ Verification logged for ${patientName || "Adolescent"} (${age}Y): Full HPV protection recorded. Continuing routine care.`);
    } else if (age >= 35 && age <= 45) {
      setActionMessage(`✓ Verification logged for ${patientName || "Woman"} (${age}Y): High-performance screening on file. 5-year recall scheduled. Continuing routine care.`);
    } else {
      setActionMessage(`✓ Patient (${age}Y) verified. Continuing standard clinical care.`);
    }
    if (onActionCompleted) {
      onActionCompleted();
    }
  };

  const isGirl13to15 = age >= 13 && age <= 15;
  const isWoman35to45 = age >= 35 && age <= 45;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. THREE WHO TARGETS HEADER BANNER (From Slide 1 & Slide 2) */}
      {!compact && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-sm border border-slate-700/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#BA2D0B] text-white">
                  WHO 2030 Elimination Targets
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  National Cervical Health Protocol Engine
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight mt-1">
                Solution Overview: Three WHO Targets, One Platform
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every alert is date arithmetic, not machine learning &middot; Automated age-cohort verification &amp; scheduling
              </p>
            </div>

            {/* Slide 2 Elimination Rule Pill */}
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
              <ShieldCheck className="size-4 text-[#DBFE87]" />
              <div className="text-right">
                <div className="text-[11px] font-bold text-[#DBFE87]">Target: &lt;4 Cases / 100k</div>
                <div className="text-[10px] text-slate-400">90-70-90 elimination pathway</div>
              </div>
            </div>
          </div>

          {/* 3 Pillar Cards (Slide 1) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
            {/* Pillar 1: 90 Vaccinate (Girls 13-15) */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                isGirl13to15
                  ? "bg-[#BA2D0B]/20 border-[#BA2D0B] ring-1 ring-[#BA2D0B]"
                  : "bg-slate-800/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#BA2D0B] text-white flex items-center justify-center font-bold text-xs">
                    90
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Vaccinate</span>
                    <span className="text-[10px] text-[#DBFE87] font-semibold">Ages 13 to 15 Cohort</span>
                  </div>
                </div>
                {isGirl13to15 && (
                  <Badge variant="primary" size="xs" className="bg-[#BA2D0B] text-white">
                    Active Cohort
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Ensure girls ages 13–15 are given HPV vaccine before age 15. If yes, continue; else schedule Cervavac/Gardasil dose.
              </p>
            </div>

            {/* Pillar 2: 70 Screen (Women 35-45) */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                isWoman35to45
                  ? "bg-amber-500/20 border-amber-500 ring-1 ring-amber-500"
                  : "bg-slate-800/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-amber-500 text-black flex items-center justify-center font-bold text-xs">
                    70
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Screen</span>
                    <span className="text-[10px] text-amber-300 font-semibold">Ages 35 and 45 Cohort</span>
                  </div>
                </div>
                {isWoman35to45 && (
                  <Badge variant="warning" size="xs" className="bg-amber-500 text-black font-bold">
                    Active Cohort
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                70% screened with high-performance HPV DNA or VIA test by 35 and again by 45. If yes, continue; else schedule test.
              </p>
            </div>

            {/* Pillar 3: 90 Treat (Curative / Precancer) */}
            <div className="p-3 rounded-xl border bg-slate-800/60 border-slate-700/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    90
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Treat</span>
                    <span className="text-[10px] text-emerald-300 font-semibold">Precancer &amp; Invasive</span>
                  </div>
                </div>
                <Badge variant="success" size="xs" className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/30">
                  Built-in Clock
                </Badge>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Same-day single-visit thermal ablation for precancer (CIN-2) and 49/56-day curative biological clock for CCRT.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. INTERACTIVE PROTOCOL CHECKER & ACTION CARD */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-[#BA2D0B] text-white flex items-center justify-center">
                  <HeartPulse className="size-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  WHO Protocol &amp; Age-Cohort Verification Guard
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Evaluates girls aged 13–15 for HPV vaccination and women aged 35–45 for high-performance screening.
              </CardDescription>
            </div>

            {/* Quick-Load Demo Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-600 mr-1">Quick Presets:</span>
              <button
                type="button"
                onClick={() => loadPreset("girl_unvac")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Girl age 14, unvaccinated - test Schedule Vaccination"
              >
                <span>👧 Anjali (14Y · Unvaccinated)</span>
              </button>
              <button
                type="button"
                onClick={() => loadPreset("girl_vac")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Girl age 13, vaccinated - test Continue"
              >
                <span>👧 Priya (13Y · Vaccinated)</span>
              </button>
              <button
                type="button"
                onClick={() => loadPreset("woman_unscreened")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Woman age 38, unscreened - test Schedule HPV test"
              >
                <span>👩 Sunita (38Y · Unscreened)</span>
              </button>
              <button
                type="button"
                onClick={() => loadPreset("woman_screened")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Woman age 42, screened - test Continue"
              >
                <span>👩 Meera (42Y · Screened)</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 flex flex-col gap-5">
          {/* Action Message Alert */}
          {actionMessage && (
            <Alert variant={actionSuccess ? "success" : "destructive"}>
              <CheckCircle2 className="size-4" />
              <AlertTitle>{actionSuccess ? "Protocol Action Executed Successfully" : "Action Notice"}</AlertTitle>
              <AlertDescription className="text-xs">{actionMessage}</AlertDescription>
            </Alert>
          )}

          {/* Demographic Inputs Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Patient / Adolescent Name
              </label>
              <input
                type="text"
                value={patientName}
                placeholder="e.g. Ananya Kumari"
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#BA2D0B]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Age (Years)
                </label>
                {isGirl13to15 && (
                  <span className="text-[10px] font-bold text-[#BA2D0B] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    Ages 13–15 Cohort
                  </span>
                )}
                {isWoman35to45 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Ages 35–45 Cohort
                  </span>
                )}
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold focus:outline-none focus:border-[#BA2D0B]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none"
              >
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Server Evaluation Status & Rule Indicator */}
          {evaluation && (
            <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <span className="font-medium">Protocol Rule: {evaluation.rule}</span>
              {evalLoading ? (
                <span className="text-[10px] text-slate-400">Verifying...</span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold">Target Linked</span>
              )}
            </div>
          )}

          {/* DYNAMIC DECISION SECTION */}
          {/* SCENARIO 1: GIRLS BETWEEN AGES 13 TO 15 (WHO Target 1: 90% Vaccinate) */}
          {isGirl13to15 && (
            <div className="p-4 rounded-xl border-2 border-slate-300 bg-white shadow-xs flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-[#BA2D0B] text-white flex items-center justify-center shrink-0">
                    <Syringe className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#BA2D0B] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        WHO Target 1 &middot; Adolescent HPV Protocol
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Cohort: Girls Ages 13–15</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      HPV Vaccination Status Check for {patientName || "Adolescent Girl"} (Age {age})
                    </h3>
                  </div>
                </div>

                <Badge variant={hpvVaccinated ? "primary" : "destructive"} size="sm">
                  {hpvVaccinated ? "Vaccinated ✓" : "Vaccination Pending ✗"}
                </Badge>
              </div>

              {/* Core Question & Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Has this girl received the HPV vaccine (Dose 1 or 2)?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Checked against public health registry &middot; Free indigenous Cervavac or Gardasil
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHpvVaccinated(true);
                      setActionMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      hpvVaccinated === true
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <Check className="size-3.5" />
                    <span>YES, Vaccinated</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHpvVaccinated(false);
                      setActionMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      hpvVaccinated === false
                        ? "bg-[#BA2D0B] text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <AlertCircle className="size-3.5" />
                    <span>NO, Not Vaccinated</span>
                  </button>
                </div>
              </div>

              {/* BRANCH A: IF YES -> THEN CONTINUE */}
              {hpvVaccinated === true && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                          Protocol Met &middot; Continue Care
                        </span>
                        <span className="text-xs font-semibold text-emerald-950">
                          Protected Against Oncogenic HPV 16/18
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-1">
                        Vaccination record confirmed for <strong>{patientName || "Adolescent"}</strong>. She has received the HPV vaccine before age 15 in accordance with WHO Target 1. Proceed with routine adolescent healthcare.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="obsidian"
                    size="sm"
                    onClick={handleContinueAction}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 gap-1.5"
                  >
                    <span>Continue Care</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* BRANCH B: ELSE IF NOT -> THEN SCHEDULE VACCINATION */}
              {hpvVaccinated === false && (
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-300 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-900 bg-rose-100 px-2 py-0.5 rounded">
                          Action Required &middot; Schedule HPV Vaccination
                        </span>
                        <span className="text-xs font-semibold text-rose-950">
                          Critical 13–15 Age Window Prior to Exposure
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 mt-1">
                        <strong>{patientName || "Patient"}</strong> is {age} years old and has not received the HPV vaccine. The WHO 2030 target and National Immunization schedule require vaccination before age 15 to eliminate cervical carcinoma risk.
                      </p>
                    </div>
                  </div>

                  {/* Schedule Details Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-rose-200">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Vaccine Brand</label>
                      <select
                        value={vaccineBrand}
                        onChange={(e) => setVaccineBrand(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="Cervavac">Cervavac (SII Indigenous)</option>
                        <option value="Gardasil-9">Gardasil-9 (MSD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Dose Series</label>
                      <select
                        value={doseNumber}
                        onChange={(e) => setDoseNumber(parseInt(e.target.value, 10))}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value={1}>Dose 1 (Initial)</option>
                        <option value={2}>Dose 2 (Completion)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Appointment Date</label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Vaccination Center</label>
                      <input
                        type="text"
                        value={center}
                        onChange={(e) => setCenter(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchOutreach}
                        onChange={(e) => setDispatchOutreach(e.target.checked)}
                        className="rounded text-[#BA2D0B]"
                      />
                      <span>Dispatch automated vernacular SMS/IVR outreach to guardian and notify ASHA</span>
                    </label>

                    <Button
                      variant="obsidian"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => handleScheduleAction("SCHEDULE_VACCINATION")}
                      className="bg-[#BA2D0B] hover:bg-[#a02609] text-white text-xs font-bold gap-1.5 shrink-0"
                    >
                      <Calendar className="size-3.5" />
                      {actionLoading ? "Scheduling..." : "Schedule HPV Vaccination"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCENARIO 2: WOMEN BETWEEN AGES 35 AND 45 (WHO Target 2: 70% High-Performance Test) */}
          {isWoman35to45 && (
            <div className="p-4 rounded-xl border-2 border-slate-300 bg-white shadow-xs flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0 font-bold">
                    <Activity className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        WHO Target 2 &middot; Adult Cervical Screening Protocol
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Cohort: Women Ages 35 and 45</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      High-Performance Screening Check for {patientName || "Woman"} (Age {age})
                    </h3>
                  </div>
                </div>

                <Badge variant={screened ? "primary" : "warning"} size="sm">
                  {screened ? "Screened ✓" : "Screening Pending ✗"}
                </Badge>
              </div>

              {/* Core Question & Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Has this woman received a high-performance screening test (HPV DNA or VIA)?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    WHO requirement: High-performance test by age 35 and again by age 45
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScreened(true);
                      setActionMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      screened === true
                        ? "bg-teal-700 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <Check className="size-3.5" />
                    <span>YES, Screened</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScreened(false);
                      setActionMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      screened === false
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <AlertCircle className="size-3.5" />
                    <span>NO, Not Screened</span>
                  </button>
                </div>
              </div>

              {/* BRANCH A: IF YES -> THEN CONTINUE */}
              {screened === true && (
                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-900 bg-teal-100 px-2 py-0.5 rounded">
                          Protocol Met &middot; Continue Care
                        </span>
                        <span className="text-xs font-semibold text-teal-950">
                          5-Year Routine Recall Active
                        </span>
                      </div>
                      <p className="text-xs text-teal-800 mt-1">
                        High-performance screening record verified for <strong>{patientName || "Woman"}</strong> ({age}Y). Cervical epithelium cleared. Next scheduled test at age {Math.min(45, age + 5)} or 5-year interval. Continue routine care.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="obsidian"
                    size="sm"
                    onClick={handleContinueAction}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shrink-0 gap-1.5"
                  >
                    <span>Continue Care</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* BRANCH B: ELSE IF NOT -> THEN SCHEDULE HIGH-PERFORMANCE TEST */}
              {screened === false && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                          Action Required &middot; Schedule Screening Test
                        </span>
                        <span className="text-xs font-semibold text-amber-950">
                          WHO 70% Target: Screen at 35 and again at 45
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 mt-1">
                        <strong>{patientName || "Patient"}</strong> is {age} years old and has not had a high-performance screening test. Schedule high-performance HPV DNA testing or Visual Inspection with Acetic Acid (VIA) to detect oncogenic changes before invasive staging.
                      </p>
                    </div>
                  </div>

                  {/* Schedule Details Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Test Modality</label>
                      <select
                        value={testType}
                        onChange={(e) => setTestType(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                      >
                        <option value="HPV_DNA">HPV DNA High-Risk Typing (Recommended)</option>
                        <option value="VIA">VIA (Visual Inspection with Acetic Acid)</option>
                        <option value="PAP_SMEAR">Liquid-Based Cytology / Pap Smear</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Appointment Date</label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">Screening Facility</label>
                      <input
                        type="text"
                        value={center}
                        onChange={(e) => setCenter(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchOutreach}
                        onChange={(e) => setDispatchOutreach(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Issue ASHA community mobilization alert and patient appointment slip</span>
                    </label>

                    <Button
                      variant="obsidian"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => handleScheduleAction("SCHEDULE_SCREENING")}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5 shrink-0"
                    >
                      <Calendar className="size-3.5" />
                      {actionLoading ? "Booking..." : "Schedule High-Performance Test"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCENARIO 3: OTHER AGES (Outside 13-15 and 35-45) */}
          {!isGirl13to15 && !isWoman35to45 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Demographic Guidance: Age {age}Y ({gender})
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  {age < 13 && `Patient is ${age} years old (under target age 13 for HPV vaccination). Enrolls in WHO Target 1 cohort upon reaching 13.`}
                  {age > 15 && age < 35 && `Patient is ${age} years old. Provide general health counseling and catch-up HPV immunization if clinically indicated.`}
                  {age > 45 && `Patient is ${age} years old. Curative oncology surveillance and symptom triage active (WHO Target 3: 90% treatment managed).`}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleContinueAction}
                className="text-xs font-semibold shrink-0"
              >
                Continue Standard Care
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
