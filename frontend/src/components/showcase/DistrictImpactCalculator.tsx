import React, { useState, useEffect } from "react";
import { api, type DistrictImpactResult } from "../../api/client";
import {
  SolarCalculator,
  SolarPulse,
  SolarUsersGroup,
  SolarCheck,
} from "../icons/SolarIcons";

export const DistrictImpactCalculator: React.FC = () => {
  const [population, setPopulation] = useState<number>(1800000);
  const [cases, setCases] = useState<number>(210);
  const [spokes, setSpokes] = useState<number>(4);
  const [distanceKm, setDistanceKm] = useState<number>(72);
  const [impactData, setImpactData] = useState<DistrictImpactResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .calculateDistrictImpact({
        district_population: population,
        annual_cervical_cases: cases,
        spoke_clinics_count: spokes,
        avg_travel_distance_km: distanceKm,
      })
      .then((res) => {
        if (!cancelled) setImpactData(res);
      });

    return () => {
      cancelled = true;
    };
  }, [population, cases, spokes, distanceKm]);

  const inrFormatted = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="w-full bg-[#FFFFFF] border-2 border-[#BA2D0B] rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#F19941]/30 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-wider font-mono-data text-[#BA2D0B] font-bold">
              Radiobiological Modeling & Economic Health Return
            </span>
            <span className="text-xs text-[#F19941]">·</span>
            <span className="text-xs text-[#4B5563]">GEC ESTRO & ABS Parameters</span>
          </div>
          <h3 className="text-2xl font-semibold text-[#000000] tracking-tight">
            District Oncology Impact & Survival Gain Calculator
          </h3>
        </div>

        <div className="flex items-center gap-2 font-mono-data text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[#DBFE87] border-2 border-[#BA2D0B] text-[#000000] font-bold shadow-xs flex items-center gap-1.5">
            <SolarCheck size={14} />
            <span>0.8% to 1.2% Daily Hazard Avoidance</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Parametric Sliders */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-5 rounded-xl bg-[#F8F9FA] border-2 border-[#F19941] space-y-5">
            <span className="text-xs font-mono-data uppercase tracking-wider text-[#000000] font-bold flex items-center gap-1.5 mb-2">
              <div className="size-5 rounded bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000]">
                <SolarCalculator size={12} />
              </div>
              <span>District Geography & Case Load Sliders</span>
            </span>

            {/* Slider 1: Annual Cervical Cancer Cases */}
            <div>
              <div className="flex justify-between text-xs font-mono-data mb-1.5">
                <span className="text-[#4B5563] font-medium">Annual District Cervical Cases:</span>
                <span className="font-bold text-[#000000]">{cases} Patients</span>
              </div>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={cases}
                onChange={(e) => setCases(Number(e.target.value))}
                className="w-full accent-[#BA2D0B] h-2 bg-[#90C3CB] rounded-lg cursor-pointer border border-[#BA2D0B]"
              />
            </div>

            {/* Slider 2: Average Travel Distance to Tertiary Hub */}
            <div>
              <div className="flex justify-between text-xs font-mono-data mb-1.5">
                <span className="text-[#4B5563] font-medium">Travel Distance to Tertiary Hub:</span>
                <span className="font-bold text-[#BA2D0B]">{distanceKm} km (One Way)</span>
              </div>
              <input
                type="range"
                min={30}
                max={120}
                step={5}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full accent-[#BA2D0B] h-2 bg-[#90C3CB] rounded-lg cursor-pointer border border-[#BA2D0B]"
              />
            </div>

            {/* Slider 3: Active EBRT Radiation Spokes */}
            <div>
              <div className="flex justify-between text-xs font-mono-data mb-1.5">
                <span className="text-[#4B5563] font-medium">Operational Daycare Radiation Spokes:</span>
                <span className="font-bold text-[#000000]">{spokes} Spoke Daycares</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={spokes}
                onChange={(e) => setSpokes(Number(e.target.value))}
                className="w-full accent-[#BA2D0B] h-2 bg-[#90C3CB] rounded-lg cursor-pointer border border-[#BA2D0B]"
              />
            </div>

            {/* Slider 4: District Rural Population */}
            <div>
              <div className="flex justify-between text-xs font-mono-data mb-1.5">
                <span className="text-[#4B5563] font-medium">Rural Population Catchment:</span>
                <span className="font-bold text-[#000000]">{(population / 100000).toFixed(1)} Lakhs</span>
              </div>
              <input
                type="range"
                min={500000}
                max={3000000}
                step={100000}
                value={population}
                onChange={(e) => setPopulation(Number(e.target.value))}
                className="w-full accent-[#BA2D0B] h-2 bg-[#90C3CB] rounded-lg cursor-pointer border border-[#BA2D0B]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Calculated Impact Outputs */}
        <div className="lg:col-span-6 space-y-4">
          {/* Key Metric 1: Lives Saved */}
          <div className="p-5 rounded-xl bg-[#DBFE87]/40 border-2 border-[#BA2D0B] flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-mono-data uppercase tracking-wider text-[#BA2D0B] font-bold block mb-1">
                Curative Pelvic Control Preservation
              </span>
              <h4 className="text-3xl font-bold text-[#000000]">
                {impactData?.biological_metrics.estimated_lives_saved_annually || 36} Lives Saved
              </h4>
              <p className="text-xs text-[#4B5563] mt-1">
                Avoided clonogenic repopulation penalty by finishing in 48 days instead of 72 days.
              </p>
            </div>
            <div className="size-12 rounded-xl bg-[#90C3CB] border-2 border-[#BA2D0B] flex items-center justify-center text-[#000000] shrink-0 shadow-xs">
              <SolarPulse size={24} />
            </div>
          </div>

          {/* Metric 2 & 3: Travel & Money Saved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-[#FFFFFF] border-2 border-[#F19941] shadow-xs">
              <div className="size-8 rounded-lg bg-[#90C3CB] border border-[#BA2D0B] flex items-center justify-center text-[#000000] mb-3">
                <SolarUsersGroup size={16} />
              </div>
              <span className="text-xs font-mono-data text-[#4B5563] block mb-1">Travel Distance Spared</span>
              <h5 className="text-xl font-bold text-[#000000]">
                {((impactData?.social_metrics.total_travel_km_spared || 600000) / 1000).toFixed(0)}k Kilometers
              </h5>
              <p className="text-[11px] text-[#4B5563] mt-1">
                Patients complete 25 fractions locally near their village.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#FFFFFF] border-2 border-[#F19941] shadow-xs">
              <div className="size-8 rounded-lg bg-[#DBFE87] border border-[#BA2D0B] flex items-center justify-center text-[#000000] mb-3">
                <SolarCalculator size={16} />
              </div>
              <span className="text-xs font-mono-data text-[#4B5563] block mb-1">Out of Pocket Savings</span>
              <h5 className="text-xl font-bold text-[#BA2D0B]">
                {inrFormatted(impactData?.social_metrics.estimated_out_of_pocket_savings_inr || 2780000)}
              </h5>
              <p className="text-[11px] text-[#4B5563] mt-1">
                Avoided daily bus tickets and attendant wage forfeiture.
              </p>
            </div>
          </div>

          {/* Drop out Rate Guarantee */}
          <div className="p-4 rounded-xl bg-[#F8F9FA] border-2 border-[#BA2D0B] flex items-center justify-between text-xs font-mono-data">
            <span className="text-[#000000] font-bold">Projected Radiotherapy Completion Rate:</span>
            <span className="px-2.5 py-1 rounded bg-[#DBFE87] border border-[#BA2D0B] text-[#000000] font-bold">
              91.4% (vs 44% Traditional Baseline)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
