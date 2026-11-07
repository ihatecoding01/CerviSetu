import type { ReactNode } from "react";
import { STATUS_LABELS, STEP_LABELS, type Referral } from "../../api/referrals";
import { TONE, type Tone, ui } from "./ui";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

/** Follow-up lane as staff see it. Days come from the server; nothing is estimated here. */
export function laneTone(r: Referral): Tone {
  if (!r.following) return r.status === "DECLINED" ? "neutral" : "routine";
  if (r.lane === "visit_due") return "critical";
  if (r.lane === "attention") return "attention";
  return "guidance";
}

export function FollowUpPill({ r }: { r: Referral }) {
  if (!r.following) return <Pill tone={laneTone(r)}>{STATUS_LABELS[r.status] ?? r.status}</Pill>;
  return <Pill tone={laneTone(r)}>{`Day ${r.follow_up_day} of 14 · ${STEP_LABELS[r.follow_up_step] ?? r.follow_up_step}`}</Pill>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={`${ui.panel} px-5 py-8 text-center`}>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Notice({ tone, children, role }: { tone: Tone; children: ReactNode; role?: "alert" | "status" }) {
  return <div role={role} className={`rounded-md border px-3 py-2.5 text-sm ${TONE[tone]}`}>{children}</div>;
}

/** Locale-formatted date and time; falls back to the raw value if it cannot be parsed. */
export function when(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
