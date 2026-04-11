"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionButton } from "@/components/common";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loanService, repaymentService, shareCapitalService } from "@/services";
import type { Loan } from "@/types";
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
  Search,
  Receipt,
  Banknote,
  CreditCard,
  CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

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
  // Share Capital Build-Up amount per period (from the loan product).
  // When present, a portion of each payment is credited to the borrower's
  // share capital ledger.
  scb_amount?: number;
}

const MOCK_ACTIVE_LOANS: ActiveLoan[] = [
  {
    id: 1,
    loan_account_number: "LN-20260001",
    application_number: "LA-20260001",
    borrower_name: "Rosario D. Santos",
    borrower_id: 1,
    loan_product_name: "Salary Loan",
    principal_amount: 20000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 6,
    payment_frequency: "monthly",
    outstanding_balance: 12000,
    total_payable: 23600,
    status: "ongoing",
    current_due: 3933,
    next_due_date: "2026-04-15",
    overdue_amount: 0,
    penalty_amount: 0,
  },
  {
    id: 2,
    loan_account_number: "LN-20260002",
    application_number: "LA-20260003",
    borrower_name: "Roberto Garcia",
    borrower_id: 2,
    loan_product_name: "Business Loan",
    principal_amount: 100000,
    interest_rate: 2,
    interest_type: "diminishing",
    term_months: 12,
    payment_frequency: "monthly",
    outstanding_balance: 75000,
    total_payable: 113000,
    status: "ongoing",
    current_due: 9417,
    next_due_date: "2026-04-01",
    overdue_amount: 9417,
    penalty_amount: 500,
  },
  {
    id: 3,
    loan_account_number: "LN-20260003",
    application_number: "LA-20260005",
    borrower_name: "Maria L. Reyes",
    borrower_id: 3,
    loan_product_name: "Emergency Loan",
    principal_amount: 10000,
    interest_rate: 5,
    interest_type: "fixed",
    term_months: 3,
    payment_frequency: "weekly",
    outstanding_balance: 7000,
    total_payable: 11500,
    status: "ongoing",
    current_due: 958,
    next_due_date: "2026-04-05",
    overdue_amount: 0,
    penalty_amount: 0,
  },
  {
    id: 4,
    loan_account_number: "LN-20260004",
    application_number: "LA-20260007",
    borrower_name: "Eduardo Mendoza",
    borrower_id: 4,
    loan_product_name: "OFW Loan",
    principal_amount: 50000,
    interest_rate: 2,
    interest_type: "diminishing",
    term_months: 12,
    payment_frequency: "monthly",
    outstanding_balance: 30000,
    total_payable: 56500,
    status: "ongoing",
    current_due: 4708,
    next_due_date: "2026-04-20",
    overdue_amount: 0,
    penalty_amount: 0,
  },
  {
    id: 5,
    loan_account_number: "LN-20260005",
    application_number: "LA-20260009",
    borrower_name: "Danilo Villanueva",
    borrower_id: 6,
    loan_product_name: "Business Loan",
    principal_amount: 80000,
    interest_rate: 2.5,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "monthly",
    outstanding_balance: 65000,
    total_payable: 104000,
    status: "ongoing",
    current_due: 8667,
    next_due_date: "2026-03-01",
    overdue_amount: 17334,
    penalty_amount: 1200,
  },
];

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

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// ---------------------------------------------------------------------------
// Allocation logic
// ---------------------------------------------------------------------------

function computeAllocation(
  amountPaid: number,
  currentDue: number,
  overdueAmount: number,
  penaltyAmount: number,
  interestPortion: number
) {
  let remaining = amountPaid;

  // 1. Penalty first
  const penaltyApplied = Math.min(remaining, penaltyAmount);
  remaining -= penaltyApplied;

  // 2. Interest portion of overdue (if any)
  const overdueInterest =
    overdueAmount > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= overdueInterest;

  // 3. Interest for current due
  const interestApplied = Math.min(remaining, interestPortion);
  remaining -= interestApplied;

  // 4. Principal (rest)
  const principalApplied = remaining;

  return {
    penaltyApplied,
    interestApplied: overdueInterest + interestApplied,
    principalApplied,
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Map API Loan to local ActiveLoan shape */
function mapLoanToActiveLoan(loan: Loan): ActiveLoan {
  const l = loan as Loan & Record<string, unknown>;
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
    next_due_date: l.next_due_date || "",
    overdue_amount: (l.overdue_amount as number) || 0,
    penalty_amount: (l.penalty_amount as number) || 0,
    scb_amount: l.scb_amount ?? undefined,
  };
}

export default function PaymentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<number | null>(null);

  // Form state
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [collectedBy, setCollectedBy] = useState("Juan Cashier");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API-loaded loans + mock fallback
  const [apiLoans, setApiLoans] = useState<ActiveLoan[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      const response = await loanService.list({ status: "ongoing", per_page: 100 });
      const loans = response.data;
      if (Array.isArray(loans) && loans.length > 0) {
        setApiLoans(loans.map(mapLoanToActiveLoan));
        setUsingMock(false);
      } else {
        setApiLoans(MOCK_ACTIVE_LOANS);
        setUsingMock(true);
      }
    } catch {
      setApiLoans(MOCK_ACTIVE_LOANS);
      setUsingMock(true);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Search filtering
  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return apiLoans.filter(
      (loan) =>
        loan.loan_account_number.toLowerCase().includes(q) ||
        loan.application_number.toLowerCase().includes(q) ||
        loan.borrower_name.toLowerCase().includes(q)
    );
  }, [searchQuery, apiLoans]);

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
      interestPortion
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

  const newOutstandingBalance = useMemo(() => {
    if (!selectedLoan || !allocation) return null;
    return Math.max(
      0,
      (selectedLoan.outstanding_balance ?? 0) - allocation.principalApplied
    );
  }, [selectedLoan, allocation]);

  // Payment status for the selected loan
  const loanPaymentStatus = useMemo(() => {
    if (!selectedLoan) return null;
    if (selectedLoan.overdue_amount > 0)
      return {
        label: "Overdue",
        icon: AlertCircle,
        className: "bg-destructive/10 text-destructive",
      };
    const dueDate = new Date(selectedLoan.next_due_date);
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
  }, [selectedLoan]);

  function handleSelectLoan(loan: ActiveLoan) {
    setSelectedLoan(loan);
    setSearchQuery(loan.borrower_name);
    setShowResults(false);
    setAmountPaid("");
    setReferenceNumber("");
    setRemarks("");
    setPaymentMethod("cash");
    setCollectedBy("Juan Cashier");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setLastReceiptId(null);
  }

  function resetForm() {
    setSelectedLoan(null);
    setSearchQuery("");
    setAmountPaid("");
    setPaymentMethod("cash");
    setReferenceNumber("");
    setRemarks("");
    setCollectedBy("Juan Cashier");
    setPaymentDate(new Date().toISOString().split("T")[0]);
  }

  async function handleSubmit() {
    if (!selectedLoan || !amountPaid || amountPaid <= 0) return;
    setIsSubmitting(true);

    try {
      const repayment = await repaymentService.create(selectedLoan.id, {
        payment_date: paymentDate,
        amount_paid: amountPaid,
        remarks: remarks || undefined,
      });

      const receiptId = repayment?.id;
      if (receiptId) setLastReceiptId(receiptId);

      toast.success("Payment posted successfully", {
        description: `${formatCurrency(amountPaid)} recorded for ${selectedLoan.borrower_name} (${selectedLoan.loan_account_number})`,
        action: receiptId
          ? { label: "View Receipt", onClick: () => router.push(`/payments/${receiptId}`) }
          : undefined,
      });

      // Credit SCB portion to the borrower's share capital ledger
      if (selectedLoan.scb_amount && selectedLoan.scb_amount > 0) {
        try {
          await shareCapitalService.ledgerCreate({
            borrower_id: selectedLoan.borrower_id,
            date: new Date().toISOString().split("T")[0],
            description: `Share Capital Build-Up from payment — Loan ${selectedLoan.loan_account_number}`,
            type: "credit",
            amount: selectedLoan.scb_amount,
          });
          toast.info("Share Capital credited", {
            description: `${formatCurrency(selectedLoan.scb_amount)} credited to ${selectedLoan.borrower_name}'s share capital.`,
          });
        } catch {
          toast.warning("Payment recorded but share capital credit failed", {
            description: "Please manually credit the share capital entry.",
          });
        }
      }

      // Refresh loan data
      if (!usingMock) fetchLoans();
      resetForm();
    } catch {
      toast.error("Failed to post payment", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsReference = paymentMethod !== "cash";

  return (
    <RouteGuard permission="payments:view" pageName="Payments">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Entry</h1>
          <p className="text-sm text-muted-foreground">
            Record borrower loan repayments
          </p>
        </div>
      </div>

      {/* Card 1: Search Active Loan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" />
            Search Active Loan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Input
              placeholder="Search by account number, application number, or borrower name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
                if (selectedLoan) setSelectedLoan(null);
              }}
              onFocus={() => setShowResults(true)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />

            {/* Dropdown results */}
            {showResults && filteredLoans.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md max-h-64 overflow-y-auto">
                {filteredLoans.map((loan) => (
                  <button
                    key={loan.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                    onClick={() => handleSelectLoan(loan)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {loan.borrower_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loan.loan_account_number} &middot;{" "}
                        {loan.loan_product_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">
                        {formatCurrency(loan.outstanding_balance)}
                      </p>
                      {loan.overdue_amount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showResults &&
              searchQuery.trim().length > 0 &&
              filteredLoans.length === 0 &&
              !selectedLoan && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md px-4 py-3 text-sm text-muted-foreground">
                  No active loans found matching &ldquo;{searchQuery}&rdquo;
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {selectedLoan && (
        <>
          {/* Card 2: Loan & Borrower Details */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4" />
                Loan &amp; Borrower Details
              </CardTitle>
              {loanPaymentStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${loanPaymentStatus.className}`}
                >
                  <loanPaymentStatus.icon className="size-3" />
                  {loanPaymentStatus.label}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <DetailRow
                    label="Borrower"
                    value={selectedLoan.borrower_name}
                  />
                  <DetailRow
                    label="Loan Account"
                    value={selectedLoan.loan_account_number}
                  />
                  <DetailRow
                    label="Application No."
                    value={selectedLoan.application_number}
                  />
                  <DetailRow
                    label="Loan Product"
                    value={selectedLoan.loan_product_name}
                  />
                  <DetailRow
                    label="Principal"
                    value={formatCurrency(selectedLoan.principal_amount)}
                  />
                </div>
                <div className="space-y-3">
                  <DetailRow
                    label="Interest Rate"
                    value={`${selectedLoan.interest_rate}% (${selectedLoan.interest_type})`}
                  />
                  <DetailRow
                    label="Term"
                    value={`${selectedLoan.term_months} months (${selectedLoan.payment_frequency.replace("_", "-")})`}
                  />
                  <DetailRow
                    label="Next Due Date"
                    value={formatDate(selectedLoan.next_due_date)}
                  />
                  <DetailRow
                    label="Current Due"
                    value={formatCurrency(selectedLoan.current_due)}
                    bold
                  />
                  {selectedLoan.overdue_amount > 0 && (
                    <DetailRow
                      label="Overdue Amount"
                      value={formatCurrency(selectedLoan.overdue_amount)}
                      className="text-destructive"
                    />
                  )}
                  {selectedLoan.penalty_amount > 0 && (
                    <DetailRow
                      label="Penalty"
                      value={formatCurrency(selectedLoan.penalty_amount)}
                      className="text-destructive"
                    />
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col items-center justify-center gap-1 py-2">
                <p className="text-sm text-muted-foreground">
                  Outstanding Balance
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrency(selectedLoan.outstanding_balance)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="size-4" />
                Payment Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Payment Date */}
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

                {/* Amount Paid */}
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
                      setAmountPaid(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <Label>
                    Payment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => {
                      if (value) setPaymentMethod(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reference Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="reference-number">
                    Reference Number
                    {needsReference && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Input
                    id="reference-number"
                    placeholder={
                      needsReference
                        ? "Required for non-cash payments"
                        : "Optional"
                    }
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>

                {/* Collected By */}
                <div className="space-y-1.5">
                  <Label htmlFor="collected-by">Collected By</Label>
                  <Input
                    id="collected-by"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Optional notes about this payment..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Payment Allocation Preview */}
          {allocation && paymentType && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="size-4" />
                  Payment Allocation Preview
                </CardTitle>
                <Badge variant={paymentType.variant}>{paymentType.label}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <AllocationRow
                    label="Penalty"
                    amount={allocation.penaltyApplied}
                  />
                  <AllocationRow
                    label="Interest"
                    amount={allocation.interestApplied}
                  />
                  <AllocationRow
                    label="Principal"
                    amount={allocation.principalApplied}
                  />
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(allocation.total)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      New Outstanding Balance
                    </p>
                    <p className="text-xl font-bold">
                      {newOutstandingBalance !== null
                        ? formatCurrency(newOutstandingBalance)
                        : "--"}
                    </p>
                  </div>

                  {typeof amountPaid === "number" &&
                    amountPaid < selectedLoan.current_due && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">
                          Remaining Amount Due
                        </p>
                        <p className="text-xl font-bold text-destructive">
                          {formatCurrency(
                            selectedLoan.current_due - amountPaid
                          )}
                        </p>
                      </div>
                    )}

                  {typeof amountPaid === "number" &&
                    amountPaid >
                      selectedLoan.current_due +
                        selectedLoan.overdue_amount +
                        selectedLoan.penalty_amount && (
                      <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-center dark:border-green-700 dark:bg-green-900/20">
                        <p className="text-xs text-muted-foreground mb-1">
                          Excess (Applied to Next Principal)
                        </p>
                        <p className="text-xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(
                            amountPaid -
                              selectedLoan.current_due -
                              selectedLoan.overdue_amount -
                              selectedLoan.penalty_amount
                          )}
                        </p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3">
            {lastReceiptId && !selectedLoan && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push(`/payments/${lastReceiptId}`)}
                className="gap-2"
              >
                <Receipt className="size-4" />
                View Last Receipt
              </Button>
            )}
            <PermissionButton
              permission="payments:create"
              tooltip="Your role doesn't have permission to record payments"
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark gap-2 px-6"
              size="lg"
              disabled={
                isSubmitting ||
                !amountPaid ||
                amountPaid <= 0 ||
                (needsReference && !referenceNumber.trim())
              }
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>Posting...</>
              ) : (
                <>
                  <Receipt className="size-4" />
                  Post Payment
                  <ArrowRight className="size-4" />
                </>
              )}
            </PermissionButton>
          </div>
        </>
      )}
    </div>
    </RouteGuard>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-right ${bold ? "font-semibold" : ""} ${className ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function AllocationRow({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{formatCurrency(amount)}</span>
    </div>
  );
}
