/**
 * @name slider
 * @description A slider component for selecting a value or range (e.g. days overdue simulation).
 * @dependencies @base-ui/react
 * @type registry:ui
 */
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn("w-full py-2", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none cursor-pointer">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-gray-200 relative grow overflow-hidden rounded-full h-2 w-full"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-[#2B66E4] select-none h-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="border-2 border-[#2B66E4] block size-5 shrink-0 rounded-full bg-white shadow-md transition-[color,box-shadow] select-none hover:ring-4 hover:ring-[#2B66E4]/20 focus-visible:ring-4 focus-visible:ring-[#2B66E4]/30 outline-none"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
