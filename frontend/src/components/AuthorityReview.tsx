import { useCallback, useEffect, useState } from "react";
import { api, type AuthorityCase } from "../api/client";

const STATUS: Record<AuthorityCase["status"], string> = {
  PENDING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  SENT_TO_DISTRICT: "Sent to district",
};

/** A person decides before any patient's identity goes to the district office. */
export function AuthorityReview() {
  const [cases, setCases] = useState<AuthorityCase[] | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(() => {
    api.getAuthorityCases().then((r) => setCases(r.cases)).catch(() => setDenied(true));
  }, []);
  useEffect(load, [load]);

  const act = async (id: string, action: "approve" | "decline" | "mark-sent") => {
    await api.authorityAction(id, action).catch(() => undefined);
    load();
  };

  const btn = "px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer";
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3" data-testid="authority-review">
      <div>
        <h2 className="text-sm font-bold text-[#111418]">District Escalation Review</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Personal details stay hidden until a doctor or administrator approves. Approving does not send anything: hand the dossier to the district office, then mark it sent.
        </p>
      </div>
      {denied && <p className="text-xs text-gray-500">Only doctors and administrators can review district cases.</p>}
      {cases?.length === 0 && <p className="text-xs text-gray-500">No cases waiting for review.</p>}
      <div className="divide-y divide-gray-100">
        {cases?.map((c) => (
          <div key={c.case_id} className="py-2.5 flex flex-wrap items-center justify-between gap-2" data-testid="authority-case">
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-gray-900">{c.patient_token} · {STATUS[c.status]}</p>
              <p className="text-gray-600">{[c.diagnosis, c.reason].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.status === "PENDING_REVIEW" && (
                <>
                  <button onClick={() => act(c.case_id, "approve")} className={`${btn} bg-black text-white`}>Approve</button>
                  <button onClick={() => act(c.case_id, "decline")} className={`${btn} border border-gray-300`}>Decline</button>
                </>
              )}
              {(c.status === "APPROVED" || c.status === "SENT_TO_DISTRICT") && (
                <a href={api.authorityDossierUrl(c.case_id)} target="_blank" rel="noreferrer" className={`${btn} border border-gray-300`}>Open dossier</a>
              )}
              {c.status === "APPROVED" && (
                <button onClick={() => act(c.case_id, "mark-sent")} className={`${btn} bg-[#0F766E] text-white`}>Mark sent</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
