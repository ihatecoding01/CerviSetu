/**
 * @name alert
 * @description Displays a callout for user attention in medical diagnoses, warnings, and error reporting.
 * @dependencies class-variance-authority
 * @type registry:ui
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group/alert relative w-full text-sm border rounded-xl p-4 grid gap-1.5 [&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-white border-gray-200 text-gray-900 shadow-xs",
        destructive:
          "bg-[#FFF1F0] border-[#FED7D7] text-[#771D1D] [&_[data-slot=alert-description]]:text-[#991B1B]",
        info: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF] [&_[data-slot=alert-description]]:text-[#2563EB]",
        success:
          "bg-[#F0FDF4] border-[#BBF7D0] text-[#065F46] [&_[data-slot=alert-description]]:text-[#166534]",
        warning:
          "bg-[#FEF9C3] border-[#FDE047] text-[#78350F] [&_[data-slot=alert-description]]:text-[#92400E]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold tracking-tight text-sm",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-slate-300 text-sm leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "flex flex-wrap gap-2 pt-2",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
