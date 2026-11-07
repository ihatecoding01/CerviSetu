import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, LogOut, Navigation, Phone, ReceiptText, RefreshCw, X } from "lucide-react";
import { CerviSetuLogo } from "../icons/CerviSetuLogo";
import { portalApi, PortalError, type PortalOverview } from "../../api/portal";
import type { Referral } from "../../api/referrals";
import { usePatientLang } from "../../i18n/patient";
import { LanguageSwitch } from "../common/LanguageSwitch";
import { GeniePopup, GenieTrigger } from "../app/Genie";
import { patientGenie } from "../app/genieConfigs";
import { btn, ui } from "../app/ui";
import { Notice, when } from "../app/Status";

const FindCentre = lazy(() => import("./FindCentre"));
import type { AssignedInfo } from "./FindCentre";

interface Props {
  token: string;
  // Session missing/expired: back to the login gateway (never to a demo patient)
  onRequireLogin: () => void;
  onOpenOwnRecord: (token: string) => void;
}

type State = { kind: "loading" } | { kind: "error" } | { kind: "forbidden" } | { kind: "ready"; overview: PortalOverview };

// Her journey in plain words. Clinical stages are grouped so she is not asked to read medical terms.
const JOURNEY = [
  { label: "Referred to the hospital", statuses: ["REFERRED"] },
  { label: "Reached the hospital", statuses: ["ARRIVED"] },
  { label: "Check-up and tests at the hospital", statuses: ["COLPOSCOPY_DONE", "BIOPSY_TAKEN"] },
  { label: "Doctor explains results and plan", statuses: ["REPORT_READY", "TREATMENT_PLANNED"] },
  { label: "Care completed", statuses: ["COMPLETED"] },
];
const stepOf = (status: string) => JOURNEY.findIndex((s) => s.statuses.includes(status));

function statusLine(r: Referral): string {
  if (r.status === "ROUTINE_SCREENING") return "Your screening is recorded. No referral is needed now.";
  if (r.status === "DECLINED") return "Your referral is paused.";
  if (r.following) return `Your referral is open. Day ${r.follow_up_day} of 14.`;
  if (r.status === "COMPLETED") return "Your care is complete.";
  return "You have reached the hospital. Your hospital team is looking after you.";
}

// SAMPLE DATA for demonstration only. No hospital has shared real patient charges with CerviSetu.
// Ranges are illustrative; the low end is 0 because many government hospitals charge nothing.
// Replace with sourced, per-hospital charges before real use.
const SAMPLE_COSTS: { item: string; min: number; max: number; note?: string }[] = [
  { item: "Registration and doctor consultation", min: 0, max: 100 },
  { item: "Colposcopy (closer check-up)", min: 0, max: 1500, note: "Only if the doctor decides it is needed" },
  { item: "Biopsy and lab report", min: 0, max: 2000, note: "Only if the doctor decides it is needed" },
  { item: "Medicines", min: 0, max: 500 },
  { item: "Travel, both ways", min: 50, max: 300 },
];
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function CostEstimate({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const min = SAMPLE_COSTS.reduce((t, c) => t + c.min, 0);
  const max = SAMPLE_COSTS.reduce((t, c) => t + c.max, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 flex flex-col gap-3" data-testid="cost-estimate" role="region" aria-labelledby="cost-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="cost-title" className={ui.h3}>Estimated cost at {hospital}</h3>
          <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900" data-testid="cost-sample">Sample figures for demonstration, not real hospital charges</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close cost estimate" className="p-1 -m-1 rounded-md text-slate-500 hover:bg-slate-200/60 cursor-pointer" data-testid="cost-close"><X className="size-4" /></button>
      </div>
      <ul className="text-sm divide-y divide-black/[0.06]">
        {SAMPLE_COSTS.map((c) => (
          <li key={c.item} className="flex justify-between gap-3 py-1.5">
            <span className="text-slate-700 min-w-0">{c.item}{c.note && <span className="block text-xs text-slate-500">{c.note}</span>}</span>
            <span className="text-slate-800 shrink-0 tabular-nums">{`${rupees(c.min)} – ${rupees(c.max)}`}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 pt-2 font-semibold"><span>Possible total</span><span className="tabular-nums" data-testid="cost-total">{`${rupees(min)} – ${rupees(max)}`}</span></li>
      </ul>
      <p className="text-xs text-slate-500">This is a guide, not a final bill. The doctor decides which tests are needed. Many government hospitals charge little or nothing. Please confirm with the hospital or your health worker.</p>
    </div>
  );
}

function NextStep({ r, onReply, busy, centre, slotRef }: { r: Referral; onReply: (id: string) => void; busy: boolean; centre: AssignedInfo | null; slotRef: (el: HTMLElement | null) => void }) {
  const [cost, setCost] = useState(false);
  if (r.status === "ROUTINE_SCREENING") {
    return <p className="text-base text-slate-800" data-testid="next-step">Please continue routine screening when your health worker tells you.</p>;
  }
  if (r.status === "DECLINED") {
    return <p className="text-base text-slate-800" data-testid="next-step">You can still go whenever you are ready. Please speak to your health worker. They can restart your referral.</p>;
  }
  if (!r.following) {
    return (
      <p className="text-base text-slate-800" data-testid="next-step">
        {r.next_follow_up ? `Your next visit is on ${when(r.next_follow_up)}. ` : "Your hospital team will tell you the next step. "}
        Your doctor will explain your results to you.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <p className="font-heading text-xl sm:text-2xl font-semibold text-[#111418] text-pretty" data-testid="next-step">Go to {r.hospital} for a closer check-up.</p>
        <p className="mt-1.5 text-sm text-slate-700">The doctors there will look more closely at the result from your screening. Going soon means any problem can be found and treated early.</p>
      </div>
      <div className="rounded-lg border border-slate-200 p-4 flex flex-col gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#C8400F]">Your referral centre</p>
          <p className="font-heading text-lg font-semibold leading-snug">{r.hospital}</p>
          {centre?.place && <p className="text-sm text-slate-600" data-testid="next-step-place">{centre.place}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {centre?.directions
            ? <a href={centre.directions} target="_blank" rel="noreferrer" className={btn("primary")} data-testid="next-directions"><Navigation className="size-4" aria-hidden="true" />Get directions</a>
            : <a href="#centre" className={btn("primary")} data-testid="next-directions"><Navigation className="size-4" aria-hidden="true" />Get directions</a>}
          <button type="button" disabled={busy} onClick={() => onReply("VISITED")} className={btn("secondary")} data-testid="reply-visited">I have been to the hospital</button>
          <button type="button" aria-expanded={cost} onClick={() => setCost((c) => !c)} className={btn("secondary")} data-testid="estimate-cost"><ReceiptText className="size-4" aria-hidden="true" />Estimate cost</button>
        </div>
        {cost && <CostEstimate hospital={r.hospital ?? "Your referral centre"} onClose={() => setCost(false)} />}
      </div>
      {/* Filled by the map only after she shares her location; hidden while empty */}
      <section aria-label="Distance to your centre" className="rounded-lg border border-[#0369A1]/25 bg-sky-50/40 p-4 has-[[data-slot]:empty]:hidden" data-testid="distance-tools">
        <div ref={slotRef} data-slot="" />
      </section>
      <div>
        <h3 className="text-sm font-semibold text-[#111418]">Take with you</h3>
        <ul className="mt-1.5 grid gap-1 text-sm text-slate-700">
          {["Your referral slip", "Aadhaar or any photo ID", "Any reports you have"].map((x) => (
            <li key={x} className="flex items-center gap-2"><Check className="size-4 text-emerald-700 shrink-0" aria-hidden="true" />{x}</li>
          ))}
        </ul>
      </div>
      <p className="-mt-1 text-xs text-slate-500">Your visit is counted when the hospital confirms you arrived.</p>
    </div>
  );
}

export const PatientPortal: React.FC<Props> = ({ token, onRequireLogin, onOpenOwnRecord }) => {
  const { lang, t } = usePatientLang();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [genieOpen, setGenieOpen] = useState(false);
  const [centre, setCentre] = useState<AssignedInfo | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Parent re-renders pass a new callback each time; keep it out of load()'s dependencies
  const requireLogin = useRef(onRequireLogin);
  requireLogin.current = onRequireLogin;

  const load = useCallback(async () => {
    // Clear previous data first: a failed reload must never leave stale or another patient's details on screen
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", overview: await portalApi.overview(token) });
    } catch (e) {
      const kind = (e as PortalError).kind;
      if (kind === "unauthenticated") return requireLogin.current();
      if (kind === "forbidden") {
        setState({ kind: "forbidden" });
        portalApi.session().then((s) => setOwnToken(s.patient_token)).catch(() => setOwnToken(null));
        return;
      }
      setState({ kind: "error" });
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const logout = async () => {
    try { await portalApi.logout(); } finally { requireLogin.current(); }
  };

  const reply = async (id: string) => {
    setBusy(true);
    setNote(null);
    try {
      await portalApi.reply(token, id);
      const text: Record<string, string> = {
        VISITED: "Thank you. Your care team can see this. Your visit is counted when the hospital confirms it.",
        NEEDS_HELP: "Thank you. Your care team can see that you need help and will contact you.",
        NURSE_CALL_BACK: "Thank you. A nurse will call you back.",
        STOP: "Reminders are stopped. You can ask your health worker to restart them.",
      };
      setNote({ ok: true, text: text[id] });
      setState({ kind: "ready", overview: await portalApi.overview(token) });
    } catch {
      setNote({ ok: false, text: "This could not be saved. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const ready = state.kind === "ready" ? state.overview : null;
  const r = ready?.referral ?? null;

  const page = (children: React.ReactNode) => (
    <div className={ui.page} lang={lang}>
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CerviSetuLogo size={30} alt="" />
            <div className="leading-tight min-w-0">
              <p className="font-heading font-semibold text-[15px]">CerviSetu</p>
              <p className="text-xs text-slate-500 truncate">{t("portal.name")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSwitch className="max-sm:w-[88px] max-sm:[&>select]:w-full" />
            {ready && <GenieTrigger open={genieOpen} onClick={() => setGenieOpen((o) => !o)} />}
            {state.kind !== "loading" && (
              <button type="button" onClick={logout} aria-label={t("portal.logout")} title={t("portal.logout")} className="p-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer" data-testid="patient-logout">
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">{children}</main>
      {ready && <GeniePopup open={genieOpen} onClose={() => setGenieOpen(false)} config={patientGenie(token, r?.hospital ?? null)} />}
    </div>
  );

  if (state.kind === "loading") return page(<p role="status" className="py-16 text-center text-sm text-slate-600">{t("portal.loading")}</p>);

  if (state.kind === "error" || state.kind === "forbidden") {
    const forbidden = state.kind === "forbidden";
    return page(
      <div role="alert" className={`${ui.panel} p-6 text-center flex flex-col items-center gap-3`}>
        <AlertTriangle className="size-7 text-amber-700" aria-hidden="true" />
        <h1 className={ui.h2}>{forbidden ? t("portal.forbidden.title") : t("portal.error.title")}</h1>
        <p className="text-sm text-slate-700">{forbidden ? t("portal.forbidden.body") : t("portal.error.body")}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          {forbidden && ownToken && <button type="button" onClick={() => onOpenOwnRecord(ownToken)} className={btn("primary")}>{t("portal.openMine")}</button>}
          {forbidden
            ? <button type="button" onClick={logout} className={btn("secondary")}>{t("portal.loginAgain")}</button>
            : <button type="button" onClick={load} className={btn("primary")}><RefreshCw className="size-4" aria-hidden="true" />{t("portal.retry")}</button>}
        </div>
      </div>,
    );
  }

  const o = state.overview;
  const at = r ? stepOf(r.status) : -1;

  return page(
    <>
      <section aria-labelledby="hello" className="flex flex-col gap-2">
        <h1 id="hello" className={ui.h1}>{o.display_name ? t("portal.hello", { name: o.display_name }) : t("portal.helloNoName")}</h1>
        <p className="text-sm text-slate-600" data-testid="patient-status">{r ? statusLine(r) : "Your health worker will add your details here after your screening."}</p>
        {r?.following && (
          <div className="max-w-sm" aria-hidden="true"><div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-[#0369A1] rounded-full" style={{ width: `${Math.min(100, Math.max(4, (r.follow_up_day / 14) * 100))}%` }} /></div></div>
        )}
      </section>

      {note && <Notice tone={note.ok ? "routine" : "critical"} role={note.ok ? "status" : "alert"}>{note.text}</Notice>}

      <div className={r?.hospital ? "grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start" : ""}>
        {r && (
          <section aria-labelledby="next" className={`${ui.panel} p-5 sm:p-6 border-t-[3px] border-t-[#0369A1]`}>
            <h2 id="next" className="text-xs font-semibold uppercase tracking-wide text-[#0369A1] mb-3">Your next step</h2>
            <NextStep r={r} onReply={reply} busy={busy} centre={centre} slotRef={setSlot} />
          </section>
        )}
        {r?.hospital && (
          <section id="centre" aria-label="Your referral centre on the map" className="scroll-mt-20 lg:sticky lg:top-20">
            <Suspense fallback={<p className="text-sm text-slate-600">Loading map</p>}>
              <FindCentre token={token} stacked onAssigned={setCentre} locationSlot={r?.following ? slot : null} />
            </Suspense>
          </section>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-stretch">
        {r && at >= 0 && (
          <section aria-labelledby="journey" className={`${ui.panel} p-5 sm:p-6`}>
            <h2 id="journey" className={ui.h3}>Your care journey</h2>
            <ol className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-0" data-testid="journey">
              {JOURNEY.map((st, i) => {
                const done = i < at, now = i === at;
                return (
                  <li key={st.label} className="relative flex sm:flex-col items-center gap-3 sm:gap-2 sm:text-center">
                    {i < JOURNEY.length - 1 && <span aria-hidden="true" className={`hidden sm:block absolute top-3 left-1/2 w-full h-0.5 ${done ? "bg-[#0369A1]" : "bg-slate-200"}`} />}
                    <span className={`relative z-10 size-6 shrink-0 rounded-full flex items-center justify-center border-2 ${done ? "bg-[#0369A1] border-[#0369A1] text-white" : now ? "border-[#0369A1] bg-white" : "border-slate-300 bg-white"}`} aria-hidden="true">
                      {done ? <Check className="size-3.5" /> : now ? <span className="size-2 rounded-full bg-[#0369A1]" /> : null}
                    </span>
                    <span className={`text-sm sm:text-xs sm:px-1 ${now ? "font-semibold text-[#111418]" : done ? "text-slate-700" : "text-slate-500"}`}>
                      {st.label}{now && <span className="sr-only"> (you are here)</span>}{done && <span className="sr-only"> (done)</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        {r?.following && (
          <section aria-labelledby="help" className={`${ui.panel} p-5 sm:p-6 flex flex-col gap-3`}>
            <div>
              <h2 id="help" className={ui.h3}>Need help?</h2>
              <p className="text-sm text-slate-600 mt-1">Tell your care team. They will see your message.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => reply("NURSE_CALL_BACK")} className={btn("secondary")} data-testid="reply-callback"><Phone className="size-4" aria-hidden="true" />Please call me back</button>
              <button type="button" disabled={busy} onClick={() => reply("NEEDS_HELP")} className={btn("secondary")} data-testid="reply-help">I need help to go</button>
            </div>
          </section>
        )}
      </div>

      {r?.following && (
        <details className={`${ui.panel} group px-5 py-4`}>
          <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">Reminder messages<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="pt-3 text-sm text-slate-700 flex flex-col gap-2">
            {r.stopped_at ? <p>Reminders are stopped. Your health worker can restart them.</p> : (
              <>
                <p>We send you reminders until the hospital confirms your visit. You can stop them at any time.</p>
                <button type="button" disabled={busy} onClick={() => reply("STOP")} className={btn("danger", "self-start")} data-testid="stop-reminders">Stop reminders</button>
              </>
            )}
          </div>
        </details>
      )}

      <details className={`${ui.panel} group px-5 py-4`}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">{t("portal.info.title")}<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <dl className="mt-3 text-sm divide-y divide-black/[0.06]">
          <div className="flex justify-between gap-4 py-2"><dt className="text-slate-600">{t("portal.info.token")}</dt><dd className={`${ui.mono} font-semibold`}>{o.patient_token}</dd></div>
          {r?.health_post && <div className="flex justify-between gap-4 py-2"><dt className="text-slate-600">Health post</dt><dd className="text-right">{r.health_post}</dd></div>}
          {r?.referred_on && <div className="flex justify-between gap-4 py-2"><dt className="text-slate-600">Referred on</dt><dd className="text-right">{when(r.referred_on)}</dd></div>}
        </dl>
        <p className="text-xs text-slate-600 mt-2">{t("portal.info.privacy")}</p>
      </details>
    </>,
  );
};
