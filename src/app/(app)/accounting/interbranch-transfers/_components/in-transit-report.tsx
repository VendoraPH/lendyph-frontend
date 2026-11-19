"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollBox } from "@/components/common/page-fill";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
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
 */
export function InTransitReport({ report, canCreate, onAction, onSendBack }: InTransitReportProps) {
  const accounts = report.clearing_accounts.map((a) => `${a.code} ${a.name}`).join(", ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">
        As of {formatDate(report.as_of)}
        {accounts ? `, on ${accounts}` : ""}. A transfer approved and not yet received keeps Interbranch Clearing
        open, so its age is the thing to watch.
      </p>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="text-sm font-medium">In transit ({report.transfers.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {report.transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is in transit.</p>
          ) : (
            <ScrollBox>
              <TransfersTable
                rows={report.transfers}
                canCreate={canCreate}
                onAction={onAction}
                onSendBack={onSendBack}
                showAge
              />
            </ScrollBox>
          )}
        </CardContent>
      </Card>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Net interbranch position by branch</CardTitle>
        </CardHeader>
        <CardContent>
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
            <TableFooter>
              <TableRow>
                <TableCell>Total on Interbranch Clearing</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {centavosOrDash(report.total_clearing_balance)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Total in transit</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{centavosOrDash(report.total_in_transit)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Difference</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{centavosOrDash(report.difference)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {report.difference === null
              ? "The difference is shown to head office only: your branches see only their side of each transfer."
              : "The difference reads ₱0.00 while nothing but transfers posts to Interbranch Clearing."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
