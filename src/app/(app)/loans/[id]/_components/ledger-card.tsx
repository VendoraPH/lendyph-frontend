"use client";

import { BookOpen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Loan } from "@/types/loan";
import type { Repayment } from "@/types";

interface LedgerRow extends Repayment {
  principalBal: number;
  interestBal: number;
  scb_paid?: number;
  excess_amount?: number;
}

interface LedgerScheduleTotals {
  interest: number;
}

interface LedgerCardProps {
  loan: Loan;
  rows: LedgerRow[];
  loanReleaseDate: string | null | undefined;
  loading: boolean;
  scheduleTotals: LedgerScheduleTotals;
  actionLoading: boolean;
  onCreateAdjustment: () => void;
  onRecordPayment: () => void;
  onVoidRepayment: (id: number) => void;
}

const ADJUSTMENT_STATUSES = ["released", "ongoing"] as const;
const PAYMENT_STATUSES = ["released", "ongoing", "current", "past_due"] as const;

export function LedgerCard({
  loan,
  rows,
  loanReleaseDate,
  loading,
  scheduleTotals,
  actionLoading,
  onCreateAdjustment,
  onRecordPayment,
  onVoidRepayment,
}: LedgerCardProps) {
  const hasScb = (loan.scb_amount ?? 0) > 0;
  const dash = <span className="text-muted-foreground/40">—</span>;
  const fmtN = (n: number | undefined) =>
    n != null && n > 0 ? formatCurrency(n) : dash;
  const totalCols = hasScb ? 14 : 13;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Ledger
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {(ADJUSTMENT_STATUSES as readonly string[]).includes(loan.status) && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={onCreateAdjustment}
              >
                <Plus className="mr-1 h-3 w-3" />
                New Adjustment
              </Button>
            )}
            {(PAYMENT_STATUSES as readonly string[]).includes(loan.status) && (
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                onClick={onRecordPayment}
              >
                <Plus className="mr-1 h-3 w-3" />
                Record Payment
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : (
          <>
            <p className="px-4 pb-2 text-[11px] text-muted-foreground sm:hidden">
              Swipe horizontally to view all columns →
            </p>
            <div className="overflow-x-auto">
              <table
                className={cn(
                  "w-full border-collapse text-xs",
                  hasScb ? "min-w-[1280px]" : "min-w-[1180px]",
                )}
              >
                <thead>
                  <tr className="border-b bg-muted/50 text-center font-semibold uppercase tracking-wide text-muted-foreground">
                    <th rowSpan={2} className="border-r px-3 py-2 text-left align-middle whitespace-nowrap">Date</th>
                    <th rowSpan={2} className="border-r px-3 py-2 align-middle whitespace-nowrap">Ref No</th>
                    <th colSpan={3} className="border-r border-b px-3 py-1 whitespace-nowrap">Principal</th>
                    <th colSpan={3} className="border-r border-b px-3 py-1 whitespace-nowrap">Interest</th>
                    <th colSpan={2} className="border-r border-b px-3 py-1 whitespace-nowrap">Past Due</th>
                    {hasScb && <th rowSpan={2} className="border-r px-3 py-2 align-middle whitespace-nowrap">SCB</th>}
                    <th rowSpan={2} className="border-r px-3 py-2 align-middle whitespace-nowrap">Others</th>
                    <th colSpan={2} className="border-b px-3 py-1 whitespace-nowrap">Total Paid</th>
                  </tr>
                  <tr className="border-b bg-muted/30 text-center text-muted-foreground">
                    <th className="border-r px-3 py-1 whitespace-nowrap">Debit</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Credit</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Balance</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Debit</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Credit</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Balance</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Penalty</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Interest</th>
                    <th className="border-r px-3 py-1 whitespace-nowrap">Amount</th>
                    <th className="px-3 py-1 text-left whitespace-nowrap">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening entry */}
                  {loanReleaseDate && (
                    <tr className="border-b bg-blue-50/40 dark:bg-blue-950/20">
                      <td className="border-r px-3 py-2 text-left whitespace-nowrap">{formatDate(loanReleaseDate)}</td>
                      <td className="border-r px-3 py-2 text-center text-muted-foreground whitespace-nowrap">—</td>
                      <td className="border-r px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{formatCurrency(loan.principal_amount)}</td>
                      <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                      <td className="border-r px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(loan.principal_amount)}</td>
                      <td className="border-r px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{scheduleTotals.interest > 0 ? formatCurrency(scheduleTotals.interest) : dash}</td>
                      <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                      <td className="border-r px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{scheduleTotals.interest > 0 ? formatCurrency(scheduleTotals.interest) : dash}</td>
                      <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                      <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                      {hasScb && <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>}
                      <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                      <td className="border-r px-3 py-2 text-center text-muted-foreground whitespace-nowrap">-</td>
                      <td className="px-3 py-2 italic text-muted-foreground whitespace-nowrap">Loan released</td>
                    </tr>
                  )}
                  {/* Repayment rows */}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={totalCols} className="px-3 py-6 text-center text-muted-foreground">
                        No repayments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/30",
                          r.status === "voided" && "opacity-50 line-through",
                        )}
                      >
                        <td className="border-r px-3 py-2 text-left whitespace-nowrap">{formatDate(r.payment_date)}</td>
                        <td className="border-r px-3 py-2 text-center text-muted-foreground whitespace-nowrap">
                          {(r as LedgerRow & { receipt_number?: string }).receipt_number ?? `OR-${String(r.id).padStart(6, "0")}`}
                        </td>
                        {/* Principal */}
                        <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                        <td className="border-r px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtN(r.principal_paid)}</td>
                        <td className="border-r px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(r.principalBal)}</td>
                        {/* Interest */}
                        <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                        <td className="border-r px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtN(r.interest_paid)}</td>
                        <td className="border-r px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(r.interestBal)}</td>
                        {/* Past Due */}
                        <td className="border-r px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {r.penalty_paid != null && r.penalty_paid > 0 ? (
                            <span className="text-destructive">{formatCurrency(r.penalty_paid)}</span>
                          ) : dash}
                        </td>
                        <td className="border-r px-3 py-2 text-center whitespace-nowrap">{dash}</td>
                        {/* SCB */}
                        {hasScb && <td className="border-r px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtN(r.scb_paid)}</td>}
                        {/* Others */}
                        <td className="border-r px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtN(r.excess_amount)}</td>
                        {/* Total Paid */}
                        <td className="border-r px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(r.amount_paid)}</td>
                        <td className="px-3 py-2 min-w-[180px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground truncate">{r.remarks || "payment"}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              {r.status === "voided" && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">voided</Badge>
                              )}
                              {r.status !== "voided" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-[10px] text-destructive hover:text-destructive"
                                  onClick={() => onVoidRepayment(r.id)}
                                  disabled={actionLoading}
                                >
                                  Void
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
