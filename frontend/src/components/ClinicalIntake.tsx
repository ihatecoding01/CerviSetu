import { useState, useRef } from "react";
import { api } from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Button } from "./careui/button";
import { Input } from "./careui/input";
import { Textarea } from "./careui/textarea";
import { Badge } from "./careui/badge";
import { Alert, AlertTitle, AlertDescription } from "./careui/alert";
import { Separator } from "./careui/separator";
import {
  FileText,
  AlertCircle,
  ShieldCheck,
  Microscope,
  UploadCloud,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";

interface Props {
  onCaseSubmitted: (data?: any) => void;
}

const SAMPLE_ORAL = {
  patient_name: "Rameshwar Prasad",
  phone: "+91 98451 23098",
  village: "Kalyanpur, Ward 4",
  district: "Mirzapur, Uttar Pradesh",
  raw_text: "Patient presenting with a 3cm non-healing ulcer on left buccal mucosa with induration for 6 weeks. History of tobacco chewing for 15 years. Mild cervical lymphadenopathy noted. Biopsy advised; sample sent for histopathology. Suspected Stage III Oral Squamous Cell Carcinoma. Follow-up in 7 days for biopsy review.",
  days_overdue: 8,
};

const SAMPLE_CERVICAL = {
  patient_name: "Geeta Devi",
  phone: "+91 97630 45012",
  village: "Sonbhadra Block 2",
  district: "Sonbhadra, Uttar Pradesh",
  raw_text: "35-year-old female, presenting with irregular vaginal bleeding for 3 months. VIA positive, referred for colposcopy. Previous normal PAP 3 years ago. High-risk HPV positive. Clinical findings consistent with early-stage cervical carcinoma. Immediate gynae-oncology referral needed.",
  days_overdue: 4,
};

export function ClinicalIntake({ onCaseSubmitted }: Props) {
  const [form, setForm] = useState(SAMPLE_ORAL);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignedOff, setIsSignedOff] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDoctorSignOff = async () => {
    if (!result?.patient_token) return;
    setSigningLoading(true);
    try {
      await api.logDoctorSignOff({
        doctor_id: "DR-ONCO-CAREUI",
        patient_token: result.patient_token,
        case_id: result.session_id,
        notes: "Attending Oncologist reviewed and validated NCG clinical workup intake.",
        ncg_verified: true,
      });
      setIsSignedOff(true);
    } catch (err) {
      console.error("Sign-off error", err);
    } finally {
      setSigningLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setIsSignedOff(false);

    const formData = new FormData();
    formData.append("patient_name", form.patient_name);
    formData.append("phone", form.phone);
    formData.append("village", form.village);
    formData.append("district", form.district);
    formData.append("raw_text", form.raw_text);
    formData.append("days_overdue", form.days_overdue.toString());
    if (imageFile) {
      formData.append("image_file", imageFile);
    }

    try {
      const res = await api.runCase(formData);
      setResult(res);
      onCaseSubmitted(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run clinical case");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header and Preset Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            Clinical Diagnostic Intake &amp; Multi-Agent Pipeline
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Ingests doctor notes, lab slips, and medical scans through a zero-knowledge AES-256 de-identified pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setForm(SAMPLE_ORAL)}
            className="text-xs font-medium"
          >
            Oral Biopsy Preset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setForm(SAMPLE_CERVICAL)}
            className="text-xs font-medium"
          >
            Cervical VIA Preset
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Intake Processing Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stepper Indicator */}
      <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between overflow-x-auto text-xs">
        {[
          { step: "01", name: "Clinical Data Ingestion", status: "Active" },
          { step: "02", name: "AES-256 Tokenization", status: result ? "Completed" : "Queued" },
          { step: "03", name: "LangGraph Synthesis", status: result ? "Completed" : "Queued" },
          { step: "04", name: "Rural Escalation Triage", status: result ? "Completed" : "Queued" },
        ].map((s, idx) => (
          <div key={s.step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`size-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                s.status === "Completed"
                  ? "bg-emerald-600 text-white"
                  : s.status === "Active"
                  ? "bg-[#2B66E4] text-white"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {s.status === "Completed" ? <Check className="size-3" /> : s.step}
              </span>
              <div>
                <div className="font-semibold text-gray-900 leading-tight">{s.name}</div>
                <div className="text-[10px] text-gray-500">{s.status}</div>
              </div>
            </div>
            {idx < 3 && <div className="w-8 h-px bg-gray-200 hidden md:block" />}
          </div>
        ))}
      </div>

      {/* 2-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Clinical Intake Form */}
        <Card className="bg-white border-gray-200 shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#111418] flex items-center gap-2">
                  <FileText className="size-4 text-[#2B66E4]" />
                  Patient Clinical Registration
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  PII is cryptographically vaulted in isolated storage before diagnostic reasoning
                </CardDescription>
              </div>
              <Badge variant="primary" size="xs">Zero-Knowledge</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">Patient Full Name</label>
                  <Input
                    value={form.patient_name}
                    onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                    placeholder="e.g. Rameshwar Prasad"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">Contact Number</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">Village / Locality</label>
                  <Input
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                    placeholder="Village or ward"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">District &amp; State</label>
                  <Input
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="District, State"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Doctor Prescription / Clinical Notes / Biopsy Findings
                </label>
                <Textarea
                  value={form.raw_text}
                  onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
                  placeholder="Paste or type clinical findings, suspicious lesions, examination notes..."
                  className="min-h-28 text-xs leading-relaxed"
                  autoSpace
                  required
                />
              </div>

              {/* Document / Scan Dropzone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Medical Scan or Pathology Slide (Optional)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 hover:border-[#2B66E4] bg-gray-50/60 hover:bg-blue-50/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
                >
                  <UploadCloud className="size-6 text-gray-400" />
                  <div className="text-xs font-medium text-gray-800">
                    {imageFile ? imageFile.name : "Click to attach histopathology slide or dermoscopy scan"}
                  </div>
                  <div className="text-[10px] text-gray-500">Supports PNG, JPG, or DICOM exports up to 25MB</div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Days Overdue (Triage Simulation Window)</label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={form.days_overdue}
                  onChange={(e) => setForm({ ...form, days_overdue: parseInt(e.target.value) || 0 })}
                />
              </div>

              <Separator className="my-1" />

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2B66E4] hover:bg-[#2052C0] text-white shadow-xs font-semibold gap-2 h-11"
              >
                {loading ? (
                  "Synthesizing Diagnostic Graph..."
                ) : (
                  <>
                    <span>Execute LangGraph Diagnostic Pipeline</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Column: Diagnostic Synthesis & State */}
        <Card className="bg-white border-gray-200 shadow-2xs flex flex-col min-h-[580px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#111418] flex items-center gap-2">
                  <Microscope className="size-4 text-[#4A91A7]" />
                  Diagnostic Synthesis &amp; Triage Dossier
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  De-identified reasoning payload with progressive escalation directive
                </CardDescription>
              </div>
              {result && (
                <Badge variant="success" size="sm">Pipeline Complete</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {!result ? (
              <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-3">
                <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <FileCheck2 className="size-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Awaiting Pipeline Execution</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    Submit the clinical case on the left to trigger real-time OCR extraction, zero-knowledge PII tokenization, and multi-agent differential diagnosis.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* De-identified Token Header */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    <span className="text-xs text-gray-600 font-medium">De-Identified ID:</span>
                    <span className="font-mono text-xs font-bold text-[#2B66E4] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {result.patient_token}
                    </span>
                  </div>
                  <Badge
                    variant={
                      result.diagnostic_synthesis?.urgency === "CRITICAL_EMERGENCY"
                        ? "destructive"
                        : "warning"
                    }
                    size="xs"
                  >
                    {result.diagnostic_synthesis?.urgency || "ROUTINE"}
                  </Badge>
                </div>

                {/* Primary Clinical Impression */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-[10px] font-bold text-[#2B66E4] uppercase tracking-wider block mb-1">
                    Primary Clinical Impression
                  </span>
                  <h3 className="text-base font-bold text-[#111418]">
                    {result.diagnostic_synthesis?.primary_impression || "Diagnosis synthesized"}
                  </h3>
                  <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                    {result.diagnostic_synthesis?.treatment_pathway_notes || ""}
                  </p>
                </div>

                {/* Differential Diagnosis Tags */}
                {result.diagnostic_synthesis?.differential_diagnosis && (
                  <div>
                    <span className="text-xs font-semibold text-gray-700 block mb-2">
                      Differential Diagnoses:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.diagnostic_synthesis.differential_diagnosis.map((d: string, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-md border border-gray-200"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Investigations */}
                {result.diagnostic_synthesis?.recommended_investigations && (
                  <div>
                    <span className="text-xs font-semibold text-gray-700 block mb-2">
                      Recommended Investigations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.diagnostic_synthesis.recommended_investigations.map((inv: string, i: number) => (
                        <Badge key={i} variant="primary" size="sm">
                          {inv}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Escalation Tier Banner */}
                {result.current_escalation_tier && (
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
                        Assigned Escalation Tier
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {result.current_escalation_tier}
                      </span>
                    </div>
                    <Badge variant="warning" size="sm">
                      {result.days_overdue} Days Overdue
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Chained audit block generated and hashed with SHA-256</span>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  {isSignedOff ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 w-full justify-center">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Doctor Electronic Sign-Off Verified &amp; Chained
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleDoctorSignOff}
                      disabled={signingLoading}
                      className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-medium text-xs py-2"
                    >
                      <FileCheck2 className="size-4 mr-1.5" />
                      {signingLoading ? "Recording Sign-Off..." : "Doctor Electronic Sign-Off (Hard Clinician Gate)"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
