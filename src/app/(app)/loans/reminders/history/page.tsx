"use client";

import { useCallback, useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { DeliveryStatusBadge } from "@/components/reminders/reminder-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { DELIVERY_STATUS_META, TEMPLATE_TYPE_LABELS } from "@/lib/reminders";
import { reminderService } from "@/services";
import type { ReminderHistoryFilters, ReminderMessage } from "@/types/reminder";
import { ReminderFilters, StatusSelect } from "../_components/reminder-filters";
import { MessageDetailSheet } from "./_components/message-detail-sheet";

const PER_PAGE_OPTIONS = [20, 50, 100] as const;

export default function ReminderHistoryPage() {
  const [filters, setFilters] = useState<ReminderHistoryFilters>({ page: 1, per_page: 20 });
  const fetcher = useCallback(() => reminderService.listHistory(filters), [filters]);
  const history = useApiResource(fetcher);
  const [selected, setSelected] = useState<ReminderMessage | null>(null);

  return (
    <div className="space-y-4">
      <ReminderFilters value={filters} onChange={setFilters} dates="range">
        <StatusSelect
          value={filters.status}
          options={DELIVERY_STATUS_META}
          onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
        />
      </ReminderFilters>

      <DataState
        resource={history}
        summary="Every reminder ever sent — the exact text, delivery result and provider reference — will be logged here once the reminder service is connected."
        endpoints={["GET /reminders/history", "GET /reminders/history/{id}"]}
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No messages match these filters."
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* The whole row opens the message for a mouse; the borrower
                      name is a real button, so keyboard and screen-reader
                      users get the same thing with Enter or Space. */}
                  {res.data.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {m.sent_at ? formatDateTime(m.sent_at) : <span className="text-muted-foreground">Not sent</span>}
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => setSelected(m)}
                          className="rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                        >
                          {m.borrower_name}
                          <span className="sr-only">: view message</span>
                        </button>
                      </TableCell>
                      <TableCell>{m.loan_account_number}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          {m.channel === "sms" ? (
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {m.recipient}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.template_type ? TEMPLATE_TYPE_LABELS[m.template_type] : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.source === "manual" ? `Manual${m.created_by_name ? ` · ${m.created_by_name}` : ""}` : "Automatic"}
                      </TableCell>
                      <TableCell>
                        <DeliveryStatusBadge status={m.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

      <MessageDetailSheet message={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
