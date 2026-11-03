/**
 * @name badge
 * @description A badge component for displaying status labels, tags, and notification indicators.
 * @dependencies class-variance-authority lucide-react @base-ui/react
 * @type registry:ui
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md border font-medium w-fit whitespace-nowrap shrink-0 overflow-hidden [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        primary:
          "border-[#BA2D0B]/30 bg-[#BA2D0B]/10 text-[#BA2D0B]",
        success:
          "border-[#DBFE87] bg-[#DBFE87]/30 text-black",
        warning:
          "border-[#F19941]/40 bg-[#F19941]/15 text-[#BA2D0B]",
        info:
          "border-[#90C3CB]/40 bg-[#90C3CB]/20 text-slate-900",
        destructive:
          "border-[#BA2D0B]/30 bg-[#BA2D0B]/10 text-[#BA2D0B]",
        neutral:
          "border-gray-200 bg-gray-100 text-gray-700",
        red:
          "border-[#BA2D0B]/30 bg-[#BA2D0B]/10 text-[#BA2D0B]",
        orange:
          "border-[#F19941]/40 bg-[#F19941]/20 text-black",
        amber:
          "border-[#F19941]/40 bg-[#F19941]/20 text-black",
        yellow:
          "border-[#DBFE87] bg-[#DBFE87]/30 text-black",
        green:
          "border-[#DBFE87] bg-[#DBFE87]/30 text-black",
        blue:
          "border-[#90C3CB]/40 bg-[#90C3CB]/20 text-slate-900",
        indigo:
          "border-[#90C3CB]/40 bg-[#90C3CB]/20 text-slate-900",
        purple:
          "border-slate-200 bg-slate-100 text-black",
      },
      solid: {
        true: "",
        false: "",
      },
      counter: {
        true: "tabular-nums rounded-sm gap-0",
        false: "",
      },
      size: {
        xs: "h-4 text-[10px] px-1.5 [&>svg]:size-2.5",
        sm: "h-5 text-xs px-2 [&>svg]:size-3",
        md: "h-6 text-xs px-2.5 [&>svg]:size-3",
        lg: "h-7 text-sm px-3 [&>svg]:size-3.5",
      },
    },
    compoundVariants: [
      {
        variant: "primary",
        solid: true,
        className: "bg-emerald-600 border-emerald-500 text-white",
      },
      {
        variant: "success",
        solid: true,
        className: "bg-green-600 border-green-500 text-white",
      },
      {
        variant: "warning",
        solid: true,
        className: "bg-amber-600 border-amber-500 text-white",
      },
      {
        variant: "info",
        solid: true,
        className: "bg-indigo-600 border-indigo-500 text-white",
      },
      {
        variant: "destructive",
        solid: true,
        className: "bg-red-600 border-red-500 text-white",
      },
      { counter: true, size: "xs", className: "min-w-4 px-1" },
      { counter: true, size: "sm", className: "min-w-5 px-1" },
      { counter: true, size: "md", className: "min-w-6 px-1.5" },
      { counter: true, size: "lg", className: "min-w-7 px-2" },
    ],
    defaultVariants: {
      variant: "primary",
      solid: false,
      counter: false,
      size: "md",
    },
  }
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>["size"]>;

const semanticVariants: ReadonlySet<BadgeVariant> = new Set([
  "primary",
  "success",
  "warning",
  "info",
  "destructive",
]);

function Badge({
  className,
  variant = "primary",
  size = "md",
  render,
  dot = false,
  solid = false,
  counter = false,
  onClose,
  children,
  ...props
}: useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean;
    solid?: boolean;
    counter?: boolean;
    onClose?: React.MouseEventHandler<HTMLButtonElement>;
  }) {
  const useSolidPalette = Boolean(
    solid && variant && semanticVariants.has(variant)
  );

  return useRender({
    defaultTagName: "span",
    render,
    state: {
      slot: "badge",
      variant,
      solid: solid || undefined,
    },
    props: mergeProps<"span">(
      {
        className: cn(
          badgeVariants({ variant, size, solid: useSolidPalette, counter }),
          onClose && "pe-0",
          className
        ),
        children: (
          <>
            {dot && (
              <span
                data-slot="badge-dot"
                className="size-1.5 shrink-0 rounded-full bg-current mr-1"
                aria-hidden="true"
              />
            )}
            {children}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Remove"
                className="inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center self-stretch rounded-r-sm opacity-60 outline-none hover:bg-current/20 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            )}
          </>
        ),
      },
      props
    ),
  });
}

export { Badge, badgeVariants };
