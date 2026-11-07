"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/portal/engagement";
import { humanize, TONE_CLASS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { StaffSupportTicket, TicketStatus } from "@/types/portal";
import { TicketReplyDialog } from "./ticket-reply-dialog";

/** Server-paged questions members sent from the portal's Help page. */
export function SupportTicketsTable() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("submitted");
  const [replying, setReplying] = useState<StaffSupportTicket | null>(null);

  const fetcher = useCallback(
    () =>
      portalAdminService.tickets({
        page,
        per_page: perPage,
        status: status || undefined,
        search: search || undefined,
      }),
    [page, perPage, status, search],
  );
  const resource = useApiResource(fetcher);
  const rows = resource.data?.data ?? [];
  const total = resource.data?.meta?.total ?? rows.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-56 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search tickets"
            placeholder="Search member, reference or subject, then press Enter"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TicketStatus | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {TICKET_STATUS[s].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {resource.unavailable && (
        <p className="text-sm text-muted-foreground">
          Support tickets are not connected yet (GET /portal-admin/support-tickets).
        </p>
      )}
      {resource.error && <p className="text-sm text-destructive">{resource.error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="hidden md:table-cell">Last update</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {resource.loading ? "Loading tickets…" : "No tickets match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => {
                const st = TICKET_STATUS[t.status] ?? { label: humanize(t.status), tone: "muted" as const };
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.reference} · {TICKET_CATEGORIES[t.category] ?? humanize(t.category)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/borrowers/${t.borrower_id}`} className="font-medium hover:underline">
                        {t.member_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{t.member_number}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDateTime(t.updated_at)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[st.tone]}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setReplying(t)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />

      <TicketReplyDialog
        ticket={replying}
        onOpenChange={(open) => !open && setReplying(null)}
        onDone={resource.refetch}
      />
    </div>
  );
}
