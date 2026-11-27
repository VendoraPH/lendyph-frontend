import { formatCurrency } from "@/lib/format";
import { NONE } from "@/lib/portal/labels";
import { cn } from "@/lib/utils";

/**
 * A server peso figure, shown as ₱ with two decimals. Nothing is worked out
 * here: an absent figure reads "—", never ₱0.00 (round "browser money", item 4).
 */
export function Money({ value, className }: { value: string | null | undefined; className?: string }) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {value === null || value === undefined || value === "" ? NONE : formatCurrency(value)}
    </span>
  );
}
