const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Plain-language messages for server error codes
export const FRIENDLY: Record<string, string> = {
  OTP_INVALID: "That code didn't match.",
  OTP_EXPIRED: "This code has expired. Tap Resend OTP to get a new one.",
  TOO_MANY_ATTEMPTS: "Too many wrong tries. Go back and start again.",
  TRANSACTION_CLOSED: "This attempt has ended. Go back and start again.",
  ALREADY_REGISTERED: "This person already has a Synthetic ABHA. Use Mobile OTP login, or Link existing ABHA with their ABHA number.",
  MOBILE_NOT_REGISTERED: "This mobile isn't registered yet. Register with ABHA first.",
  ABHA_NOT_FOUND: "No ABHA found for this number. Try Generate instead, or add the CerviSetu token.",
};

export class AbdmError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/abdm${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.detail?.code as string | undefined;
    const msg = data?.detail?.message || data?.detail || "Something went wrong. Please try again.";
    throw new AbdmError(code && FRIENDLY[code] ? `${FRIENDLY[code]}${code === "OTP_INVALID" ? " " + msg.replace(/^Incorrect OTP\. /, "") : ""}` : msg, code);
  }
  return data as T;
}


export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/abdm${path}`);
  if (!res.ok) throw new AbdmError("Request failed");
  return res.json();
}

// Opens a print-only view of the demo ABHA card (avoids printing the modal overlay)
export function printAbhaCard(rows: [string, string | null | undefined][], label: string) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(String(v))}</b></td></tr>`)
    .join("");
  w.document.write(`<!doctype html><title>Demo ABHA Card</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}.c{border:1px solid #cbd5e1;border-radius:16px;padding:20px;max-width:380px}
h2{margin:0 0 4px;font-size:16px}p{color:#BA2D0B;font-size:12px;font-weight:600;margin:0 0 12px}td{padding:6px 8px 6px 0;font-size:13px;border-top:1px solid #e2e8f0}td:first-child{color:#64748b}</style>
<div class="c"><h2>ABHA Card (Sandbox Demo)</h2><p>${esc(label)}</p><table>${body}</table></div>`);
  w.document.close();
  w.focus();
  w.print();
}
