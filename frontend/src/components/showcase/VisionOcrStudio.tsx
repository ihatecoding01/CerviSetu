import React, { useState, useEffect } from "react";
import { api, type PrescriptionParseResult } from "../../api/client";
import {
  SolarScan,
  SolarShieldKeyhole,
  SolarDocumentText,
  SolarCheck,
} from "../icons/SolarIcons";

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

  const fetchOcr = (sampleId: string) => {
    setIsParsing(true);
    api.parsePrescriptionSlip({ sample_id: sampleId }).then((res) => {
      setOcrData(res);
      setIsParsing(false);
    });
  };

  useEffect(() => {
    fetchOcr(selectedSample);
  }, [selectedSample]);

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

      {/* Sample Selector & Re parse Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
                  ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000] shadow-xs"
                  : "bg-[#FFFFFF] border-[#F19941]/50 text-[#4B5563] hover:border-[#BA2D0B] hover:text-[#000000]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchOcr(selectedSample)}
          disabled={isParsing}
          className="px-4 py-2 rounded-lg bg-[#BA2D0B] hover:bg-[#9E2407] border-2 border-[#BA2D0B] text-[#FFFFFF] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <div className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
            <SolarScan size={12} />
          </div>
          <span>{isParsing ? "Analyzing Slip..." : "Re analyze Document"}</span>
        </button>
      </div>

      {/* Split Interactive Document Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Digitized Clinical Slip with Hoverable Bounding Boxes */}
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

          {/* Paper Document Canvas with Bounding Overlays */}
          <div className="relative bg-[#FFFFFF] border-2 border-[#F19941]/40 rounded-lg p-5 font-mono-data text-xs shadow-xs min-h-[380px] select-none">
            {/* Raw Clinical Slip Lines */}
            <div className="space-y-3.5 text-[#000000] leading-relaxed">
              <div className="text-xs text-[#4B5563] pb-2 border-b border-[#000000]/10">
                GOVERNMENT DISTRICT CANCER CARE DAYCARE & RADIOTHERAPY SPOKE
              </div>
              <p className="text-[11px] text-[#4B5563]">
                Pt: {showMaskedPii ? "PT ANON 7B93" : "Sunita Devi, 46F, W/o Rameshwar"} · Dist: Varanasi
              </p>
              <p className="font-semibold text-sm">
                Diagnosis: Carcinoma Cervix, FIGO Stage IIB
              </p>
              <p className="text-xs text-[#000000]">
                Histopathology: Moderately differentiated Squamous Cell Carcinoma.
              </p>
              <p className="text-xs text-[#000000]">
                Radiation Order: External Beam Radiotherapy (EBRT) 50 Gy in 25 fractions.
              </p>
              <p className="text-xs text-[#000000]">
                Chemotherapy: Weekly Cisplatin 40 mg/m2 IV with pre hydration protocol.
              </p>
              <p className="text-xs font-semibold text-[#BA2D0B]">
                Day 21 Handoff: Transfer to Regional Hub for HDR Brachytherapy (4 fractions).
              </p>
              <p className="text-[11px] font-bold text-[#BA2D0B]">
                Strict biological ceiling: 56 days total treatment time.
              </p>
            </div>

            {/* Interactive Bounding Boxes Overlay */}
            {ocrData?.bounding_boxes.map((box) => {
              const isHovered = hoveredBoxId === box.id;
              return (
                <div
                  key={box.id}
                  onMouseEnter={() => setHoveredBoxId(box.id)}
                  onMouseLeave={() => setHoveredBoxId(null)}
                  style={{
                    top: `${box.rect.top}%`,
                    left: `${box.rect.left}%`,
                    width: `${box.rect.width}%`,
                    height: `${box.rect.height}%`,
                  }}
                  className={`absolute rounded transition-all cursor-pointer border-2 ${
                    isHovered
                      ? "bg-[#DBFE87]/40 border-[#BA2D0B] ring-2 ring-[#BA2D0B]/30 scale-[1.02] z-20"
                      : "bg-[#90C3CB]/20 border-[#F19941] hover:border-[#BA2D0B]"
                  }`}
                >
                  <span
                    className={`absolute -top-3 left-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                      isHovered
                        ? "bg-[#BA2D0B] text-[#FFFFFF] border-[#BA2D0B]"
                        : "bg-[#FFFFFF] text-[#000000] border-[#F19941]"
                    }`}
                  >
                    {box.label} ({Math.round(box.confidence * 100)}%)
                  </span>
                </div>
              );
            })}
          </div>
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
                  {showMaskedPii ? "Protected: PT ANON 7B93" : "Authenticated Workstation View"}
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

          {/* Structured Key Values Table */}
          <div className="border-2 border-[#BA2D0B] rounded-xl overflow-hidden shadow-xs bg-[#FFFFFF]">
            <div className="px-4 py-3 bg-[#F8F9FA] border-b-2 border-[#F19941]/30 flex items-center justify-between">
              <span className="text-xs font-mono-data uppercase tracking-wider text-[#000000] font-bold">
                Clinical Entity Key Values
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-[#DBFE87] border border-[#BA2D0B] text-[#000000] font-bold">
                Verified
              </span>
            </div>

            <div className="divide-y-2 divide-[#F19941]/20 font-mono-data text-xs">
              <div
                onMouseEnter={() => setHoveredBoxId("box_diag")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_diag" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Cancer Site:</span>
                <span className="font-bold text-[#000000]">
                  {ocrData?.cancer_type || "CERVICAL"}
                </span>
              </div>

              <div
                onMouseEnter={() => setHoveredBoxId("box_stage")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_stage" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">FIGO Clinical Staging:</span>
                <span className="font-bold text-[#BA2D0B]">
                  {ocrData?.stage || "Stage IIB"}
                </span>
              </div>

              <div
                onMouseEnter={() => setHoveredBoxId("box_biopsy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_biopsy" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Histopathology Confirmation:</span>
                <span className="font-bold text-[#000000]">
                  Squamous Cell Carcinoma (Positive)
                </span>
              </div>

              <div
                onMouseEnter={() => setHoveredBoxId("box_ebrt")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_ebrt" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Local Spoke Radiotherapy:</span>
                <span className="font-bold text-[#000000]">
                  25 Fractions (50 Gy Total)
                </span>
              </div>

              <div
                onMouseEnter={() => setHoveredBoxId("box_brachy")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_brachy" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Tertiary Hub Referral:</span>
                <span className="font-bold text-[#F19941]">
                  4 Brachytherapy Fractions (HDR)
                </span>
              </div>

              <div
                onMouseEnter={() => setHoveredBoxId("box_ceiling")}
                onMouseLeave={() => setHoveredBoxId(null)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  hoveredBoxId === "box_ceiling" ? "bg-[#DBFE87]/30" : "bg-transparent"
                }`}
              >
                <span className="text-[#4B5563] font-medium">Curative Biological Limit:</span>
                <span className="font-bold text-[#BA2D0B]">
                  56 Days Maximum Window
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
