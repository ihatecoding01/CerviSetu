/**
 * @name use-auto-space
 * @description Returns an onBeforeInput handler that auto-inserts a space after punctuation when the next character typed is not a space.
 * @type registry:hook
 */
import * as React from "react";

const PUNCT = new Set([".", ",", "!", "?", ";", ":"]);

/**
 * Returns an `onBeforeInput` handler that auto-inserts a space after
 * punctuation (. , ! ? ; :) when the next character typed is not already
 * a space.
 */
export function useAutoSpace(
  enabled: boolean
): React.FormEventHandler<HTMLInputElement | HTMLTextAreaElement> {
  return React.useCallback(
    (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!enabled) return;

      const event = e.nativeEvent as InputEvent;

      if (event.isComposing) return;

      const char = event.data;

      if (!char || char.length !== 1) return;

      if (/\s/.test(char) || PUNCT.has(char)) return;

      const el = e.currentTarget;
      const cursor = el.selectionStart ?? 0;
      if (cursor === 0) return;

      const prevChar = el.value[cursor - 1];
      if (!PUNCT.has(prevChar)) return;

      if (prevChar === "." && /\d/.test(char)) return;

      if (prevChar === "," && /\d/.test(char)) {
        const beforeComma = cursor >= 2 ? el.value[cursor - 2] : "";
        if (/\d/.test(beforeComma)) return;
      }

      event.preventDefault();
      document.execCommand("insertText", false, " " + char);
    },
    [enabled]
  );
}
