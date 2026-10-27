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
          "border-blue-200 bg-blue-50 text-[#2B66E4]",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800",
        info:
          "border-sky-200 bg-sky-50 text-[#4A91A7]",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700",
        neutral:
          "border-gray-200 bg-gray-100 text-gray-700",
        red:
          "border-rose-200 bg-rose-50 text-rose-700",
        orange:
          "border-orange-200 bg-orange-50 text-orange-700",
        amber:
          "border-amber-200 bg-amber-50 text-amber-800",
        yellow:
          "border-yellow-200 bg-yellow-50 text-yellow-800",
        green:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        blue:
          "border-blue-200 bg-blue-50 text-[#2B66E4]",
        indigo:
          "border-indigo-200 bg-indigo-50 text-indigo-700",
        purple:
          "border-purple-200 bg-purple-50 text-purple-700",
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
