import React, { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (otp: string) => void;
  // Changing this refocuses the first empty box (new OTP sent, or a wrong code cleared)
  focusKey?: unknown;
  groupLabel: string;
  digitLabel: (n: number) => string;
  invalid?: boolean;
}

// Six single-digit boxes: auto-advance, backspace to previous, paste of a full code
export const OtpBoxes: React.FC<Props> = ({ value, onChange, focusKey, groupLabel, digitLabel, invalid }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  useEffect(() => {
    refs.current[Math.min(value.length, 5)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) {
      onChange(d.slice(0, 6));
      refs.current[Math.min(d.length, 6) - 1]?.focus();
      return;
    }
    onChange(digits.map((c, j) => (j === i ? d || " " : c)).join("").replace(/ /g, ""));
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2" role="group" aria-label={groupLabel}>
      {digits.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={c.trim()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          maxLength={6}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-12 text-center bg-slate-50 border border-slate-300 rounded-xl text-base font-mono text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus:border-black"
        />
      ))}
    </div>
  );
};
