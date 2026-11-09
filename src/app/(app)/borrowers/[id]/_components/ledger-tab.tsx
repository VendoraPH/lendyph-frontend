"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, BookOpen, FileText, RefreshCw } from "lucide-react";
import { borrowerService } from "@/services";
import {
  ledgerClosingCells,
  ledgerRowCells,
  memberLedgerReportHref,
  readMemberLedger,
  type MemberLedgerView,
} from "../_lib/ledger-rows";

interface LedgerTabProps {
  borrowerId: number;
}

export function LedgerTab({ borrowerId }: LedgerTabProps) {
  // Null when it could not be read; an empty ledger has an empty `entries`.
  const [ledger, setLedger] = useState<MemberLedgerView | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      // No `per_page`: the endpoint answers every row in one response, with no
      // paginator to bound.
      setLedger(readMemberLedger(await borrowerService.ledger(borrowerId)));
    } catch {
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ledger === null) {
    return (
      <Card>
        <CardContent className="p-0">
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm">
            <p className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              We couldn&rsquo;t load the ledger.
            </p>
            <Button variant="outline" size="sm" onClick={() => void fetchLedger()}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { entries, closing } = ledger;
  const closingCells = ledgerClosingCells(closing);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Subsidiary Ledger Report
          </CardTitle>
          <Link
            href={memberLedgerReportHref(borrowerId)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="mr-2 h-4 w-4" />
            Open in Reports
          </Link>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" />
            <p className="text-sm">No ledger entries found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const cells = ledgerRowCells(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{cells.loan}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{cells.reference}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{cells.debit}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-green-600">
                      {cells.credit}
                      {cells.amountPaid && (
                        <span className="block text-xs text-muted-foreground">
                          Paid {cells.amountPaid}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {cells.balance}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-sm font-medium whitespace-normal">
                  Closing balance
                  <span className="block text-xs font-normal text-muted-foreground">
                    Principal {closingCells.principal} · Interest {closingCells.interest} · Penalty{" "}
                    {closingCells.penalty}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-semibold">
                  {closingCells.balance}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
