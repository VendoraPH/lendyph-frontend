"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountingService } from "@/services";
import type { EquityChanges } from "@/types";
import { Amount } from "../../_components/report-section";
import { equityRowKey } from "../_lib/statement-lines";
import { StatementState } from "./statement-state";
import { useStatementResource } from "./use-statement-resource";

interface EquityChangesReportProps {
  from: string;
  to: string;
  branchId?: number;
}

/**
 * How equity moved over the period, line by line.
 *
 * Needs opening balances and the movements between them, so it comes from the
 * server, totals included. The "Earnings not yet closed" row (income less
 * expense not yet closed into equity) is one of the server's rows and reads
 * like the others, so the ending total equals the balance sheet's equity.
 */
export function EquityChangesReport({
  from,
  to,
  branchId,
}: EquityChangesReportProps) {
  const fetcher = useCallback(
    () => accountingService.equityChanges({ from, to, branch_id: branchId }),
    [from, to, branchId],
  );
  const { resource, refusal } = useStatementResource<EquityChanges>(fetcher);

  return (
    <StatementState
      resource={resource}
      refusal={refusal}
      summary="Capital at the start of the period, what was put in and taken out, and where it ended."
      endpoints={["GET /accounting/statements/equity-changes"]}
      isEmpty={(report) => report.rows.length === 0}
      emptyMessage="No equity movement in this period."
    >
      {(report) => (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Beginning</TableHead>
                  <TableHead className="text-right">Additions</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Ending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={equityRowKey(row)}>
                    <TableCell className="text-sm">{row.label}</TableCell>
                    <TableCell className="text-right">
                      <Amount value={row.beginning} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount value={row.additions} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount value={row.deductions} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount value={row.ending} className="font-medium" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right">
                    <Amount value={report.total_beginning} className="font-semibold" />
                  </TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right">
                    <Amount value={report.total_ending} className="font-semibold" />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </StatementState>
  );
}
