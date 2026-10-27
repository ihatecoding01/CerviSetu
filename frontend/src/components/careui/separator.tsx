/**
 * @name separator
 * @description Visually or semantically separates content.
 * @dependencies @base-ui/react class-variance-authority
 * @type registry:ui
 */
import { cva, type VariantProps } from "class-variance-authority";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@/lib/utils";

const separatorVariants = cva(
  "shrink-0 data-horizontal:w-full data-vertical:self-stretch",
  {
    variants: {
      variant: {
        solid: "bg-gray-200 data-horizontal:h-px data-vertical:w-px",
        dashed:
          "border-gray-200 border-dashed data-horizontal:h-0 data-horizontal:border-t data-vertical:w-0 data-vertical:border-l",
      },
    },
    defaultVariants: {
      variant: "solid",
    },
  }
);

function Separator({
  className,
  orientation = "horizontal",
  variant,
  ...props
}: SeparatorPrimitive.Props & VariantProps<typeof separatorVariants>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(separatorVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Separator, separatorVariants };
