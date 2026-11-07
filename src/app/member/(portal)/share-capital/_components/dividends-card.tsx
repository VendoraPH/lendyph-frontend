"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { CREDITED_TO, DIVIDEND_STATUS, sortDividends } from "@/lib/portal/engagement";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import { StatusPill } from "../../../_components/portal-shell";

/** Interest on share capital and patronage refunds, one row per year. */
export function DividendsCard() {
  const fetcher = useCallback(() => portalService.dividends(), []);
  const resource = useApiResource(fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dividends and patronage refunds</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/share-capital/dividends"]}
          summary="Your yearly dividends and patronage refunds."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No dividends or patronage refunds have been declared for you yet."
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Dividend</TableHead>
                    <TableHead className="text-right">Patronage refund</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortDividends(rows).map((row) => {
                    const status = DIVIDEND_STATUS[row.status] ?? DIVIDEND_STATUS.pending;
                    return (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.dividend)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.patronage_refund)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                        <TableCell>
                          <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.credited_to ? CREDITED_TO[row.credited_to] : "—"}
                          {row.paid_at && ` · ${formatDate(row.paid_at)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
