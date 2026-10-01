"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyExact, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { loanService } from "@/services";
import type { Loan, LoanAmortizationBalances } from "@/types/loan";
import { balanceStatus, type BalanceStatus } from "../_lib/amortization-balance-status";
import { ScheduleNotice } from "./schedule-notice";

const STATUS_STYLES: Record<BalanceStatus, string> = {
  paid: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  partial: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
  upcoming: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

/** The request a stored answer belongs to. */
interface Request {
  loanId: number;
  refreshKey: unknown;
  attempt: number;
}

interface AmortizationBalanceTableProps {
  loan: Loan;
  /**
   * Changes whenever the page re-reads the loan's figures. The page passes its
   * summary, which every payment, void and adjustment re-reads, so this table
   * re-reads with it and its footer keeps matching Current Outstanding.
   */
  refreshKey: unknown;
}

/**
 * The Amortization Balance tab's table: what is still owed on each period,
 * per component, exactly as `GET /loans/{id}/amortization-balances` reports
 * it. Nothing is added up or derived here; the footer is the server's totals.
 */
export function AmortizationBalanceTable({ loan, refreshKey }: AmortizationBalanceTableProps) {
  const loanId = loan.id;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    request: Request;
    balances: LoanAmortizationBalances | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const request: Request = { loanId, refreshKey, attempt };
    loanService
      .amortizationBalances(loanId)
      .then((balances) => {
        if (!cancelled) setResult({ request, balances });
      })
      .catch(() => {
        if (!cancelled) setResult({ request, balances: null });
      });
    return () => {
      cancelled = true;
    };
  }, [loanId, refreshKey, attempt]);

  // A refresh keeps the last answer on screen until the new one lands; another
  // loan's answer, or a failure being retried, never stands in.
  const isCurrent =
    result !== null &&
    result.request.loanId === loanId &&
    result.request.refreshKey === refreshKey &&
    result.request.attempt === attempt;
  const balances = result !== null && result.request.loanId === loanId ? result.balances : null;
  const retry = () => setAttempt((n) => n + 1);

  if (balances === null) {
    return <ScheduleNotice load={isCurrent ? "failed" : "loading"} loan={loan} onRetry={retry} />;
  }

  if (balances.periods.length === 0) {
    return <ScheduleNotice load="loaded" loan={loan} onRetry={retry} />;
  }

  const { totals } = balances;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal Balance</TableHead>
            <TableHead className="text-right">Interest Balance</TableHead>
            <TableHead className="text-right">Penalty Balance</TableHead>
            <TableHead className="text-right">Total Balance</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.periods.map((period) => {
            const status = balanceStatus(period);
            return (
              <TableRow key={period.id} className={cn(status === "paid" && "text-muted-foreground/50")}>
                <TableCell className="text-center">{period.period_number}</TableCell>
                <TableCell>{formatDate(period.due_date)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyExact(period.principal.balance)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyExact(period.interest.balance)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", period.penalty.balance > 0 && "text-destructive")}>
                  {formatCurrencyExact(period.penalty.balance)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrencyExact(period.balance)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 capitalize", STATUS_STYLES[status])}
                  >
                    {status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">Total</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatCurrencyExact(totals.principal.balance)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatCurrencyExact(totals.interest.balance)}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatCurrencyExact(totals.penalty.balance)}
            </TableCell>
            <TableCell className="text-right font-bold tabular-nums">
              {formatCurrencyExact(totals.balance)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
