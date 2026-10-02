"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks";
import { QUEUE_STATUS_META } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { reminderService } from "@/services";
import type { ReminderListFilters, ReminderQueueStatus } from "@/types/reminder";
import { QueueTable } from "../_components/queue-table";
import { ReminderFilters } from "../_components/reminder-filters";

const STATUSES = Object.keys(QUEUE_STATUS_META) as ReminderQueueStatus[];
const PER_PAGE_OPTIONS = [20, 50, 100] as const;

/**
 * Status filters counted from `meta.stats`: global per-status totals,
 * unaffected by this request's own status filter, so every button keeps its
 * number while one is selected. Without stats they still filter, just without
 * counts.
 *
 * Toggle buttons (`role="group"` + `aria-pressed`), not a tablist: they
 * re-query the one table below, like the members and loans status filters.
 */
function StatusFilter({
  value,
  stats,
  onChange,
}: {
  value: ReminderQueueStatus | undefined;
  stats: Record<string, number> | undefined;
  onChange: (status: ReminderQueueStatus | undefined) => void;
}) {
  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : null;
  const tabs: { key: ReminderQueueStatus | undefined; label: string; count: number | null }[] = [
    { key: undefined, label: "All", count: total },
    ...STATUSES.map((s) => ({ key: s, label: QUEUE_STATUS_META[s].label, count: stats ? (stats[s] ?? 0) : null })),
  ];
  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex min-w-max gap-1 px-1" role="group" aria-label="Filter the queue by status">
        {tabs.map((t) => (
          <button
            key={t.label}
            type="button"
            aria-pressed={value === t.key}
            onClick={() => onChange(t.key)}
            title={t.key ? QUEUE_STATUS_META[t.key].description : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40",
              value === t.key ? "border-brand-orange bg-brand-orange/10 font-medium text-brand-orange" : "hover:bg-muted",
            )}
          >
            {t.label}
            {t.count !== null && <span className="ml-1 tabular-nums text-muted-foreground">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReminderQueuePage() {
  const [filters, setFilters] = useState<ReminderListFilters>({ page: 1, per_page: 20 });
  const fetcher = useCallback(() => reminderService.listQueue(filters), [filters]);
  const queue = useApiResource(fetcher);

  return (
    <div className="space-y-4">
      <ReminderFilters value={filters} onChange={setFilters} dates="range" />
      <StatusFilter
        value={filters.status}
        stats={queue.data?.meta.stats}
        onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
      />
      <DataState
        resource={queue}
        summary="The reminder queue will list every scheduled, sending, sent and cancelled reminder once the reminder service is connected."
        endpoints={["GET /reminders/queue"]}
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No reminders match these filters."
      >
        {(res) => (
          <div className="space-y-3">
            <QueueTable items={res.data} />
            <TablePagination
              page={res.meta.current_page}
              perPage={res.meta.per_page}
              total={res.meta.total}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              onPerPageChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
