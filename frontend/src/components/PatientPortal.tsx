import { CerviSetuLogo } from "./icons/CerviSetuLogo";
import { VoiceSymptomReporter } from "./VoiceSymptomReporter";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  HeartHandshake,
  Info,
  LogOut,
  PauseCircle,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import { portalApi, PortalError, type PortalHistory, type PortalOverview } from "../api/portal";
import { usePatientLang, type Lang, type PatientKey, type TFn } from "../i18n/patient";
import { LanguageSwitch } from "./LanguageSwitch";

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
  | { kind: "ready"; overview: PortalOverview; history: PortalHistory };

// Dates arrive as clinic-local YYYY-MM-DD; build them as local dates so they never shift by timezone
function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(iso: string, lang: Lang, t: TFn, today?: string): string {
  if (today) {
    const diff = Math.round((parseDay(iso).getTime() - parseDay(today).getTime()) / 86400000);
    if (diff === 0) return t("portal.today");
    if (diff === 1) return t("portal.tomorrow");
  }
  return parseDay(iso).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />,
  MISSED: <XCircle className="size-5 text-[#BA2D0B]" aria-hidden="true" />,
  APPROVED_PAUSE: <PauseCircle className="size-5 text-slate-600" aria-hidden="true" />,
  FACILITY_DOWNTIME: <Wrench className="size-5 text-slate-600" aria-hidden="true" />,
  PLANNED_REST: <CircleSlash className="size-5 text-slate-500" aria-hidden="true" />,
  UPCOMING: <CircleDashed className="size-5 text-slate-500" aria-hidden="true" />,
};

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
  // Parent re-renders pass a new callback each time; keep it out of load()'s dependencies
  const requireLogin = useRef(onRequireLogin);
  requireLogin.current = onRequireLogin;

  const load = useCallback(async () => {
    // Clear previous data first: a failed reload must never leave stale or another patient's details on screen
    setState({ kind: "loading" });
    try {
      const [overview, history] = await Promise.all([portalApi.overview(token), portalApi.history(token)]);
      setState({ kind: "ready", overview, history });
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

  const { overview: o, history: h } = state;
  const c = o.clock;
  const today = c?.as_of_date;

  const welcome = (
    <div className="space-y-3">
      {o.synthetic_patient && (
        <div role="note" className="bg-white border-2 border-dashed border-[#BA2D0B]/40 rounded-2xl p-4 flex gap-3">
          <Info className="size-5 text-[#BA2D0B] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-[#BA2D0B]">{t("portal.synthetic.badge")}</p>
            <p className="text-sm text-slate-700">{t("portal.synthetic.body")}</p>
          </div>
        </div>
      )}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {o.display_name ? t("portal.hello", { name: o.display_name }) : t("portal.helloNoName")}
        </h1>
        {o.facility_name && <p className="text-sm text-slate-600 mt-1">{t("portal.clinic", { name: o.facility_name })}</p>}
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
        {o.stage && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-slate-600">{t("portal.info.stage")}</dt>
            <dd className="font-semibold text-right">{t("portal.info.stageValue", { stage: o.stage.replace(/^stage\s*/i, "") })}</dd>
          </div>
        )}
        {o.abha_sandbox_id_masked && (
          <>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-slate-600">{t("portal.info.abha")}</dt>
              <dd className="font-mono font-semibold text-right">{o.abha_sandbox_id_masked}</dd>
            </div>
            {o.abha_sandbox_address && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-slate-600">{t("portal.info.abhaAddress")}</dt>
                <dd className="font-mono font-semibold text-right break-all">{o.abha_sandbox_address}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {o.abha_sandbox_id_masked && <p className="text-xs font-semibold text-[#BA2D0B] mt-2">{t("portal.info.abhaLabel")}</p>}
      <p className="text-xs text-slate-600 mt-2">{t("portal.info.privacy")}</p>
    </Section>
  );

  if (!o.has_plan || !c) {
    return shell(
      <>
        {welcome}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2" aria-labelledby="noplan">
          <CalendarClock className="size-8 text-slate-500 mx-auto" aria-hidden="true" />
          <h2 id="noplan" className="text-lg font-bold">{t("portal.noplan.title")}</h2>
          <p className="text-sm text-slate-700 max-w-md mx-auto">{t("portal.noplan.body")}</p>
        </section>
        {info}
      </>,
    );
  }

  const pct = c.total_sessions ? Math.round((c.completed_sessions / c.total_sessions) * 100) : 0;
  const statusKey = (["OPTIMAL", "WARNING", "BREACH_RISK"].includes(c.status) ? c.status : c.state) as string;
  const knownStatus = ["OPTIMAL", "WARNING", "BREACH_RISK", "COMPLETED", "PAUSED", "NOT_STARTED"].includes(statusKey);
  const onTrack = statusKey === "OPTIMAL" || statusKey === "COMPLETED";
  const tier = c.support_tier ? c.support_tier.slice(0, 6) : null;

  const progress = (
    <Section title={t("portal.progress.title")} id="progress">
      <p className="text-xl sm:text-2xl font-bold">{t("portal.progress.count", { done: c.completed_sessions, total: c.total_sessions })}</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={c.total_sessions}
        aria-valuenow={c.completed_sessions}
        aria-label={t("portal.progress.aria", { done: c.completed_sessions, total: c.total_sessions })}
        className="h-3 bg-slate-100 rounded-full overflow-hidden mt-3"
      >
        <div className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 text-sm text-slate-700 space-y-1">
        <li>{t("portal.progress.external", { done: c.external_completed, total: c.external_planned })}</li>
        {c.internal_planned > 0 && <li>{t("portal.progress.internal", { done: c.internal_completed, total: c.internal_planned })}</li>}
        {c.treatment_day_today != null && c.treatment_day_today >= 0 && <li>{t("portal.progress.day", { day: c.treatment_day_today })}</li>}
      </ul>
      <p className="mt-3 text-sm font-semibold">
        {c.expected_completion_date
          ? t("portal.progress.expected", { date: formatDay(c.expected_completion_date, lang, t) })
          : t("portal.progress.expectedNone")}
      </p>
      <p className="mt-1 text-xs text-slate-600">{t("portal.progress.disclaimer")}</p>
    </Section>
  );

  const next = (
    <Section title={t("portal.next.title")} id="next">
      {c.next_session ? (
        <div className="flex items-center gap-3">
          <CalendarClock className="size-8 text-black shrink-0" aria-hidden="true" />
          <div>
            <p className="text-lg font-bold">{formatDay(c.next_session.date, lang, t, today)}</p>
            <p className="text-sm text-slate-700">
              {t("portal.next.session", {
                n: c.next_session.session_number,
                kind: t(`portal.kind.${c.next_session.phase === "BRACHY" ? "BRACHY" : "EBRT"}` as PatientKey),
              })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700">{t("portal.next.none")}</p>
      )}
    </Section>
  );

  const status = (
    <Section title={t("portal.status.title")} id="status">
      <div className="flex items-start gap-3">
        {onTrack ? (
          <CheckCircle2 className="size-6 text-emerald-700 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-6 text-[#BA2D0B] shrink-0" aria-hidden="true" />
        )}
        <div>
          {knownStatus && (
            <>
              <p className="font-bold">{t(`portal.status.${statusKey}` as PatientKey)}</p>
              <p className="text-sm text-slate-700">{t(`portal.status.${statusKey}.body` as PatientKey)}</p>
            </>
          )}
          {c.missed_sessions > 0 && <p className="text-sm text-slate-700 mt-2">{t("portal.missed", { n: c.missed_sessions })}</p>}
          {c.consecutive_missed_sessions > 0 && (
            <p className="text-sm font-semibold text-[#BA2D0B] mt-1">{t("portal.missedRecent", { n: c.consecutive_missed_sessions })}</p>
          )}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-3">
        <HeartHandshake className="size-6 text-slate-700 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold text-sm">{t("portal.support.title")}</p>
          <p className="text-sm text-slate-700">{tier ? t(`portal.support.${tier}` as PatientKey) : t("portal.support.none")}</p>
          {tier && <p className="text-xs text-slate-600 mt-1">{t("portal.support.simulated")}</p>}
        </div>
      </div>
    </Section>
  );

  const row = (key: string, type: string, date: string, n: number | null, synthetic: boolean) => (
    <li key={key} className="flex items-center gap-3 py-2.5">
      {EVENT_ICON[type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {t(`portal.event.${type}` as PatientKey)}
          {n != null && <span className="font-normal text-slate-600"> · {t("portal.event.session", { n })}</span>}
        </p>
        <p className="text-xs text-slate-600">{formatDay(date, lang, t, type === "UPCOMING" ? today : undefined)}</p>
      </div>
      {synthetic && (
        <span className="text-[11px] font-semibold text-[#BA2D0B] border border-[#BA2D0B]/30 rounded-full px-2 py-0.5 whitespace-nowrap">
          {t("portal.journey.syntheticTag")}
        </span>
      )}
    </li>
  );

  const journey = (
    <Section title={t("portal.journey.title")} id="journey">
      {h.upcoming.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-slate-700 mt-1">{t("portal.journey.upcoming")}</h3>
          <ul className="divide-y divide-slate-100">
            {h.upcoming.map((u) => row(`u-${u.date}`, "UPCOMING", u.date, u.session_number, false))}
          </ul>
        </>
      )}
      <h3 className="text-sm font-bold text-slate-700 mt-4">{t("portal.journey.history")}</h3>
      {h.events.length ? (
        <ul className="divide-y divide-slate-100">
          {h.events.map((e, i) => row(`e-${e.date}-${i}`, e.type, e.date, e.session_number, e.synthetic))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 py-2">{t("portal.journey.empty")}</p>
      )}
    </Section>
  );

  return shell(
    <>
      {welcome}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-3 space-y-4">{progress}</div>
        <div className="md:col-span-2 space-y-4">
          {next}
          {status}
        </div>
      </div>
      <VoiceSymptomReporter patientToken={token} clockDay={1} />
      {journey}
      {info}
    </>,
  );
};
