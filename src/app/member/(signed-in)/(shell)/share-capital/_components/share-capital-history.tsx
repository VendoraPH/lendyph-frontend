"use client";

import { useCallback, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { Pager } from "@/components/portal/pager";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate } from "@/lib/format";
import { isNilAmount } from "@/lib/savings/amount-text";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";

/** The share capital entries, newest first, with the balance after each as the server counts it. */
export function ShareCapitalHistory() {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => portalService.shareCapitalEntries(page), [page]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the history. Please try again.");

  return (
    <SectionCard title="History">
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No share capital entries yet.">
        {data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Date</TableHead>
                  <TableHead scope="col">Details</TableHead>
                  <TableHead scope="col" className="text-right">In</TableHead>
                  <TableHead scope="col" className="text-right">Out</TableHead>
                  <TableHead scope="col" className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((entry, index) => (
                  <TableRow key={`${entry.reference ?? "entry"}-${index}`}>
                    <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                    <TableCell className="min-w-40">
                      {entry.description ?? NONE}
                      {entry.reference && <span className="block text-xs text-muted-foreground">{entry.reference}</span>}
                    </TableCell>
                    <TableCell className="text-right">{isNilAmount(entry.credit) ? NONE : <Money value={entry.credit} />}</TableCell>
                    <TableCell className="text-right">{isNilAmount(entry.debit) ? NONE : <Money value={entry.debit} />}</TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={entry.running_balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
    </SectionCard>
  );
}
