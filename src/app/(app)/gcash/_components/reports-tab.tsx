"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency, formatDate } from "@/lib/format";
import type { GCashIncomeReport, GCashPendingItem } from "@/types";
import { PaidButton } from "./paid-button";

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function ReportsTab() {
  const [{ start, end }, setRange] = useState(defaultRange);
  const [report, setReport] = useState<GCashIncomeReport | null>(null);
  const [pending, setPending] = useState<GCashPendingItem[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIncomeLoading(true);
      try {
        const res = await gcashService.incomeReport(start, end);
        if (!cancelled) setReport(res ?? null);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setIncomeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPendingLoading(true);
      try {
        const res = await gcashService.pendingList();
        if (!cancelled) setPending(Array.isArray(res) ? res : []);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Total Income</CardTitle>
          <CardDescription>
            Charges earned on Cash In (when paid) and Cash Out. Pending Cash In
            rows are excluded until they are marked paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={start}
                onChange={(e) =>
                  setRange((p) => ({ ...p, start: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={end}
                onChange={(e) =>
                  setRange((p) => ({ ...p, end: e.target.value }))
                }
              />
            </div>
            <Button variant="ghost" onClick={refresh}>
              Refresh
            </Button>
          </div>

          {incomeLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : report ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  Total Income
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(report.total_income)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Cash In Count
                </div>
                <div className="text-2xl font-semibold">
                  {report.cash_in_count}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Cash Out Count
                </div>
                <div className="text-2xl font-semibold">
                  {report.cash_out_count}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No data for this range.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Payments</CardTitle>
          <CardDescription>
            Cash In transactions awaiting cash collection. Click Paid once the
            member settles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Charge</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Days Pending</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="inline h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : pending.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No pending payments.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.transaction_date)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.reference_no}
                      </TableCell>
                      <TableCell>{p.borrower.full_name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.charge_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.days_pending}
                      </TableCell>
                      <TableCell className="text-right">
                        <PaidButton
                          transactionId={p.id}
                          referenceNo={p.reference_no}
                          onPaid={refresh}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
