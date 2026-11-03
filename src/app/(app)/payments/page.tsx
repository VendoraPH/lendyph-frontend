"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionButton } from "@/components/common";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { loanService, repaymentService } from "@/services";
import type { RepaymentPreview } from "@/services/repayment.service";
import type { Loan } from "@/types";
import { useAuth } from "@/hooks/use-auth";
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
import { formatCurrency, formatRate, todayISO } from "@/lib/format";
import { INSURANCE_PREMIUM_LABEL } from "@/lib/insurance-premium";
import { currencyOrDash, toNumber } from "@/lib/report-format";
import {
  dueAmountCell,
  dueNowOnDate,
  dueNowPeriodLabel,
  dueNowTiles,
  readAmountDueNow,
  type AmountDueNow,
} from "@/lib/payment-figures";
import { getErrorMessage } from "@/lib/api-error";
import { fetchAllActiveLoans, type ActiveLoanTotals } from "./_lib/active-loans";
import { checkPaymentAmount } from "./_lib/payment-amount";
import {
  postPaymentErrorMessage,
  previewAllocation,
  previewBadge,
  previewTotalOutstandingAfter,
  previewTotalOutstandingBefore,
} from "./_lib/payment-preview";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface ActiveLoan {
  id: number;
  loan_account_number: string;
  application_number: string;
  borrower_name: string;
  borrower_id: number;
  loan_product_name: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: "fixed" | "diminishing";
  term_months: number;
  payment_frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
  /** Everything owed (principal, interest, penalty, premium); null when not sent. */
  total_outstanding: number | null;
  total_payable: number;
  status: string;
  current_due: number;
  next_due_date: string;
  overdue_amount: number;
  penalty_amount: number;
  /** The server's amount due now and its parts; null when it sent none. */
  amount_due_now: AmountDueNow | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function getLoanPaymentStatus(loan: ActiveLoan) {
  if (loan.overdue_amount > 0)
    return {
      label: "Overdue",
      icon: AlertCircle,
      className: "bg-destructive/10 text-destructive",
    };
  if (!loan.next_due_date) return { label: "Current", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  const dueDate = new Date(loan.next_due_date);
  const today = new Date();
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilDue <= 3)
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
// Map API Loan to local shape
// ---------------------------------------------------------------------------

/** The list row fields this screen reads that `Loan` does not declare. */
type LoanListRow = Loan & { total_outstanding?: number | string | null };

function mapLoanToActiveLoan(loan: Loan): ActiveLoan {
  const l = loan as LoanListRow & Record<string, unknown>;
  // Upon-maturity loans have a single payment due at maturity, so the next due
  // date is the maturity date — never a monthly increment off the release date.
  const isUponMaturity =
    (l.frequency ?? l.payment_frequency) === "upon_maturity" ||
    (l.interest_method ?? l.interest_type) === "upon_maturity";
  const maturityDate = (l.maturity_date as string) || "";
  return {
    id: l.id,
    loan_account_number: l.loan_account_number || `LN-${l.id}`,
    application_number: l.application_number || `LA-${l.id}`,
    borrower_name: l.borrower?.full_name ?? l.borrower?.name ?? l.borrower_name ?? "—",
    borrower_id: l.borrower?.id ?? l.borrower_id ?? 0,
    loan_product_name: l.loan_product?.name ?? l.loan_product_name ?? "—",
    principal_amount: l.principal_amount,
    interest_rate: l.interest_rate,
    interest_type: ((l.interest_method ?? l.interest_type) === "upon_maturity" ? "fixed" : (l.interest_method ?? l.interest_type ?? "fixed")) as ActiveLoan["interest_type"],
    term_months: l.term ?? l.term_months ?? 0,
    payment_frequency: (l.frequency ?? l.payment_frequency ?? "monthly") as ActiveLoan["payment_frequency"],
    total_outstanding: toNumber(l.total_outstanding),
    total_payable: l.total_payable ?? 0,
    status: l.status,
    current_due: (l.current_due as number) || 0,
    next_due_date: isUponMaturity ? maturityDate || l.next_due_date || "" : l.next_due_date || "",
    overdue_amount: (l.overdue_amount as number) || 0,
    penalty_amount: (l.penalty_amount as number) || 0,
    amount_due_now: readAmountDueNow(l.amount_due_now),
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
  const defaultCollector = user?.full_name || user?.username || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
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

  // API-loaded loans
  const [apiLoans, setApiLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);
  // `meta.total` for the same `status=active` query — how many active loans
  // exist, which is not necessarily how many are in `apiLoans`. Null until a
  // response says otherwise, so the cards can decline to state a figure the API
  // has not confirmed rather than printing a confident 0.
  const [activeLoanTotal, setActiveLoanTotal] = useState<number | null>(null);
  // Set only when the page guard stopped the fetch with pages outstanding.
  // Rendered, never swallowed — see the notice below the header.
  const [truncated, setTruncated] = useState(false);
  // GET /loans `meta.totals` for the same query: the server's figures over
  // every active loan. Null until a response carries them.
  const [listTotals, setListTotals] = useState<ActiveLoanTotals | null>(null);
  // A failed load must not look like an empty one. Without this the table falls
  // back to "No active loans found", which tells a cashier standing in front of
  // a member that the member has nothing to pay.
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllActiveLoans((params) =>
        loanService.list(params),
      );
      setApiLoans(result.loans.map(mapLoanToActiveLoan));
      setActiveLoanTotal(result.total);
      setTruncated(result.truncated);
      setListTotals(result.totals);
    } catch (err) {
      console.error("Failed to load active loans", err);
      setApiLoans([]);
      setActiveLoanTotal(null);
      setTruncated(false);
      setListTotals(null);
      setError("We couldn't load the active loans.");
      notifyError(err, "We couldn't load the active loans. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

// Filter loans by search
  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim()) return apiLoans;
    const q = searchQuery.toLowerCase();
    return apiLoans.filter(
      (loan) =>
        loan.loan_account_number.toLowerCase().includes(q) ||
        loan.application_number.toLowerCase().includes(q) ||
        loan.borrower_name.toLowerCase().includes(q) ||
        loan.loan_product_name.toLowerCase().includes(q)
    );
  }, [searchQuery, apiLoans]);

  // Sort: overdue first, then due soon, then by next due date
  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      // Overdue first
      if (a.overdue_amount > 0 && b.overdue_amount <= 0) return -1;
      if (a.overdue_amount <= 0 && b.overdue_amount > 0) return 1;
      // Then by next due date (earliest first)
      if (a.next_due_date && b.next_due_date) {
        return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
      }
      return 0;
    });
  }, [filteredLoans]);

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
    selectedLoan && sendAmount !== null && paymentDate
      ? `${selectedLoan.id}|${sendAmount}|${paymentDate}`
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
  const paymentBadge = useMemo(
    () => (serverPreview ? previewBadge(serverPreview) : null),
    [serverPreview]
  );

  useEffect(() => {
    if (!previewKey || !selectedLoan || sendAmount === null) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      repaymentService
        .preview(selectedLoan.id, { amount_paid: sendAmount, payment_date: paymentDate })
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
  }, [previewKey, selectedLoan, sendAmount, paymentDate]);

  function handleSelectLoan(loan: ActiveLoan) {
    setSelectedLoan(loan);
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
    setSelectedLoan(null);
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

    // Backend only stores payment_date/amount_paid/remarks — fold the cashier
    // UI metadata into remarks so nothing is lost.
    const metaParts: string[] = [];
    metaParts.push(`method=${PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}`);
    if (referenceNumber.trim()) metaParts.push(`ref=${referenceNumber.trim()}`);
    if (collectedBy.trim()) metaParts.push(`collected_by=${collectedBy.trim()}`);
    const metaLine = `[${metaParts.join(" | ")}]`;
    const composedRemarks = remarks.trim() ? `${remarks.trim()}\n${metaLine}` : metaLine;

    try {
      const repayment = await repaymentService.create(selectedLoan.id, {
        payment_date: paymentDate,
        amount_paid: sendAmount,
        remarks: composedRemarks,
      });

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

      await fetchLoans();
      resetForm();
    } catch (err) {
      toast.error(postPaymentErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsReference = paymentMethod !== "cash";

  // Stats. The overdue and outstanding figures are the server's totals over
  // every active loan (GET /loans `meta.totals`); a figure it did not send
  // shows a dash. Never add the rows up here.
  const overdueCount = listTotals?.overdue_count ?? null;
  const overdueAmount = listTotals?.overdue_amount ?? null;
  const totalOutstanding = listTotals?.total_outstanding ?? null;
  // The count of active loans is the one figure the server can state directly,
  // so prefer `meta.total` over the row count: they agree normally, and when
  // they don't, the server is right and the notice explains the gap.
  const activeLoanCount = activeLoanTotal ?? apiLoans.length;
  // Nothing has been confirmed yet, so state nothing. A zero here reads as
  // "this coop has no loans out", which a failed request is in no position to
  // claim.
  const statsKnown = !(error && apiLoans.length === 0);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Entry</h1>
          <p className="text-sm text-muted-foreground">
            Select a borrower from the list below to record a payment
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

      {/* The list is knowingly incomplete — say so where it cannot be missed.
          This is the state the old `per_page: 500` produced silently. */}
      {truncated && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              This list is incomplete
              {activeLoanTotal != null
                ? ` — showing ${apiLoans.length} of ${activeLoanTotal} active loans.`
                : "."}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Some borrowers will not appear below. The figures above are the
              server&apos;s totals and still cover every active loan. Please report
              this so the payments screen can be paged properly.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active Loans"
          value={statsKnown ? String(activeLoanCount) : null}
          icon={<Users className="size-5 text-brand-orange" />}
          iconBg="bg-brand-orange/10"
        />
        <SummaryCard
          label="Overdue"
          value={statsKnown && overdueCount !== null ? String(overdueCount) : null}
          detail={
            statsKnown && overdueCount !== null && overdueAmount !== null
              ? `${formatCurrency(overdueAmount)} overdue`
              : undefined
          }
          icon={<AlertCircle className="size-5 text-destructive" />}
          iconBg="bg-destructive/10"
        />
        <SummaryCard
          label="Total Outstanding"
          value={statsKnown && totalOutstanding !== null ? formatCurrency(totalOutstanding) : null}
          icon={<Banknote className="size-5 text-blue-600" />}
          iconBg="bg-blue-500/10"
        />
      </div>

      {/* Borrower Loan List */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4" />
            Borrowers with Active Loans
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search borrower, account, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading loans...
            </div>
          ) : error ? (
            // Deliberately NOT the empty state. "No active loans found" after a
            // failed request tells a cashier the member in front of them has
            // nothing to pay, which is a different and much worse claim than
            // "we could not check".
            <div
              role="alert"
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <AlertTriangle className="mb-3 size-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLoans}
                className="mt-3 border-brand-orange/50 text-brand-orange hover:bg-brand-orange/5"
              >
                Retry
              </Button>
            </div>
          ) : sortedLoans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery.trim()
                ? `No active loans found matching "${searchQuery}"`
                : "No active loans found"}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="hidden sm:table-cell">Loan Product</TableHead>
                    <TableHead className="hidden md:table-cell">Next Due</TableHead>
                    <TableHead className="text-right">Due Amount</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Outstanding</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLoans.map((loan) => {
                    const status = getLoanPaymentStatus(loan);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow
                        key={loan.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectLoan(loan)}
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
                            // The server's amount due now, the same figure
                            // the Record Payment dialog shows as Total Due.
                            const cell = dueAmountCell(loan.amount_due_now);
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
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              status.className
                            )}
                          >
                            <StatusIcon className="size-3" />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
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
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
                  {dueNow === null && selectedLoan.amount_due_now !== null && (
                    <p className="text-[10px] text-muted-foreground">Today&apos;s date only</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Next Due Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.next_due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                  <p className="text-sm font-medium">{formatRate(selectedLoan.interest_rate)}% ({selectedLoan.interest_type})</p>
                </div>
              </div>

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
                  value={paymentMethod}
                  onValueChange={(value) => { if (value) setPaymentMethod(value); }}
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
                      displayAllocation.insuranceApplied > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"
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
                    <div
                      className={cn(
                        "rounded-lg border p-3 text-center",
                        displayAllocation.scbApplied > 0 &&
                          "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                      )}
                    >
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">SCB</p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          displayAllocation.scbApplied > 0 && "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {formatCurrency(displayAllocation.scbApplied)}
                      </p>
                    </div>
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

                    {displayAllocation.scbApplied > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Excess → Share Capital
                        </p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {formatCurrency(displayAllocation.scbApplied)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          will credit borrower&apos;s SCB ledger
                        </p>
                      </div>
                    )}

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
