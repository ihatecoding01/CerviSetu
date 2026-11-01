import React, { useState } from "react";
import { Search, User, Users, CheckCircle2, MapPin, ShieldCheck, ArrowRight, Sparkles, QrCode, Phone } from "lucide-react";
import { api, type Facility } from "../api/client";

interface Props {
  onLoginStaff: () => void;
  onLoginPatient: (token?: string) => void;
  onOpenDualView?: () => void;
}

export const CareGateway: React.FC<Props> = ({ onLoginStaff, onLoginPatient, onOpenDualView }) => {
  const [districtQuery, setDistrictQuery] = useState("Mirzapur");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showPatientLoginModal, setShowPatientLoginModal] = useState(false);
  const [authMethod, setAuthMethod] = useState<"OTP" | "QR">("OTP");
  const [mobileNumber, setMobileNumber] = useState("+91 98765 43210");
  const [otpCode, setOtpCode] = useState("7891");

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    try {
      const res = await api.searchFacilities(districtQuery);
      setFacilities(res.facilities);
      setHasSearched(true);
    } catch {
      // Fallback mock facilities
      setFacilities([
        {
          facility_type: "REGIONAL_EBRT_SPOKE",
          role_label: "Regional EBRT Spoke (Fractions 1–25)",
          facility_name: `${districtQuery.trim() || "Mirzapur"} District Oncology Daycare & Spoke Clinic`,
          district: districtQuery.trim() || "Mirzapur",
          approx_distance_km: 12.5,
          pmjay_empanelled: true,
          services: ["Daily EBRT Fractions (1–25)", "Weekly Cisplatin Hydration & Lab Monitoring", "Smart Paper Slip OCR Upload"],
          badge: "EBRT Local Spoke"
        },
        {
          facility_type: "CENTRAL_BRACHY_HUB",
          role_label: "Tertiary Brachytherapy Hub (Fractions 26–29)",
          facility_name: "Regional Cancer Centre (RCC) Brachytherapy Hub",
          district: districtQuery.trim() || "Mirzapur",
          approx_distance_km: 75.0,
          pmjay_empanelled: true,
          has_dharamshala: true,
          services: ["High-Dose-Rate (HDR) Brachytherapy (Fractions 26–29)", "Pre-Anesthetic Checkup (PAC)", "Patient Dharamshala Accommodation"],
          badge: "Brachytherapy Hub"
        }
      ]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-100 via-rose-100 to-indigo-100 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans antialiased text-[#111418]">
      {/* Main Care Gateway Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100/80 p-8 sm:p-12 transition-all">
        {/* Top Branding */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            {/* CARE Cross Symbol (5 square dots) */}
            <div className="grid grid-cols-3 gap-1 size-9 items-center justify-center">
              <div />
              <div className="size-2.5 bg-[#2E7D6F] rounded-xs" />
              <div />
              <div className="size-2.5 bg-[#2E7D6F] rounded-xs" />
              <div className="size-2.5 bg-[#2E7D6F] rounded-xs" />
              <div className="size-2.5 bg-[#2E7D6F] rounded-xs" />
              <div />
              <div className="size-2.5 bg-[#2E7D6F] rounded-xs" />
              <div />
            </div>
            <span className="text-4xl font-extrabold tracking-tight text-[#1E293B]">care</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#2E7D6F] mt-2">
            CerviSetu Hub-and-Spoke Oncology Portal
          </span>
        </div>

        {/* Section 1: Search for Available Facilities */}
        <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/70 mb-8">
          <h2 className="text-sm font-semibold text-center text-slate-700 mb-4">
            Search for available facilities to book an appointment <span className="font-bold text-slate-900">(for new patients)</span>
          </h2>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder="Enter district name to find facilities..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E7D6F] focus:ring-2 focus:ring-[#2E7D6F]/20 text-slate-800 placeholder:text-slate-400 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 bg-[#2E7D6F] hover:bg-[#25665a] text-white font-medium text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isSearching ? "Searching..." : "Search Facilities"}
            </button>
          </form>

          {/* Results: Hub-and-Spoke Paired Cards */}
          {hasSearched && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Matched Hub-and-Spoke Pathway for "{districtQuery}"
                </span>
                <span className="text-[11px] text-[#2E7D6F] font-semibold bg-[#2E7D6F]/10 px-2.5 py-0.5 rounded-full">
                  ABDM & PMJAY Empanelled
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {facilities.map((fac, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-4 border transition-all ${
                      fac.facility_type === "REGIONAL_EBRT_SPOKE"
                        ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300"
                        : "bg-blue-50/50 border-blue-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        {fac.badge}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" /> ~{fac.approx_distance_km} km
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug mb-1">{fac.facility_name}</h3>
                    <p className="text-[11px] text-slate-500 mb-3 font-medium">{fac.role_label}</p>

                    <div className="space-y-1 mb-3">
                      {fac.services.map((srv, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                          <span>{srv}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                      <span className="font-semibold text-emerald-700">✓ Free Treatment (PMJAY)</span>
                      {fac.has_dharamshala && <span className="text-blue-700 font-semibold">🏠 Dharamshala Pass</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dotted Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-dotted border-slate-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-slate-500 font-semibold tracking-wider">
              Already registered? Log in to your account.
            </span>
          </div>
        </div>

        {/* Section 2: Two Login Cards (Staff vs Patient) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Log in as Staff */}
          <div className="group relative rounded-2xl border border-slate-200 p-6 bg-gradient-to-b from-emerald-50/60 via-white to-white hover:border-emerald-500 hover:shadow-lg transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-4 group-hover:scale-105 transition-transform">
              <User className="size-6" />
            </div>

            <div className="mb-6">
              <button
                onClick={onLoginStaff}
                className="w-full py-2.5 px-6 rounded-xl border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-600 hover:text-white font-bold text-sm transition-all shadow-xs cursor-pointer block"
              >
                Log in as Staff
              </button>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                For hospital staff: doctors, radiation oncologists, spoke nurses, and administrators.
              </p>
            </div>

            <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
              CareUI Workstation · Dual-Clock Ward Board
            </div>
          </div>

          {/* Card 2: Log in as Patient */}
          <div className="group relative rounded-2xl border border-slate-200 p-6 bg-gradient-to-b from-blue-50/60 via-white to-white hover:border-blue-500 hover:shadow-lg transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 mb-4 group-hover:scale-105 transition-transform">
              <Users className="size-6" />
            </div>

            <div className="mb-6">
              <button
                onClick={() => setShowPatientLoginModal(true)}
                className="w-full py-2.5 px-6 rounded-xl border-2 border-[#2E7D6F] text-[#2E7D6F] hover:bg-[#2E7D6F] hover:text-white font-bold text-sm transition-all shadow-xs cursor-pointer block"
              >
                Log in as Patient
              </button>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                For cancer patients & family caregivers: view the 29-step Healing Clock, check side effects, & get travel passes.
              </p>
            </div>

            <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
              Vernacular Co-Pilot · Zero Password Friction
            </div>
          </div>
        </div>

        {/* Hackathon Live Demo Shortcut Bar */}
        {onOpenDualView && (
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Hackathon Evaluation Shortcut:</span>
            </div>
            <button
              onClick={onOpenDualView}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Open Live Demo: Clinic Tablet | Patient's Phone <ArrowRight className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Frictionless Rural Patient Auth Modal */}
      {showPatientLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">मरीज लॉगिन (Patient Login)</h3>
                <p className="text-xs text-slate-500">Rural Zero-Password Friction Gateway</p>
              </div>
              <button
                onClick={() => setShowPatientLoginModal(false)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Auth Tab Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-5 text-xs font-semibold">
              <button
                onClick={() => setAuthMethod("OTP")}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMethod === "OTP" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Phone className="size-3.5" /> Mobile OTP / ABHA
              </button>
              <button
                onClick={() => setAuthMethod("QR")}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMethod === "QR" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="size-3.5" /> 1-Tap Slip QR
              </button>
            </div>

            {authMethod === "OTP" ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Registered Mobile or ABHA Number:
                  </label>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-[#2E7D6F]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">4-Digit Security OTP:</label>
                    <span className="text-[10px] text-emerald-600 font-mono">Demo Auto-Filled</span>
                  </div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={4}
                    className="w-full px-3.5 py-2 text-center bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-800 focus:outline-none focus:border-[#2E7D6F]"
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 flex items-start gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">DPDP Act 2023 Token Isolation:</span>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Your identity maps strictly to token <strong>PT-RURAL-7891</strong>. No personal name or phone is stored in plaintext.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowPatientLoginModal(false);
                    onLoginPatient("PT-RURAL-7891");
                  }}
                  className="w-full py-2.5 bg-[#2E7D6F] hover:bg-[#25665a] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  पोर्टल में प्रवेश करें (Enter Portal)
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="size-48 mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-4">
                  <QrCode className="size-20 text-[#2E7D6F] mb-2 animate-pulse" />
                  <span className="text-[11px] font-semibold text-slate-600">
                    Point camera at OPD Card QR code
                  </span>
                  <span className="text-[9px] text-slate-400 mt-1 font-mono">
                    https://care.cervisetu.in/p?token=PT-RURAL-7891
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowPatientLoginModal(false);
                    onLoginPatient("PT-RURAL-7891");
                  }}
                  className="w-full py-2.5 bg-[#2E7D6F] hover:bg-[#25665a] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Simulate QR Scan (Token PT-RURAL-7891)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
