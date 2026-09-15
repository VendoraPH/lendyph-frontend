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
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { AccountingBook, BookKind } from "@/types";
import { DataState } from "../../_components/data-state";

interface BookReportProps {
  kind: BookKind;
  from: string;
  to: string;
  branchId?: number;
  /** What this book is for, in the operator's words. */
  summary: string;
  endpoint: string;
}

/**
 * All four books render the same way — date, entry number, particulars,
 * account, debit, credit — because BIR prescribes the columns. One component
 * with a `kind` beats four near-identical tables.
 */
export function BookReport({
  kind,
  from,
  to,
  branchId,
  summary,
  endpoint,
}: BookReportProps) {
  const fetcher = useCallback(
    () => accountingService.book(kind, { from, to, branch_id: branchId }),
    [kind, from, to, branchId],
  );
  const resource = useAccountingResource<AccountingBook>(fetcher);

  return (
    <DataState
      resource={resource}
      summary={summary}
      endpoints={[endpoint]}
      isEmpty={(book) => book.rows.length === 0}
      emptyMessage="Nothing recorded in this book for the chosen dates."
    >
      {(book) => (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-sm text-muted-foreground">
              {formatDate(book.from)} to {formatDate(book.to)} ·{" "}
              {book.rows.length} {book.rows.length === 1 ? "line" : "lines"}
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-32">Entry no.</TableHead>
                    <TableHead className="w-32">Reference</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-32 text-right">Debit</TableHead>
                    <TableHead className="w-32 text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {book.rows.map((row, i) => (
                    <TableRow key={`${row.journal_no}-${i}`}>
                      <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.journal_no}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.reference || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{row.particulars}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.account_code ? (
                          <>
                            <span className="font-mono text-xs">
                              {row.account_code}
                            </span>{" "}
                            {row.account_name}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.debit ? formatCentavos(row.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.credit ? formatCentavos(row.credit) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCentavos(book.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCentavos(book.total_credit)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}
