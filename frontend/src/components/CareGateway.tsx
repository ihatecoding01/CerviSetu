import { Sym } from "./icons/Sym";
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
    <div className="min-h-screen w-full bg-slate-200/90 text-slate-900 font-sans selection:bg-pink-100 selection:text-[#9D174D] antialiased relative overflow-hidden flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Blurred Out Depth Backdrop */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 size-[34rem] rounded-full bg-pink-300/20 blur-[72px]" />
        <div className="absolute top-1/4 -right-24 size-[36rem] rounded-full bg-sky-300/20 blur-[72px]" />
        <div className="absolute top-2/3 left-1/3 size-[30rem] rounded-full bg-sky-200/15 blur-[64px]" />
        <div className="absolute inset-0 backdrop-blur-md bg-slate-100/75" />
      </div>

      {/* Main Care Gateway Card */}
      <div className="relative z-10 w-full max-w-4xl card-base card-gradient-pink rounded-lg border border-black/15 shadow-sm p-6 sm:p-10 transition-all">
        {/* Top bar: back link + language picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {onOpenLanding ? (
            <button
              onClick={onOpenLanding}
              className="inline-flex items-center gap-1.5 text-xs font-heading font-semibold text-slate-700 hover:text-black bg-white/90 hover:bg-white px-3 py-1.5 rounded-md border border-black/15 transition-all shadow-2xs cursor-pointer"
            >
              <Sym n="arrow-left" /> System Overview
            </button>
          ) : (
            <span />
          )}
          <LanguageSwitch className="ml-auto" />
        </div>

        {/* Top Branding */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-lg bg-white border border-pink-200/80 flex items-center justify-center p-1 shadow-2xs">
              <CerviSetuLogo size={34} />
            </div>
            <span className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">cervisetu</span>
          </div>
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#9D174D] bg-pink-50 border border-pink-200/90 px-3 py-1 rounded-md mt-3 shadow-2xs">
            District Hub-and-Spoke Oncology Portal
          </span>
        </div>

        {/* Section 1: Search for Available Facilities */}
        <div className="card-base card-gradient-subtle rounded-lg p-5 sm:p-6 border border-black/15 mb-8 shadow-2xs">
          <h2 className="font-heading text-xs sm:text-sm font-bold text-center text-slate-800 mb-4 uppercase tracking-wider">
            Search Available Oncology Facilities <span className="text-[#9D174D] font-extrabold">· Open Public Lookup</span>
          </h2>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder="Enter district name (e.g. Mirzapur, Varanasi)..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-black/15 rounded-md text-sm font-sans focus:outline-none focus:border-[#9D174D] focus:ring-2 focus:ring-pink-500/20 text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-[#9D174D] hover:bg-[#831843] text-white font-heading font-semibold text-xs tracking-wider uppercase rounded-md shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isSearching ? "Searching..." : "Search Facilities"}
            </button>
          </form>

          {/* Results: Hub-and-Spoke Paired Cards */}
          {hasSearched && (
            <div className="mt-6 pt-5 border-t border-black/10">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-heading text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Matched Pathway for "{districtQuery}"
                </span>
                <span className="text-[11px] text-[#0369A1] font-bold bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md">
                  ABDM & PMJAY Empanelled
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {facilities.map((fac, idx) => (
                  <div
                    key={idx}
                    className={`card-base ${
                      fac.facility_type === "REGIONAL_EBRT_SPOKE"
                        ? "card-gradient-pink border-pink-300/70"
                        : "card-gradient-blue border-sky-300/70"
                    } rounded-lg p-4.5 border shadow-2xs transition-all`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-heading text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-black/15 text-slate-800 shadow-2xs">
                        {fac.badge}
                      </span>
                      <span className="font-mono-data text-xs font-bold text-slate-600 flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" /> ~{fac.approx_distance_km} km
                      </span>
                    </div>

                    <h3 className="font-heading text-sm font-bold text-slate-900 leading-snug mb-1">{fac.facility_name}</h3>
                    <p className="text-xs text-slate-600 mb-3 font-medium">{fac.role_label}</p>

                    <div className="space-y-1.5 mb-3.5">
                      {fac.services.map((srv, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <CheckCircle2 className="size-3.5 text-[#0284C7] shrink-0" />
                          <span>{srv}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2.5 border-t border-black/10 flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-900"><Sym n="check" /> PMJAY Free Treatment</span>
                      <button
                        onClick={onLoginStaff}
                        className="px-3 py-1.5 rounded-md bg-[#0F172A] hover:bg-black text-white font-heading font-semibold text-xs tracking-wider transition-all cursor-pointer shadow-2xs"
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
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white/95 px-4 font-heading text-[11px] text-slate-500 font-bold tracking-wider rounded-md">
              Already registered? Select clinical portal
            </span>
          </div>
        </div>

        {/* Section 2: Three Distinct Login Pathways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {/* Card 1: Doctor / Staff */}
          <div className="card-base card-gradient-warm rounded-lg border border-black/15 hover:border-black/30 p-5 transition-all shadow-2xs flex flex-col justify-between items-center text-center">
            <div className="size-11 rounded-md bg-white border border-black/15 flex items-center justify-center text-slate-900 mb-3 shadow-2xs">
              <User className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <button
                onClick={onLoginStaff}
                className="w-full py-2 px-3 rounded-md bg-[#0F172A] text-white hover:bg-black font-heading font-semibold text-xs tracking-wider uppercase transition-all shadow-2xs cursor-pointer block"
              >
                Doctor / Clinical Staff
              </button>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                For hospital staff: radiation oncologists, spoke nurses, and cancer clinic coordinators.
              </p>
            </div>

            <div className="font-mono-data text-[10px] font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-black/10">
              CareUI Workstation · Dual-Clock Board
            </div>
          </div>

          {/* Card 2: ASHA Worker */}
          <div className="card-base card-gradient-pink rounded-lg border border-black/15 hover:border-pink-500/40 p-5 transition-all shadow-2xs flex flex-col justify-between items-center text-center">
            <div className="size-11 rounded-md bg-white border border-pink-200 flex items-center justify-center text-[#9D174D] mb-3 shadow-2xs">
              <HeartHandshake className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <button
                onClick={onLoginAsha || onLoginStaff}
                className="w-full py-2 px-3 rounded-md bg-[#9D174D] text-white hover:bg-[#831843] font-heading font-semibold text-xs tracking-wider uppercase transition-all shadow-2xs cursor-pointer block"
              >
                Frontline ASHA Worker
              </button>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                For frontline community health workers: home visit alerts, distress tickets & travel vouchers.
              </p>
            </div>

            <div className="font-mono-data text-[10px] font-bold text-[#9D174D] bg-pink-50 px-2.5 py-1 rounded-md border border-pink-200">
              ASHA Network · Field Coordination
            </div>
          </div>

          {/* Card 3: Patient */}
          <div className="card-base card-gradient-blue rounded-lg border border-black/15 hover:border-sky-500/40 p-5 transition-all shadow-2xs flex flex-col justify-between items-center text-center">
            <div className="size-11 rounded-md bg-white border border-sky-200 flex items-center justify-center text-[#0284C7] mb-3 shadow-2xs">
              <Users className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <button
                onClick={() => setShowPatientLoginModal(true)}
                className="w-full py-2 px-3 rounded-md bg-[#0284C7] text-white hover:bg-[#0369A1] font-heading font-semibold text-xs tracking-wider uppercase transition-all shadow-2xs cursor-pointer block"
              >
                Patient & Caregiver
              </button>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                For cancer patients & caregivers: 29-step Healing Clock, hydration guide, & travel passes.
              </p>
            </div>

            <div className="font-mono-data text-[10px] font-bold text-[#0369A1] bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
              Vernacular Co-Pilot · Zero Password
            </div>
          </div>
        </div>
      </div>

      {/* Patient login modal */}
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-login-title"
        onClick={(e) => e.stopPropagation()}
        className="card-base card-gradient-subtle rounded-lg max-w-md w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-black/20 relative"
      >
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h3 id="patient-login-title" className="font-heading text-lg font-bold text-slate-900">{t("login.title")}</h3>
            <p className="text-xs text-slate-600">{t("login.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              onClick={onClose}
              aria-label={t("login.close")}
              className="size-8 rounded-md bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-black/15 shadow-2xs focus-visible:outline-2 focus-visible:outline-black cursor-pointer"
            >
              <Sym n="x" />
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="mb-4 text-xs font-medium text-[#9D174D] bg-pink-50 border border-pink-200 rounded-md px-3 py-2">
            {t("login.sessionExpired")}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-md mb-5 text-xs font-heading font-semibold" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={method === tab.id}
              onClick={() => setMethod(tab.id)}
              className={`py-2 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                method === tab.id ? "bg-white text-slate-900 shadow-2xs border border-black/10 font-bold" : "text-slate-600 hover:text-slate-900"
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
              <div className="mx-auto bg-white/70 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-6 shadow-2xs">
                <QrCode className="size-14 text-slate-400 mb-3" aria-hidden="true" />
                <p className="text-xs text-slate-700">{t("login.qr.unavailable")}</p>
              </div>
              <button
                onClick={() => setMethod("OTP")}
                className="w-full py-2.5 bg-[#0F172A] hover:bg-black text-white font-heading font-semibold text-xs tracking-wider uppercase rounded-md transition-all shadow-2xs cursor-pointer"
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
