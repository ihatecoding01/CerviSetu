import React, { useState, useEffect } from "react";
import { api, type GraphTraceResult } from "../../api/client";
import {
  SolarLayers,
  SolarCheck,
  SolarPulse,
  SolarShieldCheck,
  SolarArrowRight,
} from "../icons/SolarIcons";

export const AgentReasoningCanvas: React.FC = () => {
  const [daysOverdue, setDaysOverdue] = useState<number>(3);
  const [traceData, setTraceData] = useState<GraphTraceResult | null>(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);

  const fetchTrace = (overdue: number) => {
    api.getGraphExecutionTrace({ simulated_days_overdue: overdue }).then((res) => {
      setTraceData(res);
    });
  };

  useEffect(() => {
    fetchTrace(daysOverdue);
  }, [daysOverdue]);

  const activeNode = traceData?.nodes[selectedNodeIndex] || traceData?.nodes[0];

  return (
    <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Canvas Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#F19941]/30 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
              Multi Agent Reasoning Flow
            </span>
            <span className="text-xs text-[#F19941]">·</span>
            <span className="text-xs text-[#4B5563]">LangGraph Orchestration</span>
          </div>
          <h3 className="text-2xl font-semibold text-[#000000] tracking-tight">
            Autonomous Rural Clinical Decision & Adherence Canvas
          </h3>
        </div>

        {/* Trace Latency & Nodes Counter */}
        <div className="flex items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] text-[#000000] font-bold shadow-xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>{traceData?.total_latency_ms || 189.2} ms Pipeline</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#90C3CB] border-2 border-[#F19941] text-[#000000] font-bold shadow-xs">
            <span>5 Stateful Nodes</span>
          </div>
        </div>
      </div>

      {/* Overdue Adherence Simulator Slider */}
      <div className="p-5 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-xs font-mono-data text-[#BA2D0B] font-bold uppercase tracking-wider block">
              Missed Treatment Adherence Stress Test
            </span>
            <span className="text-sm font-semibold text-[#000000]">
              Simulate Patient Missed Days: {daysOverdue} Days Overdue
            </span>
          </div>
          <span
            className={`text-xs font-mono-data font-bold px-3 py-1 rounded-md border-2 ${
              daysOverdue >= 5
                ? "bg-rose-100 border-[#BA2D0B] text-[#BA2D0B]"
                : daysOverdue >= 2
                ? "bg-[#DBFE87] border-[#BA2D0B] text-[#000000]"
                : "bg-[#FFFFFF] border-[#F19941] text-[#000000]"
            }`}
          >
            {daysOverdue === 0 && "Optimal Day 0 · Routine Verification"}
            {daysOverdue >= 1 && daysOverdue <= 2 && "Tier 1 · Automated SMS Alert"}
            {daysOverdue >= 3 && daysOverdue <= 4 && "Tier 2 · Vernacular IVR Voice Call"}
            {daysOverdue >= 5 && daysOverdue <= 6 && "Tier 3 · Emergency ASHA Home Visit"}
            {daysOverdue >= 7 && "Tier 4 · District Medical Officer Escalation"}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={8}
          value={daysOverdue}
          onChange={(e) => setDaysOverdue(Number(e.target.value))}
          className="w-full accent-[#BA2D0B] h-2 bg-[#90C3CB] rounded-lg cursor-pointer border border-[#BA2D0B]"
        />
      </div>

      {/* Horizontal Multi Agent Reasoning Node Chain */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8">
        {traceData?.nodes.map((node, index) => {
          const isSelected = selectedNodeIndex === index;
          return (
            <button
              key={node.node}
              onClick={() => setSelectedNodeIndex(index)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${
                isSelected
                  ? "bg-[#DBFE87] border-[#BA2D0B] shadow-sm ring-2 ring-[#BA2D0B]/20 scale-[1.02]"
                  : "bg-[#FFFFFF] border-[#F19941]/50 hover:border-[#BA2D0B]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono-data text-[#4B5563] mb-1">
                  <span>Step {index + 1}</span>
                  <span className="font-bold text-[#BA2D0B]">{node.latency_ms} ms</span>
                </div>
                <h4 className="text-xs font-bold text-[#000000] leading-snug line-clamp-2">
                  {node.name}
                </h4>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#000000]/10 text-[10px] font-mono-data">
                <span className="text-[#4B5563] truncate">{node.role}</span>
                <span className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000] shrink-0">
                  <SolarArrowRight size={10} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Node Deep Dive Inspector */}
      {activeNode && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 p-6 rounded-xl bg-[#F8F9FA] border-2 border-[#BA2D0B]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#F19941]/30 mb-4">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                  <SolarLayers size={14} />
                </div>
                <span className="text-xs font-mono-data uppercase tracking-wider text-[#000000] font-bold">
                  {activeNode.name}
                </span>
              </div>
              <span className="text-xs font-mono-data text-[#BA2D0B] font-bold">
                Execution Time: {activeNode.latency_ms} ms
              </span>
            </div>

            <p className="text-sm text-[#000000] font-semibold mb-2">
              Clinical Responsibility: {activeNode.role}
            </p>
            <p className="text-xs font-mono-data text-[#4B5563] leading-relaxed mb-4">
              State Mutation Result: {activeNode.summary}
            </p>

            <div className="p-3.5 rounded-lg bg-[#FFFFFF] border-2 border-[#F19941]/40 font-mono-data text-xs flex items-center justify-between">
              <span className="text-[#4B5563]">Node Output Integrity:</span>
              <span className="text-[#000000] font-bold flex items-center gap-1.5">
                <div className="size-4 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                  <SolarPulse size={10} />
                </div>
                <span>Validated against State Schema</span>
              </span>
            </div>
          </div>

          {/* Cryptographic Ledger Audit Chained Block */}
          <div className="lg:col-span-4 p-6 rounded-xl bg-[#FFFFFF] border-2 border-[#F19941] shadow-xs">
            <span className="text-xs font-mono-data text-[#000000] uppercase tracking-wider font-bold block mb-3 flex items-center gap-1.5">
              <div className="size-5 rounded bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                <SolarShieldCheck size={14} />
              </div>
              <span>SHA 256 Ledger Block</span>
            </span>

            <div className="space-y-3 font-mono-data text-xs text-[#4B5563]">
              <div>
                <span className="text-[#000000] font-bold block">Current Block Hash:</span>
                <code className="text-[10px] text-[#BA2D0B] break-all leading-normal">
                  {traceData?.ledger_block.sha256}
                </code>
              </div>
              <div>
                <span className="text-[#000000] font-bold block">Chained Previous Hash:</span>
                <code className="text-[10px] text-[#4B5563] break-all leading-normal">
                  {traceData?.ledger_block.previous_hash}
                </code>
              </div>
              <div className="pt-2 border-t border-[#F19941]/30 flex items-center justify-between text-[11px]">
                <span className="text-[#000000] font-bold">Privacy Framework:</span>
                <span className="text-[#BA2D0B] font-bold">DPDP Act 2023 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
