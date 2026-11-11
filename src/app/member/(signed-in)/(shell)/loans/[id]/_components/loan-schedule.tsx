"use client";

import { useCallback } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { SCHEDULE_STATUS, SCHEDULE_STATUS_TONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { penaltyMonthsText } from "@/lib/portal/words";

/**
 * The loan's schedule as the Amortization Balance tab shows it: each
 * period's principal, interest and penalty still owed, from the server. The
 * footer is the server's total, equal to Outstanding.
 */
export function LoanSchedule({ loanId }: { loanId: number }) {
  const fetcher = useCallback(() => portalService.loanSchedule(loanId), [loanId]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the schedule. Please try again.");

  return (
    <LoadState loading={loading} error={error} onRetry={reload} empty={data?.periods.length === 0} emptyText="This loan has no schedule yet.">
      {data && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">#</TableHead>
                <TableHead scope="col">Due date</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">Principal Balance</TableHead>
                <TableHead scope="col" className="text-right">Interest Balance</TableHead>
                <TableHead scope="col" className="text-right">Penalty Balance</TableHead>
                <TableHead scope="col" className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.periods.map((period) => (
                <TableRow key={period.period_number}>
                  <TableCell>{period.period_number}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(period.due_date)}</TableCell>
                  <TableCell>
                    <StatusPill value={period.status} labels={SCHEDULE_STATUS} tones={SCHEDULE_STATUS_TONE} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={period.principal.balance} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={period.interest.balance} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={period.penalty.balance} />
                    {penaltyMonthsText(period.penalty_months) && (
                      <span className="block text-[10px] text-destructive">{penaltyMonthsText(period.penalty_months)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={period.balance} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">
                  <Money value={data.totals.principal.balance} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={data.totals.interest.balance} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={data.totals.penalty.balance} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={data.totals.balance} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Insurance premium owed: <Money value={data.totals.insurance_owed} />. The total balance includes it and equals Outstanding.
          </p>
        </div>
      )}
    </LoadState>
  );
}
