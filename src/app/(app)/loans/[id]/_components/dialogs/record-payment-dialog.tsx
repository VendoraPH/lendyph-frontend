"use client";

import {
  CalendarIcon,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateObj } from "@/lib/format";
import type { RepaymentPreview } from "@/services/repayment.service";
import type { Loan } from "@/types/loan";
import type { AmortizationRow } from "../../_lib/schedule";

export interface LoanSummary {
  outstanding_balance?: number;
  total_paid?: number;
  principal_paid?: number;
  interest_paid?: number;
  overdue_amount?: number;
  penalty_amount?: number;
  next_due_date?: string;
  next_due_amount?: number;
}

interface ScheduleTotals {
  shareCapitalBuildUp: number;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  loanSummary: LoanSummary | null;
  schedule: AmortizationRow[];
  scheduleTotals: ScheduleTotals;
  preview: RepaymentPreview | null;
  previewLoading: boolean;
  paymentDate: Date;
  onPaymentDateChange: (date: Date) => void;
  paymentDatePickerOpen: boolean;
  onPaymentDatePickerOpenChange: (open: boolean) => void;
  paymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
  paymentRemarks: string;
  onPaymentRemarksChange: (value: string) => void;
  paymentMode: "regular" | "advance";
  onPaymentModeChange: (mode: "regular" | "advance") => void;
  advancePeriods: number;
  onAdvancePeriodsChange: (n: number) => void;
  actionLoading: boolean;
  onSubmit: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  loan,
  loanSummary,
  schedule,
  scheduleTotals,
  preview,
  previewLoading,
  paymentDate,
  onPaymentDateChange,
  paymentDatePickerOpen,
  onPaymentDatePickerOpenChange,
  paymentAmount,
  onPaymentAmountChange,
  paymentRemarks,
  onPaymentRemarksChange,
  paymentMode,
  onPaymentModeChange,
  advancePeriods,
  onAdvancePeriodsChange,
  actionLoading,
  onSubmit,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <DollarSign className="h-5 w-5 shrink-0" />
            <span>Record Payment</span>
            {paymentMode === "advance" && (
              <Badge className="bg-blue-600 hover:bg-blue-600 text-white">
                Advance Payment
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="break-words">
            {paymentMode === "advance"
              ? `Recording an advance payment for loan ${loan.loan_account_number || loan.application_number}. Excess will be applied to upcoming scheduled installments.`
              : `Record a repayment for loan ${loan.loan_account_number || loan.application_number}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Loan / dues summary */}
        <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {loan.borrower?.full_name ?? loan.borrower?.name ?? loan.borrower_name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {loan.loan_account_number || loan.application_number} &middot;{" "}
                {loan.loan_product?.name ?? loan.loan_product_name ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
              <p className="text-sm font-bold tabular-nums truncate">
                {formatCurrency(
                  loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0
                )}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">Next Due</p>
              <p className="text-sm font-bold tabular-nums truncate">
                {formatCurrency(loanSummary?.next_due_amount ?? 0)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums truncate",
                  (loanSummary?.overdue_amount ?? 0) > 0 && "text-destructive"
                )}
              >
                {formatCurrency(loanSummary?.overdue_amount ?? 0)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">Penalty</p>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums truncate",
                  (loanSummary?.penalty_amount ?? 0) > 0 && "text-destructive"
                )}
              >
                {formatCurrency(loanSummary?.penalty_amount ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Current Scheduled Payment */}
        {schedule.length > 0 && (() => {
          const current = schedule.find((row) => row.status !== "paid");
          if (!current) return null;
          const hasScb = scheduleTotals.shareCapitalBuildUp > 0;
          const isOverdue = current.status === "overdue";
          const isPartial = current.status === "partial";
          const currentAlloc = (preview?.allocations ?? []).find(
            (a) => a.period === current.period
          );
          const currentApplied =
            currentAlloc?.amount_applied ??
            (currentAlloc?.principal ?? 0) +
              (currentAlloc?.interest ?? 0) +
              (currentAlloc?.penalty ?? 0);
          const currentRemaining = currentAlloc?.remaining_balance ?? 0;
          const willFullySettle =
            !!currentAlloc && currentApplied > 0 && currentRemaining <= 0;
          return (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 shrink-0" />
                  Current Scheduled Payment
                </p>
                {isOverdue ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Overdue
                  </span>
                ) : isPartial ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Partially Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Pending
                  </span>
                )}
              </div>
              <div className="px-3 sm:px-4 py-3 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Period {current.period} &middot; Due
                    </p>
                    <p className="text-base font-semibold truncate">
                      {formatDateObj(current.dueDate)}
                    </p>
                  </div>
                  <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/30 sm:text-right">
                    <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wide font-semibold">
                      Amount to Pay
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                      {formatCurrency(current.totalPayment)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onPaymentAmountChange(current.totalPayment.toFixed(2))}
                      className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
                    >
                      Use this amount →
                    </button>
                  </div>
                </div>

                <div className={cn("grid gap-2", hasScb ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
                  <div className="rounded-md border bg-background p-2 text-center min-w-0">
                    <p className="text-[10px] text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold tabular-nums truncate">
                      {formatCurrency(current.principal)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-2 text-center min-w-0">
                    <p className="text-[10px] text-muted-foreground">Interest</p>
                    <p className="text-sm font-semibold tabular-nums truncate">
                      {formatCurrency(current.interest)}
                    </p>
                  </div>
                  {hasScb && (
                    <div className="rounded-md border bg-background p-2 text-center min-w-0 col-span-2 sm:col-span-1">
                      <p className="text-[10px] text-muted-foreground">SCB</p>
                      <p className="text-sm font-semibold tabular-nums text-brand-orange truncate">
                        {formatCurrency(current.shareCapitalBuildUp)}
                      </p>
                    </div>
                  )}
                </div>

                {currentAlloc && currentApplied > 0 && (
                  <div
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
                      willFullySettle
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    )}
                  >
                    <span className="flex items-start gap-1.5 min-w-0">
                      <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                      <span className="break-words">
                        {willFullySettle
                          ? "This payment fully settles this scheduled period"
                          : `Partial: ${formatCurrency(currentRemaining)} will still be owed for this period`}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap shrink-0">
                      applying {formatCurrency(currentApplied)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Payment mode toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium">Payment Mode</p>
            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => onPaymentModeChange("regular")}
                className={cn(
                  "px-3 py-1 text-xs rounded-sm transition-colors",
                  paymentMode === "regular"
                    ? "bg-background shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => onPaymentModeChange("advance")}
                className={cn(
                  "px-3 py-1 text-xs rounded-sm transition-colors",
                  paymentMode === "advance"
                    ? "bg-background shadow-sm font-semibold text-blue-700 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Advance
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground sm:text-right break-words">
            {paymentMode === "regular"
              ? "Settles current dues — excess cascades automatically"
              : "Pay ahead toward upcoming scheduled installments"}
          </p>
        </div>

        {/* Advance-mode helpers */}
        {paymentMode === "advance" && schedule.length > 0 && (() => {
          const unpaid = schedule.filter((r) => r.status !== "paid");
          if (unpaid.length === 0) return null;
          const sumOfNext = (n: number) =>
            unpaid.slice(0, n).reduce((s, r) => s + r.totalPayment, 0);
          const fillForPeriods = (n: number) => {
            const capped = Math.max(1, Math.min(n, unpaid.length));
            onAdvancePeriodsChange(capped);
            const total = sumOfNext(capped);
            onPaymentAmountChange(total > 0 ? String(total.toFixed(2)) : "");
          };
          return (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  Pay ahead by
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {unpaid.length} unpaid period{unpaid.length === 1 ? "" : "s"} remaining
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6].filter((n) => n <= unpaid.length).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={advancePeriods === n ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs whitespace-nowrap",
                      advancePeriods === n &&
                        "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                    onClick={() => fillForPeriods(n)}
                  >
                    {n} period{n === 1 ? "" : "s"}
                    <span className="ml-1.5 opacity-80 text-[10px] tabular-nums">
                      ({formatCurrency(sumOfNext(n))})
                    </span>
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={advancePeriods === unpaid.length ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs whitespace-nowrap",
                    advancePeriods === unpaid.length &&
                      "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                  onClick={() => fillForPeriods(unpaid.length)}
                >
                  Pay all remaining
                  <span className="ml-1.5 opacity-80 text-[10px] tabular-nums">
                    ({formatCurrency(sumOfNext(unpaid.length))})
                  </span>
                </Button>
              </div>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 break-words">
                Tap a preset to auto-fill the amount. You can still edit it
                manually below — the allocation preview will recompute.
              </p>
            </div>
          );
        })()}

        {/* Form */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 pt-2">
          <div className="space-y-1.5 min-w-0">
            <Label>Payment Date <span className="text-red-500">*</span></Label>
            <Popover open={paymentDatePickerOpen} onOpenChange={onPaymentDatePickerOpenChange}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateObj(paymentDate)}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => {
                    if (date) onPaymentDateChange(date);
                    onPaymentDatePickerOpenChange(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="payment-amount">
                Amount <span className="text-red-500">*</span>
              </Label>
              {(() => {
                const currentDue = schedule.find((r) => r.status !== "paid");
                if (!currentDue) return null;
                const suggested = currentDue.totalPayment;
                if (suggested <= 0) return null;
                return (
                  <button
                    type="button"
                    onClick={() => onPaymentAmountChange(suggested.toFixed(2))}
                    className="text-[10px] font-medium text-brand-orange hover:underline tabular-nums"
                  >
                    Use {formatCurrency(suggested)}
                  </button>
                );
              })()}
            </div>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => onPaymentAmountChange(e.target.value)}
              className="w-full"
            />
            {paymentAmount && Number(paymentAmount) > 0 && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Borrower will pay{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(paymentAmount))}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2 min-w-0">
            <Label htmlFor="payment-remarks">Remarks (optional)</Label>
            <Textarea
              id="payment-remarks"
              placeholder="Add notes about this payment..."
              value={paymentRemarks}
              onChange={(e) => onPaymentRemarksChange(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Payment Application Order */}
        {(() => {
          const loanHasScb = (loan?.scb_amount ?? 0) > 0;
          const steps: Array<{
            n: number;
            label: string;
            hint: string;
            cls: string;
          }> = [
            {
              n: 1,
              label: "Penalty",
              hint: "Late-payment fees first",
              cls: "border-destructive/40 bg-destructive/5 text-destructive",
            },
            {
              n: 2,
              label: "Overdue Interest",
              hint: "Interest on missed periods",
              cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
            },
            {
              n: 3,
              label: "Current Interest",
              hint: "Interest for the current period",
              cls: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
            },
            {
              n: 4,
              label: "Current Principal",
              hint: "Principal for the current period",
              cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
            },
            loanHasScb
              ? {
                  n: 5,
                  label: "SCB (Excess)",
                  hint: "Share Capital Build-Up credit",
                  cls: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
                }
              : {
                  n: 5,
                  label: "Next Interest",
                  hint: "Advance toward next period",
                  cls: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
                },
            {
              n: 6,
              label: loanHasScb ? "Next Interest" : "Next Principal",
              hint: loanHasScb
                ? "If SCB is settled, future periods next"
                : "Advance principal reduction",
              cls: "border-muted-foreground/30 bg-muted/40 text-foreground",
            },
          ];
          return (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">Payment Application Order</p>
                <span className="text-[10px] text-muted-foreground">
                  how each ₱ paid is distributed
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {steps.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "rounded-md border px-2 py-1 text-[10px] font-medium flex items-center gap-1.5",
                        s.cls
                      )}
                    >
                      <span className="inline-flex items-center justify-center rounded-full bg-background/80 size-4 text-[9px] font-bold">
                        {s.n}
                      </span>
                      <span className="whitespace-nowrap">{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <span className="text-[10px] text-muted-foreground">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                The system applies the entered amount in this order. Each
                bucket must be fully covered before excess flows to the
                next. {loanHasScb
                  ? "Because this loan has SCB, leftover after current dues credits the borrower's Share Capital before advancing future periods."
                  : "This loan has no SCB, so leftover after current dues advances directly to upcoming periods."}
              </p>
            </div>
          );
        })()}

        {/* Allocation Preview */}
        {preview && Number(paymentAmount) > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                  <CreditCard className="size-4 shrink-0" />
                  <span>Payment Allocation</span>
                  {previewLoading && (
                    <span className="text-[10px] font-normal text-muted-foreground">checking…</span>
                  )}
                  {!previewLoading && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Server-verified
                    </Badge>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Penalty</p>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums truncate",
                      (preview.total_penalty ?? 0) > 0 && "text-destructive"
                    )}
                  >
                    {formatCurrency(preview.total_penalty ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Interest</p>
                  <p className="text-sm font-semibold tabular-nums truncate">
                    {formatCurrency(preview.total_interest ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-2 sm:p-3 text-center min-w-0">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Principal</p>
                  <p className="text-sm font-semibold tabular-nums truncate">
                    {formatCurrency(preview.total_principal ?? 0)}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-2 sm:p-3 text-center min-w-0",
                    (preview.excess ?? 0) > 0 &&
                      "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                  )}
                >
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Excess / SCB</p>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums truncate",
                      (preview.excess ?? 0) > 0 && "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {formatCurrency(preview.excess ?? 0)}
                  </p>
                </div>
              </div>

              {Array.isArray(preview.allocations) && preview.allocations.length > 0 && (() => {
                const loanHasScb = (loan?.scb_amount ?? 0) > 0;
                const periodScb = (period: number | undefined) => {
                  if (typeof period !== "number") return 0;
                  const row = schedule.find((r) => r.period === period);
                  return row?.shareCapitalBuildUp ?? 0;
                };
                return (
                <div className="rounded-lg border overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Receipt className="size-3.5 shrink-0" />
                      Schedule Periods Covered
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {preview.allocations.length} period
                      {preview.allocations.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto -mx-px">
                    <Table className={cn("min-w-[640px]", loanHasScb && "min-w-[720px]")}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center text-[10px] uppercase">#</TableHead>
                          <TableHead className="text-[10px] uppercase">Due Date</TableHead>
                          <TableHead className="text-right text-[10px] uppercase">Principal</TableHead>
                          <TableHead className="text-right text-[10px] uppercase">Interest</TableHead>
                          {loanHasScb && (
                            <TableHead className="text-right text-[10px] uppercase">SCB</TableHead>
                          )}
                          <TableHead className="text-right text-[10px] uppercase">Penalty</TableHead>
                          <TableHead className="text-right text-[10px] uppercase">Applied</TableHead>
                          <TableHead className="text-right text-[10px] uppercase">Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.allocations.map((a, idx) => {
                          const applied =
                            a.amount_applied ??
                            (a.principal ?? 0) + (a.interest ?? 0) + (a.penalty ?? 0);
                          const remaining = a.remaining_balance ?? 0;
                          const isFullySettled = remaining <= 0 && applied > 0;
                          return (
                            <TableRow key={`${a.schedule_id ?? idx}-${a.period ?? idx}`}>
                              <TableCell className="text-center text-xs font-medium">
                                {a.period ?? idx + 1}
                              </TableCell>
                              <TableCell className="text-xs">
                                {a.due_date ? formatDate(a.due_date) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {formatCurrency(a.principal ?? 0)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {formatCurrency(a.interest ?? 0)}
                              </TableCell>
                              {loanHasScb && (
                                <TableCell className="text-right text-xs tabular-nums text-brand-orange">
                                  {formatCurrency(periodScb(a.period))}
                                </TableCell>
                              )}
                              <TableCell
                                className={cn(
                                  "text-right text-xs tabular-nums",
                                  (a.penalty ?? 0) > 0 && "text-destructive"
                                )}
                              >
                                {formatCurrency(a.penalty ?? 0)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums">
                                {formatCurrency(applied)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {isFullySettled ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    Settled
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {formatCurrency(remaining)}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {!loanHasScb && (
                    <div className="px-3 py-2 bg-muted/20 border-t text-[11px] text-muted-foreground">
                      This loan has no Share Capital Build-Up configured, so
                      the SCB column is hidden. Loans with SCB will show a
                      per-period SCB column here.
                    </div>
                  )}
                </div>
                );
              })()}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    New Outstanding Balance
                  </p>
                  <p className="text-lg font-bold tabular-nums break-words">
                    {formatCurrency(
                      Math.max(
                        0,
                        (loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0) -
                          (preview.total_principal ?? 0)
                      )
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    was{" "}
                    {formatCurrency(
                      loanSummary?.outstanding_balance ?? loan.outstanding_balance ?? 0
                    )}
                  </p>
                </div>

                {(preview.excess ?? 0) > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      Excess → Share Capital / Future Periods
                    </p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums break-words">
                      {formatCurrency(preview.excess ?? 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 break-words">
                      will be applied per allocation rules
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Total Recorded</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(Number(paymentAmount) || 0)}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 sticky bottom-0 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-1">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={onSubmit}
            disabled={actionLoading || !paymentAmount || Number(paymentAmount) <= 0}
          >
            {actionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
