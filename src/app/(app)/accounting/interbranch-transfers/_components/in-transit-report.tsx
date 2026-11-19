"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollBox } from "@/components/common/page-fill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { FIT_CLASSES } from "@/lib/page-fill";
import type { InterbranchInTransitReport, InterbranchTransfer } from "@/types/interbranch-transfer";
import { centavosOrDash } from "../../_lib/server-figure";
import type { TransferActionButton } from "../_lib/transfers";
import { TransfersTable } from "./transfers-table";

interface InTransitReportProps {
  report: InterbranchInTransitReport;
  canCreate: boolean;
  onAction: (transfer: InterbranchTransfer, action: TransferActionButton) => void;
  onSendBack: (transfer: InterbranchTransfer) => void;
}

/**
 * What is in transit, oldest first, with each transfer's age, and each
 * branch's net interbranch position (its balance on the clearing accounts:
 * sent less received). Every figure and total is the server's.
 *
 * One scroll box holds both tables, each under its own heading, so every row
 * stays readable on a short screen. `data-unpinned`: nothing pins inside it,
 * so no heading or total ever covers another. The totals are one plain block.
 */
export function InTransitReport({ report, canCreate, onAction, onSendBack }: InTransitReportProps) {
  const accounts = report.clearing_accounts.map((a) => `${a.code} ${a.name}`).join(", ");

  return (
    <Card className={FIT_CLASSES.section}>
      <CardContent className={FIT_CLASSES.section}>
        <ScrollBox>
          <div data-unpinned="" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              As of {formatDate(report.as_of)}
              {accounts ? `, on ${accounts}` : ""}. A transfer approved and not yet received keeps Interbranch
              Clearing open, so its age is the thing to watch.
            </p>

            <section aria-labelledby="ibt-in-transit-heading" className="space-y-2">
              <h2 id="ibt-in-transit-heading" className="text-sm font-medium">
                In transit ({report.transfers.length})
              </h2>
              {report.transfers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing is in transit.</p>
              ) : (
                <TransfersTable
                  rows={report.transfers}
                  canCreate={canCreate}
                  onAction={onAction}
                  onSendBack={onSendBack}
                  showAge
                />
              )}
            </section>

            <section aria-labelledby="ibt-positions-heading" className="space-y-2">
              <h2 id="ibt-positions-heading" className="text-sm font-medium">
                Net interbranch position by branch
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Net position (sent less received)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.branches.map((row) => (
                    <TableRow key={row.branch_id ?? "none"}>
                      <TableCell>{row.branch_name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {centavosOrDash(row.net_interbranch_position)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <dl className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt>Total on Interbranch Clearing</dt>
                  <dd className="font-mono tabular-nums">{centavosOrDash(report.total_clearing_balance)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Total in transit</dt>
                  <dd className="font-mono tabular-nums">{centavosOrDash(report.total_in_transit)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-1 font-medium">
                  <dt>Difference</dt>
                  <dd className="font-mono tabular-nums">{centavosOrDash(report.difference)}</dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground">
                {report.difference === null
                  ? "The difference is shown to head office only: your branches see only their side of each transfer."
                  : "The difference reads ₱0.00 while nothing but transfers posts to Interbranch Clearing."}
              </p>
            </section>
          </div>
        </ScrollBox>
      </CardContent>
    </Card>
  );
}
