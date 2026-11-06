import { useState, useEffect } from "react";
import { api, type ScreeningCase } from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import {
  Stethoscope,
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Eye,
  Send,
  UserCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
} from "lucide-react";

export function SpecialistReviewPortal() {
  const [queue, setQueue] = useState<ScreeningCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<ScreeningCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review Form State
  const [oncologistId, setOncologistId] = useState("DR-ANAND-GYN-ONC");
  const [clinicalAssessment, setClinicalAssessment] = useState(
    "Dense acetowhite lesion extending into endocervical canal with punctation and irregular vascular borders. High suspicion of CIN 3 / Pre-invasive."
  );
  const [treatmentPlan, setTreatmentPlan] = useState(
    "Urgent colposcopy-directed quadrant punch biopsy + endocervical curettage (ECC) scheduled at Tertiary Hub OT 2."
  );

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getSpecialistQueue();
      if (res?.queue && res.queue.length > 0) {
        setQueue(res.queue);
        setSelectedCase(res.queue[0]);
      } else {
        // Fallback default sample for presentation
        const sampleCase: ScreeningCase = {
          case_id: "SCR-CASE-03",
          patient_token: "PT-SCR-3503",
          patient_name: "Asha Devi",
          age: 43,
          screening_type: "VIA",
          test_date: new Date().toISOString().split("T")[0],
          findings_classification: "ABNORMAL_VIA_POSITIVE",
          uploaded_image_or_doc: "/static/samples/via_acetowhite_lesion.jpg",
          symptom_notes: "Dense acetowhite lesion on squamocolumnar junction, irregular borders, contact bleeding noted during speculum examination.",
          triage_track: "TERTIARY_SPECIALIST_REFERRAL",
          care_action_status: "REFERRED_TO_TERTIARY",
          tertiary_facility: "Varanasi Regional Cancer Centre (Hub)",
        };
        setQueue([sampleCase]);
        setSelectedCase(sampleCase);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.submitSpecialistReview({
        case_id: selectedCase.case_id,
        oncologist_id: oncologistId,
        clinical_assessment: clinicalAssessment,
        treatment_plan: treatmentPlan,
      });

      if (res?.case) {
        setSuccessMsg(`Clinical plan confirmed by ${oncologistId} for ${selectedCase.patient_name}. Case updated to SPECIALIST_REVIEWED.`);
        setSelectedCase(res.case);
        setQueue((prev) => prev.map((c) => (c.case_id === selectedCase.case_id ? res.case : c)));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit specialist review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            Tertiary Care Center Referral Hub
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-teal-700" />
            Specialist Review Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Direct oncologist and gynecologist review for referred Cohort 2 women (Ages 35–45) with abnormal VIA, suspicious Pap smears, and persistent lesions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadQueue}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{queue.length} Referred Cases Pending</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <Alert variant="default" className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertTitle>Specialist Directives Confirmed</AlertTitle>
          <AlertDescription className="text-xs">{successMsg}</AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Referred Cases Queue */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <span>Specialist Queue ({queue.length})</span>
            <span>Priority Order</span>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {queue.map((c) => {
              const isSelected = selectedCase?.case_id === c.case_id;
              const isReviewed = c.care_action_status === "SPECIALIST_REVIEWED";
              return (
                <div
                  key={c.case_id}
                  onClick={() => setSelectedCase(c)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "border-teal-600 bg-teal-50/50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{c.patient_name}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Age {c.age} · {c.screening_type} Screening
                      </div>
                    </div>
                    {isReviewed ? (
                      <Badge variant="success" size="xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Reviewed
                      </Badge>
                    ) : (
                      <Badge variant="destructive" size="xs">
                        Action Due
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-slate-600 line-clamp-2 bg-slate-50/80 p-1.5 rounded border border-slate-100 font-mono">
                    {c.symptom_notes || "Suspicious cervical findings reported by ASHA"}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {c.test_date}
                    </span>
                    <span className="text-teal-700 font-medium">{c.case_id}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Clinical Inspection & Decision Cockpit */}
        <div className="lg:col-span-8">
          {selectedCase ? (
            <div className="space-y-6">
              {/* Patient Dossier Header */}
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        {selectedCase.patient_name}
                        <span className="text-xs font-mono font-normal text-slate-500">
                          ({selectedCase.patient_token})
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Referred to {selectedCase.tertiary_facility || "Varanasi Regional Cancer Centre"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" size="sm">
                        Age {selectedCase.age} Y
                      </Badge>
                      <Badge variant="destructive" size="sm">
                        {selectedCase.findings_classification}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Point-of-Care Visual / Slip Inspection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-teal-700" />
                      Point-of-Care Visual Inspection (VIA)
                    </label>
                    <div className="relative rounded-xl border border-slate-200 bg-slate-950 overflow-hidden aspect-[4/3] flex items-center justify-center group">
                      {/* Cervical Visual Presentation */}
                      <div className="w-full h-full bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 flex flex-col items-center justify-center p-4 text-center relative">
                        {/* Simulation of Acetowhite lesion */}
                        <div className="w-32 h-32 rounded-full border-4 border-rose-400/40 bg-rose-600/30 flex items-center justify-center relative shadow-inner">
                          <div className="w-14 h-14 rounded-full bg-rose-900 border-2 border-rose-500 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-slate-950" />
                          </div>
                          {/* Acetowhite Area Annotation */}
                          <div className="absolute -top-1 -right-2 px-1.5 py-0.5 rounded bg-white text-rose-950 font-bold text-[10px] shadow border border-rose-200">
                            Dense Acetowhite
                          </div>
                          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-amber-100/90 blur-[1px] border border-amber-300" />
                        </div>
                        <span className="text-[11px] text-slate-300 mt-3 font-medium">
                          Squamocolumnar Junction (SCJ) Visualization
                        </span>
                        <span className="text-[10px] text-amber-300 font-mono">
                          Suspicious transformation zone · Grade 2 lesion
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 backdrop-blur text-[10px] text-white flex items-center gap-1">
                        <ZoomIn className="w-3 h-3" />
                        High-Resolution Capture
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 italic">
                      Image captured at District Spoke Clinic via mobile colposcope camera and securely tokenized.
                    </div>
                  </div>

                  {/* ASHA Primary Intake & Symptoms */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-teal-700" />
                      ASHA Intake Telemetry & Symptom Notes
                    </label>

                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Reported Symptoms:</span>
                        <p className="text-slate-800 font-medium mt-0.5">
                          {selectedCase.symptom_notes || "Persistent contact bleeding and foul-smelling discharge."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Screening Method:</span>
                          <span className="font-semibold text-slate-800">{selectedCase.screening_type} (Point-of-Care)</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Test Date:</span>
                          <span className="font-semibold text-slate-800 font-mono">{selectedCase.test_date}</span>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-200/80">
                        <span className="text-slate-500 text-[11px] block">Triage Destination:</span>
                        <span className="font-semibold text-teal-800">
                          {selectedCase.tertiary_facility || "Tertiary Specialist Oncology Center"}
                        </span>
                      </div>
                    </div>

                    {selectedCase.specialist_doctor_notes && (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs space-y-1">
                        <span className="font-bold text-emerald-950 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          Signed Specialist Directive:
                        </span>
                        <p className="text-emerald-900 font-medium">
                          {selectedCase.specialist_doctor_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Specialist Action & Directive Form */}
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-teal-700" />
                    Specialist Directive & Treatment Plan Sign-off
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sign off on secondary care management or schedule tertiary diagnostic procedures for this patient.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Attending Oncologist / Gynecologist ID
                        </label>
                        <input
                          type="text"
                          value={oncologistId}
                          onChange={(e) => setOncologistId(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Recommended Procedure / Intervention
                        </label>
                        <select
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                          onChange={(e) => setTreatmentPlan(e.target.value)}
                          defaultValue={treatmentPlan}
                        >
                          <option value="Urgent colposcopy-directed quadrant punch biopsy + endocervical curettage (ECC) scheduled at Tertiary Hub OT 2.">
                            Colposcopy-Directed Punch Biopsy + ECC
                          </option>
                          <option value="Thermal ablation at tertiary daycare followed by 6-month surveillance.">
                            Daycare Thermal Ablation (Preserved Transition Zone)
                          </option>
                          <option value="Loop Electrosurgical Excision Procedure (LEEP) under local anesthesia.">
                            LEEP Excision Procedure
                          </option>
                          <option value="Direct escalation to Oncology Staging (Pelvic MRI + Clinical Staging examination).">
                            Oncology Pelvic Staging Examination (Suspicious Invasive)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Clinical Assessment & Differential Diagnosis
                      </label>
                      <textarea
                        rows={3}
                        value={clinicalAssessment}
                        onChange={(e) => setClinicalAssessment(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-sans"
                        placeholder="Detail the visual staging, margin involvement, and clinical impression..."
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <ShieldCheck className="w-4 h-4 text-teal-700" />
                        <span>Cryptographically logged to sovereign audit ledger</span>
                      </div>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5"
                      >
                        <Send className="w-4 h-4" />
                        {submitting ? "Signing Directive..." : "Confirm & Sign Clinical Directive"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400">
              Select a referred patient from the queue to review visual imagery and sign clinical directives.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
