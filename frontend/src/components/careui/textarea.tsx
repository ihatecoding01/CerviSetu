/**
 * @name textarea
 * @description Displays a form textarea with CareUI styling.
 * @dependencies none
 * @registryDependencies use-auto-space
 * @type registry:ui
 */
import * as React from "react";

import { useAutoSpace } from "@/hooks/use-auto-space";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  autoSpace = false,
  onBeforeInput,
  ...props
}: React.ComponentProps<"textarea"> & { autoSpace?: boolean }) {
  const handleAutoSpace = useAutoSpace(autoSpace);
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-16 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-2xs transition-[color,box-shadow] outline-none focus-visible:border-[#BA2D0B] focus-visible:ring-2 focus-visible:ring-[#BA2D0B]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onBeforeInput={(e) => {
        handleAutoSpace(e);
        onBeforeInput?.(e);
      }}
      {...props}
    />
  );
}

export { Textarea };
