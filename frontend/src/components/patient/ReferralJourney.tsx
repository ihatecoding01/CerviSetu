import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { STATUS_LABELS, STATUS_ORDER, STEP_LABELS, type Referral } from "../../api/referrals";

/** The path a woman takes from referral to care, shared by the staff and patient screens. */
export function ReferralJourney({ referral }: { referral: Referral }) {
  if (referral.status === "ROUTINE_SCREENING") {
    return <p className="text-sm text-slate-700">Your screening was recorded. Please continue routine screening as your health worker advises.</p>;
  }
  const at = STATUS_ORDER.indexOf(referral.status);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-[#F8F9FA] border border-slate-200 p-3 text-sm">
        <div className="font-bold text-black">{referral.hospital}</div>
        <div className="text-xs text-slate-600 mt-0.5">Referred from {referral.health_post}</div>
        {referral.following && (
          <div className="text-xs font-semibold text-[#BA2D0B] mt-1">Day {referral.follow_up_day} of 14 · {STEP_LABELS[referral.follow_up_step]}</div>
        )}
      </div>
      {referral.status === "DECLINED" ? (
        <p className="text-sm text-slate-700">{STATUS_LABELS.DECLINED}. Your health worker can restart this whenever you are ready.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {STATUS_ORDER.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 text-sm">
              {i < at ? <CheckCircle2 className="size-5 text-emerald-700 shrink-0" /> : i === at ? <CircleDot className="size-5 text-[#BA2D0B] shrink-0" /> : <Circle className="size-5 text-slate-300 shrink-0" />}
              <span className={i === at ? "font-bold text-black" : i < at ? "text-slate-800" : "text-slate-500"}>{STATUS_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
