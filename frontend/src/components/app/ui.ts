/**
 * Shared look for the four portals (Orion tokens, used plainly).
 * Calm surfaces, one action colour, colour only for status. No gradients or glows inside the apps.
 */
export const ui = {
  page: "min-h-screen bg-[#FAFAFC] text-[#111418] font-sans antialiased",
  h1: "font-heading text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-[#111418] text-balance",
  h2: "font-heading text-lg font-semibold text-[#111418]",
  h3: "text-sm font-semibold text-[#111418]",
  lead: "text-sm sm:text-base text-slate-600 text-pretty",
  muted: "text-sm text-slate-500",
  label: "text-xs font-semibold text-slate-600",
  panel: "rounded-xl border border-black/[0.08] bg-white",
  divider: "border-t border-black/[0.06]",
  input:
    "min-h-11 w-full min-w-0 rounded-md border border-black/15 bg-white px-3 text-sm text-[#111418] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7]/40 focus:border-[#0284C7] disabled:bg-slate-50 disabled:text-slate-500",
  btn: "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7]",
  primary: "bg-[#0369A1] text-white hover:bg-[#075985]",
  secondary: "bg-white text-[#111418] border border-black/15 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-white text-rose-800 border border-rose-200 hover:bg-rose-50",
  link: "text-sm font-semibold text-[#0369A1] hover:underline cursor-pointer",
  th: "px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap",
  td: "px-3 py-3 align-top text-sm",
  mono: "font-mono text-xs tabular-nums",
} as const;

export const btn = (variant: "primary" | "secondary" | "ghost" | "danger" = "secondary", extra = "") =>
  `${ui.btn} ${ui[variant]} ${extra}`;

/** Status tiers from the Orion spec: colour carries meaning, never decoration. */
export type Tone = "critical" | "attention" | "routine" | "guidance" | "neutral";
export const TONE: Record<Tone, string> = {
  critical: "bg-rose-50 text-rose-800 border-rose-200",
  attention: "bg-amber-50 text-amber-900 border-amber-200",
  routine: "bg-emerald-50 text-emerald-800 border-emerald-200",
  guidance: "bg-sky-50 text-sky-900 border-sky-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
};
