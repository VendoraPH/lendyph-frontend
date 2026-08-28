"use client";

import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { BorrowerStatus } from "@/types";

type StatusFilter = BorrowerStatus | "all";

/** `null` means "not known yet" — a failed or not-yet-arrived count. */
type StatusCounts = Record<StatusFilter, number | null>;

interface BorrowerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  /**
   * Resets search AND status together. Deliberately one callback rather than
   * the caller firing `onSearchChange("")` then `onStatusFilterChange("all")`:
   * those are two separate state updates, and because search is debounced by
   * 300ms the status half landed first, firing a request that still carried the
   * old search term. The admin saw a wrong result set for ~300ms before a
   * second request corrected it. One callback, one state update, one request.
   */
  onClearFilters: () => void;
  counts: StatusCounts;
}

/**
 * Label per member status. A `Record<BorrowerStatus, string>` rather than a
 * hand-written array: adding a status to `BorrowerStatus` now fails the build
 * here instead of quietly rendering one tab fewer. That is exactly how the
 * previous hand-written list drifted — `statusBadgeColor` picked up `rejected`
 * for free because it is keyed off the model type, while this list did not.
 *
 * `pending` and `rejected` are absent by design, not by omission: they are
 * applications, not members, they are excluded from this list server-side by
 * `members_only=1`, and each has its own top-level tab.
 */
const MEMBER_STATUS_LABELS: Record<BorrowerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...(Object.keys(MEMBER_STATUS_LABELS) as BorrowerStatus[]).map((value) => ({
    value,
    label: MEMBER_STATUS_LABELS[value],
  })),
];

export function BorrowerFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
  counts,
}: BorrowerFiltersProps) {
  const hasFilters = search !== "" || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* `role="group"` + `aria-pressed`, not `tablist`/`tab`: these are toggle
          buttons that re-query the same table. A tablist promises arrow-key
          roving focus, which would be a lie here. Matches the loans page. */}
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="Filter members by status"
      >
        {STATUS_TABS.map((tab) => {
          const selected = statusFilter === tab.value;
          const count = counts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onStatusFilterChange(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 ${
                selected
                  ? "bg-brand-orange text-brand-orange-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs tabular-nums ${
                  selected
                    ? "text-brand-orange-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {/* An em dash, not 0: see the StatCard note on the members page. */}
                {count ?? "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search members"
            placeholder="Search name, ID, phone..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export type { StatusFilter, StatusCounts };
