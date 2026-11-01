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
import { usePermission } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";
import { shareCapitalTabView } from "../_lib/share-capital-tab-view";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "—" when the server sent no figure, never a browser stand-in. */
function money(amount: number | null): string {
  return amount === null ? "—" : formatCurrency(amount);
}

interface ShareCapitalTabProps {
  borrowerId: number;
}

export function ShareCapitalTab({ borrowerId }: ShareCapitalTabProps) {
  // The ledger needs `share_capital:view`, which a member's page does not
  // imply. Without it the ledger is not asked for, and the tab says it could
  // not be read rather than showing an empty ledger (see `failed` below).
  const canReadLedger = usePermission().can("share_capital:view");
  const [entries, setEntries] = useState<ShareCapitalLedgerEntry[]>([]);
  const [summary, setSummary] = useState<ShareCapitalMemberPeriod | null>(null);
  const [loading, setLoading] = useState(canReadLedger);
  // Set only when the drain gave up with pages outstanding. The balances and
  // totals are the server's, so they stay right; only the list is short.
  const [shortfall, setShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  // Distinct from `entries.length === 0`, and that distinction is the whole
  // point: a failed request used to land in the same state as a member who has
  // never contributed, so the screen said "No share capital entries found" and
  // showed a ₱0.00 balance for somebody holding six figures.
  const [failed, setFailed] = useState(!canReadLedger);

  const fetchEntries = useCallback(async () => {
    if (!canReadLedger) return;
    setLoading(true);
    try {
      // Drained across pages, with each entry's server `running_balance` and
      // the member's `meta.summary` (credits, debits, ending balance).
      const { rows, truncated, total, summary: period } =
        await shareCapitalService.memberLedger(borrowerId);
      setEntries(rows);
      setSummary(period);
      setShortfall(truncated ? { shown: rows.length, total } : null);
      setFailed(false);
    } catch {
      setEntries([]);
      setSummary(null);
      setShortfall(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [borrowerId, canReadLedger]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Every figure is the server's; nothing is added up here.
  const { rows: entriesWithBalance, totals } = useMemo(
    () => shareCapitalTabView(entries, summary),
    [entries, summary],
  );
  const { totalCredits, totalDebits, balance } = totals;

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
          consequence="The totals and the Balance column are the server's figures over every entry; only the list of entries below is incomplete."
        />
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
            <p className="text-xl font-bold text-green-600 tabular-nums">{money(totalCredits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">
              {totalDebits !== null && totalDebits > 0 ? formatCurrency(totalDebits) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-orange/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-1">Share Capital Balance</p>
            <p className="text-xl font-bold text-brand-orange tabular-nums">{money(balance)}</p>
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
                      {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-green-600">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-semibold">
                      {money(entry.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2} className="text-sm">Total</TableCell>
                  <TableCell className="text-right text-sm text-red-600 tabular-nums">
                    {totalDebits !== null && totalDebits > 0 ? formatCurrency(totalDebits) : ""}
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600 tabular-nums">
                    {money(totalCredits)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {money(balance)}
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
