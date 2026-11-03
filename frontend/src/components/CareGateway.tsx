import React, { useState } from "react";
import { Search, User, Users, CheckCircle2, MapPin, ShieldCheck, ArrowRight, Sparkles, QrCode, Phone } from "lucide-react";
import { api, type Facility } from "../api/client";

interface Props {
  onLoginStaff: () => void;
  onLoginPatient: (token?: string) => void;
  onOpenDualView?: () => void;
  onOpenLanding?: () => void;
}

export const CareGateway: React.FC<Props> = ({ onLoginStaff, onLoginPatient, onOpenDualView, onOpenLanding }) => {
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
    <div className="min-h-screen w-full bg-[#FAFAFA] flex items-center justify-center p-6 sm:p-8 md:p-12 font-sans antialiased text-black">
      {/* Main Care Gateway Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xs border border-slate-200/90 p-8 sm:p-12 transition-all relative">
        {onOpenLanding && (
          <button
            onClick={onOpenLanding}
            className="sm:absolute sm:top-8 sm:left-8 mb-4 sm:mb-0 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
          >
            ← System Overview
          </button>
        )}

        {/* Top Branding */}
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="flex items-center gap-3">
            {/* Logo in Primary Burnt Terracotta */}
            <div className="size-10 rounded-2xl bg-[#BA2D0B] text-white flex items-center justify-center font-bold text-base shadow-xs">
              CS
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-black">cervisetu</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#BA2D0B] bg-[#BA2D0B]/10 border border-[#BA2D0B]/20 px-3 py-1 rounded-full mt-3">
            District Hub-and-Spoke Oncology Portal
          </span>
        </div>

        {/* Section 1: Search for Available Facilities */}
        <div className="bg-slate-50/80 rounded-2xl p-6 sm:p-8 border border-slate-200/80 mb-10">
          <h2 className="text-sm font-semibold text-center text-slate-700 mb-5">
            Search for available facilities to book an appointment <span className="font-bold text-black">(for new patients)</span>
          </h2>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder="Enter district name to find facilities..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 text-slate-800 placeholder:text-slate-400 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 bg-[#BA2D0B] hover:bg-[#a02609] text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isSearching ? "Searching..." : "Search Facilities"}
            </button>
          </form>

          {/* Results: Hub-and-Spoke Paired Cards */}
          {hasSearched && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Matched Hub-and-Spoke Pathway for "{districtQuery}"
                </span>
                <span className="text-xs text-black font-bold bg-[#DBFE87] border border-[#c4e872] px-2.5 py-0.5 rounded-full">
                  ABDM & PMJAY Empanelled
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {facilities.map((fac, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-5 border transition-all ${
                      fac.facility_type === "REGIONAL_EBRT_SPOKE"
                        ? "bg-[#DBFE87]/15 border-[#DBFE87]/40"
                        : "bg-[#90C3CB]/15 border-[#90C3CB]/40"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 shadow-2xs">
                        {fac.badge}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" /> ~{fac.approx_distance_km} km
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-black leading-snug mb-1">{fac.facility_name}</h3>
                    <p className="text-xs text-slate-600 mb-3 font-medium">{fac.role_label}</p>

                    <div className="space-y-1.5 mb-3">
                      {fac.services.map((srv, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <CheckCircle2 className="size-3.5 text-black shrink-0" />
                          <span>{srv}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 text-xs text-slate-600">
                      <span className="font-bold text-black">✓ Free Treatment (PMJAY)</span>
                      {fac.has_dharamshala && <span className="text-black font-bold">🏠 Dharamshala Pass</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dotted Divider */}
        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-slate-500 font-semibold tracking-wider">
              Already registered? Log in to your account
            </span>
          </div>
        </div>

        {/* Section 2: Two Login Cards (Staff vs Patient) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Log in as Staff */}
          <div className="group relative rounded-2xl border border-slate-200 p-7 bg-white hover:border-black hover:shadow-sm transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-black mb-4 group-hover:scale-105 transition-transform">
              <User className="size-6" />
            </div>

            <div className="mb-6 w-full">
              <button
                onClick={onLoginStaff}
                className="w-full py-2.5 px-6 rounded-full bg-black text-white hover:bg-black/85 font-semibold text-xs transition-colors shadow-xs cursor-pointer block"
              >
                Log in as Staff
              </button>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                For hospital staff: doctors, radiation oncologists, spoke nurses, and administrators.
              </p>
            </div>

            <div className="text-xs font-semibold text-black bg-[#DBFE87]/40 px-3 py-1 rounded-full border border-[#DBFE87]">
              CareUI Workstation · Dual-Clock Board
            </div>
          </div>

          {/* Card 2: Log in as Patient */}
          <div className="group relative rounded-2xl border border-slate-200 p-7 bg-white hover:border-[#BA2D0B] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-[#BA2D0B]/10 flex items-center justify-center text-[#BA2D0B] mb-4 group-hover:scale-105 transition-transform">
              <Users className="size-6" />
            </div>

            <div className="mb-6 w-full">
              <button
                onClick={() => setShowPatientLoginModal(true)}
                className="w-full py-2.5 px-6 rounded-full border border-[#BA2D0B] text-[#BA2D0B] hover:bg-[#BA2D0B] hover:text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer block"
              >
                Log in as Patient
              </button>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                For cancer patients & family caregivers: view the 29-step Healing Clock, check side effects, & get travel passes.
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-800 bg-[#90C3CB]/25 px-3 py-1 rounded-full border border-[#90C3CB]/60">
              Vernacular Co-Pilot · Zero Password Friction
            </div>
          </div>
        </div>

        {/* Hackathon Live Demo Shortcut Bar */}
        {onOpenDualView && (
          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#F19941]" />
              <span>Hackathon Evaluation Shortcut:</span>
            </div>
            <button
              onClick={onOpenDualView}
              className="text-xs font-semibold text-black bg-slate-100 hover:bg-slate-200 px-4 py-1.5 rounded-full border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Open Live Demo: Clinic Tablet | Patient Web Portal <ArrowRight className="size-3" />
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
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">4-Digit Security OTP:</label>
                    <span className="text-xs text-black bg-[#DBFE87] px-2 py-0.5 rounded font-mono font-bold">Auto-Filled</span>
                  </div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={4}
                    className="w-full px-3.5 py-2 text-center bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-800 focus:outline-none focus:border-black"
                  />
                </div>

                <div className="bg-[#DBFE87]/20 border border-[#DBFE87] rounded-xl p-3 text-xs text-black flex items-start gap-2">
                  <ShieldCheck className="size-4 text-black shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">DPDP Act 2023 Token Isolation:</span>
                    <p className="text-xs text-slate-700 mt-0.5">
                      Your identity maps strictly to token <strong>PT-RURAL-7891</strong>. No personal name or phone is stored in plaintext.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowPatientLoginModal(false);
                    onLoginPatient("PT-RURAL-7891");
                  }}
                  className="w-full py-2.5 bg-black hover:bg-black/85 text-white font-semibold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
                >
                  पोर्टल में प्रवेश करें (Enter Portal)
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="size-48 mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-4">
                  <QrCode className="size-20 text-[#BA2D0B] mb-2" />
                  <span className="text-xs font-semibold text-slate-600">
                    Point camera at OPD Card QR code
                  </span>
                  <span className="text-xs text-slate-400 mt-1 font-mono">
                    https://care.cervisetu.in/p?token=PT-RURAL-7891
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowPatientLoginModal(false);
                    onLoginPatient("PT-RURAL-7891");
                  }}
                  className="w-full py-2.5 bg-black hover:bg-black/85 text-white font-semibold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
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
