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
          "border-pink-300 bg-pink-100 text-[#9D174D] font-heading font-bold",
        success:
          "border-sky-300 bg-sky-50 text-[#0369A1] font-heading font-bold",
        warning:
          "border-slate-300 bg-slate-100 text-slate-800 font-heading font-bold",
        info:
          "border-sky-300 bg-sky-100 text-[#0369A1] font-heading font-bold",
        destructive:
          "border-pink-400 bg-pink-50 text-[#831843] font-heading font-bold",
        neutral:
          "border-black/15 bg-white text-slate-800 font-heading",
        red:
          "border-pink-300 bg-pink-100 text-[#9D174D] font-heading font-bold",
        orange:
          "border-pink-300 bg-pink-50 text-[#9D174D] font-heading font-bold",
        amber:
          "border-slate-300 bg-slate-100 text-slate-800 font-heading font-bold",
        yellow:
          "border-slate-300 bg-slate-100 text-slate-800 font-heading font-bold",
        green:
          "border-sky-300 bg-sky-50 text-[#0369A1] font-heading font-bold",
        blue:
          "border-sky-300 bg-sky-100 text-[#0369A1] font-heading font-bold",
        indigo:
          "border-sky-300 bg-sky-100 text-[#0369A1] font-heading font-bold",
        purple:
          "border-pink-300 bg-pink-50 text-[#9D174D] font-heading font-bold",
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
        className: "bg-[#9D174D] border-[#9D174D] text-white",
      },
      {
        variant: "success",
        solid: true,
        className: "bg-[#0284C7] border-[#0284C7] text-white",
      },
      {
        variant: "warning",
        solid: true,
        className: "bg-slate-700 border-slate-700 text-white",
      },
      {
        variant: "info",
        solid: true,
        className: "bg-[#0284C7] border-[#0284C7] text-white",
      },
      {
        variant: "destructive",
        solid: true,
        className: "bg-[#9D174D] border-[#9D174D] text-white",
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
