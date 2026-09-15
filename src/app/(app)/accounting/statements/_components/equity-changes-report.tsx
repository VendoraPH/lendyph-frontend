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
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import type { EquityChanges } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount } from "../../_components/report-section";

interface EquityChangesReportProps {
  from: string;
  to: string;
  branchId?: number;
}

/**
 * How equity moved over the period, line by line.
 *
 * Needs opening balances and the movements between them, which a single
 * trial balance does not carry, so it comes from the server rather than being
 * regrouped client-side like the balance sheet.
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
  const resource = useAccountingResource<EquityChanges>(fetcher);

  return (
    <DataState
      resource={resource}
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
                  <TableRow key={row.label}>
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
    </DataState>
  );
}
