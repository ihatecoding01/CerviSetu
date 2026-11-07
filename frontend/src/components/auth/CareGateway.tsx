import { Sym } from "../icons/Sym";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import React, { useEffect, useState } from "react";
import { UserCog, Search, User, Users, CheckCircle2, MapPin, ShieldCheck, QrCode, Phone, HeartHandshake } from "lucide-react";
import { api, type Facility } from "../../api/client";
import { SERVICES } from "../../api/admin";
import { AbhaRegistration } from "./AbhaRegistration";
import { MobileOtpLogin } from "./MobileOtpLogin";
import { usePatientLang } from "../../i18n/patient";
import { LanguageSwitch } from "../common/LanguageSwitch";

export const PATIENT_LOGIN_FLAG = "cervisetu_open_patient_login";

interface Props {
  onLoginStaff: () => void;
  onLoginAsha?: () => void;
  onLoginAdmin?: () => void;
  onLoginPatient: (token?: string) => void;
  onOpenLanding?: () => void;
}

export const CareGateway: React.FC<Props> = ({
  onLoginStaff,
  onLoginAsha,
  onLoginAdmin,
  onLoginPatient,
  onOpenLanding,
}) => {
  const [districtQuery, setDistrictQuery] = useState("");
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
      setFacilities([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFC] relative flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans antialiased text-slate-900">
      {/* Codename Drake: Soft Ambient Radial Lighting Backdrop */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="w-[520px] sm:w-[680px] h-[520px] sm:h-[680px] rounded-full bg-radial from-pink-200/30 via-sky-100/25 to-transparent blur-3xl opacity-75 absolute top-4 left-1/2 -translate-x-1/2" />
      </div>

      {/* Main Care Gateway Card (Codename Drake Styling) */}
      <div className="w-full max-w-5xl card-base card-gradient-warm rounded-2xl border border-black/12 shadow-sm p-6 sm:p-10 relative">
        {/* Top bar: back link + language picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {onOpenLanding ? (
            <button
              onClick={onOpenLanding}
              className="inline-flex items-center gap-1.5 text-xs font-heading font-semibold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-black/15 shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <Sym n="arrow-left" /> System Overview
            </button>
          ) : (
            <span />
          )}
          <LanguageSwitch className="ml-auto" />
        </div>

        {/* Top Branding (Codename Drake) */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-white border border-black/15 flex items-center justify-center p-1.5 shadow-2xs">
              <CerviSetuLogo size={30} />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900 leading-none">
                CerviSetu
              </span>
              <span className="text-[11px] font-sans text-slate-500 mt-0.5">
                HPV Immunization &amp; Rural Cancer Referral Platform
              </span>
            </div>
          </div>

          

          <p className="font-subtitle-playfair text-xs sm:text-sm text-slate-600 mt-2 text-center max-w-lg leading-relaxed font-medium">
            Sovereign multi-cohort triage, point-of-care VIA verification, and rapid hospital referral pathways across rural districts.
          </p>
        </div>

        {/* Section 1: Search for Available Facilities (Drake Bento Subcard) */}
        <div className="card-base card-gradient-subtle rounded-xl p-5 sm:p-7 border border-black/12 mb-8 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-md bg-white border border-black/15 flex items-center justify-center text-[#0369A1] shadow-2xs">
                <MapPin size={12} />
              </div>
              <h2 className="font-heading text-xs uppercase tracking-wider font-bold text-slate-800">
                Find Accredited Spoke &amp; Hub Hospitals
              </h2>
            </div>
            <span className="text-[11px] font-mono-data text-slate-500">Live Spoke Directory</span>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder="Enter hospital name, district, or area (e.g. Varanasi, Sion, CHC)"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/15 rounded-md text-xs font-sans focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 text-slate-900 placeholder:text-slate-400 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-[#0F172A] hover:bg-black text-white font-heading font-bold text-xs rounded-md shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 active:scale-98 shrink-0"
            >
              {isSearching ? "Searching..." : "Search Hospitals"}
            </button>
          </form>

          {/* Results */}
          {hasSearched && (
            <div className="mt-6 pt-5 border-t border-black/10">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-heading font-bold text-slate-800 uppercase tracking-wider">
                  Accredited Facilities ({facilities.length})
                </span>
              </div>
              {facilities.length === 0 && (
                <p className="text-xs font-mono-data text-slate-500 px-1 py-2">
                  No facility found matching this district or keyword.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {facilities.map((fac) => (
                  <div
                    key={`${fac.name}-${fac.area}`}
                    className={`rounded-xl p-4 sm:p-5 border shadow-2xs transition-all ${
                      fac.hospital_type === "TERTIARY_HOSPITAL"
                        ? "card-base card-gradient-pink border-pink-200"
                        : "card-base card-gradient-blue border-sky-200"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span
                        className={`text-[10px] font-mono-data font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white shadow-2xs border ${
                          fac.hospital_type === "TERTIARY_HOSPITAL"
                            ? "text-[#9D174D] border-pink-200"
                            : "text-[#0369A1] border-sky-200"
                        }`}
                      >
                        {fac.hospital_type === "TERTIARY_HOSPITAL"
                          ? "Tertiary Oncology Hub"
                          : fac.hospital_type === "PERIPHERAL_HOSPITAL"
                          ? "District Spoke Daycare"
                          : "Primary Health Spoke"}
                      </span>
                      <span className="text-xs font-mono-data font-semibold text-slate-600 flex items-center gap-1">
                        <MapPin className="size-3 text-[#0369A1]" /> {fac.area}
                      </span>
                    </div>
                    <h3 className="font-heading text-sm font-bold text-slate-900 leading-snug mb-1">
                      {fac.name}
                    </h3>
                    {fac.address && <p className="text-xs text-slate-600 font-sans mb-1">{fac.address}</p>}
                    {fac.phone && <p className="text-xs text-slate-600 font-mono-data mb-1">Tel: {fac.phone}</p>}
                    <div className="space-y-1.5 mt-3 pt-2 border-t border-black/8">
                      {fac.services.length === 0 && (
                        <p className="text-xs text-slate-500 font-sans">
                          Clinical oncology services verified by district authority.
                        </p>
                      )}
                      {fac.services.map((srv) => (
                        <div key={srv} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <CheckCircle2 className="size-3.5 text-[#0369A1] shrink-0" />
                          <span className="font-mono-data text-[11px]">
                            {SERVICES.find((x) => x.id === srv)?.label ?? srv}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#FAFAFC] px-3.5 text-slate-500 font-heading font-bold tracking-wider text-[11px]">
              Authorized Care Portals
            </span>
          </div>
        </div>

        {/* Section 2: Four Distinct Login Pathways (Codename Drake Bento Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {/* Card 1: Log in as Doctor / Staff (Clinical Blue & Obsidian) */}
          <div className="card-base card-gradient-subtle rounded-xl border border-black/12 p-5 hover:border-[#0284C7] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center group">
            <div className="size-11 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0369A1] mb-3.5 group-hover:scale-105 transition-transform shadow-2xs">
              <User className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <h4 className="font-heading font-bold text-sm text-slate-900 mb-1">
                Clinician &amp; Staff
              </h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mb-3">
                For hospital oncology, VIA triage, radiation daycare &amp; spoke OPD.
              </p>
              <button
                onClick={onLoginStaff}
                className="w-full py-2 px-3 rounded-md bg-[#0F172A] hover:bg-black text-white font-heading font-bold text-xs transition-all shadow-xs cursor-pointer block active:scale-98"
              >
                Log in as Clinician
              </button>
            </div>

            <div className="text-[10px] font-mono-data font-semibold text-[#0369A1] bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200 shadow-2xs">
              VIA · Clinical Desk
            </div>
          </div>

          {/* Card 2: Log in as ASHA Worker (Drake Dark Pink) */}
          <div className="card-base card-gradient-subtle rounded-xl border border-black/12 p-5 hover:border-[#9D174D] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center group">
            <div className="size-11 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-[#9D174D] mb-3.5 group-hover:scale-105 transition-transform shadow-2xs">
              <HeartHandshake className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <h4 className="font-heading font-bold text-sm text-slate-900 mb-1">
                ASHA Mobilizer
              </h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mb-3">
                For community health workers: follow-up rosters, home visits &amp; consent.
              </p>
              <button
                onClick={onLoginAsha || onLoginStaff}
                className="w-full py-2 px-3 rounded-md bg-[#9D174D] hover:bg-[#831843] text-white font-heading font-bold text-xs transition-all shadow-xs cursor-pointer block active:scale-98"
              >
                Log in as ASHA
              </button>
            </div>

            <div className="text-[10px] font-mono-data font-semibold text-[#9D174D] bg-pink-50 px-2.5 py-0.5 rounded-md border border-pink-200 shadow-2xs">
              ASHA Network · Home Visits
            </div>
          </div>

          {/* Card 3: Log in as Patient (Drake Clean Sky Blue / White) */}
          <div className="card-base card-gradient-subtle rounded-xl border border-black/12 p-5 hover:border-[#0284C7] hover:shadow-sm transition-all flex flex-col justify-between items-center text-center group">
            <div className="size-11 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7] mb-3.5 group-hover:scale-105 transition-transform shadow-2xs">
              <Users className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <h4 className="font-heading font-bold text-sm text-slate-900 mb-1">
                Patient Companion
              </h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mb-3">
                For patients and families: referral slips, hospital map &amp; next visit.
              </p>
              <button
                onClick={() => setShowPatientLoginModal(true)}
                className="w-full py-2 px-3 rounded-md bg-white hover:bg-slate-50 border border-[#0284C7] text-[#0284C7] font-heading font-bold text-xs transition-all shadow-2xs cursor-pointer block active:scale-98"
              >
                Log in as Patient
              </button>
            </div>

            <div className="text-[10px] font-mono-data font-semibold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-black/15 shadow-2xs">
              Vernacular · Mobile OTP
            </div>
          </div>

          {/* Card 4: Log in as Administrator (Drake Slate) */}
          <div className="card-base card-gradient-subtle rounded-xl border border-black/12 p-5 hover:border-slate-800 hover:shadow-sm transition-all flex flex-col justify-between items-center text-center group">
            <div className="size-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-3.5 group-hover:scale-105 transition-transform shadow-2xs">
              <UserCog className="size-5" />
            </div>

            <div className="mb-4 w-full">
              <h4 className="font-heading font-bold text-sm text-slate-900 mb-1">
                Administrator
              </h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mb-3">
                For district health authorities: hospital oncology capacity &amp; staffing.
              </p>
              <button
                onClick={onLoginAdmin || onLoginStaff}
                className="w-full py-2 px-3 rounded-md bg-slate-800 hover:bg-slate-900 text-white font-heading font-bold text-xs transition-all shadow-xs cursor-pointer block active:scale-98"
              >
                Log in as Admin
              </button>
            </div>

            <div className="text-[10px] font-mono-data font-semibold text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
              Hospitals · Services
            </div>
          </div>
        </div>
      </div>

      {/* Patient login modal (Codename Drake) */}
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
    { id: "ABHA", icon: <ShieldCheck className="size-3.5" aria-hidden="true" />, label: t("login.tab.abha") },
    { id: "OTP", icon: <Phone className="size-3.5" aria-hidden="true" />, label: t("login.tab.mobile") },
    { id: "QR", icon: <QrCode className="size-3.5" aria-hidden="true" />, label: t("login.tab.qr") },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-login-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl border border-black/15 relative"
      >
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h3 id="patient-login-title" className="font-heading font-bold text-base sm:text-lg text-slate-900">
              {t("login.title")}
            </h3>
            <p className="font-sans text-xs text-slate-600 mt-0.5">
              {t("login.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              onClick={onClose}
              aria-label={t("login.close")}
              className="size-8 rounded-md bg-white hover:bg-slate-50 border border-black/15 text-slate-700 flex items-center justify-center font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Sym n="x" />
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="mb-4 text-xs font-mono-data text-[#9D174D] bg-pink-50 border border-pink-200 rounded-md px-3 py-2 shadow-2xs">
            {t("login.sessionExpired")}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-lg mb-5 text-xs font-heading font-semibold border border-black/8" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={method === tab.id}
              onClick={() => setMethod(tab.id)}
              className={`min-h-9 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                method === tab.id
                  ? "bg-white text-slate-900 shadow-2xs font-bold border border-black/10"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon} <span>{tab.label}</span>
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
              <div className="mx-auto bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6">
                <QrCode className="size-12 text-[#0369A1] mb-2.5" aria-hidden="true" />
                <p className="text-xs text-slate-700 font-sans">{t("login.qr.unavailable")}</p>
              </div>
              <button
                onClick={() => setMethod("OTP")}
                className="w-full min-h-10 bg-[#0F172A] hover:bg-black text-white font-heading font-bold text-xs rounded-md shadow-xs transition-all cursor-pointer active:scale-98"
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
