/**
 * @name input
 * @description A text input component for forms and user data entry with built-in styling and accessibility features.
 * @dependencies none
 * @registryDependencies use-auto-space
 * @type registry:ui
 */
import * as React from "react";

import { cn } from "@/lib/utils";
import { useAutoSpace } from "@/hooks/use-auto-space";

/** Input types where auto-spacing must never run. */
const SKIP_TYPES = new Set([
  "email",
  "number",
  "url",
  "password",
  "search",
  "tel",
]);

function Input({
  className,
  type,
  autoSpace = false,
  ...props
}: React.ComponentProps<"input"> & {
  autoSpace?: boolean;
}) {
  const handleBeforeInput = useAutoSpace(
    autoSpace && !SKIP_TYPES.has(type ?? "")
  );

  return (
    <input
      type={type}
      autoComplete="off"
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-2xs transition-[color,box-shadow] outline-none focus-visible:border-[#BA2D0B] focus-visible:ring-2 focus-visible:ring-[#BA2D0B]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onBeforeInput={handleBeforeInput}
      {...props}
    />
  );
}

export { Input };
