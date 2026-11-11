import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Emphasised, for the figure the card is about. */
  strong?: boolean;
}

/** Label and value pairs as a description list: two columns from `sm` up, stacked on a phone. */
export function DetailList({ items, className }: { items: DetailItem[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-3 border-b border-dashed pb-2 sm:block sm:border-0 sm:pb-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("text-right text-sm break-words sm:text-left", item.strong && "text-base font-semibold")}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
