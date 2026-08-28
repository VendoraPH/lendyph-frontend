"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Loader2, Landmark, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { shareCapitalService } from "@/services";
import type { ShareCapitalLedgerEntry } from "@/types";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(isNaN(amount) ? 0 : amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ShareCapitalTabProps {
  borrowerId: number;
}

export function ShareCapitalTab({ borrowerId }: ShareCapitalTabProps) {
  const [entries, setEntries] = useState<ShareCapitalLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Set only when the drain gave up with pages outstanding. This tab prints a
  // running balance per row, so a short ledger is not merely a short table:
  // every balance in the Balance column is accumulated from the first entry
  // shown, and if that is not the first entry that EXISTS then every figure in
  // the column is wrong, including the closing one.
  const [shortfall, setShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  // Distinct from `entries.length === 0`, and that distinction is the whole
  // point: a failed request used to land in the same state as a member who has
  // never contributed, so the screen said "No share capital entries found" and
  // showed a ₱0.00 balance for somebody holding six figures.
  const [failed, setFailed] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Drained across pages. `per_page: 9999` was clamped to 100, so a member
      // with a longer ledger saw their hundred most recent entries under a
      // "Share Capital Balance" card that summed only those.
      const { rows, truncated, total } = await shareCapitalService.ledgerListAll({
        borrower_id: borrowerId,
      });
      setEntries(rows);
      setShortfall(truncated ? { shown: rows.length, total } : null);
      setFailed(false);
    } catch {
      setEntries([]);
      setShortfall(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const { totalCredits, totalDebits, balance } = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const e of entries) {
      const amt = parseFloat(String(e.amount ?? 0)) || 0;
      if (e.type === "credit") credits += amt;
      else debits += amt;
    }
    return { totalCredits: credits, totalDebits: debits, balance: credits - debits };
  }, [entries]);

  // Compute running balance
  const entriesWithBalance = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let running = 0;
    return sorted.map((e) => {
      const amt = parseFloat(String(e.amount ?? 0)) || 0;
      running += e.type === "credit" ? amt : -amt;
      return { ...e, runningBalance: running };
    });
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              This member&rsquo;s share capital ledger could not be loaded
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Their balance is unknown, which is not the same as zero — so
              nothing is shown here rather than a ₱0.00 that would read as
              &ldquo;this member has no share capital&rdquo;.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEntries}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shortfall && (
        <IncompleteListNotice
          shown={shortfall.shown}
          total={shortfall.total}
          noun="share capital entries"
          consequence="The totals and the running Balance column below are computed from only the entries that loaded, so every figure in them is understated or overstated by the entries that did not."
        />
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
            <p className="text-xl font-bold text-green-600 tabular-nums">{formatCurrency(totalCredits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">
              {totalDebits > 0 ? formatCurrency(totalDebits) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-orange/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Share Capital Balance</p>
            <p className="text-xl font-bold text-brand-orange tabular-nums">{formatCurrency(balance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Share Capital Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entriesWithBalance.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Landmark className="h-8 w-8 opacity-40" />
              <p className="text-sm">No share capital entries found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesWithBalance.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-red-600">
                      {entry.type === "debit" ? formatCurrency(parseFloat(String(entry.amount ?? 0)) || 0) : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-green-600">
                      {entry.type === "credit" ? formatCurrency(parseFloat(String(entry.amount ?? 0)) || 0) : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-semibold">
                      {formatCurrency(entry.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2} className="text-sm">Total</TableCell>
                  <TableCell className="text-right text-sm text-red-600 tabular-nums">
                    {totalDebits > 0 ? formatCurrency(totalDebits) : ""}
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600 tabular-nums">
                    {formatCurrency(totalCredits)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(balance)}
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
