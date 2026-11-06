/**
 * @name card
 * @description Displays a card with header, content, and footer.
 * @dependencies none
 * @type registry:ui
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export type CardVariant = "default" | "pink" | "blue" | "warm" | "subtle" | "table";

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: CardVariant }) {
  const variantClasses = {
    default: "bg-white/95 border-black/15 shadow-2xs",
    pink: "card-gradient-pink border-black/15 shadow-2xs",
    blue: "card-gradient-blue border-black/15 shadow-2xs",
    warm: "card-gradient-warm border-black/15 shadow-2xs",
    subtle: "card-gradient-subtle border-black/15 shadow-2xs",
    table: "card-gradient-table border-black/15 shadow-2xs",
  };

  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card border text-slate-900 flex flex-col gap-5 overflow-hidden rounded-lg py-4 text-sm has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header flex flex-col gap-1 px-4 group-data-[size=sm]/card:px-3.5",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-bold tracking-tight text-slate-900 group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-slate-500 text-xs", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 group-data-[size=sm]/card:px-4", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl px-5 group-data-[size=sm]/card:px-4 border-t border-gray-100 pt-3.5",
        className
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
