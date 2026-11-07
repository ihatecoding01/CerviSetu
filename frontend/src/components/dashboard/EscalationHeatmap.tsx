import { useCallback, useEffect, useState } from "react";
import { MessageCenter } from "./MessageCenter";
import { referralApi, STATUS_LABELS, STEP_LABELS, type Referral, type ReferralEvent } from "../../api/referrals";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../careui/card";
import { Button } from "../careui/button";
import { Badge } from "../careui/badge";
import { Alert, AlertTitle, AlertDescription } from "../careui/alert";
import { ShieldAlert, Send, PhoneCall, MessageSquare, UserCheck, Home, CalendarClock } from "lucide-react";

interface Props {
  canReview?: boolean;
}

const REPLIES = [
  { id: "VISITED", label: "Has Visited" },
  { id: "NEEDS_HELP", label: "Needs Help" },
  { id: "NURSE_CALL_BACK", label: "Nurse Call Back" },
];
const KIND_LABELS: Record<string, string> = {
  REFERRED: "Referred", SCREENED: "Screening Recorded", REMINDER: "Reminder", PATIENT_REPLY: "Patient Reply",
  ASHA_VISIT_ORDERED: "ASHA Visit Ordered", CONSENT_POSITIVE: "Positive Consent", CONSENT_NEGATIVE: "Negative Consent", ...STATUS_LABELS,
};

function dayTone(day: number, current: number) {
  if (day > current) return "bg-gray-100 text-gray-400";
  if (day <= 10) return "bg-[#E0F2FE] text-black";
  if (day <= 13) return "bg-[#0284C7] text-black";
  return "bg-[#9D174D] text-white";
}

export function EscalationHeatmap({ canReview = true }: Props) {
  const [rows, setRows] = useState<Referral[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [mode, setMode] = useState("simulated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await referralApi.board();
    setRows(res.referrals);
    setMode(res.messaging_mode);
    setSelected((cur) => cur ?? res.referrals.find((r) => r.following)?.referral_id ?? null);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);
  useEffect(() => {
    if (selected) referralApi.events(selected).then((r) => setEvents(r.events)).catch((e) => setError(e.message));
  }, [selected, rows]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const following = rows.filter((r) => r.following);
  const current = rows.find((r) => r.referral_id === selected) ?? null;
  const stages = [
    { title: "Daily Reminders", days: "1–10", icon: MessageSquare, desc: "Voice, WhatsApp or SMS each day", variant: "primary" as const, count: following.filter((r) => r.follow_up_step === "DAILY_REMINDER").length },
    { title: "Intensive Contact", days: "11–13", icon: PhoneCall, desc: "More frequent contact if she has not replied", variant: "warning" as const, count: following.filter((r) => r.follow_up_step === "INTENSIVE_CONTACT").length },
    { title: "ASHA Home Visit", days: "14", icon: Home, desc: "The visit records her decision", variant: "destructive" as const, count: following.filter((r) => r.follow_up_step === "ASHA_VISIT").length },
    { title: "Reached Hospital", days: "Closed", icon: UserCheck, desc: "Follow-up stops when she arrives", variant: "neutral" as const, count: rows.filter((r) => r.arrived_on).length },
  ];
  const declined = rows.filter((r) => r.status === "DECLINED");

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">14-Day Referral Tracker</h1>
          <p className="text-xs text-gray-500 mt-1">Reminders, replies and home visits for every woman referred to hospital</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === "twilio" ? "success" : "warning"} size="sm">{mode === "twilio" ? "Live Messaging" : "Messages Simulated"}</Badge>
          <Button size="sm" disabled={busy} onClick={() => run(async () => { const r = await referralApi.runCycle(); setNotice(`${r.reminders} reminders, ${r.visits_ordered} home visits`); }, "Today's follow-up has run.")} className="text-xs bg-[#9D174D] hover:bg-[#a02609] text-white gap-1.5">
            <CalendarClock className="size-3.5" /> Run Today's Follow-up
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Action Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && <div className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{notice}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stages.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title} size="sm" className="bg-white border-gray-200 shadow-2xs hover:border-black transition-all">
              <CardHeader className="pb-1.5">
                <div className="flex items-center justify-between">
                  <div className="size-7 rounded-lg flex items-center justify-center bg-[#E0F2FE]/40 text-black"><Icon className="size-3.5" /></div>
                  <Badge variant={s.variant} size="xs">{s.days}</Badge>
                </div>
                <CardTitle className="text-sm font-bold text-black mt-1.5">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-black mb-1">{s.count}</div>
                <p className="text-xs text-gray-500 leading-tight">{s.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-white border-gray-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-black">Follow-up Timeline</CardTitle>
          <CardDescription className="text-xs text-gray-500">Select a patient to see her messages and record a reply</CardDescription>
        </CardHeader>
        <CardContent>
          {following.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No follow-up is running.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex flex-col gap-2 min-w-[640px]">
                {following.map((r) => (
                  <button key={r.referral_id} onClick={() => setSelected(r.referral_id)} className={`flex items-center gap-3 p-2 rounded-lg border text-left cursor-pointer ${selected === r.referral_id ? "border-[#9D174D] bg-[#9D174D]/5" : "border-gray-200 hover:border-black"}`}>
                    <span className="w-44 shrink-0">
                      <span className="block text-xs font-bold text-black">{r.patient_name}</span>
                      <span className="block text-[11px] text-gray-500">{r.hospital}</span>
                    </span>
                    <span className="flex-1 grid gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                      {Array.from({ length: 14 }, (_, i) => (
                        <span key={i} className={`h-6 rounded text-[10px] font-mono flex items-center justify-center ${dayTone(i + 1, r.follow_up_day)}`}>{i + 1}</span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {current && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card className="bg-white border-gray-200 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-[#111418]">{current.patient_name}</CardTitle>
              <CardDescription className="text-xs text-gray-500">
                {current.following ? `Day ${current.follow_up_day} of 14 · ${STEP_LABELS[current.follow_up_step]}` : STATUS_LABELS[current.status]}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="text-xs text-gray-700">{current.health_post} → {current.hospital}</div>
              {current.following && (
                <>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1.5">Send a Reminder</div>
                    <div className="flex flex-wrap gap-2">
                      {["SMS", "WHATSAPP", "VOICE"].map((c) => (
                        <Button key={c} variant="outline" size="xs" disabled={busy} className="text-xs gap-1" onClick={() => run(() => referralApi.remind(current.referral_id, c), `${c}: recorded for ${current.patient_name}`)}>
                          <Send className="size-3" /> {c}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1.5">Record Her Reply</div>
                    <div className="flex flex-wrap gap-2">
                      {REPLIES.map((r) => (
                        <Button key={r.id} variant="outline" size="xs" disabled={busy} className="text-xs" onClick={() => run(() => referralApi.reply(current.referral_id, r.id), `${r.label}: recorded for ${current.patient_name}`)}>{r.label}</Button>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" disabled={busy} className="bg-black text-white text-xs" onClick={() => run(() => referralApi.setStatus(current.referral_id, { status: "ARRIVED" }), `${current.patient_name} marked as arrived`)}>Mark Arrived at Hospital</Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-black">Contact Log</CardTitle>
              <CardDescription className="text-xs text-gray-500">Each entry shows what really happened to the message</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? <p className="text-xs text-gray-500">Nothing recorded yet.</p> : (
                <ol className="flex flex-col gap-2 text-xs">
                  {events.map((e) => (
                    <li key={e.event_id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-bold text-gray-900">{KIND_LABELS[e.kind] ?? e.kind}</span>
                        {e.channel && <span className="text-gray-600"> · {e.channel}</span>}
                        {e.detail && <span className="text-gray-600"> · {e.detail}</span>}
                      </span>
                      <span className="flex items-center gap-2 text-gray-500 font-mono text-[11px]">
                        {e.status && <Badge variant="neutral" size="xs">{e.status}</Badge>}
                        {e.event_date}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {canReview && (
        <Card className="bg-white border-gray-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-black">Doctor Review: Declined Referrals</CardTitle>
            <CardDescription className="text-xs text-gray-500">Women who gave negative consent on the home visit</CardDescription>
          </CardHeader>
          <CardContent>
            {declined.length === 0 ? <p className="text-xs text-gray-500">No declined referrals.</p> : (
              <ul className="flex flex-col gap-2 text-xs">
                {declined.map((r) => (
                  <li key={r.referral_id} className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
                    <span className="font-bold text-black">{r.patient_name}</span> · {r.screening_finding}{r.consent_note ? ` · ${r.consent_note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      <MessageCenter />
    </div>
  );
}
