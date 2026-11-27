"use client";

import { allStatusCount } from "@/lib/loan-origination";
import { cn } from "@/lib/utils";

/**
 * A row of status chips. Counts come from the server's `meta.stats` (every
 * status, ignoring the status filter), never from the rows on this page; the
 * "All" count is its `total`, never a sum of the chips.
 */
export function StatusTabs<S extends string>({
  value,
  statuses,
  labels,
  stats,
  onChange,
}: {
  value: S | undefined;
  statuses: readonly S[];
  labels: Record<S, string>;
  stats: Record<string, number> | undefined;
  onChange: (status: S | undefined) => void;
}) {
  const total = allStatusCount(stats);
  const chip = (key: S | undefined, label: string, count: number | undefined) => (
    <button
      key={key ?? "all"}
      type="button"
      aria-pressed={value === key}
      onClick={() => onChange(key)}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40",
        value === key
          ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </button>
  );
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto py-0.5" role="group" aria-label="Filter by status">
      {chip(undefined, "All", total)}
      {statuses.map((s) => chip(s, labels[s], stats?.[s] ?? (stats ? 0 : undefined)))}
    </div>
  );
}
