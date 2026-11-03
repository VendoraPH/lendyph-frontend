"use client";

import Link from "next/link";
import { usePermission } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatRate } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import type { InterestPostingRow, InterestTotals as Totals } from "@/types/savings";

/** The server's totals for a preview or batch; never summed from the rows. */
export function InterestTotals({ totals }: { totals: Totals }) {
  const cards = [
    { label: "Accounts in scope", value: formatCount(totals.accounts) },
    { label: "Earning interest", value: formatCount(totals.eligible_accounts) },
    { label: "Total interest", value: formatCurrency(totals.total_interest) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-semibold tabular-nums">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const basisLabel = (basis: InterestPostingRow["day_count_basis"]) => (basis === "actual" ? "Actual" : "365");

/**
 * Per-account figures with the inputs that produced them (average daily
 * balance, eligible days, rate, basis), so a reviewer can check any row.
 */
export function InterestRows({ rows }: { rows: InterestPostingRow[] }) {
  // An approver may review batches without `savings:view`, which the account page needs.
  const canViewAccounts = usePermission().can("savings:view");
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No savings accounts fall in this period and scope.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account no.</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Avg. daily balance</TableHead>
              <TableHead className="text-right">Days earned</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Interest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.account_id}>
                <TableCell>
                  {canViewAccounts ? (
                    <Link href={`/savings/accounts/${r.account_id}`} className="font-mono underline-offset-2 hover:underline">
                      {r.account_number}
                    </Link>
                  ) : (
                    <span className="font-mono">{r.account_number}</span>
                  )}
                </TableCell>
                <TableCell>{r.member_name}</TableCell>
                <TableCell>{r.product_name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.average_daily_balance)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.eligible_days} / {r.days_in_period}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(r.rate)}%</TableCell>
                <TableCell>{basisLabel(r.day_count_basis)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(r.interest_amount)}
                  {r.skip_reason && <p className="text-xs font-normal text-muted-foreground">{r.skip_reason}</p>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
