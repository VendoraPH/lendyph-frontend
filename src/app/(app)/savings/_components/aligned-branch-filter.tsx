import type { ComponentProps } from "react";
import { BranchFilter } from "@/components/common/branch-filter";
import { cn } from "@/lib/utils";

/**
 * The shared branch filter, lined up with the other controls of a savings
 * filter row (`items-end`). Its own wrapper spaces its children with
 * `space-y-*`, and the select's hidden input comes after the trigger, so the
 * trigger carries a bottom margin that lifted it above its neighbours. That
 * margin is dropped here. `wrapperClassName` sizes the slot (e.g. a flexible
 * width in a row).
 */
export function AlignedBranchFilter({
  wrapperClassName,
  ...props
}: ComponentProps<typeof BranchFilter> & { wrapperClassName?: string }) {
  return (
    <div className={cn("[&_[data-slot=select-trigger]]:mb-0", wrapperClassName)}>
      <BranchFilter {...props} />
    </div>
  );
}
