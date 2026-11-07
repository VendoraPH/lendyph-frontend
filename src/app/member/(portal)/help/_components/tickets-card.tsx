"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/portal/engagement";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { SupportTicket } from "@/types/portal";
import { StatusPill } from "../../../_components/portal-shell";
import { NewTicketDialog } from "./new-ticket-dialog";
import { TicketDialog } from "./ticket-dialog";

export function TicketsCard() {
  const fetcher = useCallback(() => portalService.tickets(), []);
  const resource = useApiResource(fetcher);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">My support tickets</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)} disabled={resource.unavailable}>
          <Plus className="mr-1.5 h-4 w-4" /> Ask a question
        </Button>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={[
            "GET /portal/support-tickets",
            "POST /portal/support-tickets",
            "GET /portal/support-tickets/{id}",
            "POST /portal/support-tickets/{id}/reply",
          ]}
          summary="Questions you sent the cooperative and its answers."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="You have not asked anything yet."
        >
          {(rows) => (
            <ul className="divide-y">
              {rows.map((t) => (
                <TicketRow key={t.id} ticket={t} onOpen={() => setOpenId(t.id)} />
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
      <NewTicketDialog open={creating} onOpenChange={setCreating} onSubmitted={resource.refetch} />
      <TicketDialog ticketId={openId} onClose={() => setOpenId(null)} onChanged={resource.refetch} />
    </Card>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: SupportTicket; onOpen: () => void }) {
  const status = TICKET_STATUS[ticket.status] ?? TICKET_STATUS.open;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/40">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{ticket.subject}</span>
          <span className="block text-xs text-muted-foreground">
            {ticket.reference} · {TICKET_CATEGORIES[ticket.category] ?? ticket.category} · Updated{" "}
            {formatDateTime(ticket.updated_at)}
          </span>
        </span>
        <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
      </button>
    </li>
  );
}
