import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import React, { useEffect, useState } from "react";
import { Search, User, Users, CheckCircle2, MapPin, ShieldCheck, QrCode, Phone, HeartHandshake } from "lucide-react";
import { api, type Facility } from "../api/client";
import { AbhaRegistration } from "./AbhaRegistration";
import { MobileOtpLogin } from "./MobileOtpLogin";
import { usePatientLang } from "../i18n/patient";
import { LanguageSwitch } from "./LanguageSwitch";

export const PATIENT_LOGIN_FLAG = "cervisetu_open_patient_login";

interface Props {
  onLoginStaff: () => void;
  onLoginAsha?: () => void;
  onLoginPatient: (token?: string) => void;
  onOpenDualView?: () => void;
  onOpenLanding?: () => void;
}

export const CareGateway: React.FC<Props> = ({ onLoginStaff, onLoginAsha, onLoginPatient, onOpenLanding }) => {
  const [districtQuery, setDistrictQuery] = useState("Mirzapur");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  // The portal sends patients back here (flag in sessionStorage) when their session is missing or expired
  const [loginNotice] = useState(() => {
    try {
      const v = sessionStorage.getItem(PATIENT_LOGIN_FLAG);
      sessionStorage.removeItem(PATIENT_LOGIN_FLAG);
      return v;
    } catch {
      return null;
    }
  });
  const [showPatientLoginModal, setShowPatientLoginModal] = useState(!!loginNotice);
  const [authMethod, setAuthMethod] = useState<"OTP" | "QR" | "ABHA">("OTP");

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
        {/* Top bar: back link + language picker (in normal flow so long translations never overlap) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-4">
          {onOpenLanding ? (
            <button
              onClick={onOpenLanding}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-black bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
            >
              ← System Overview
            </button>
          ) : (
            <span />
          )}
          <LanguageSwitch className="ml-auto" />
        </div>

        {/* Top Branding */}
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="flex items-center gap-3">
            {/* CerviSetu teal ribbon emblem */}
            <div className="size-10 rounded-2xl bg-white border border-[#0F766E]/30 flex items-center justify-center p-0.5 shadow-xs">
              <CerviSetuLogo size={34} />
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

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold text-black">✓ Free Treatment (PMJAY)</span>
                      <button
                        onClick={onLoginStaff}
                        className="px-3 py-1 rounded-lg bg-[#BA2D0B] hover:bg-[#a02609] text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Book Appointment &rarr;
                      </button>
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

        {/* Section 2: Three Distinct Login Pathways (Doctor / Staff, Frontline ASHA, Cancer Patient) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {/* Card 1: Log in as Doctor / Staff */}
          <div className="group relative rounded-2xl border border-slate-200 p-6 bg-white hover:border-black hover:shadow-sm transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-black mb-4 group-hover:scale-105 transition-transform">
              <User className="size-6" />
            </div>

            <div className="mb-5 w-full">
              <button
                onClick={onLoginStaff}
                className="w-full py-2.5 px-4 rounded-full bg-black text-white hover:bg-black/85 font-semibold text-xs transition-colors shadow-xs cursor-pointer block"
              >
                Log in as Doctor / Staff
              </button>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                For hospital staff: radiation oncologists, spoke nurses, and cancer clinic administrators.
              </p>
            </div>

            <div className="text-[11px] font-semibold text-black bg-[#DBFE87]/40 px-3 py-1 rounded-full border border-[#DBFE87]">
              CareUI Workstation · Dual-Clock Board
            </div>
          </div>

          {/* Card 2: Log in as ASHA Worker */}
          <div className="group relative rounded-2xl border border-slate-200 p-6 bg-white hover:border-[#0F766E] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-[#0F766E]/10 flex items-center justify-center text-[#0F766E] mb-4 group-hover:scale-105 transition-transform">
              <HeartHandshake className="size-6" />
            </div>

            <div className="mb-5 w-full">
              <button
                onClick={onLoginAsha || onLoginStaff}
                className="w-full py-2.5 px-4 rounded-full bg-[#0F766E] text-white hover:bg-[#0d635c] font-semibold text-xs transition-colors shadow-xs cursor-pointer block"
              >
                Log in as ASHA Worker
              </button>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                For frontline community health workers: home visit alerts, distress tickets, & travel vouchers.
              </p>
            </div>

            <div className="text-[11px] font-semibold text-[#0F766E] bg-[#0F766E]/10 px-3 py-1 rounded-full border border-[#0F766E]/20">
              ASHA Network · Field Coordination
            </div>
          </div>

          {/* Card 3: Log in as Patient */}
          <div className="group relative rounded-2xl border border-slate-200 p-6 bg-white hover:border-[#BA2D0B] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center">
            <div className="size-12 rounded-full bg-[#BA2D0B]/10 flex items-center justify-center text-[#BA2D0B] mb-4 group-hover:scale-105 transition-transform">
              <Users className="size-6" />
            </div>

            <div className="mb-5 w-full">
              <button
                onClick={() => setShowPatientLoginModal(true)}
                className="w-full py-2.5 px-4 rounded-full border-2 border-[#BA2D0B] text-[#BA2D0B] hover:bg-[#BA2D0B] hover:text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer block"
              >
                Log in as Patient
              </button>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                For cancer patients & caregivers: 29-step Healing Clock, hydration guide, & travel passes.
              </p>
            </div>

            <div className="text-[11px] font-semibold text-slate-800 bg-[#90C3CB]/25 px-3 py-1 rounded-full border border-[#90C3CB]/60">
              Vernacular Co-Pilot · Zero Password
            </div>
          </div>
        </div>

      </div>

      {/* Patient login modal: ABHA sandbox, mobile OTP (both issue a patient session) */}
      {showPatientLoginModal && (
        <PatientLoginModal
          method={authMethod}
          setMethod={setAuthMethod}
          notice={loginNotice}
          onClose={() => setShowPatientLoginModal(false)}
          onVerified={(token) => {
            setShowPatientLoginModal(false);
            onLoginPatient(token);
          }}
        />
      )}
    </div>
  );
};

interface ModalProps {
  method: "OTP" | "QR" | "ABHA";
  setMethod: (m: "OTP" | "QR" | "ABHA") => void;
  notice: string | null;
  onClose: () => void;
  onVerified: (token: string) => void;
}

const PatientLoginModal: React.FC<ModalProps> = ({ method, setMethod, notice, onClose, onVerified }) => {
  const { t } = usePatientLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const tabs: { id: "ABHA" | "OTP" | "QR"; icon: React.ReactNode; label: string }[] = [
    { id: "ABHA", icon: <ShieldCheck className="size-4" aria-hidden="true" />, label: t("login.tab.abha") },
    { id: "OTP", icon: <Phone className="size-4" aria-hidden="true" />, label: t("login.tab.mobile") },
    { id: "QR", icon: <QrCode className="size-4" aria-hidden="true" />, label: t("login.tab.qr") },
  ];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-login-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 relative"
      >
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h3 id="patient-login-title" className="text-lg font-bold text-slate-900">{t("login.title")}</h3>
            <p className="text-sm text-slate-600">{t("login.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              onClick={onClose}
              aria-label={t("login.close")}
              className="size-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold focus-visible:outline-2 focus-visible:outline-black"
            >
              ✕
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="mb-4 text-sm text-[#BA2D0B] bg-[#BA2D0B]/5 border border-[#BA2D0B]/20 rounded-xl px-3 py-2">
            {t("login.sessionExpired")}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl mb-5 text-xs sm:text-sm font-semibold" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={method === tab.id}
              onClick={() => setMethod(tab.id)}
              className={`min-h-11 px-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                method === tab.id ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {method === "ABHA" ? (
            <AbhaRegistration onUseMobileLogin={() => setMethod("OTP")} onVerified={onVerified} />
          ) : method === "OTP" ? (
            <MobileOtpLogin onVerified={onVerified} onRegister={() => setMethod("ABHA")} />
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6">
                <QrCode className="size-14 text-slate-400 mb-3" aria-hidden="true" />
                <p className="text-sm text-slate-700">{t("login.qr.unavailable")}</p>
              </div>
              <button
                onClick={() => setMethod("OTP")}
                className="w-full min-h-12 bg-black hover:bg-black/85 text-white font-semibold text-sm rounded-full transition-colors cursor-pointer"
              >
                {t("login.qr.useMobile")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
