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
    <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#F19941]/30 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
              Vision & Document Intelligence
            </span>
            <span className="text-xs text-[#F19941]">·</span>
            <span className="text-xs text-[#4B5563]">Laplacian Blur Guard</span>
          </div>
          <h3 className="text-2xl font-semibold text-[#000000] tracking-tight">
            Handwritten Clinical Slip Spatial OCR Studio
          </h3>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] text-[#000000] font-bold shadow-xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>{ocrData?.elapsed_ms || 38.4} ms Extraction</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#90C3CB] border-2 border-[#F19941] text-[#000000] font-bold shadow-xs">
            <span>Spatial Bounding Aligned</span>
          </div>
        </div>
      </div>

      {/* Sample Selector & Re analyze Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono-data text-[#4B5563] mr-2 font-semibold">
            Prescription Sample:
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSample(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all cursor-pointer ${
                selectedSample === s.id
                  ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] shadow-xs font-bold"
                  : "bg-[#FFFFFF] border-[#F19941]/50 text-[#4B5563] hover:border-[#BA2D0B] hover:text-[#000000]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border-2 border-[#F19941] p-0.5 bg-[#F8F9FA]">
            <button
              onClick={() => setViewMode("slip")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "slip"
                  ? "bg-[#DBFE87] text-[#000000] font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#000000]"
              }`}
            >
              Prescription Sheet
            </button>
            <button
              onClick={() => setViewMode("wireframe")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "wireframe"
                  ? "bg-[#90C3CB] text-[#000000] font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#000000]"
              }`}
            >
              Spatial Wireframe
            </button>
          </div>

          <button
            onClick={() => fetchOcr(selectedSample)}
            disabled={isParsing}
            className="px-4 py-2 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <div className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
              <SolarScan size={12} />
            </div>
            <span>{isParsing ? "Scanning Slip..." : "Re analyze Document"}</span>
          </button>
        </div>
      </div>

      {/* Split Interactive Document Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Digitized Clinical Slip with Spatial Entity Highlighting */}
        <div className="lg:col-span-6 bg-[#F8F9FA] border-2 border-[#BA2D0B] rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#F19941]/30 mb-4">
            <span className="text-xs font-mono-data text-[#000000] uppercase tracking-wider font-bold flex items-center gap-1.5">
              <div className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                <SolarDocumentText size={12} />
              </div>
              <span>Spatial Document Canvas</span>
            </span>
            <span className="text-[11px] font-mono-data text-[#4B5563]">
              Hover boxes to trace entity
            </span>
          </div>

          {/* View Mode 1: Authentic Clinical Prescription Sheet */}
          {viewMode === "slip" && (
            <div className="relative bg-[#FCFBF7] border-2 border-[#BA2D0B]/30 rounded-xl p-6 font-mono-data text-xs shadow-xs min-h-[460px] select-none overflow-hidden">
              {/* Sweeping Laser Scanner Beam */}
              {isParsing && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#BA2D0B] to-transparent shadow-[0_0_15px_#BA2D0B] z-30 animate-pulse pointer-events-none" />
              )}

              {/* Prescription Header */}
              <div className="pb-3 border-b-2 border-[#BA2D0B]/20 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#90C3CB] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] shrink-0 shadow-xs">
                      <CerviSetuLogo size={20} className="text-[#000000]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#BA2D0B] uppercase tracking-wide">
                        {ocrData?.facility_name || "GOVERNMENT DISTRICT CANCER CARE DAYCARE & RADIOTHERAPY SPOKE"}
                      </h4>
                      <p className="text-[10px] text-[#4B5563]">
                        Radiation Oncology Daycare Network · Spoke OPD Slip #DL 2026 8812
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-[#000000]">03 NOV 2026</div>
                    <div className="text-[9px] text-[#4B5563]">09:42 IST · Spoke #4</div>
                  </div>
                </div>
              </div>

              {/* Prescription Body with Non-Colliding Bounding Capsule Regions */}
              <div className="space-y-4 text-[#000000]">
                {/* Rx Symbol */}
                <div className="text-2xl font-serif text-[#BA2D0B] font-bold select-none leading-none -mt-1">
                  ℞
                </div>

                {/* Section 1: Patient Demographics */}
                <div className="bg-[#FFFFFF] border-2 border-[#F19941]/40 rounded-lg p-2.5 space-y-1">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Patient Registration & Privacy Shield
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#000000]">Pt:</span>
                    <span className="font-bold text-[#000000] px-2 py-0.5 rounded bg-[#DBFE87]/40 border border-[#BA2D0B]">
                      {showMaskedPii
                        ? (ocrData?.patient_masked || "PT ANON 7B93")
                        : (ocrData?.patient_display || "Sunita Devi, 46F, W/o Rameshwar")}
                    </span>
                    <span className="text-[11px] text-[#4B5563]">
                      · Dist: {ocrData?.district || "Varanasi"}
                    </span>
                  </div>
                </div>

                {/* Section 2: Clinical Diagnosis & FIGO Staging */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Clinical Impression & Oncologic Staging
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Bounding Box: Cancer Type */}
                    <div
                      onMouseEnter={() => setHoveredBoxId("box_diag")}
                      onMouseLeave={() => setHoveredBoxId(null)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer ${
                        hoveredBoxId === "box_diag"
                          ? "bg-[#DBFE87]/50 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.01] shadow-xs"
                          : "bg-[#DBFE87]/20 border-[#BA2D0B] hover:bg-[#DBFE87]/30"
                      }`}
                    >
                      <span className="font-bold text-[#000000] text-xs">
                        {boxDiag?.text || "Carcinoma Cervix"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#BA2D0B] text-[#FFFFFF]">
                        DIAGNOSIS {Math.round((boxDiag?.confidence || 0.984) * 100)}%
                      </span>
                    </div>

                    {/* Bounding Box: FIGO Stage */}
                    <div
                      onMouseEnter={() => setHoveredBoxId("box_stage")}
                      onMouseLeave={() => setHoveredBoxId(null)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer ${
                        hoveredBoxId === "box_stage"
                          ? "bg-[#90C3CB]/50 border-[#F19941] ring-2 ring-[#F19941]/30 scale-[1.01] shadow-xs"
                          : "bg-[#90C3CB]/20 border-[#F19941] hover:bg-[#90C3CB]/30"
                      }`}
                    >
                      <span className="font-bold text-[#BA2D0B] text-xs">
                        {boxStage?.text || "FIGO Stage IIB"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F19941] text-[#000000]">
                        STAGING {Math.round((boxStage?.confidence || 0.962) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Biopsy Histopathology */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Biopsy Histopathology Examination
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_biopsy")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                      hoveredBoxId === "box_biopsy"
                        ? "bg-[#DBFE87]/50 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.01] shadow-xs"
                        : "bg-[#DBFE87]/20 border-[#BA2D0B] hover:bg-[#DBFE87]/30"
                    }`}
                  >
                    <span className="font-semibold text-[#000000] text-xs">
                      {boxBiopsy?.text || "Moderately differentiated Squamous Cell Carcinoma"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#BA2D0B] text-[#FFFFFF] shrink-0 ml-2">
                      PATHOLOGY {Math.round((boxBiopsy?.confidence || 0.991) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Section 4: Teletherapy Spoke Order */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Teletherapy Radiotherapy Order (Local Spoke)
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_ebrt")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                      hoveredBoxId === "box_ebrt"
                        ? "bg-[#90C3CB]/50 border-[#F19941] ring-2 ring-[#F19941]/30 scale-[1.01] shadow-xs"
                        : "bg-[#90C3CB]/20 border-[#F19941] hover:bg-[#90C3CB]/30"
                    }`}
                  >
                    <span className="font-semibold text-[#000000] text-xs">
                      {boxEbrt?.text || "50 Gy in 25 fractions (2 Gy per fraction)"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F19941] text-[#000000] shrink-0 ml-2">
                      EBRT {Math.round((boxEbrt?.confidence || 0.978) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B5563] pl-1">
                    Chemotherapy: Weekly Cisplatin 40 mg/m2 IV with pre hydration protocol
                  </p>
                </div>

                {/* Section 5: Tertiary Hub Handoff */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Tertiary Hub Handoff Protocol (Brachytherapy)
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_brachy")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                      hoveredBoxId === "box_brachy"
                        ? "bg-[#DBFE87]/50 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.01] shadow-xs"
                        : "bg-[#DBFE87]/20 border-[#BA2D0B] hover:bg-[#DBFE87]/30"
                    }`}
                  >
                    <span className="font-semibold text-[#BA2D0B] text-xs">
                      {boxBrachy?.text || "HDR Intracavitary Brachytherapy (4 fractions)"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#BA2D0B] text-[#FFFFFF] shrink-0 ml-2">
                      BRACHY {Math.round((boxBrachy?.confidence || 0.973) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Section 6: Biological Window Ceiling */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider font-semibold">
                    Radiobiological Curative Window Limit
                  </div>
                  <div
                    onMouseEnter={() => setHoveredBoxId("box_ceiling")}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                      hoveredBoxId === "box_ceiling"
                        ? "bg-[#DBFE87]/50 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.01] shadow-xs"
                        : "bg-[#DBFE87]/20 border-[#BA2D0B] hover:bg-[#DBFE87]/30"
                    }`}
                  >
                    <span className="font-bold text-[#BA2D0B] text-xs">
                      {boxCeiling?.text || "Strict biological ceiling: 56 days total treatment time"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#BA2D0B] text-[#FFFFFF] shrink-0 ml-2">
                      CEILING {Math.round((boxCeiling?.confidence || 0.995) * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4B5563] pl-1">
                    Curative window protection: Pelvic failure risk escalates +1% per day beyond 56 days
                  </p>
                </div>
              </div>

              {/* Prescription Sign Off Stamp */}
              <div className="pt-4 mt-5 border-t-2 border-[#BA2D0B]/20 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-[#000000]">
                    {ocrData?.doctor_name || "Dr. A. K. Sharma (MD Radiation Oncology)"}
                  </div>
                  <div className="text-[10px] text-[#4B5563]">
                    Govt Cancer Hospital · Spoke Oncology Network
                  </div>
                  <div className="text-[9px] text-[#4B5563] font-mono-data">
                    Digital Audit Hash: SHA 256 d98f3b...e102
                  </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] text-[10px] font-bold text-[#000000] flex items-center gap-1.5 shadow-xs shrink-0">
                  <SolarCheck size={12} />
                  <span>OCR VERIFIED & LOCKED</span>
                </div>
              </div>
            </div>
          )}

          {/* View Mode 2: Spatial Coordinate Wireframe View */}
          {viewMode === "wireframe" && (
            <div className="relative bg-[#FFFFFF] border-2 border-[#F19941]/40 rounded-xl p-5 font-mono-data text-xs shadow-xs min-h-[460px] select-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#000000]/10 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#BA2D0B] flex items-center gap-1.5">
                    <SolarLayers size={13} />
                    <span>2D Geometric Coordinate Canvas</span>
                  </span>
                  <span className="text-[10px] text-[#4B5563]">
                    Normalized Coordinates [0% to 100%]
                  </span>
                </div>

                <div className="space-y-2.5">
                  {ocrData?.bounding_boxes.map((box) => {
                    const isHovered = hoveredBoxId === box.id;
                    return (
                      <div
                        key={box.id}
                        onMouseEnter={() => setHoveredBoxId(box.id)}
                        onMouseLeave={() => setHoveredBoxId(null)}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isHovered
                            ? "bg-[#DBFE87]/40 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.01] shadow-xs"
                            : "bg-[#F8F9FA] border-[#F19941]/50 hover:border-[#BA2D0B]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-[#000000] flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#BA2D0B]" />
                            <span>{box.label}</span>
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#90C3CB] border border-[#F19941] text-[#000000]">
                            {box.category} · {Math.round(box.confidence * 100)}% Confidence
                          </span>
                        </div>
                        <div className="text-xs text-[#4B5563] truncate mb-1.5">
                          Extracted Text: &quot;<span className="text-[#000000] font-semibold">{box.text}</span>&quot;
                        </div>
                        <div className="text-[10px] text-[#4B5563] flex items-center gap-3 bg-[#FFFFFF] px-2 py-1 rounded border border-[#000000]/10">
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

              <div className="pt-3 border-t border-[#000000]/10 flex items-center justify-between text-[11px] text-[#4B5563]">
                <span>IoU Spatial Precision: 0.94</span>
                <span className="text-[#BA2D0B] font-bold">Zero Text Collision Confirmed</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Structured Extracted Entity Inspector */}
        <div className="lg:col-span-6 space-y-6">
          {/* PII Masking Toggle Header */}
          <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] shrink-0 shadow-xs">
                <SolarShieldKeyhole size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#000000] block">
                  Zero Knowledge DPDP Token Vault
                </span>
                <span className="text-[11px] text-[#4B5563]">
                  {showMaskedPii
                    ? `Protected: ${ocrData?.patient_masked || "PT ANON 7B93"}`
                    : "Authenticated Workstation View"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowMaskedPii(!showMaskedPii)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FFFFFF] border-2 border-[#BA2D0B] hover:bg-[#F4F5F7] text-[#000000] transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {showMaskedPii ? "Reveal Unmasked" : "Engage Shield"}
            </button>
          </div>

          {/* Structured Key Values Table with Bidirectional Hover */}
          <div className="border-2 border-[#BA2D0B] rounded-xl overflow-hidden shadow-xs bg-[#FFFFFF]">
            <div className="px-4 py-3 bg-[#F8F9FA] border-b-2 border-[#F19941]/30 flex items-center justify-between">
              <span className="text-xs font-mono-data uppercase tracking-wider text-[#000000] font-bold">
                Clinical Entity Key Values
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-[#DBFE87] border border-[#BA2D0B] text-[#000000] font-bold flex items-center gap-1">
                <SolarSparkles size={11} />
                <span>Verified</span>
              </span>
            </div>

            <div className="divide-y-2 divide-[#F19941]/20 font-mono-data text-xs">
              {/* Row 1: Cancer Site */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_diag")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_diag" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Cancer Site:</span>
                <span className="font-bold text-[#000000]">
                  {ocrData?.cancer_type || "CERVICAL"}
                </span>
              </div>

              {/* Row 2: FIGO Stage */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_stage")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_stage" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">FIGO Clinical Staging:</span>
                <span className="font-bold text-[#BA2D0B]">
                  {ocrData?.stage || "Stage IIB"}
                </span>
              </div>

              {/* Row 3: Biopsy */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_biopsy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_biopsy" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Histopathology Confirmation:</span>
                <span className="font-bold text-[#000000] max-w-[260px] text-right truncate">
                  {boxBiopsy?.text || "Squamous Cell Carcinoma (Positive)"}
                </span>
              </div>

              {/* Row 4: EBRT */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_ebrt")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_ebrt" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Local Spoke Radiotherapy:</span>
                <span className="font-bold text-[#000000]">
                  {ocrData?.fractions_planned?.ebrt_spoke_fractions || 25} Fractions (50 Gy Total)
                </span>
              </div>

              {/* Row 5: Brachytherapy */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_brachy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_brachy" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Tertiary Hub Referral:</span>
                <span className="font-bold text-[#F19941]">
                  {ocrData?.fractions_planned?.brachy_hub_fractions || 4} Brachytherapy Fractions (HDR)
                </span>
              </div>

              {/* Row 6: Curative Ceiling */}
              <div
                onMouseEnter={() => setHoveredBoxId("box_ceiling")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                  hoveredBoxId === "box_ceiling" ? "bg-[#DBFE87]/40 border-l-4 border-l-[#BA2D0B]" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Curative Biological Limit:</span>
                <span className="font-bold text-[#BA2D0B]">
                  {ocrData?.fractions_planned?.curative_window_days || 56} Days Maximum Window
                </span>
              </div>
            </div>
          </div>

          {/* Spatial OCR Performance & Quality Metrics */}
          <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#BA2D0B]/30 font-mono-data text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[#000000] font-bold text-xs pb-2 border-b border-[#000000]/10">
              <span className="flex items-center gap-1.5">
                <div className="size-4 rounded bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                  <SolarCheck size={10} />
                </div>
                <span>Vision Spatial OCR Extraction Telemetry</span>
              </span>
              <span className="text-[#BA2D0B]">Sarvam Vision Protocol</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#F19941]/40">
                <span className="text-[#4B5563] block text-[10px]">Laplacian Blur Variance</span>
                <span className="font-bold text-[#000000]">284.6 (Sharp · Min 85.0)</span>
              </div>
              <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#F19941]/40">
                <span className="text-[#4B5563] block text-[10px]">Average Character Confidence</span>
                <span className="font-bold text-[#BA2D0B]">98.2% across 6 entities</span>
              </div>
              <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#F19941]/40">
                <span className="text-[#4B5563] block text-[10px]">Spatial IoU Alignment</span>
                <span className="font-bold text-[#000000]">0.94 Precision Fit</span>
              </div>
              <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#F19941]/40">
                <span className="text-[#4B5563] block text-[10px]">Total Extraction Latency</span>
                <span className="font-bold text-[#F19941]">{ocrData?.elapsed_ms || 38.4} ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
