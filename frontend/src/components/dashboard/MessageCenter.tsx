import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { api, type MessageLog } from "../../api/client";

const STATUS_TEXT: Record<string, string> = {
  SIMULATED: "Simulated, not sent",
  SENT: "Sent",
  QUEUED: "Queued",
  DELIVERED: "Delivered",
  READ: "Read",
  COMPLETED: "Call completed",
  FAILED: "Failed",
  UNDELIVERED: "Not delivered",
  BLOCKED_NOT_ALLOWED: "Blocked: number not approved",
  NO_PHONE_NUMBER: "No phone number",
};

/** The true state of every reminder, so staff know who actually needs a follow-up call. */
export function MessageCenter() {
  const [log, setLog] = useState<MessageLog | null>(null);
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("SMS");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getMessages().then(setLog).catch(() => setLog(null));
  }, []);
  useEffect(load, [load]);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api.sendTestMessage(channel, phone);
      setResult(STATUS_TEXT[res.status] || res.status);
      load();
    } catch {
      setResult("Could not send. Your role may not allow this.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3" data-testid="message-center">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#111418]">Patient Messages</h2>
          <p className="text-xs text-gray-500 mt-0.5" data-testid="message-mode">
            {log?.mode === "twilio"
              ? `Live sending is on for ${log.approved_numbers} approved number(s).`
              : "Simulation mode: reminders are logged but nothing is sent to patients."}
          </p>
        </div>
        <button onClick={load} aria-label="Refresh messages" className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <RefreshCw className="size-4 text-gray-600" />
        </button>
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel" className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white">
          <option value="SMS">SMS</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="VOICE">Voice call</option>
        </select>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Test phone number"
          inputMode="tel"
          data-testid="message-phone"
          className="flex-1 min-w-40 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
        />
        <button type="submit" disabled={busy || !phone.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
          <Send className="size-3.5" /> Send test
        </button>
      </form>
      {result && <p className="text-xs text-gray-700" role="status" data-testid="message-result">{result}</p>}

      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
        {log?.messages.length === 0 && <p className="text-xs text-gray-500 py-2">No messages yet.</p>}
        {log?.messages.map((m) => (
          <div key={m.message_id} className="py-2 flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {m.channel} · {m.patient_token || "Test"}{m.phone_last4 ? ` · ending ${m.phone_last4}` : ""}
              </p>
              <p className="text-gray-600 truncate" translate="no">{m.body}</p>
            </div>
            <span className={`shrink-0 font-semibold ${["FAILED", "UNDELIVERED", "BLOCKED_NOT_ALLOWED", "NO_PHONE_NUMBER"].includes(m.status) ? "text-[#BA2D0B]" : "text-gray-700"}`}>
              {STATUS_TEXT[m.status] || m.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
