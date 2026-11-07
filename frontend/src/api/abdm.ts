import type { PatientKey, TFn } from "../i18n/patient";
import { BASE_URL, apiFetch } from "./config";

export class AbdmError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(`${BASE_URL}/api/abdm${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AbdmError("network", "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.detail?.code as string | undefined;
    throw new AbdmError(data?.detail?.message || String(data?.detail || "Request failed"), code);
  }
  return data as T;
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

// Localised message for a failed call: known server codes map to dictionary entries
export function errorText(t: TFn, e: unknown): string {
  const err = e as AbdmError;
  if (err?.code === "NETWORK") return t("err.network");
  if (err?.code === "OTP_INVALID") {
    const n = /(\d+) attempt/.exec(err.message)?.[1] ?? "0";
    return t("err.OTP_INVALID", { n });
  }
  if (err?.code) {
    const key = `err.${err.code}` as PatientKey;
    const text = t(key);
    if (text !== key) return text;
  }
  return t("err.generic");
}
