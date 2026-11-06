import React, { useState, useEffect } from "react";
import { api, type PrescriptionParseResult } from "../../api/client";
import {
  SolarScan,
  SolarShieldKeyhole,
  SolarDocumentText,
  SolarCheck,
  SolarLayers,
  SolarSparkles,
} from "../icons/SolarIcons";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";

const SAMPLES = [
  { id: "sample_cervical_01", label: "Cervical Carcinoma FIGO IIB (Standard Spoke)" },
  { id: "sample_cervical_02", label: "Endocervical Adenocarcinoma (Advanced)" },
  { id: "sample_cervical_03", label: "CHC Rural Primary Screening Referral" },
];

export const VisionOcrStudio: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<string>("sample_cervical_01");
  const [ocrData, setOcrData] = useState<PrescriptionParseResult | null>(null);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [showMaskedPii, setShowMaskedPii] = useState<boolean>(true);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"slip" | "wireframe">("slip");

  const fetchOcr = (sampleId: string) => {
    setIsParsing(true);
    api.parsePrescriptionSlip({ sample_id: sampleId }).then((res) => {
      setOcrData(res);
      setTimeout(() => {
        setIsParsing(false);
      }, 700);
    });
  };

  useEffect(() => {
    fetchOcr(selectedSample);
  }, [selectedSample]);

  // Lookup helper for specific entity bounding box
  const getBox = (boxId: string) => ocrData?.bounding_boxes.find((b) => b.id === boxId);
  const boxDiag = getBox("box_diag");
  const boxStage = getBox("box_stage");
  const boxBiopsy = getBox("box_biopsy");
  const boxEbrt = getBox("box_ebrt");
  const boxBrachy = getBox("box_brachy");
  const boxCeiling = getBox("box_ceiling");

  return (
    <div className="w-full card-base card-gradient-blue rounded-lg p-5 sm:p-7 border border-black/15 shadow-sm">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/10 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-heading text-xs uppercase tracking-wider text-[#0284C7] font-bold bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
              Vision &amp; Document Intelligence
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-600 font-medium">Laplacian Blur Guard</span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Handwritten Clinical Slip Spatial OCR Studio
          </h3>
        </div>

        {/* Live Metrics (strictly Sky Blue & Pink, no green) */}
        <div className="flex items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-md bg-sky-50 border border-sky-200 text-[#0369A1] font-bold shadow-2xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>{ocrData?.elapsed_ms || 38.4} ms Extraction</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-pink-50 border border-pink-200 text-[#9D174D] font-bold shadow-2xs">
            <span>Spatial Bounding Aligned</span>
          </div>
        </div>
      </div>

      {/* Sample Selector & Re-analyze Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-heading text-slate-700 mr-1.5 font-bold uppercase tracking-wider">
            Prescription Sample:
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSample(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold border transition-all cursor-pointer shadow-2xs ${
                selectedSample === s.id
                  ? "bg-[#0284C7] border-[#0284C7] text-white font-bold"
                  : "bg-white/90 border-black/15 text-slate-700 hover:border-black/30 hover:text-black"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-md border border-black/15 p-0.5 bg-white/80 shadow-2xs">
            <button
              onClick={() => setViewMode("slip")}
              className={`px-3 py-1 text-xs font-heading font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "slip"
                  ? "bg-[#0F172A] text-white font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Prescription Sheet
            </button>
            <button
              onClick={() => setViewMode("wireframe")}
              className={`px-3 py-1 text-xs font-heading font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "wireframe"
                  ? "bg-[#0F172A] text-white font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Spatial Wireframe
            </button>
          </div>

          <button
            onClick={() => fetchOcr(selectedSample)}
            disabled={isParsing}
            className="px-3.5 py-1.5 rounded-md bg-[#0F172A] hover:bg-black text-white text-xs font-heading font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 uppercase tracking-wider"
          >
            <SolarScan size={12} />
            <span>{isParsing ? "Scanning Slip..." : "Re-analyze Document"}</span>
          </button>
        </div>
      </div>

      {/* Split Interactive Document Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Digitized Clinical Slip with Spatial Entity Highlighting */}
        <div className="lg:col-span-6 card-base card-gradient-subtle border border-black/15 rounded-lg p-4 sm:p-5 relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-black/10 mb-4">
            <span className="font-heading text-xs text-slate-900 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <div className="size-5 rounded-md bg-white border border-black/15 flex items-center justify-center text-[#0284C7]">
                <SolarDocumentText size={12} />
              </div>
              <span>Spatial Document Canvas</span>
            </span>
            <span className="text-[11px] font-mono-data text-slate-500">
              Hover boxes to trace entity
            </span>
          </div>

          {/* View Mode 1: Authentic Clinical Prescription Sheet */}
          {viewMode === "slip" && (
            <div className="relative bg-[#FCFBF7] border border-black/15 rounded-lg p-5 font-mono-data text-xs shadow-2xs min-h-[460px] select-none overflow-hidden">
              {/* Prescription Header */}
              <div className="pb-3 border-b border-black/10 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-md bg-white border border-black/15 flex items-center justify-center text-slate-900 shrink-0 shadow-2xs">
                      <CerviSetuLogo size={20} />
                    </div>
                    <div>
                      <h4 className="font-heading text-xs font-bold text-[#0369A1] uppercase tracking-wide">
                        {ocrData?.facility_name || "GOVERNMENT DISTRICT CANCER CARE DAYCARE & RADIOTHERAPY SPOKE"}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Radiation Oncology Daycare Network · Spoke OPD Slip #DL 2026 8812
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-slate-900 font-mono-data">03 NOV 2026</div>
                    <div className="text-[9px] text-slate-500 font-mono-data">09:42 IST · Spoke #4</div>
                  </div>
                </div>
              </div>

              {/* Prescription Body with Bounding Capsule Regions */}
              <div className="space-y-3.5 text-slate-900">
                {/* Rx Symbol */}
                <div className="text-2xl font-serif text-[#0369A1] font-bold select-none leading-none -mt-1">
                  ℞
                </div>

                {/* Section 1: Patient Demographics */}
                <div className="bg-white border border-black/15 rounded-md p-2.5 space-y-1 shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Patient Registration &amp; Privacy Shield
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Pt:</span>
                    <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200">
                      {showMaskedPii
                        ? (ocrData?.patient_masked || "PT ANON 7B93")
                        : (ocrData?.patient_display || "Sunita Devi, 46F, W/o Rameshwar")}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      · Dist: {ocrData?.district || "Varanasi"}
                    </span>
                  </div>
                </div>

                {/* Section 2: Clinical Diagnosis & FIGO Staging */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Clinical Impression &amp; Oncologic Staging
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Bounding Box: Cancer Type */}
                    <div
                      onMouseEnter={() => setHoveredBoxId("box_diag")}
                      onMouseLeave={() => setHoveredBoxId(null)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                        hoveredBoxId === "box_diag"
                          ? "bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]"
                          : "bg-white border-black/15 hover:border-black/30"
                      }`}
                    >
                      <span className="font-bold text-slate-900 text-xs">
                        {boxDiag?.text || "Carcinoma Cervix"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#0284C7] text-white">
                        DIAGNOSIS {Math.round((boxDiag?.confidence || 0.984) * 100)}%
                      </span>
                    </div>

                    {/* Bounding Box: FIGO Stage */}
                    <div
                      onMouseEnter={() => setHoveredBoxId("box_stage")}
                      onMouseLeave={() => setHoveredBoxId(null)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                        hoveredBoxId === "box_stage"
                          ? "bg-pink-50 border-[#9D174D] ring-1 ring-[#9D174D]"
                          : "bg-white border-black/15 hover:border-black/30"
                      }`}
                    >
                      <span className="font-bold text-[#9D174D] text-xs">
                        {boxStage?.text || "FIGO Stage IIB"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#9D174D] text-white">
                        STAGING {Math.round((boxStage?.confidence || 0.962) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Biopsy Histopathology */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Biopsy Histopathology Examination
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_biopsy")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                      hoveredBoxId === "box_biopsy"
                        ? "bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]"
                        : "bg-white border-black/15 hover:border-black/30"
                    }`}
                  >
                    <span className="font-semibold text-slate-900 text-xs">
                      {boxBiopsy?.text || "Moderately differentiated Squamous Cell Carcinoma"}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#0284C7] text-white shrink-0 ml-2">
                      PATHOLOGY {Math.round((boxBiopsy?.confidence || 0.991) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Section 4: Teletherapy Spoke Order (Sky Blue, strictly no orange/amber) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Teletherapy Radiotherapy Order (Local Spoke)
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_ebrt")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                      hoveredBoxId === "box_ebrt"
                        ? "bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]"
                        : "bg-white border-black/15 hover:border-black/30"
                    }`}
                  >
                    <span className="font-semibold text-slate-900 text-xs">
                      {boxEbrt?.text || "50 Gy in 25 fractions (2 Gy per fraction)"}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#0284C7] text-white shrink-0 ml-2">
                      EBRT {Math.round((boxEbrt?.confidence || 0.978) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-1">
                    Chemotherapy: Weekly Cisplatin 40 mg/m2 IV with pre-hydration protocol
                  </p>
                </div>

                {/* Section 5: Tertiary Hub Handoff (Dark Pink, strictly no indigo/purple) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Tertiary Hub Handoff Protocol (Brachytherapy)
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_brachy")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                      hoveredBoxId === "box_brachy"
                        ? "bg-pink-50 border-[#9D174D] ring-1 ring-[#9D174D]"
                        : "bg-white border-black/15 hover:border-black/30"
                    }`}
                  >
                    <span className="font-semibold text-[#9D174D] text-xs">
                      {boxBrachy?.text || "HDR Intracavitary Brachytherapy (4 fractions)"}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#9D174D] text-white shrink-0 ml-2">
                      BRACHY {Math.round((boxBrachy?.confidence || 0.973) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Section 6: Cadence & Follow-up Window */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-heading">
                    Cadence &amp; Follow-up Window
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_ceiling")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                      hoveredBoxId === "box_ceiling"
                        ? "bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]"
                        : "bg-white border-black/15 hover:border-black/30"
                    }`}
                  >
                    <span className="font-bold text-[#0369A1] text-xs">
                      {boxCeiling?.text || "14-Day Cadence Window & 6-Month HPV Interval"}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#0284C7] text-white shrink-0 ml-2">
                      CADENCE {Math.round((boxCeiling?.confidence || 0.995) * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 pl-1">
                    Prevention window tracking: 14-day pre-due alerts and persistent recurrent overdue cycle
                  </p>
                </div>
              </div>

              {/* Prescription Sign-Off Stamp (Sky Blue, strictly no green) */}
              <div className="pt-4 mt-5 border-t border-black/10 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-900 font-heading">
                    {ocrData?.doctor_name || "Dr. A. K. Sharma (MD Radiation Oncology)"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Govt Cancer Hospital · Spoke Oncology Network
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono-data">
                    Digital Audit Hash: SHA 256 d98f3b...e102
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-md bg-sky-50 border border-sky-200 text-[10px] font-bold text-[#0369A1] flex items-center gap-1.5 shadow-2xs shrink-0 font-mono-data">
                  <SolarCheck size={12} />
                  <span>OCR VERIFIED &amp; LOCKED</span>
                </div>
              </div>
            </div>
          )}

          {/* View Mode 2: Spatial Coordinate Wireframe View */}
          {viewMode === "wireframe" && (
            <div className="relative bg-white border border-black/15 rounded-lg p-5 font-mono-data text-xs shadow-2xs min-h-[460px] select-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7] flex items-center gap-1.5 font-heading">
                    <SolarLayers size={13} />
                    <span>2D Geometric Coordinate Canvas</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Normalized Coordinates [0% to 100%]
                  </span>
                </div>

                <div className="space-y-2">
                  {ocrData?.bounding_boxes.map((box) => {
                    const isHovered = hoveredBoxId === box.id;
                    return (
                      <div
                        key={box.id}
                        onMouseEnter={() => setHoveredBoxId(box.id)}
                        onMouseLeave={() => setHoveredBoxId(null)}
                        className={`p-2.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                          isHovered
                            ? "bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]"
                            : "bg-slate-50/70 border-black/10 hover:border-black/25"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#0284C7]" />
                            <span>{box.label}</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-black/10 text-slate-700">
                            {box.category} · {Math.round(box.confidence * 100)}% Confidence
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 truncate mb-1">
                          Extracted Text: &quot;<span className="text-slate-900 font-semibold">{box.text}</span>&quot;
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-3 bg-white px-2 py-0.5 rounded-md border border-black/10">
                          <span>top: {box.rect.top}%</span>
                          <span>left: {box.rect.left}%</span>
                          <span>width: {box.rect.width}%</span>
                          <span>height: {box.rect.height}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Sample document. Upload real documents in Clinical Intake.</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Structured Extracted Entity Inspector */}
        <div className="lg:col-span-6 space-y-4">
          {/* PII Masking Toggle Header */}
          <div className="p-4 rounded-lg card-base card-gradient-warm border border-black/15 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-white border border-black/15 flex items-center justify-center text-[#0284C7] shrink-0 shadow-2xs">
                <SolarShieldKeyhole size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block font-heading">
                  Zero-Knowledge DPDP Token Vault
                </span>
                <span className="text-[11px] text-slate-600 font-mono-data">
                  {showMaskedPii
                    ? `Protected: ${ocrData?.patient_masked || "PT ANON 7B93"}`
                    : "Authenticated Workstation View"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowMaskedPii(!showMaskedPii)}
              className="px-3 py-1.5 rounded-md text-xs font-heading font-semibold bg-white border border-black/15 hover:bg-slate-50 text-slate-800 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              {showMaskedPii ? "Reveal Unmasked" : "Engage Shield"}
            </button>
          </div>

          {/* Structured Key Values Table with Bidirectional Hover */}
          <div className="border border-black/15 rounded-lg overflow-hidden shadow-2xs card-base card-gradient-subtle">
            <div className="px-4 py-3 bg-white/90 border-b border-black/10 flex items-center justify-between">
              <span className="text-xs font-heading uppercase tracking-wider text-slate-900 font-bold">
                Clinical Entity Key Values
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#0369A1] font-bold flex items-center gap-1">
                <SolarSparkles size={11} />
                <span>Verified</span>
              </span>
            </div>

            <div className="divide-y divide-black/5 font-mono-data text-xs">
              {/* Row 1: Cancer Site */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_diag")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_diag" ? "bg-sky-50 text-blue-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">Cancer Site:</span>
                <span className="font-bold text-slate-900">
                  {ocrData?.cancer_type || "CERVICAL"}
                </span>
              </div>

              {/* Row 2: FIGO Stage */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_stage")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_stage" ? "bg-pink-50 text-pink-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">FIGO Clinical Staging:</span>
                <span className="font-bold text-[#9D174D]">
                  {ocrData?.stage || "Stage IIB"}
                </span>
              </div>

              {/* Row 3: Biopsy */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_biopsy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_biopsy" ? "bg-sky-50 text-blue-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">Histopathology Confirmation:</span>
                <span className="font-bold text-slate-900 max-w-[260px] text-right truncate">
                  {boxBiopsy?.text || "Squamous Cell Carcinoma (Positive)"}
                </span>
              </div>

              {/* Row 4: EBRT (Sky Blue, strictly no orange/amber) */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_ebrt")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_ebrt" ? "bg-sky-50 text-blue-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">Local Spoke Radiotherapy:</span>
                <span className="font-bold text-slate-900">
                  {ocrData?.fractions_planned?.ebrt_spoke_fractions || 25} Fractions (50 Gy Total)
                </span>
              </div>

              {/* Row 5: Brachytherapy (Dark Pink, strictly no indigo/purple) */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_brachy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_brachy" ? "bg-pink-50 text-pink-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">Tertiary Hub Referral:</span>
                <span className="font-bold text-[#9D174D]">
                  {ocrData?.fractions_planned?.brachy_hub_fractions || 4} Brachytherapy Fractions (HDR)
                </span>
              </div>

              {/* Row 6: Curative Ceiling */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_ceiling")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_ceiling" ? "bg-sky-50 text-blue-950 font-semibold" : "bg-transparent"
                }`}
              >
                <span className="text-slate-500 font-medium font-sans">Cadence &amp; Window Limit:</span>
                <span className="font-bold text-[#0284C7]">
                  14-Day Cadence &amp; 6-Month HPV Interval
                </span>
              </div>
            </div>
          </div>

          {/* Spatial OCR Performance & Quality Metrics */}
          <div className="p-4 rounded-lg card-base card-gradient-pink border border-black/15 font-mono-data text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-900 font-bold text-xs pb-2 border-b border-black/10">
              <span className="flex items-center gap-1.5 font-heading">
                <div className="size-4 rounded bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
                  <SolarCheck size={10} />
                </div>
                <span>Vision Spatial OCR Extraction Telemetry</span>
              </span>
              <span className="text-[#0284C7] font-bold">Sarvam Vision Protocol</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-md bg-white border border-black/10 shadow-2xs">
                <span className="text-slate-500 block text-[10px]">Laplacian Blur Variance</span>
                <span className="font-bold text-slate-900">284.6 (Sharp · Min 85.0)</span>
              </div>
              <div className="p-2.5 rounded-md bg-white border border-black/10 shadow-2xs">
                <span className="text-slate-500 block text-[10px]">Document source</span>
                <span className="font-bold text-[#0284C7]">Sample slip for illustration</span>
              </div>
              <div className="p-2.5 rounded-md bg-white border border-black/10 shadow-2xs">
                <span className="text-slate-500 block text-[10px]">Real documents</span>
                <span className="font-bold text-slate-900">Clinical Intake workspace</span>
              </div>
              <div className="p-2.5 rounded-md bg-white border border-black/10 shadow-2xs">
                <span className="text-slate-500 block text-[10px]">Total Extraction Latency</span>
                <span className="font-bold text-[#0369A1]">{ocrData?.elapsed_ms || 38.4} ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
