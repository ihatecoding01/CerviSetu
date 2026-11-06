/**
 * @name avatar
 * @description An image element with a fallback for representing the user or patient.
 * @dependencies class-variance-authority @base-ui/react
 * @type registry:ui
 */
import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/utils";

function Avatar({
  className,
  size = "default",
  shape = "circle",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg";
  shape?: "circle" | "rounded";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-shape={shape}
      className={cn(
        "relative flex size-9 shrink-0 select-none overflow-hidden",
        size === "sm" && "size-7 text-xs",
        size === "lg" && "size-12 text-base",
        shape === "circle" && "rounded-full",
        shape === "rounded" && "rounded-md",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

const avatarFallbackVariants = cva(
  "flex size-full items-center justify-center font-medium",
  {
    variants: {
      color: {
        default: "bg-slate-100 text-slate-700",
        primary: "bg-pink-50 text-[#9D174D] border border-pink-200",
        warning: "bg-slate-100 text-slate-800 border border-slate-200",
        info: "bg-sky-50 text-[#0369A1] border border-sky-200",
        destructive: "bg-pink-100 text-[#831843] border border-pink-300",
      },
    },
    defaultVariants: {
      color: "default",
    },
  }
);

function AvatarFallback({
  className,
  color = "default",
  ...props
}: AvatarPrimitive.Fallback.Props & VariantProps<typeof avatarFallbackVariants>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants({ color }), className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
