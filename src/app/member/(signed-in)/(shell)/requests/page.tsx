"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Pager } from "@/components/portal/pager";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { REQUEST_STATUS, REQUEST_STATUS_TONE, REQUEST_TYPE, labelOf } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { NewRequestDialog } from "./_components/new-request-dialog";

/** The member's requests, newest first (carried over from #513 by Augustin). */
export default function RequestsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const fetcher = useCallback(() => portalService.requests(page), [page]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your requests. Please try again.");

  return (
    <>
      <PortalPageHeader
        title="Requests"
        description="Ask your branch for a withdrawal, a new savings account or a profile change."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New request
          </Button>
        }
      />
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="You haven't sent any requests.">
        {data && (
          <>
            <ul className="space-y-2">
              {data.data.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/member/requests/${row.id}`}
                    className="block rounded-lg border bg-card p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{labelOf(REQUEST_TYPE, row.type)}</span>
                        <span className="block text-sm break-words text-muted-foreground">{row.summary}</span>
                      </span>
                      <StatusPill value={row.status} labels={REQUEST_STATUS} tones={REQUEST_STATUS_TONE} />
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{row.reference}</span>
                      <span>Sent {formatDate(row.created_at)}</span>
                      {row.amount && (
                        <span>
                          <Money value={row.amount} />
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
      <NewRequestDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
