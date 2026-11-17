import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ProductFilter } from "./product-filter";

/**
 * The savings product filter, lined up with the other controls of a savings
 * filter row (`items-end`). The filter itself is shared with the reports
 * page and keeps its own spacing there; here its label takes the row's grey
 * label style and spacing, and the bottom margin its `space-y-*` wrapper puts
 * under the select (the select's hidden input comes after the trigger) is
 * dropped. `wrapperClassName` sizes the slot.
 */
export function AlignedProductFilter({
  wrapperClassName,
  ...props
}: ComponentProps<typeof ProductFilter> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn(
        "[&_[data-slot=select-trigger]]:mb-0 [&_label]:mb-1.5 [&_label]:text-muted-foreground",
        wrapperClassName,
      )}
    >
      <ProductFilter {...props} />
    </div>
  );
}
