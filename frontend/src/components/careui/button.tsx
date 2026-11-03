/**
 * @name button
 * @description Displays a button or a component that looks like a button.
 * @dependencies @base-ui/react class-variance-authority
 * @type registry:ui
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 px-3 whitespace-nowrap rounded-lg border border-transparent bg-clip-padding text-sm font-medium outline-0 select-none shrink-0 transition touch-action-manipulation [-webkit-tap-highlight-color:transparent] group/button [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA2D0B] aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#BA2D0B] text-white shadow-xs hover:bg-[#a02609] active:bg-[#851e06]",
        secondary:
          "border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 active:bg-gray-100",
        tertiary:
          "bg-gray-100 text-gray-800 hover:bg-gray-200",
        outline:
          "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs",
        obsidian:
          "bg-black text-white shadow-xs hover:bg-neutral-800 active:bg-neutral-900",
        ghost:
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        link:
          "text-[#BA2D0B] underline underline-offset-4 hover:underline hover:text-[#a02609]",
        destructive:
          "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200",
        "destructive-solid":
          "border border-[#BA2D0B] bg-[#BA2D0B] text-white shadow-xs hover:bg-[#a02609] active:bg-[#851e06]",
      },
      size: {
        default: "h-10 px-4 text-sm",
        xs: "h-7 gap-1 px-2.5 rounded-sm text-xs",
        sm: "h-8.5 gap-1.5 px-3 rounded-md text-xs",
        lg: "h-11 gap-2 px-5 text-base rounded-md",
        xl: "h-12 gap-2.5 px-6 text-base rounded-md",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm",
        "icon-sm": "size-8.5 rounded-md",
        "icon-lg": "size-11 rounded-md",
        "icon-xl": "size-12 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type RenderProp =
  | React.ReactElement
  | ((props: unknown, state: unknown) => React.ReactElement)
  | undefined;

function resolveAsChild(
  asChild: boolean | undefined,
  children: React.ReactNode,
  render: RenderProp
): {
  render: RenderProp;
  children: React.ReactNode;
  isNonButtonTag: boolean;
} {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      children?: React.ReactNode;
      [key: string]: unknown;
    }>;
    const { children: extractedChildren, ...restProps } = child.props;
    return {
      render: React.createElement(child.type as React.ElementType, restProps),
      children: extractedChildren,
      isNonButtonTag: typeof child.type === "string" && child.type !== "button",
    };
  }
  return { render, children, isNonButtonTag: false };
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild,
  render,
  nativeButton,
  children,
  ...props
}: Omit<ButtonPrimitive.Props, "render"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    render?: RenderProp;
  }) {
  const resolved = resolveAsChild(asChild, children, render);

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      render={resolved.render}
      nativeButton={nativeButton ?? !resolved.isNonButtonTag}
      {...props}
    >
      {resolved.children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
