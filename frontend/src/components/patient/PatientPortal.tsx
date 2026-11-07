import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, LogOut, RefreshCw } from "lucide-react";
import { portalApi, PortalError, type PortalOverview } from "../../api/portal";
import { usePatientLang } from "../../i18n/patient";
import { LanguageSwitch } from "../common/LanguageSwitch";
import { ReferralJourney } from "./ReferralJourney";
import { PatientGenie } from "./PatientGenie";

const FindCentre = lazy(() => import("./FindCentre"));

interface Props {
  token: string;
  // Session missing/expired: back to the login gateway (never to a demo patient)
  onRequireLogin: () => void;
  onOpenOwnRecord: (token: string) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "forbidden" }
  | { kind: "ready"; overview: PortalOverview };

const Section: React.FC<{ title: string; children: React.ReactNode; id: string }> = ({ title, children, id }) => (
  <section aria-labelledby={id} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
    <h2 id={id} className="text-base sm:text-lg font-bold text-slate-900 mb-3">
      {title}
    </h2>
    {children}
  </section>
);

export const PatientPortal: React.FC<Props> = ({ token, onRequireLogin, onOpenOwnRecord }) => {
  const { lang, t } = usePatientLang();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [replyNote, setReplyNote] = useState<string | null>(null);
  // Parent re-renders pass a new callback each time; keep it out of load()'s dependencies
  const requireLogin = useRef(onRequireLogin);
  requireLogin.current = onRequireLogin;

  const load = useCallback(async () => {
    // Clear previous data first: a failed reload must never leave stale or another patient's details on screen
    setState({ kind: "loading" });
    try {
      const overview = await portalApi.overview(token);
      setState({ kind: "ready", overview });
    } catch (e) {
      const kind = (e as PortalError).kind;
      if (kind === "unauthenticated") {
        requireLogin.current();
        return;
      }
      if (kind === "forbidden") {
        setState({ kind: "forbidden" });
        portalApi.session().then((s) => setOwnToken(s.patient_token)).catch(() => setOwnToken(null));
        return;
      }
      setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    try {
      await portalApi.logout();
    } finally {
      requireLogin.current();
    }
  };

  const header = (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-white border border-[#0F766E]/30 flex items-center justify-center p-0.5 shrink-0" aria-hidden="true">
            <CerviSetuLogo size={30} alt="" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-base text-black leading-tight">cervisetu</p>
            <p className="text-xs text-slate-600 leading-tight">{t("portal.name")}</p>
          </div>
        </div>
        <nav aria-label={t("portal.menu")} className="flex items-center gap-2">
          <LanguageSwitch />
          {state.kind !== "loading" && (
            <button
              onClick={logout}
              className="min-h-9 px-3 rounded-full border border-slate-300 text-xs font-semibold text-slate-800 hover:border-black flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-black"
            >
              <LogOut className="size-3.5" aria-hidden="true" /> <span className="hidden sm:inline">{t("portal.logout")}</span>
              <span className="sm:hidden sr-only">{t("portal.logout")}</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#F7F7F5] text-slate-900 antialiased" lang={lang}>
      {header}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">{children}</main>
    </div>
  );

  if (state.kind === "loading") {
    return shell(
      <p role="status" className="text-sm text-slate-600 py-16 text-center">
        {t("portal.loading")}
      </p>,
    );
  }

  if (state.kind === "error" || state.kind === "forbidden") {
    const forbidden = state.kind === "forbidden";
    return shell(
      <div role="alert" className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
        <AlertTriangle className="size-8 text-[#BA2D0B] mx-auto" aria-hidden="true" />
        <h1 className="text-lg font-bold">{forbidden ? t("portal.forbidden.title") : t("portal.error.title")}</h1>
        <p className="text-sm text-slate-700">{forbidden ? t("portal.forbidden.body") : t("portal.error.body")}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {forbidden && ownToken && (
            <button onClick={() => onOpenOwnRecord(ownToken)} className="min-h-12 px-5 rounded-full bg-black text-white text-sm font-semibold">
              {t("portal.openMine")}
            </button>
          )}
          {forbidden ? (
            <button onClick={logout} className="min-h-12 px-5 rounded-full border border-slate-300 text-sm font-semibold">
              {t("portal.loginAgain")}
            </button>
          ) : (
            <button onClick={load} className="min-h-12 px-5 rounded-full bg-black text-white text-sm font-semibold flex items-center justify-center gap-2">
              <RefreshCw className="size-4" aria-hidden="true" /> {t("portal.retry")}
            </button>
          )}
        </div>
      </div>,
    );
  }

  const { overview: o } = state;

  const welcome = (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {o.display_name ? t("portal.hello", { name: o.display_name }) : t("portal.helloNoName")}
        </h1>
        
      </div>
    </div>
  );

  const info = (
    <Section title={t("portal.info.title")} id="info">
      <dl className="text-sm divide-y divide-slate-100">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-slate-600">{t("portal.info.token")}</dt>
          <dd className="font-mono font-semibold text-right">{o.patient_token}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-600 mt-2">{t("portal.info.privacy")}</p>
    </Section>
  );

  const r = o.referral;
  if (!r) {
    return shell(
      <>
        {welcome}
        <PatientGenie token={token} patientName={o.display_name} hospital={null} initialExpanded={true} />
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2" aria-labelledby="noplan">
          <CalendarClock className="size-8 text-slate-500 mx-auto" aria-hidden="true" />
          <h2 id="noplan" className="text-lg font-bold">No referral yet</h2>
          <p className="text-sm text-slate-700 max-w-md mx-auto">Your health worker will add your details here after your screening.</p>
        </section>
        {info}
      </>,
    );
  }

  const sendReply = async (id: string) => {
    try {
      await portalApi.reply(token, id);
      setReplyNote(id === "STOP" ? "Reminders are stopped. You can ask your health worker to restart them." : "Thank you. Your care team can see this.");
      await portalApi.overview(token).then((overview) => setState({ kind: "ready", overview }));
    } catch {
      setReplyNote("This could not be saved. Please try again.");
    }
  };

  return shell(
    <>
      {welcome}
      <PatientGenie token={token} patientName={o.display_name} hospital={r.hospital} initialExpanded={true} />
      <Section title="Your Next Step" id="next">
        {r.following ? (
          <p className="text-sm text-slate-800" data-testid="next-step">Please go to {r.hospital}. Take your referral slip and any reports. Your visit counts once the hospital confirms you have arrived.</p>
        ) : r.status === "DECLINED" ? (
          <p className="text-sm text-slate-800" data-testid="next-step">You can still go whenever you are ready. Please speak to your health worker.</p>
        ) : (
          <p className="text-sm text-slate-800" data-testid="next-step">{r.next_follow_up ? `Your next visit is on ${r.next_follow_up}.` : "Your hospital team will tell you the next step."} Your doctor will explain your results.</p>
        )}
      </Section>
      {r.hospital && (
        <div className="lg:relative lg:left-1/2 lg:w-[min(1200px,calc(100vw-48px))] lg:-translate-x-1/2">
          <Suspense fallback={<p className="text-sm text-slate-600">Loading map</p>}>
            <FindCentre token={token} />
          </Suspense>
        </div>
      )}
      <Section title="Your Care Journey" id="journey">
        <ReferralJourney referral={r} />
      </Section>
      {r.following && (
        <Section title="Tell Your Care Team" id="reply">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[["VISITED", "I Have Visited"], ["NEEDS_HELP", "I Need Help"], ["NURSE_CALL_BACK", "Call Me Back"]].map(([id, label]) => (
              <button key={id} onClick={() => sendReply(id)} className="min-h-12 px-4 rounded-xl border-2 border-black text-sm font-semibold hover:bg-slate-50">{label}</button>
            ))}
          </div>
          {!r.stopped_at && (
            <button onClick={() => sendReply("STOP")} className="mt-3 min-h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold" data-testid="stop-reminders">Stop Reminders</button>
          )}
          {r.stopped_at && <p className="mt-3 text-sm text-slate-700">Reminders are stopped.</p>}
          {replyNote && <p role="status" className="text-sm font-medium text-emerald-800 mt-3">{replyNote}</p>}
        </Section>
      )}
      {info}
    </>,
  );
};
