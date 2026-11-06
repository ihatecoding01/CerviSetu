import { AlertTriangle, ArrowLeft, ArrowRight, Bus, Check, CheckCircle2, Droplet, Flame, Home, PauseCircle, Volume2, X, Zap } from "lucide-react";

const ICONS = {
  check: Check,
  x: X,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  droplet: Droplet,
  alert: AlertTriangle,
  flame: Flame,
  zap: Zap,
  volume: Volume2,
  bus: Bus,
  home: Home,
};

const DOTS = { green: "#0284C7", amber: "#64748B", red: "#9D174D", grey: "#94A3B8" };

const inline = { width: "1em", height: "1em", display: "inline-block", verticalAlign: "-0.14em" } as const;

/** Inline icon sized in em, so it scales with its text and takes the text colour. */
export function Sym({ n }: { n: keyof typeof ICONS }) {
  const Icon = ICONS[n];
  return <Icon aria-hidden="true" strokeWidth={2.25} style={inline} />;
}

/** Small status dot, sized in em. */
export function Dot({ tone }: { tone: keyof typeof DOTS }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-block", width: "0.6em", height: "0.6em", borderRadius: "50%", background: DOTS[tone], marginRight: "0.4em", verticalAlign: "0.05em" }}
    />
  );
}

const STATUS: Record<string, { tone?: keyof typeof DOTS; Icon?: typeof Check; color?: string }> = {
  "🟢": { tone: "green" },
  "🟡": { tone: "amber" },
  "🔴": { tone: "red" },
  "⚪": { tone: "grey" },
  "✅": { Icon: CheckCircle2, color: DOTS.green },
  "⏸": { Icon: PauseCircle, color: DOTS.grey },
};

/** Renders status text such as a coded "🟢 On track" label as a proper dot or icon plus the words. */
export function StatusText({ text }: { text: string }) {
  const marker = Object.keys(STATUS).find((k) => text.startsWith(k));
  if (!marker) return <>{text}</>;
  const { tone, Icon, color } = STATUS[marker];
  const words = text.slice(marker.length).replace(/^[\s️]+/, "");
  return (
    <>
      {tone && <Dot tone={tone} />}
      {Icon && <Icon aria-hidden="true" strokeWidth={2.25} style={{ ...inline, color, marginRight: "0.3em" }} />}
      <span>{words}</span>
    </>
  );
}
