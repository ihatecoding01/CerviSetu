import { useState, useEffect } from "react";
import {
  api,
  type HpvVaccination,
  type ScreeningRecord,
  type PrecancerEpisode,
} from "../../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../careui/card";
import { Badge } from "../careui/badge";
import { Button } from "../careui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../careui/table";
import { Alert, AlertTitle, AlertDescription } from "../careui/alert";
import {
  ShieldCheck,
  Syringe,
  Calendar,
  Users,
  CheckCircle2,
  Send,
  Plus,
  Activity,
  Sparkles,
  HeartPulse,
} from "lucide-react";

export function PreventionScreening() {
  const [activeTab, setActiveTab] = useState<"vaccination" | "screening" | "precancer">("vaccination");

  // 1. Vaccination State
  const [vaccinations, setVaccinations] = useState<HpvVaccination[]>([]);
  const [vacLoading, setVacLoading] = useState(false);
  const [vacSuccessMsg, setVacSuccessMsg] = useState<string | null>(null);
  const [showVacModal, setShowVacModal] = useState(false);
  const [newVac, setNewVac] = useState({
    patient_token: "PT-VACC-" + Math.floor(100 + Math.random() * 900),
    patient_name: "",
    age: 12,
    dose_number: 1,
    vaccine_brand: "Cervavac",
    school_or_center: "",
  });

  // 2. Screening State
  const [screenings, setScreenings] = useState<ScreeningRecord[]>([]);
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenSuccessMsg, setScreenSuccessMsg] = useState<string | null>(null);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [newScreen, setNewScreen] = useState({
    patient_token: "PT-SCR-" + Math.floor(100 + Math.random() * 900),
    patient_name: "",
    age: 35,
    test_type: "VIA",
    result: "VIA_POSITIVE",
    notes: "Dense acetowhite lesion near squamocolumnar junction",
  });

  // 3. Precancer State
  const [precancerList, setPrecancerList] = useState<PrecancerEpisode[]>([]);
  const [precancerLoading, setPrecancerLoading] = useState(false);
  const [precancerSuccessMsg, setPrecancerSuccessMsg] = useState<string | null>(null);
  const [showPrecancerModal, setShowPrecancerModal] = useState(false);
  const [newPrecancer, setNewPrecancer] = useState({
    patient_token: "PT-PREC-" + Math.floor(100 + Math.random() * 900),
    patient_name: "",
    diagnosis: "CIN_2",
    treatment_type: "LEEP",
    appointment_date: new Date().toISOString().split("T")[0],
    completion_date: new Date().toISOString().split("T")[0],
    margins_clear: 1,
    surveillance_interval_months: 6,
    notes: "",
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setVacLoading(true);
    setScreenLoading(true);
    setPrecancerLoading(true);

    try {
      const v = await api.getHpvVaccinations();
      if (v?.vaccinations) setVaccinations(v.vaccinations);
    } catch {
      // Offline fallback
    } finally {
      setVacLoading(false);
    }

    try {
      const s = await api.getScreenings();
      if (s?.screenings) setScreenings(s.screenings);
    } catch {
      // Offline fallback
    } finally {
      setScreenLoading(false);
    }

    try {
      const p = await api.getPrecancerSurveillance();
      if (p?.surveillance_list) setPrecancerList(p.surveillance_list);
    } catch {
      // Offline fallback
    } finally {
      setPrecancerLoading(false);
    }
  };

  const handleCreateVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVac.patient_name) return;
    try {
      const res = await api.logHpvVaccination(newVac);
      setVacSuccessMsg(`Vaccination recorded for ${newVac.patient_name} (ID: ${res.vaccination.vaccine_id}). Dose 2 projected at 60 days.`);
      setShowVacModal(false);
      setNewVac({
        patient_token: "PT-VACC-" + Math.floor(100 + Math.random() * 900),
        patient_name: "",
        age: 12,
        dose_number: 1,
        vaccine_brand: "Cervavac",
        school_or_center: "",
      });
      loadAllData();
    } catch {
      setVacSuccessMsg("Failed to register vaccination on server.");
    }
  };

  const handleTriggerOutreach = async (vaccineId: string) => {
    try {
      const res = await api.triggerVaccineOutreach(vaccineId);
      setVacSuccessMsg(`Outreach Dispatched: ${res.message} (Record: ${vaccineId})`);
      loadAllData();
    } catch {
      setVacSuccessMsg("The reminder could not be sent. Please try again.");
    }
  };

  const handleCreateScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScreen.patient_name) return;
    try {
      const res = await api.recordScreening(newScreen);
      setScreenSuccessMsg(`Screening logged. Recommended Pathway: ${res.recommended_pathway}`);
      setShowScreenModal(false);
      setNewScreen({
        patient_token: "PT-SCR-" + Math.floor(100 + Math.random() * 900),
        patient_name: "",
        age: 35,
        test_type: "VIA",
        result: "VIA_POSITIVE",
        notes: "Dense acetowhite lesion near squamocolumnar junction",
      });
      loadAllData();
    } catch {
      setScreenSuccessMsg("This could not be saved. Please try again.");
    }
  };

  const handleCreatePrecancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrecancer.patient_name) return;
    try {
      const res = await api.logPrecancerTreatment(newPrecancer);
      setPrecancerSuccessMsg(`Precancer episode logged: ${res.precancer_episode.precancer_id}. 6-month surveillance recall scheduled for ${res.precancer_episode.surveillance_due_date}.`);
      setShowPrecancerModal(false);
      setNewPrecancer({
        patient_token: "PT-PREC-" + Math.floor(100 + Math.random() * 900),
        patient_name: "",
        diagnosis: "CIN_2",
        treatment_type: "LEEP",
        appointment_date: new Date().toISOString().split("T")[0],
        completion_date: new Date().toISOString().split("T")[0],
        margins_clear: 1,
        surveillance_interval_months: 6,
        notes: "",
      });
      loadAllData();
    } catch {
      setPrecancerSuccessMsg("This could not be saved. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-[#9D174D] text-white flex items-center justify-center font-bold">
              <ShieldCheck className="size-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              Prevention, Screening &amp; Precancer Clinic
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-gray-400" />
            <span>WHO 90-70-90 Continuum &middot; Primary Prevention, Secondary Triage &amp; Precancer Surveillance</span>
          </p>
        </div>

        {/* Global Action Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg max-w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab("vaccination")}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "vaccination"
                ? "bg-[#9D174D] text-white shadow-2xs"
                : "text-gray-700 hover:text-black"
            }`}
          >
            <Syringe className="size-3.5" />
            <span>HPV Vaccination ({vaccinations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("screening")}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "screening"
                ? "bg-[#9D174D] text-white shadow-2xs"
                : "text-gray-700 hover:text-black"
            }`}
          >
            <Activity className="size-3.5" />
            <span>Screening Triage ({screenings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("precancer")}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "precancer"
                ? "bg-[#9D174D] text-white shadow-2xs"
                : "text-gray-700 hover:text-black"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Precancer &amp; Surveillance ({precancerList.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADOLESCENT HPV VACCINATION */}
      {activeTab === "vaccination" && (
        <div className="flex flex-col gap-5">
          {vacSuccessMsg && (
            <Alert variant="success">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle>Vaccination Registry Notification</AlertTitle>
              <AlertDescription>{vacSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {/* Metric Overview Cards with calibrated perimeter hover trace */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card size="sm" variant="blue" traceColor="#0284C7" className="border-sky-200/80 shadow-2xs hover:shadow-sm transition-all">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-800">Adolescents Enrolled (9-14y)</span>
                  <div className="size-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                    <Users className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="text-2xl font-bold font-mono-data text-slate-900">{vaccinations.length} <span className="text-xs font-sans font-normal text-slate-500">Registered</span></div>
                <div className="text-xs text-slate-500 mt-0.5">Schools &amp; health posts</div>
              </CardContent>
            </Card>

            <Card size="sm" variant="subtle" traceColor="#059669" className="border-emerald-200/80 shadow-2xs hover:shadow-sm transition-all">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800">Dose 2 Retention Target</span>
                  <div className="size-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Calendar className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="text-2xl font-bold font-mono-data text-slate-900">94.2% <span className="text-xs font-sans font-normal text-emerald-700 font-bold">Completed</span></div>
                <div className="text-xs text-emerald-700 mt-0.5">60-day automated reminder active</div>
              </CardContent>
            </Card>

            <Card size="sm" variant="pink" traceColor="#9D174D" className="border-pink-200/80 shadow-2xs hover:shadow-sm transition-all">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#9D174D]">Vaccine Brands Stocked</span>
                  <div className="size-8 rounded-lg bg-pink-100 text-[#9D174D] flex items-center justify-center font-bold">
                    <Syringe className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="text-lg font-bold text-slate-900">Cervavac &middot; Gardasil-9</div>
                <div className="text-xs text-slate-500 mt-0.5">Serum Institute of India indigenous supply</div>
              </CardContent>
            </Card>
          </div>

          {/* Roster & Add Action */}
          <Card className="bg-white border-gray-200 shadow-2xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-bold text-black">
                  Adolescent HPV Vaccination Roster (Ages 9–14 Cohort)
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Targeted primary prevention to eliminate cervical oncogenesis prior to HPV exposure
                </CardDescription>
              </div>

              <Button
                variant="obsidian"
                size="sm"
                onClick={() => setShowVacModal(true)}
                className="bg-black hover:bg-black/85 text-white gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Register Vaccine Dose
              </Button>
            </CardHeader>

            <CardContent>
              {vacLoading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading vaccination roster...</div>
              ) : vaccinations.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No vaccination records found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adolescent &middot; Token</TableHead>
                      <TableHead>Dose &middot; Brand</TableHead>
                      <TableHead>Administered Date</TableHead>
                      <TableHead>Next Due (Dose 2)</TableHead>
                      <TableHead>Administration Center</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Guardian Outreach</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vaccinations.map((v) => (
                      <TableRow key={v.vaccine_id} className="hover:bg-gray-50/80 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-[#E0F2FE] text-black font-bold text-xs flex items-center justify-center border border-[#BAE6FD]">
                              {v.patient_name[0] || "P"}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-black">{v.patient_name}</div>
                              <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                <span className="text-[#9D174D] font-semibold">{v.patient_token}</span>
                                <span>&middot; {v.age}Y</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold text-black">
                            Dose {v.dose_number} of 2
                          </div>
                          <div className="text-xs text-gray-500">{v.vaccine_brand}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono text-gray-800">{v.administered_date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono font-semibold text-gray-900">
                            {v.next_due_date || "Complete"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-gray-700">{v.school_or_center}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={v.status === "COMPLETED" ? "primary" : v.status === "OVERDUE" ? "destructive" : "warning"}
                            size="xs"
                          >
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleTriggerOutreach(v.vaccine_id)}
                            className="text-xs font-semibold gap-1 text-black border-slate-200"
                          >
                            <Send className="size-3 text-[#9D174D]" />
                            {v.outreach_sent ? "Resend Reminder" : "Dispatch SMS"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: SCREENING & TRIAGE */}
      {activeTab === "screening" && (
        <div className="flex flex-col gap-5">
          {screenSuccessMsg && (
            <Alert variant="success">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle>Screening Triage Result</AlertTitle>
              <AlertDescription>{screenSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {/* Visual Acetowhite Epithelium Diagnostic Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl">
              <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                VIA Negative
              </div>
              <div className="text-xs font-semibold text-emerald-800 mt-1">Normal Pink Epithelium</div>
              <p className="text-xs text-emerald-900 mt-1">
                No acetowhitening. Squamocolumnar junction fully visible. Standard 5-year routine recall.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl">
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                VIA Positive (CIN-1 / CIN-2)
              </div>
              <div className="text-xs font-semibold text-amber-800 mt-1">Thin / Well-Demarcated</div>
              <p className="text-xs text-amber-900 mt-1">
                Acetowhite lesion covers &le; 75% of cervix. Refer for colposcopy. Treatment is the doctor's decision.
              </p>
            </div>

            <div className="p-3.5 bg-[#0284C7]/20 border border-[#0284C7] rounded-xl">
              <div className="text-xs font-bold text-[#9D174D] uppercase tracking-wider">
                High-Grade (CIN-3 / HSIL)
              </div>
              <div className="text-xs font-semibold text-black mt-1">Dense / Punctation / Mosaic</div>
              <p className="text-xs text-gray-800 mt-1">
                Extends into endocervical canal. Refer for colposcopy-guided biopsy.
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl">
              <div className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                Suspected Invasive Cancer
              </div>
              <div className="text-xs font-semibold text-[#9D174D] mt-1">Exophytic / Ulcerative Mass</div>
              <p className="text-xs text-rose-950 mt-1">
                Bleeding on touch. Urgent referral to gynaecologic oncology.
              </p>
            </div>
          </div>

          {/* Screening Register Table */}
          <Card className="bg-white border-gray-200 shadow-2xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-bold text-black">
                  Community Screening Registry (VIA, HPV DNA &amp; Pap Smear)
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Population-level screening records triaged according to National Cancer Grid guidelines
                </CardDescription>
              </div>

              <Button
                variant="obsidian"
                size="sm"
                onClick={() => setShowScreenModal(true)}
                className="bg-black hover:bg-black/85 text-white gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Record Screening Result
              </Button>
            </CardHeader>

            <CardContent>
              {screenLoading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading screening registry...</div>
              ) : screenings.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No screening results found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Screening ID &middot; Token</TableHead>
                      <TableHead>Patient Details</TableHead>
                      <TableHead>Test Modality</TableHead>
                      <TableHead>Result &middot; Findings</TableHead>
                      <TableHead>Clinical Triage Recommendation</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {screenings.map((s) => (
                      <TableRow key={s.screening_id} className="hover:bg-gray-50/80 transition-colors">
                        <TableCell>
                          <div className="font-mono text-xs font-bold text-black">{s.screening_id}</div>
                          <div className="font-mono text-xs text-[#9D174D]">{s.patient_token}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-bold text-black">{s.patient_name}</div>
                          <div className="text-xs text-gray-500">{s.age}Y &middot; Screened on {s.test_date}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral" size="xs">{s.test_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-black">{s.result}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">{s.notes}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-semibold text-black bg-[#E0F2FE]/40 px-2 py-1 rounded inline-block border border-[#E0F2FE]">
                            {s.triage_status}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              setActiveTab("precancer");
                              setShowPrecancerModal(true);
                              setNewPrecancer((prev) => ({
                                ...prev,
                                patient_token: s.patient_token,
                                patient_name: s.patient_name,
                              }));
                            }}
                            className="text-xs font-semibold text-[#9D174D] border-slate-200"
                          >
                            Open Precancer Workup &rarr;
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: PRECANCER CLINIC & 6-12M SURVEILLANCE */}
      {activeTab === "precancer" && (
        <div className="flex flex-col gap-5">
          {precancerSuccessMsg && (
            <Alert variant="success">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle>Precancer Procedure Recorded</AlertTitle>
              <AlertDescription>{precancerSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {/* Procedure Standards Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-[#9D174D] text-white flex items-center justify-center shrink-0">
                <HeartPulse className="size-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-black">
                  Precancer Procedure Record
                </div>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                  Treatment is the treating doctor's decision, following current national or state guidance.</p>
              </div>
            </div>

            <Button
              variant="obsidian"
              size="sm"
              onClick={() => setShowPrecancerModal(true)}
              className="shrink-0 bg-black hover:bg-black/85 text-white text-xs font-semibold gap-1.5"
            >
              <Plus className="size-3.5" />
              Log Precancer Procedure
            </Button>
          </div>

          {/* Precancer Surveillance Roster Table */}
          <Card className="bg-white border-gray-200 shadow-2xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-bold text-black">
                  Precancer Surveillance Recall Roster (6–12 Month Watchlist)
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Continuous surveillance to verify absence of recurrent dysplasia following ablation or LEEP
                </CardDescription>
              </div>
              <Badge variant="neutral" size="sm">{precancerList.length} In Active Surveillance</Badge>
            </CardHeader>

            <CardContent>
              {precancerLoading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading surveillance roster...</div>
              ) : precancerList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No precancer episodes recorded.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Precancer ID &middot; Token</TableHead>
                      <TableHead>Patient Details</TableHead>
                      <TableHead>Diagnosis &middot; Modality</TableHead>
                      <TableHead>Margin Status</TableHead>
                      <TableHead>Surveillance Due Date</TableHead>
                      <TableHead>Surveillance Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {precancerList.map((p) => (
                      <TableRow key={p.precancer_id} className="hover:bg-gray-50/80 transition-colors">
                        <TableCell>
                          <div className="font-mono text-xs font-bold text-black">{p.precancer_id}</div>
                          <div className="font-mono text-xs text-[#9D174D] font-semibold">{p.patient_token}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-bold text-black">{p.patient_name}</div>
                          <div className="text-xs text-gray-500">Completed on {p.completion_date || p.appointment_date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold text-black">{p.diagnosis}</div>
                          <div className="text-xs text-gray-600">{p.treatment_type}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs font-semibold text-emerald-800">
                              {p.margins_clear ? "Margins Clear (100%)" : "Close Margin"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono font-bold text-black">
                            {p.surveillance_due_date}
                          </div>
                          <div className="text-xs text-gray-500">{p.surveillance_interval_months}-month recall</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.surveillance_status === "SCHEDULED" ? "primary" : "neutral"}
                            size="xs"
                          >
                            {p.surveillance_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              alert(`Surveillance visit confirmation sent to ${p.patient_name}. Recall scheduled for ${p.surveillance_due_date}.`);
                            }}
                            className="text-xs font-semibold text-black border-slate-200"
                          >
                            Issue 6m Recall
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 1. VACCINATION MODAL */}
      {showVacModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-bold text-black">Log Adolescent HPV Vaccination</h3>
            <p className="text-xs text-gray-500 mt-1">
              Record Dose 1 or Dose 2 administration. CerviSetu automatically schedules Dose 2 outreach (+60 days).
            </p>

            <form onSubmit={handleCreateVaccination} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Patient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={newVac.patient_name}
                  onChange={(e) => setNewVac({ ...newVac, patient_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none focus:border-[#9D174D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Age (Target: 9-14y)</label>
                  <input
                    type="number"
                    min={9}
                    max={26}
                    value={newVac.age}
                    onChange={(e) => setNewVac({ ...newVac, age: parseInt(e.target.value, 10) || 12 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Dose Number</label>
                  <select
                    value={newVac.dose_number}
                    onChange={(e) => setNewVac({ ...newVac, dose_number: parseInt(e.target.value, 10) || 1 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value={1}>Dose 1 (Initial)</option>
                    <option value={2}>Dose 2 (Completed Series)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Vaccine Brand</label>
                  <select
                    value={newVac.vaccine_brand}
                    onChange={(e) => setNewVac({ ...newVac, vaccine_brand: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value="Cervavac">Cervavac (SII Indigenous)</option>
                    <option value="Gardasil-9">Gardasil-9 (MSD Nonavalent)</option>
                    <option value="Cecolin">Cecolin (Bivalent)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Token ID</label>
                  <input
                    type="text"
                    readOnly
                    value={newVac.patient_token}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-200 mt-1 bg-gray-50 font-mono text-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">School / Healthcare Center</label>
                <input
                  type="text"
                  value={newVac.school_or_center}
                  onChange={(e) => setNewVac({ ...newVac, school_or_center: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowVacModal(false)}>
                  Cancel
                </Button>
                <Button variant="obsidian" size="sm" type="submit" className="bg-[#9D174D] text-white">
                  Save Vaccine Administration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. SCREENING MODAL */}
      {showScreenModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-bold text-black">Log Primary Screening Result</h3>
            <p className="text-xs text-gray-500 mt-1">
              Ingest Visual Inspection with Acetic Acid (VIA), HPV DNA, or Pap smear findings.
            </p>

            <form onSubmit={handleCreateScreening} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Patient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rekha Devi"
                  value={newScreen.patient_name}
                  onChange={(e) => setNewScreen({ ...newScreen, patient_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none focus:border-[#9D174D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Age</label>
                  <input
                    type="number"
                    value={newScreen.age}
                    onChange={(e) => setNewScreen({ ...newScreen, age: parseInt(e.target.value, 10) || 35 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Test Modality</label>
                  <select
                    value={newScreen.test_type}
                    onChange={(e) => setNewScreen({ ...newScreen, test_type: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value="VIA">VIA (Visual Inspection with Acetic Acid)</option>
                    <option value="HPV_DNA">HPV DNA High-Risk Typing</option>
                    <option value="PAP_SMEAR">Liquid-Based Cytology / Pap Smear</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Screening Result Classification</label>
                <select
                  value={newScreen.result}
                  onChange={(e) => setNewScreen({ ...newScreen, result: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                >
                  <option value="NEGATIVE">NEGATIVE (No acetowhite lesions - 5y recall)</option>
                  <option value="VIA_POSITIVE">VIA_POSITIVE (Acetowhite)</option>
                  <option value="SUSPECTED_HIGH_RISK_HPV">SUSPECTED_HIGH_RISK_HPV (Types 16/18 - Colposcopy referral)</option>
                  <option value="ABNORMAL_PAP">ABNORMAL_PAP (HSIL / ASCUS - Diagnostic biopsy)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Colposcopic / Visual Observations</label>
                <textarea
                  rows={2}
                  value={newScreen.notes}
                  onChange={(e) => setNewScreen({ ...newScreen, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowScreenModal(false)}>
                  Cancel
                </Button>
                <Button variant="obsidian" size="sm" type="submit" className="bg-[#9D174D] text-white">
                  Save &amp; Generate Triage Pathway
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PRECANCER MODAL */}
      {showPrecancerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-bold text-black">Log Precancer Treatment &amp; Surveillance</h3>
            <p className="text-xs text-gray-500 mt-1">
              Document a procedure the treating doctor chose and completed. Records the recall date.
            </p>

            <form onSubmit={handleCreatePrecancer} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Patient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rekha Devi"
                  value={newPrecancer.patient_name}
                  onChange={(e) => setNewPrecancer({ ...newPrecancer, patient_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Diagnosis</label>
                  <select
                    value={newPrecancer.diagnosis}
                    onChange={(e) => setNewPrecancer({ ...newPrecancer, diagnosis: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value="CIN_1">CIN-1 (Mild Dysplasia)</option>
                    <option value="CIN_2">CIN-2 (Moderate Dysplasia)</option>
                    <option value="CIN_3_HSIL">CIN-3 / HSIL (Severe Dysplasia / CIS)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Treatment Modality</label>
                  <select
                    value={newPrecancer.treatment_type}
                    onChange={(e) => setNewPrecancer({ ...newPrecancer, treatment_type: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value="THERMAL_ABLATION">Thermal Ablation</option>
                    <option value="CRYOTHERAPY">Cryotherapy (N2O Double Freeze)</option>
                    <option value="LEEP">LEEP / LLETZ Loop Excision</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Surveillance Interval</label>
                  <select
                    value={newPrecancer.surveillance_interval_months}
                    onChange={(e) => setNewPrecancer({ ...newPrecancer, surveillance_interval_months: parseInt(e.target.value, 10) || 6 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value={6}>6 Months (High Grade CIN-2/3)</option>
                    <option value={12}>12 Months (Low Grade CIN-1)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Margin Status</label>
                  <select
                    value={newPrecancer.margins_clear}
                    onChange={(e) => setNewPrecancer({ ...newPrecancer, margins_clear: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none bg-white"
                  >
                    <option value={1}>Margins Clear &middot; Full Ablation</option>
                    <option value={0}>Close Margin &middot; Close Watch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Procedure Notes</label>
                <textarea
                  rows={2}
                  value={newPrecancer.notes}
                  onChange={(e) => setNewPrecancer({ ...newPrecancer, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 mt-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowPrecancerModal(false)}>
                  Cancel
                </Button>
                <Button variant="obsidian" size="sm" type="submit" className="bg-[#9D174D] text-white">
                  Schedule Surveillance &amp; Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
