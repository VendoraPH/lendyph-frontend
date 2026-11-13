"use client";

import { useState, useMemo, useEffect } from "react";
import { RouteGuard, PermissionButton } from "@/components/common";
import { PAYMENT_CREATE_GATE } from "@/lib/lending-write-gates";
import { TablePagination } from "@/components/common/table-pagination";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { repaymentService } from "@/services";
import type { RepaymentPreview } from "@/services/repayment.service";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  PhilippinePeso,
  ReceiptText,
  Banknote,
  CreditCard,
  CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Users,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate as formatShortDate, todayISO } from "@/lib/format";
import { INSURANCE_PREMIUM_LABEL } from "@/lib/insurance-premium";
import { currencyOrDash } from "@/lib/report-format";
import {
  dueNowOnDate,
  dueNowPeriodLabel,
  dueNowTiles,
} from "@/lib/payment-figures";
import { getErrorMessage } from "@/lib/api-error";
import {
  ACTIVE_LOANS_PER_PAGE_OPTIONS,
  activeLoanDueCell,
  activeLoanInterestText,
  activeLoanIsDefaulted,
  isDueSoon,
  type ActiveLoan,
} from "./_lib/active-loans";
import { buildPaymentBody, referenceAfterMethodChange } from "./_lib/payment-body";
import { useActiveLoanPage, useSelectedLoan } from "./_lib/use-active-loan-page";
import { allocationPenaltyNote } from "@/lib/penalty-months";
import { PenaltyMonthsNote } from "@/components/common/penalty-months-note";
import { RecoveryPaymentNote } from "@/components/common/recovery-payment-note";
import { LOAN_STATUS_COLORS, LOAN_STATUS_LABELS } from "@/constants/loan-status";
import { checkPaymentAmount } from "./_lib/payment-amount";
import {
  postPaymentErrorMessage,
  previewAllocation,
  previewBadge,
  previewExcessCells,
  previewExcessTiles,
  previewTotalOutstandingAfter,
  previewTotalOutstandingBefore,
} from "./_lib/payment-preview";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return formatShortDate(dateStr);
};

/** The allocation grid's columns on wider screens, by its cell count. */
const ALLOCATION_GRID_COLUMNS: Record<number, string> = {
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

function getLoanPaymentStatus(loan: ActiveLoan) {
  if (loan.overdue_amount > 0)
    return {
      label: "Overdue",
      icon: AlertCircle,
      className: "bg-destructive/10 text-destructive",
    };
  if (!loan.next_due_date) return { label: "Current", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  if (isDueSoon(loan.next_due_date))
    return {
      label: "Due Soon",
      icon: Clock,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  return {
    label: "Current",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

/**
 * One figure at the top of the screen.
 *
 * `value` is pre-formatted so a count and a peso amount can share the card, and
 * null means "not known" — rendered as an em dash rather than 0. A zero here
 * would read as a statement about the coop's portfolio; a load that failed is
 * in no position to make one.
 */
function SummaryCard({
  label,
  value,
  detail,
  icon,
  iconBg,
}: {
  label: string;
  value: string | null;
  /** An optional second figure under the value, already formatted. */
  detail?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", iconBg)}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value ?? "—"}</p>
            {detail && <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function PaymentsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermission();
  // Picking a loan opens Record Payment, so it needs payments:create.
  const canRecordPayment = can(PAYMENT_CREATE_GATE.permission);
  const defaultCollector = user?.full_name || user?.username || "";

  const list = useActiveLoanPage();
  const selected = useSelectedLoan();
  const selectedLoan = selected.loan;
  const selectedLoanId = selectedLoan?.id ?? null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastReceiptId, setLastReceiptId] = useState<number | null>(null);

  // Form state
  // The posted payment_date must be the cashier's calendar day. Deriving it
  // from toISOString() booked every payment taken before 08:00 Manila against
  // yesterday — see todayISO().
  const [paymentDate, setPaymentDate] = useState(todayISO);
  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [collectedBy, setCollectedBy] = useState(defaultCollector);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The server's preview of exactly this payment. It runs the real repayment
  // code and rolls it back, so its allocation and badge are what posting this
  // amount on this date will record; the page no longer estimates either.
  // Kept with the request it answers, so a slow reply for an earlier amount
  // can never stand in for the current one.
  // The amount typed, checked for centavos: more than two decimals shows a
  // message and sends neither the preview nor the payment (the server
  // refuses it too). `sendAmount` is what may be sent, null otherwise.
  const amountCheck = checkPaymentAmount(amountPaid);
  const sendAmount = amountCheck.amount !== null && amountCheck.amount > 0 ? amountCheck.amount : null;
  const previewKey =
    selectedLoanId !== null && sendAmount !== null && paymentDate
      ? `${selectedLoanId}|${sendAmount}|${paymentDate}`
      : null;
  const [previewResult, setPreviewResult] = useState<{
    key: string;
    preview: RepaymentPreview | null;
    error: string | null;
  } | null>(null);
  const currentPreview = previewResult?.key === previewKey ? previewResult : null;
  const serverPreview = currentPreview?.preview ?? null;
  const previewError = currentPreview?.error ?? null;

  // The preview's outstanding balance (everything owed, premium included)
  // before and after this payment; a dash when the server sent none.
  const newOutstandingBalance = previewTotalOutstandingAfter(serverPreview);
  const previousOutstandingBalance = previewTotalOutstandingBefore(serverPreview);
  // What a payment must be today (premium owed plus the open period), with
  // its parts, from the loan; null when the server sent none or the payment
  // is dated another day (the figure is as of today).
  const dueNow = dueNowOnDate(selectedLoan?.amount_due_now ?? null, paymentDate, todayISO());
  const dueNowParts = dueNowTiles(dueNow);

  const displayAllocation = useMemo(
    () => (serverPreview ? previewAllocation(serverPreview) : null),
    [serverPreview]
  );
  const excessTiles = useMemo(
    () => (serverPreview ? previewExcessTiles(serverPreview, selectedLoan?.has_build_up ?? null) : []),
    [serverPreview, selectedLoan?.has_build_up]
  );
  const excessCells = useMemo(
    () => (serverPreview ? previewExcessCells(serverPreview, selectedLoan?.has_build_up ?? null) : []),
    [serverPreview, selectedLoan?.has_build_up]
  );
  const paymentBadge = useMemo(
    () => (serverPreview ? previewBadge(serverPreview) : null),
    [serverPreview]
  );

  useEffect(() => {
    if (!previewKey || selectedLoanId === null || sendAmount === null) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      repaymentService
        .preview(selectedLoanId, { amount_paid: sendAmount, payment_date: paymentDate })
        .then((preview) => {
          if (!cancelled) setPreviewResult({ key: previewKey, preview: preview ?? null, error: null });
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setPreviewResult({ key: previewKey, preview: null, error: getErrorMessage(err) });
          }
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [previewKey, selectedLoanId, sendAmount, paymentDate]);

  function handleSelectLoan(loan: ActiveLoan) {
    selected.select(loan);
    setAmountPaid("");
    setReferenceNumber("");
    setRemarks("");
    setPaymentMethod("cash");
    setCollectedBy(defaultCollector);
    setPaymentDate(todayISO());
    setLastReceiptId(null);
    setDialogOpen(true);
  }

  function resetForm() {
    selected.clear();
    setAmountPaid("");
    setPaymentMethod("cash");
    setReferenceNumber("");
    setRemarks("");
    setCollectedBy(defaultCollector);
    setPaymentDate(todayISO());
    setDialogOpen(false);
  }

  async function handleSubmit() {
    if (!selectedLoan || sendAmount === null) return;
    setIsSubmitting(true);

    try {
      const repayment = await repaymentService.create(
        selectedLoan.id,
        buildPaymentBody({
          paymentDate,
          amount: sendAmount,
          method: paymentMethod,
          referenceNumber,
          remarks,
          collectedBy,
          signedInName: defaultCollector,
        }),
      );

      const receiptId = repayment?.id;
      if (receiptId) setLastReceiptId(receiptId);

      const scbCredited = repayment?.scb_paid ?? 0;
      toast.success("Payment posted", {
        description: scbCredited > 0
          ? `${formatCurrency(sendAmount)} recorded for ${selectedLoan.borrower_name} (${selectedLoan.loan_account_number}). ${formatCurrency(scbCredited)} credited to share capital.`
          : `${formatCurrency(sendAmount)} recorded for ${selectedLoan.borrower_name} (${selectedLoan.loan_account_number})`,
        action: receiptId
          ? { label: "View Receipt", onClick: () => router.push(`/payments/${receiptId}`) }
          : undefined,
      });

      list.reload();
      resetForm();
    } catch (err) {
      toast.error(postPaymentErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsReference = paymentMethod !== "cash";

  // The cards are the server's figures over every active loan (GET /loans
  // `meta.total` and `meta.totals`); a figure it did not send shows a dash.
  // Never add the rows up here.
  const activeLoanCount = list.cards?.total ?? null;
  const overdueCount = list.cards?.totals?.overdue_count ?? null;
  const overdueAmount = list.cards?.totals?.overdue_amount ?? null;
  const totalOutstanding = list.cards?.totals?.total_outstanding ?? null;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Entry</h1>
          <p className="text-sm text-muted-foreground">
            Select a member from the list below to record a payment
          </p>
        </div>
        {lastReceiptId && (
          <Button
            variant="outline"
            onClick={() => router.push(`/payments/${lastReceiptId}`)}
            className="gap-2"
          >
            <ReceiptText className="size-4" />
            View Last Receipt
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active Loans"
          value={activeLoanCount !== null ? String(activeLoanCount) : null}
          icon={<Users className="size-5 text-brand-orange" />}
          iconBg="bg-brand-orange/10"
        />
        <SummaryCard
          label="Overdue"
          value={overdueCount !== null ? String(overdueCount) : null}
          detail={
            overdueCount !== null && overdueAmount !== null
              ? `${formatCurrency(overdueAmount)} overdue`
              : undefined
          }
          icon={<AlertCircle className="size-5 text-destructive" />}
          iconBg="bg-destructive/10"
        />
        <SummaryCard
          label="Total Outstanding"
          value={totalOutstanding !== null ? formatCurrency(totalOutstanding) : null}
          icon={<Banknote className="size-5 text-blue-600" />}
          iconBg="bg-blue-500/10"
        />
      </div>

      {/* Borrower Loan List */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4" />
            Members with Active Loans
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Input
              aria-label="Search active loans"
              placeholder="Search member, account, or product..."
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent>
          {list.error ? (
            // Deliberately NOT the empty state. "No active loans found" after a
            // failed request tells a cashier the member in front of them has
            // nothing to pay, which is a different and much worse claim than
            // "we could not check".
            <div
              role="alert"
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <AlertTriangle className="mb-3 size-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">{list.error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={list.reload}
                className="mt-3 border-brand-orange/50 text-brand-orange hover:bg-brand-orange/5"
              >
                Retry
              </Button>
            </div>
          ) : list.pending && list.rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading loans...
            </div>
          ) : list.rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {list.query
                ? `No active loans found matching "${list.query}"`
                : "No active loans found"}
            </div>
          ) : (
            <>
            <p role="status" className="sr-only">
              {list.pending ? "Loading loans..." : ""}
            </p>
            <div
              aria-busy={list.pending}
              className={cn(
                "rounded-md border overflow-hidden transition-opacity",
                list.pending && "opacity-60",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden sm:table-cell">Loan Product</TableHead>
                    <TableHead className="hidden md:table-cell">Next Due</TableHead>
                    <TableHead className="text-right">Due Amount</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Outstanding</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.rows.map((loan) => {
                    const status = getLoanPaymentStatus(loan);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow
                        key={loan.id}
                        className={cn(
                          "hover:bg-muted/50 transition-colors",
                          canRecordPayment && "cursor-pointer",
                        )}
                        onClick={canRecordPayment ? () => handleSelectLoan(loan) : undefined}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{loan.borrower_name}</p>
                            <p className="text-xs text-muted-foreground">{loan.loan_account_number}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm">{loan.loan_product_name}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{formatDate(loan.next_due_date)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const cell = activeLoanDueCell(loan);
                            return (
                              <div>
                                <p className="text-sm font-semibold tabular-nums">{cell.amount}</p>
                                {cell.penaltyNote && (
                                  <p className="text-[10px] text-destructive">{cell.penaltyNote}</p>
                                )}
                                {cell.insuranceNote && (
                                  <p className="text-[10px] text-muted-foreground">{cell.insuranceNote}</p>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className="text-sm font-medium tabular-nums">
                            {currencyOrDash(loan.total_outstanding)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {activeLoanIsDefaulted(loan) ? (
                            <Badge variant="outline" className={LOAN_STATUS_COLORS.defaulted}>
                              {LOAN_STATUS_LABELS.defaulted}
                            </Badge>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                status.className
                              )}
                            >
                              <StatusIcon className="size-3" />
                              {status.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <PermissionButton
                            permission={PAYMENT_CREATE_GATE.permission}
                            tooltip={PAYMENT_CREATE_GATE.tooltip}
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-brand-orange hover:text-brand-orange-dark"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLoan(loan);
                            }}
                          >
                            Pay
                            <ArrowRight className="size-3" />
                          </PermissionButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={list.page}
              perPage={list.perPage}
              total={list.total}
              perPageOptions={ACTIVE_LOANS_PER_PAGE_OPTIONS}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
            />
            </>
          )}
        </CardContent>
      </Card>

    </div>

    {/* Payment Entry Dialog */}
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        {selectedLoan && (
          <div className="space-y-5">
            <RecoveryPaymentNote status={selectedLoan.status} />

            {/* Loan Summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{selectedLoan.borrower_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLoan.loan_account_number} &middot; {selectedLoan.loan_product_name}
                  </p>
                </div>
                {(() => {
                  const s = getLoanPaymentStatus(selectedLoan);
                  const SIcon = s.icon;
                  return (
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.className)}>
                      <SIcon className="size-3" />
                      {s.label}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                  <p className="text-sm font-bold tabular-nums">{currencyOrDash(selectedLoan.total_outstanding)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    Total Due
                    {dueNowPeriodLabel(dueNow) !== null && (
                      <span className="normal-case"> · {dueNowPeriodLabel(dueNow)}</span>
                    )}
                  </p>
                  <p className="text-sm font-bold tabular-nums">
                    {currencyOrDash(dueNow?.amount)}
                  </p>
                  {selected.loaded && dueNow === null && selectedLoan.amount_due_now !== null && (
                    <p className="text-[10px] text-muted-foreground">Today&apos;s date only</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Next Due Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.next_due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                  <p className="text-sm font-medium">
                    {activeLoanInterestText(selectedLoan)}
                  </p>
                </div>
              </div>

              {/* The table's row carries none of this; say so instead of
                  leaving dashes to read as "nothing owed". */}
              {!selected.loaded && !selected.detailError && (
                <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Loading this loan&apos;s figures...
                </p>
              )}
              {selected.detailError && (
                <div role="alert" className="flex items-center justify-between gap-3 text-xs text-destructive">
                  <span>We couldn&apos;t load this loan&apos;s figures. {selected.detailError}</span>
                  <Button variant="outline" size="sm" onClick={selected.retry}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Total Due's parts, as the server sent them: insurance
                  premium owed first, then penalty, interest, principal and
                  any share capital build-up. */}
              <Separator />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-2">
                  Total Dues Breakdown
                </p>
                <div
                  className={cn(
                    "grid grid-cols-2 gap-2",
                    dueNowParts.length >= 5 ? "sm:grid-cols-5" : dueNowParts.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
                  )}
                >
                  {dueNowParts.map((part) => {
                    const owed = (part.amount ?? 0) > 0;
                    return (
                      <div
                        key={part.key}
                        className={cn(
                          "rounded-md border bg-background p-2 text-center",
                          part.key === "insurance" && "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20",
                          part.key === "penalty" && owed && "border-destructive/30 bg-destructive/5",
                          part.key === "share_capital_build_up" &&
                            "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                        )}
                      >
                        <p className="text-[10px] text-muted-foreground">{part.label}</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            part.key === "insurance" && "text-purple-700 dark:text-purple-300",
                            part.key === "penalty" && owed && "text-destructive",
                            part.key === "share_capital_build_up" && "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {currencyOrDash(part.amount)}
                        </p>
                        {part.key === "penalty" && owed && (
                          <PenaltyMonthsNote note={selectedLoan.penalty_note} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payment-date">
                  Payment Date <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount-paid">
                  Amount Paid <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) =>
                    setAmountPaid(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  aria-invalid={amountCheck.error !== null}
                  aria-describedby={amountCheck.error !== null ? "amount-paid-error" : undefined}
                />
                {amountCheck.error !== null && (
                  <p id="amount-paid-error" role="alert" className="text-xs text-destructive">
                    {amountCheck.error}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Payment Method <span className="text-destructive">*</span>
                </Label>
                <Select
                  items={PAYMENT_METHOD_LABELS}
                  value={paymentMethod}
                  onValueChange={(value) => {
                    if (!value) return;
                    setReferenceNumber((current) => referenceAfterMethodChange(paymentMethod, value, current));
                    setPaymentMethod(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reference-number">
                  Reference Number
                  {needsReference && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  id="reference-number"
                  placeholder={needsReference ? "Required for non-cash payments" : "Optional"}
                  maxLength={100}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="collected-by">Collected By</Label>
                <Input
                  id="collected-by"
                  value={collectedBy}
                  onChange={(e) => setCollectedBy(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Optional notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Allocation Preview */}
            {previewKey && !displayAllocation && (
              <>
                <Separator />
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="size-4" />
                  {previewError
                    ? `Couldn't preview this payment: ${previewError}`
                    : "Working out the allocation…"}
                </p>
              </>
            )}
            {displayAllocation && paymentBadge && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4" />
                      Payment Allocation
                    </p>
                    <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                  </div>

                  {/* Component allocation totals. Insurance premium owed on
                      the loan is collected first, so it leads when there is any. */}
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2",
                      ALLOCATION_GRID_COLUMNS[3 + excessCells.length + (displayAllocation.insuranceApplied > 0 ? 1 : 0)]
                    )}
                  >
                    {displayAllocation.insuranceApplied > 0 && (
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">
                          {INSURANCE_PREMIUM_LABEL}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(displayAllocation.insuranceApplied)}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Penalty</p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          displayAllocation.penaltyApplied > 0 && "text-destructive"
                        )}
                      >
                        {formatCurrency(displayAllocation.penaltyApplied)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Interest</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(displayAllocation.interestApplied)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Principal</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(displayAllocation.principalApplied)}
                      </p>
                    </div>
                    {excessCells.map((cell) => (
                      <div
                        key={cell.key}
                        className={cn(
                          "rounded-lg border p-3 text-center",
                          cell.key === "build_up" &&
                            excessTiles.some((tile) => tile.key === "build_up") &&
                            "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                        )}
                      >
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">{cell.label}</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            cell.key === "build_up" &&
                              excessTiles.some((tile) => tile.key === "build_up") &&
                              "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {cell.amount}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Per-schedule allocation table — shows exactly which
                      amortization periods this payment covers and how much
                      goes to principal/interest/penalty for each. */}
                  {Array.isArray(serverPreview?.allocations) && serverPreview.allocations.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                        <p className="text-xs font-medium flex items-center gap-1.5">
                          <ReceiptText className="size-3.5" />
                          Schedule Periods Covered
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {serverPreview.allocations.length} period{serverPreview.allocations.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center text-[10px] uppercase">#</TableHead>
                              <TableHead className="text-[10px] uppercase">Due Date</TableHead>
                              <TableHead className="text-right text-[10px] uppercase">Principal</TableHead>
                              <TableHead className="text-right text-[10px] uppercase">Interest</TableHead>
                              <TableHead className="text-right text-[10px] uppercase">Penalty</TableHead>
                              <TableHead className="text-right text-[10px] uppercase">Applied</TableHead>
                              <TableHead className="text-right text-[10px] uppercase">Remaining</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {serverPreview.allocations.map((a, idx) => {
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
                                  <TableCell
                                    className={cn(
                                      "text-right text-xs tabular-nums",
                                      (a.penalty ?? 0) > 0 && "text-destructive"
                                    )}
                                  >
                                    {formatCurrency(a.penalty ?? 0)}
                                    <PenaltyMonthsNote
                                      note={allocationPenaltyNote(selectedLoan.schedule_penalties, a)}
                                    />
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
                    </div>
                  )}

                  {/* Outcome summary */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                        New Outstanding Balance
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {currencyOrDash(newOutstandingBalance)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        was {currencyOrDash(previousOutstandingBalance)}
                      </p>
                    </div>

                    {/* No browser shortfall: the server's amount due now,
                        shown when its dated preview calls this payment
                        partial. */}
                    {serverPreview?.payment_badge?.type === "partial" && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                          {dueNow === null ? (
                            // Another date: the server's figure is today's,
                            // so only its verdict for this date shows.
                            <p className="text-lg font-bold text-destructive">Partial</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                                Amount Due Now
                              </p>
                              <p className="text-lg font-bold text-destructive tabular-nums">
                                {currencyOrDash(dueNow.amount)}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                this payment is short of it
                              </p>
                            </>
                          )}
                        </div>
                      )}

                    {excessTiles.map((tile) => (
                      <div
                        key={tile.key}
                        className={cn(
                          "rounded-lg border p-3",
                          tile.key === "build_up"
                            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                            : "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                        )}
                      >
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          {tile.label}
                        </p>
                        <p
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            tile.key === "build_up"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-blue-700 dark:text-blue-400"
                          )}
                        >
                          {formatCurrency(tile.amount)}
                        </p>
                        {tile.note && <p className="text-[10px] text-muted-foreground mt-0.5">{tile.note}</p>}
                      </div>
                    ))}

                    {displayAllocation.nextInterestApplied > 0 && (
                      <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Excess → Next Interest
                        </p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                          {formatCurrency(displayAllocation.nextInterestApplied)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          advance toward upcoming amortization
                        </p>
                      </div>
                    )}

                    {displayAllocation.nextPrincipalApplied > 0 && (
                      <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Excess → Next Principal
                        </p>
                        <p className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                          {formatCurrency(displayAllocation.nextPrincipalApplied)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          advance reduces future principal
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick reconciliation footer */}
                  <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Total Recorded</span>
                    <span className="font-bold tabular-nums">
                      {typeof amountPaid === "number" ? formatCurrency(amountPaid) : "—"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <PermissionButton
                permission="payments:create"
                tooltip="Your role doesn't have permission to record payments"
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark gap-2"
                disabled={
                  isSubmitting ||
                  !selected.loaded ||
                  sendAmount === null ||
                  (needsReference && !referenceNumber.trim())
                }
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <PhilippinePeso className="size-4" />
                    Post Payment
                  </>
                )}
              </PermissionButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// The page is the list of active loans, and `GET /loans` needs `loans:view`.
export default function PaymentsPage() {
  return (
    <RouteGuard permission="payments:view" pageName="Payments">
      <RouteGuard permission="loans:view" pageName="Payments">
        <PaymentsContent />
      </RouteGuard>
    </RouteGuard>
  );
}
