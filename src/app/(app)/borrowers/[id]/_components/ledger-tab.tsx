"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, BookOpen, FileText } from "lucide-react";
import { borrowerService } from "@/services";
import type { BorrowerLedgerEntry, PaginatedResponse } from "@/types";
import { ledgerRowCells } from "../_lib/ledger-rows";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface LedgerTabProps {
  borrowerId: number;
}

export function LedgerTab({ borrowerId }: LedgerTabProps) {
  const [entries, setEntries] = useState<BorrowerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      // No `per_page`, deliberately. `BorrowerController::ledger()` is not a
      // paginated endpoint at all: it builds the entries in memory from the
      // member's loans and repayments and answers
      // `response()->json(['data' => $withBalance])` — no paginator, no `meta`,
      // no clamp. The `per_page: 200` that used to be here was read by nothing
      // on either side. It was still worth removing rather than leaving: it
      // read as a bound on a list that has none, so the next person to audit
      // this file would either "fix" it to 100 or drain an endpoint that
      // returns everything in one response already.
      //
      // The rows carry the server's running `balance`, which is not shown:
      // it takes whole payments, interest and penalty included, off the
      // principal released, so it matches neither the loan's Principal
      // Balance nor its Outstanding.
      const res = await borrowerService.ledger(borrowerId);
      const items = Array.isArray(res)
        ? (res as BorrowerLedgerEntry[])
        : (res as PaginatedResponse<BorrowerLedgerEntry>)?.data ?? [];
      setEntries(items);
    } catch {
      setEntries([]);
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Subsidiary Ledger Report
          </CardTitle>
          <Link
            href="/reports/subsidiary_ledger"
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
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const cells = ledgerRowCells(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{cells.reference}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{cells.debit}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-green-600">
                      {cells.credit}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
