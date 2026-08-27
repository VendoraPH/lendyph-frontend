"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionButton } from "@/components/common";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { loanService, repaymentService, shareCapitalService } from "@/services";
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
  Receipt,
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
import { todayISO } from "@/lib/format";
import { fetchAllActiveLoans } from "./_lib/active-loans";

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
  outstanding_balance: number;
  total_payable: number;
  status: string;
  current_due: number;
  next_due_date: string;
  overdue_amount: number;
  penalty_amount: number;
  scb_amount?: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ---------------------------------------------------------------------------
// Allocation logic
// ---------------------------------------------------------------------------

function computeAllocation(
  amountPaid: number,
  currentDue: number,
  overdueAmount: number,
  penaltyAmount: number,
  interestPortion: number,
  scbAmount: number
) {
  let remaining = amountPaid;

  // 1. Penalty first
  const penaltyApplied = Math.min(remaining, penaltyAmount);
  remaining -= penaltyApplied;

  // 2. Overdue interest (if any arrears)
  const overdueInterest =
    overdueAmount > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= overdueInterest;

  // 3. Current period interest
  const currentInterest = Math.min(remaining, interestPortion);
  remaining -= currentInterest;

  // 4. Current period principal
  const currentPrincipalDue = Math.max(0, currentDue - interestPortion - penaltyAmount);
  const currentPrincipal = Math.min(remaining, currentPrincipalDue);
  remaining -= currentPrincipal;

  // 5. Excess → SCB (no cap; drains all remaining excess when loan has SCB)
  const scbApplied = scbAmount > 0 ? remaining : 0;
  remaining -= scbApplied;

  // 6. Excess → next amortization interest (only reachable when scbAmount === 0)
  const nextInterest = remaining > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= nextInterest;

  // 7. Excess → next principal
  const nextPrincipal = remaining;

  return {
    penaltyApplied,
    interestApplied: overdueInterest + currentInterest + nextInterest,
    principalApplied: currentPrincipal + nextPrincipal,
    scbApplied,
    nextInterestApplied: nextInterest,
    nextPrincipalApplied: nextPrincipal,
    total: amountPaid,
  };
}

function detectPaymentType(
  amountPaid: number,
  currentDue: number,
  overdueAmount: number,
  penaltyAmount: number
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (amountPaid === 0)
    return { label: "No Payment", variant: "outline" };
  if (amountPaid < currentDue)
    return { label: "Partial Payment", variant: "destructive" };
  if (amountPaid === currentDue)
    return { label: "Exact Payment", variant: "default" };
  if (amountPaid <= currentDue + overdueAmount + penaltyAmount)
    return { label: "Full Payment (with arrears)", variant: "secondary" };
  return { label: "Advance Payment", variant: "secondary" };
}

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

function mapLoanToActiveLoan(loan: Loan): ActiveLoan {
  const l = loan as Loan & Record<string, unknown>;
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
    outstanding_balance: l.outstanding_balance ?? 0,
    total_payable: l.total_payable ?? 0,
    status: l.status,
    current_due: (l.current_due as number) || 0,
    next_due_date: isUponMaturity ? maturityDate || l.next_due_date || "" : l.next_due_date || "",
    overdue_amount: (l.overdue_amount as number) || 0,
    penalty_amount: (l.penalty_amount as number) || 0,
    scb_amount: l.scb_amount ?? undefined,
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
  icon,
  iconBg,
}: {
  label: string;
  value: string | null;
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaymentsPage() {
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
    } catch (err) {
      console.error("Failed to load active loans", err);
      setApiLoans([]);
      setActiveLoanTotal(null);
      setTruncated(false);
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

  // Allocation preview
  const allocation = useMemo(() => {
    if (!selectedLoan || !amountPaid || amountPaid <= 0) return null;
    const interestPortion =
      (selectedLoan.outstanding_balance ?? 0) * (selectedLoan.interest_rate / 100);
    return computeAllocation(
      amountPaid,
      selectedLoan.current_due,
      selectedLoan.overdue_amount,
      selectedLoan.penalty_amount,
      interestPortion,
      selectedLoan.scb_amount ?? 0
    );
  }, [selectedLoan, amountPaid]);

  const paymentType = useMemo(() => {
    if (!selectedLoan || !amountPaid || amountPaid <= 0) return null;
    return detectPaymentType(
      amountPaid,
      selectedLoan.current_due,
      selectedLoan.overdue_amount,
      selectedLoan.penalty_amount
    );
  }, [selectedLoan, amountPaid]);

  // Server-side preview of the repayment breakdown — debounced to avoid spamming.
  const [serverPreview, setServerPreview] = useState<RepaymentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Breakdown of what's currently due (principal/interest/penalty/scb).
  // Computed once when the dialog opens by running a "full payment" preview.
  const [duesBreakdown, setDuesBreakdown] = useState<{
    principal: number;
    interest: number;
    penalty: number;
    scb: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedLoan || !dialogOpen) {
      setDuesBreakdown(null);
      return;
    }
    const fullDue =
      (selectedLoan.current_due ?? 0) +
      (selectedLoan.overdue_amount ?? 0) +
      (selectedLoan.penalty_amount ?? 0);
    if (fullDue <= 0) {
      setDuesBreakdown({
        principal: 0,
        interest: 0,
        penalty: 0,
        scb: selectedLoan.scb_amount ?? 0,
        total: 0,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await repaymentService.preview(selectedLoan.id, {
          amount_paid: fullDue,
          payment_date: todayISO(),
        });
        if (cancelled) return;
        const principal =
          typeof res?.total_principal === "number" ? res.total_principal : 0;
        const interest =
          typeof res?.total_interest === "number" ? res.total_interest : 0;
        const penalty =
          typeof res?.total_penalty === "number"
            ? res.total_penalty
            : (selectedLoan.penalty_amount ?? 0);
        // SCB due comes from the loan config, not the preview (preview.excess
        // represents unallocated overflow, not the scheduled SCB contribution).
        const scb = selectedLoan.scb_amount ?? 0;
        setDuesBreakdown({
          principal,
          interest,
          penalty,
          scb,
          total: principal + interest + penalty + scb,
        });
      } catch {
        if (cancelled) return;
        setDuesBreakdown(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLoan, dialogOpen]);

  const newOutstandingBalance = useMemo(() => {
    if (!selectedLoan) return null;
    const principalAppliedForBalance =
      (typeof serverPreview?.total_principal === "number" ? serverPreview.total_principal : null) ??
      allocation?.principalApplied ??
      null;
    if (principalAppliedForBalance === null) return null;
    return Math.max(
      0,
      (selectedLoan.outstanding_balance ?? 0) - principalAppliedForBalance
    );
  }, [selectedLoan, allocation, serverPreview]);

  // Prefer server-returned numbers over client math when present.
  const displayAllocation = useMemo(() => {
    if (!allocation) return null;
    if (!serverPreview) return allocation;
    const pick = <T,>(server: T | undefined, fallback: T) =>
      typeof server === "number" && !Number.isNaN(server) ? (server as T) : fallback;
    return {
      ...allocation,
      penaltyApplied: pick(serverPreview.total_penalty, allocation.penaltyApplied),
      interestApplied: pick(serverPreview.total_interest, allocation.interestApplied),
      principalApplied: pick(serverPreview.total_principal, allocation.principalApplied),
      scbApplied: pick(serverPreview.excess, allocation.scbApplied),
    };
  }, [allocation, serverPreview]);

  useEffect(() => {
    setServerPreview(null);
    if (!selectedLoan || typeof amountPaid !== "number" || amountPaid <= 0 || !paymentDate) {
      return;
    }
    const loanId = selectedLoan.id;
    const amount = amountPaid;
    const date = paymentDate;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await repaymentService.preview(loanId, {
          amount_paid: amount,
          payment_date: date,
        });
        setServerPreview(res ?? null);
      } catch {
        setServerPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [selectedLoan, amountPaid, paymentDate]);

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
    if (!selectedLoan || !amountPaid || amountPaid <= 0) return;
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
        amount_paid: amountPaid,
        remarks: composedRemarks,
      });

      const receiptId = repayment?.id;
      if (receiptId) setLastReceiptId(receiptId);

      toast.success("Payment posted", {
        description: `${formatCurrency(amountPaid)} recorded for ${selectedLoan.borrower_name} (${selectedLoan.loan_account_number})`,
        action: receiptId
          ? { label: "View Receipt", onClick: () => router.push(`/payments/${receiptId}`) }
          : undefined,
      });

      // Credit the portion of this payment that was allocated to SCB
      const scbToCredit = displayAllocation?.scbApplied ?? 0;
      if (scbToCredit > 0) {
        try {
          await shareCapitalService.ledgerCreate({
            borrower_id: selectedLoan.borrower_id,
            date: paymentDate,
            description: `Share Capital Build-Up from payment — Loan ${selectedLoan.loan_account_number}`,
            type: "credit",
            amount: scbToCredit,
          });
          toast.info("Share Capital credited", {
            description: `${formatCurrency(scbToCredit)} credited to ${selectedLoan.borrower_name}'s share capital.`,
          });
        } catch {
          toast.warning("Payment recorded but share capital credit failed", {
            description: "Please manually credit the share capital entry.",
          });
        }
      }

      await fetchLoans();
      resetForm();
    } catch {
      toast.error("We couldn't post the payment. Please try again.", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsReference = paymentMethod !== "cash";

  // Stats.
  //
  // Both of these are aggregates over `overdue_amount` / `outstanding_balance`,
  // which LoanResource derives per row from the loaded amortization schedules.
  // There is no server-side equivalent — `meta.stats` is a GROUP BY status row
  // count — so they are only meaningful because `apiLoans` is now the complete
  // active set. If that ever stops being true the `truncated` notice says so;
  // do not reintroduce a partial fetch and leave these summing a page.
  const overdueCount = apiLoans.filter((l) => l.overdue_amount > 0).length;
  const totalOutstanding = apiLoans.reduce((sum, l) => sum + l.outstanding_balance, 0);
  // The count of active loans is the one figure the server can state directly,
  // so prefer `meta.total` over the row count: they agree normally, and when
  // they don't, the server is right and the notice explains the gap.
  const activeLoanCount = activeLoanTotal ?? apiLoans.length;
  // Nothing has been confirmed yet, so state nothing. A zero here reads as
  // "this coop has no loans out", which a failed request is in no position to
  // claim.
  const statsKnown = !(error && apiLoans.length === 0);

  return (
    <RouteGuard permission="payments:view" pageName="Payments">
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
            <Receipt className="size-4" />
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
              Some borrowers will not appear below, and the figures above count
              only the loans shown. Please report this so the payments screen can
              be paged properly.
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
          value={statsKnown ? String(overdueCount) : null}
          icon={<AlertCircle className="size-5 text-destructive" />}
          iconBg="bg-destructive/10"
        />
        <SummaryCard
          label="Total Outstanding"
          value={statsKnown ? formatCurrency(totalOutstanding) : null}
          icon={<Banknote className="size-5 text-blue-600" />}
          iconBg="bg-blue-500/10"
        />
      </div>

      {/* Borrower Loan List */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" />
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
                          <div>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatCurrency(loan.current_due + loan.overdue_amount)}
                            </p>
                            {loan.penalty_amount > 0 && (
                              <p className="text-[10px] text-destructive">
                                +{formatCurrency(loan.penalty_amount)} penalty
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(loan.outstanding_balance)}
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
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(selectedLoan.outstanding_balance)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Due</p>
                  <p className="text-sm font-bold tabular-nums">
                    {formatCurrency(
                      (duesBreakdown?.total ??
                        (selectedLoan.current_due +
                          selectedLoan.overdue_amount +
                          selectedLoan.penalty_amount))
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Next Due Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.next_due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                  <p className="text-sm font-medium">{selectedLoan.interest_rate}% ({selectedLoan.interest_type})</p>
                </div>
              </div>

              {/* Total Dues breakdown: Principal, Interest, Penalty, SCB */}
              <Separator />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-2">
                  Total Dues Breakdown
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border bg-background p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {duesBreakdown
                        ? formatCurrency(duesBreakdown.principal)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Interest</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {duesBreakdown
                        ? formatCurrency(duesBreakdown.interest)
                        : "—"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-md border bg-background p-2 text-center",
                      (duesBreakdown?.penalty ?? 0) > 0 &&
                        "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <p className="text-[10px] text-muted-foreground">Penalty</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        (duesBreakdown?.penalty ?? 0) > 0 && "text-destructive"
                      )}
                    >
                      {duesBreakdown
                        ? formatCurrency(duesBreakdown.penalty)
                        : "—"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-md border bg-background p-2 text-center",
                      (duesBreakdown?.scb ?? 0) > 0 &&
                        "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                    )}
                  >
                    <p className="text-[10px] text-muted-foreground">SCB</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        (duesBreakdown?.scb ?? 0) > 0 &&
                          "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {duesBreakdown ? formatCurrency(duesBreakdown.scb) : "—"}
                    </p>
                  </div>
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
                />
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
            {displayAllocation && paymentType && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4" />
                      Payment Allocation
                      {previewLoading && (
                        <span className="text-[10px] font-normal text-muted-foreground">checking…</span>
                      )}
                      {!previewLoading && serverPreview && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Server-verified
                        </Badge>
                      )}
                    </p>
                    <Badge variant={paymentType.variant}>{paymentType.label}</Badge>
                  </div>

                  {/* Component allocation totals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                          <Receipt className="size-3.5" />
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
                        {newOutstandingBalance !== null ? formatCurrency(newOutstandingBalance) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        was {formatCurrency(selectedLoan.outstanding_balance)}
                      </p>
                    </div>

                    {typeof amountPaid === "number" &&
                      amountPaid <
                        selectedLoan.current_due +
                          selectedLoan.overdue_amount +
                          selectedLoan.penalty_amount && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                            Remaining Due
                          </p>
                          <p className="text-lg font-bold text-destructive tabular-nums">
                            {formatCurrency(
                              selectedLoan.current_due +
                                selectedLoan.overdue_amount +
                                selectedLoan.penalty_amount -
                                amountPaid
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            short of full current dues
                          </p>
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
                  !amountPaid ||
                  amountPaid <= 0 ||
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
                    <Receipt className="size-4" />
                    Post Payment
                  </>
                )}
              </PermissionButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </RouteGuard>
  );
}
