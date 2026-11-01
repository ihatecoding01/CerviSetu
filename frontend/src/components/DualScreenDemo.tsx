import React, { useState } from "react";
import {
  Tablet,
  Smartphone,
  ArrowLeft
} from "lucide-react";
import { PatientCompanion } from "./PatientCompanion";

interface Props {
  onBackToStaff: () => void;
  onBackToGateway: () => void;
}

export const DualScreenDemo: React.FC<Props> = ({ onBackToStaff, onBackToGateway }) => {
  const [selectedToken, setSelectedToken] = useState("PT-RURAL-7891");

  // Sample dual-column ward roster demonstrating separation of Projection vs Event
  const wardCases = [
    {
      token: "PT-RURAL-7891",
      age: 52,
      stage: "Stage IIB",
      currentStep: 14,
      totalSteps: 29,
      // Column 1: Biological Clock Projection (Calculated)
      projectedFinishDays: 44,
      clockStatus: "OPTIMAL", // <=49d
      // Column 2: Adherence Event (Acute)
      adherenceStatus: "ATTENDING_DAILY",
      adherenceSeverity: "NORMAL",
      lastFractionLogged: "Today (Step 14)",
      hubSlotStatus: "REQUESTED_DAYS_38_44"
    },
    {
      token: "PT-RURAL-4421",
      age: 46,
      stage: "Stage IIIA",
      currentStep: 8,
      totalSteps: 29,
      projectedFinishDays: 52,
      clockStatus: "TARGET_AT_RISK", // 50-56d
      adherenceStatus: "1_DAY_OVERDUE",
      adherenceSeverity: "TIER_1_SMS",
      lastFractionLogged: "Yesterday (Step 8)",
      hubSlotStatus: "NOT_YET_DUE"
    },
    {
      token: "PT-RURAL-1102",
      age: 58,
      stage: "Stage IIIB",
      currentStep: 19,
      totalSteps: 29,
      projectedFinishDays: 59,
      clockStatus: "BREACH_RISK", // >56d
      adherenceStatus: "4_DAYS_OVERDUE",
      adherenceSeverity: "TIER_2_IVR",
      lastFractionLogged: "4 Days Ago (Step 19)",
      hubSlotStatus: "PAC_CHECKLIST_PENDING"
    }
  ];

  const activeCase = wardCases.find((c) => c.token === selectedToken) || wardCases[0];

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToGateway}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> CARE Gateway
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">Live Hackathon Demonstration</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
              Clinic Tablet | Patient's Phone
            </span>
          </div>
        </div>

        <button
          onClick={onBackToStaff}
          className="text-xs font-semibold bg-[#2E7D6F] hover:bg-[#25665a] text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          Open Full CareUI Workstation ➔
        </button>
      </header>

      {/* Main Dual Viewport Split Grid */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full items-start">
        {/* LEFT VIEWPORT: Clinic Tablet (Spoke CareUI Workstation) - 7 cols */}
        <section className="lg:col-span-7 bg-slate-950 rounded-3xl border border-slate-800 p-5 shadow-2xl flex flex-col h-[780px] overflow-hidden">
          {/* Tablet Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Tablet className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 leading-none">Clinic Tablet (Regional Spoke CareUI)</h2>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Mirzapur Spoke Clinic · Linac Room 01
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
              30% Clinician Weight
            </span>
          </div>

          {/* Dual-Column Ward Board: Column 1 (Projection) vs Column 2 (Event) */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-200">
                  Dual-Clock Ward Board (Projection vs. Acute Event)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">3 Active Patients</span>
              </div>

              <div className="space-y-2.5">
                {wardCases.map((c) => {
                  const isSelected = c.token === selectedToken;
                  return (
                    <div
                      key={c.token}
                      onClick={() => setSelectedToken(c.token)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-800 border-indigo-500 shadow-sm"
                          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-200">{c.token}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.age}y · {c.stage}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Step {c.currentStep}/{c.totalSteps}
                        </span>
                      </div>

                      {/* The 2 Distinct Columns */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {/* Column 1: Biological Clock Projection */}
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-semibold">
                            Col 1: Biological Finish
                          </span>
                          <div className="mt-1 flex items-center gap-1.5">
                            {c.clockStatus === "OPTIMAL" && (
                              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                            )}
                            {c.clockStatus === "TARGET_AT_RISK" && (
                              <span className="size-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                            )}
                            {c.clockStatus === "BREACH_RISK" && (
                              <span className="size-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
                            )}
                            <strong className="font-mono text-slate-200">Proj: {c.projectedFinishDays}d</strong>
                          </div>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            {c.clockStatus === "OPTIMAL" ? "≤49d GEC-ESTRO Optimal" : c.clockStatus === "TARGET_AT_RISK" ? "50–56d ABS Limit" : ">56d (~1%/d Pelvic Loss)"}
                          </span>
                        </div>

                        {/* Column 2: Clinical Adherence Event */}
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-semibold">
                            Col 2: Acute Adherence Event
                          </span>
                          <div className="mt-1 font-bold text-slate-200">
                            {c.adherenceStatus === "ATTENDING_DAILY" ? (
                              <span className="text-emerald-400">Regular Attendance</span>
                            ) : c.adherenceStatus === "1_DAY_OVERDUE" ? (
                              <span className="text-amber-400">Day 1 Overdue (Tier 1 SMS)</span>
                            ) : (
                              <span className="text-rose-400">Day 4 Overdue (Tier 2 IVR)</span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            Last: {c.lastFractionLogged}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Case Deep-Dive & Clinician Tools */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">
                  Selected Patient: <strong className="text-emerald-400 font-mono">{activeCase.token}</strong>
                </span>
                <span className="text-[10px] text-slate-400">Spoke-to-Hub: ~75 km</span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">Day-21 (Fraction 15) Readiness Gate:</span>
                    <span className="text-emerald-400 font-mono font-bold">CBC/RFT Verified ✓</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    PAC Anesthesia Clearance: Cleared · Requested Brachy OT Slot Window: <strong>Days 38–44</strong>
                  </p>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="text-[11px]">
                    <span className="text-slate-400 block text-[10px]">Attending Radiation Oncologist:</span>
                    <strong className="text-slate-200">Dr. Sharma, MD (CareUI Hard Sign Gate)</strong>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Signed & Vaulted
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tablet Footer */}
          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            <span>DPDP Zero-Knowledge AES-256 Vaulted</span>
            <span>CareUI v2.0 · CDSCO SaMD Safe</span>
          </div>
        </section>

        {/* RIGHT VIEWPORT: Patient's Phone (Vernacular Web/IVR Simulator) - 5 cols */}
        <section className="lg:col-span-5 flex flex-col items-center">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Smartphone className="size-3.5 text-blue-400" />
              <span>Patient's Phone (WhatsApp / Web Companion)</span>
            </div>
          </div>

          <PatientCompanion
            patientToken={selectedToken}
            isEmbeddedInDualView={true}
          />
        </section>
      </main>
    </div>
  );
};
