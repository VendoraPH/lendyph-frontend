"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionButton } from "@/components/common";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loanService, repaymentService } from "@/services";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  interestPortion: number
) {
  let remaining = amountPaid;
  const penaltyApplied = Math.min(remaining, penaltyAmount);
  remaining -= penaltyApplied;
  const overdueInterest =
    overdueAmount > 0 ? Math.min(remaining, interestPortion) : 0;
  remaining -= overdueInterest;
  const interestApplied = Math.min(remaining, interestPortion);
  remaining -= interestApplied;
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
// Mock data for testing / fallback
// ---------------------------------------------------------------------------

const MOCK_ACTIVE_LOANS: ActiveLoan[] = [
  {
    id: 1, loan_account_number: "LN-20260001", application_number: "LA-20260001",
    borrower_name: "Rosario D. Santos", borrower_id: 1, loan_product_name: "Salary Loan",
    principal_amount: 20000, interest_rate: 3, interest_type: "fixed", term_months: 6,
    payment_frequency: "monthly", outstanding_balance: 12000, total_payable: 23600,
    status: "ongoing", current_due: 3933, next_due_date: "2026-04-15", overdue_amount: 0, penalty_amount: 0,
  },
  {
    id: 2, loan_account_number: "LN-20260002", application_number: "LA-20260003",
    borrower_name: "Roberto Garcia", borrower_id: 2, loan_product_name: "Business Loan",
    principal_amount: 100000, interest_rate: 2, interest_type: "diminishing", term_months: 12,
    payment_frequency: "monthly", outstanding_balance: 75000, total_payable: 113000,
    status: "ongoing", current_due: 9417, next_due_date: "2026-04-01", overdue_amount: 9417, penalty_amount: 500,
  },
  {
    id: 3, loan_account_number: "LN-20260003", application_number: "LA-20260005",
    borrower_name: "Maria L. Reyes", borrower_id: 3, loan_product_name: "Emergency Loan",
    principal_amount: 10000, interest_rate: 5, interest_type: "fixed", term_months: 3,
    payment_frequency: "weekly", outstanding_balance: 7000, total_payable: 11500,
    status: "ongoing", current_due: 958, next_due_date: "2026-04-05", overdue_amount: 0, penalty_amount: 0,
  },
  {
    id: 4, loan_account_number: "LN-20260004", application_number: "LA-20260007",
    borrower_name: "Eduardo Mendoza", borrower_id: 4, loan_product_name: "OFW Loan",
    principal_amount: 50000, interest_rate: 2, interest_type: "diminishing", term_months: 12,
    payment_frequency: "monthly", outstanding_balance: 30000, total_payable: 56500,
    status: "ongoing", current_due: 4708, next_due_date: "2026-04-20", overdue_amount: 0, penalty_amount: 0,
  },
  {
    id: 5, loan_account_number: "LN-20260005", application_number: "LA-20260009",
    borrower_name: "Danilo Villanueva", borrower_id: 6, loan_product_name: "Business Loan",
    principal_amount: 80000, interest_rate: 2.5, interest_type: "fixed", term_months: 12,
    payment_frequency: "monthly", outstanding_balance: 65000, total_payable: 104000,
    status: "ongoing", current_due: 8667, next_due_date: "2026-03-01", overdue_amount: 17334, penalty_amount: 1200,
  },
  {
    id: 6, loan_account_number: "LN-20260006", application_number: "LA-20260011",
    borrower_name: "Ana Marie Cruz", borrower_id: 7, loan_product_name: "Salary Loan",
    principal_amount: 15000, interest_rate: 3, interest_type: "fixed", term_months: 6,
    payment_frequency: "monthly", outstanding_balance: 9500, total_payable: 17700,
    status: "ongoing", current_due: 2950, next_due_date: "2026-04-12", overdue_amount: 0, penalty_amount: 0,
  },
  {
    id: 7, loan_account_number: "LN-20260007", application_number: "LA-20260013",
    borrower_name: "Carlos P. Ramos", borrower_id: 8, loan_product_name: "Emergency Loan",
    principal_amount: 5000, interest_rate: 5, interest_type: "fixed", term_months: 3,
    payment_frequency: "weekly", outstanding_balance: 3200, total_payable: 5750,
    status: "ongoing", current_due: 479, next_due_date: "2026-04-08", overdue_amount: 479, penalty_amount: 50,
  },
];

// ---------------------------------------------------------------------------
// Map API Loan to local shape
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaymentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // API-loaded loans
  const [apiLoans, setApiLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await loanService.list({ status: "ongoing", per_page: 100 });
      const loans = response.data;
      if (Array.isArray(loans) && loans.length > 0) {
        setApiLoans(loans.map(mapLoanToActiveLoan));
      } else {
        // Fallback to mock data when API returns empty
        setApiLoans(MOCK_ACTIVE_LOANS);
      }
    } catch {
      // Fallback to mock data when API fails
      setApiLoans(MOCK_ACTIVE_LOANS);
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

  function handleSelectLoan(loan: ActiveLoan) {
    setSelectedLoan(loan);
    setAmountPaid("");
    setReferenceNumber("");
    setRemarks("");
    setPaymentMethod("cash");
    setCollectedBy("Juan Cashier");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setLastReceiptId(null);
    setDialogOpen(true);
  }

  function resetForm() {
    setSelectedLoan(null);
    setAmountPaid("");
    setPaymentMethod("cash");
    setReferenceNumber("");
    setRemarks("");
    setCollectedBy("Juan Cashier");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setDialogOpen(false);
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

      if (selectedLoan.scb_amount && selectedLoan.scb_amount > 0) {
        toast.info("Share Capital credited", {
          description: `${formatCurrency(selectedLoan.scb_amount)} credited to ${selectedLoan.borrower_name}'s share capital from this payment.`,
        });
      }

      fetchLoans();
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

  // Stats
  const overdueCount = apiLoans.filter((l) => l.overdue_amount > 0).length;
  const totalOutstanding = apiLoans.reduce((sum, l) => sum + l.outstanding_balance, 0);

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

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-brand-orange/10 p-2.5">
                <Users className="size-5 text-brand-orange" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Loans</p>
                <p className="text-2xl font-bold">{apiLoans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2.5">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <Banknote className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <p className="text-[10px] text-muted-foreground uppercase">Current Due</p>
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(selectedLoan.current_due)}</p>
                </div>
                {selectedLoan.overdue_amount > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
                    <p className="text-sm font-bold tabular-nums text-destructive">{formatCurrency(selectedLoan.overdue_amount)}</p>
                  </div>
                )}
                {selectedLoan.penalty_amount > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Penalty</p>
                    <p className="text-sm font-bold tabular-nums text-destructive">{formatCurrency(selectedLoan.penalty_amount)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Next Due Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.next_due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                  <p className="text-sm font-medium">{selectedLoan.interest_rate}% ({selectedLoan.interest_type})</p>
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
            {allocation && paymentType && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4" />
                      Allocation Preview
                    </p>
                    <Badge variant={paymentType.variant}>{paymentType.label}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Penalty</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(allocation.penaltyApplied)}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Interest</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(allocation.interestApplied)}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Principal</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(allocation.principalApplied)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">New Outstanding Balance</p>
                      <p className="text-lg font-bold">
                        {newOutstandingBalance !== null ? formatCurrency(newOutstandingBalance) : "—"}
                      </p>
                    </div>

                    {typeof amountPaid === "number" && amountPaid < selectedLoan.current_due && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Remaining Due</p>
                        <p className="text-lg font-bold text-destructive">
                          {formatCurrency(selectedLoan.current_due - amountPaid)}
                        </p>
                      </div>
                    )}

                    {typeof amountPaid === "number" &&
                      amountPaid > selectedLoan.current_due + selectedLoan.overdue_amount + selectedLoan.penalty_amount && (
                        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-center dark:border-green-700 dark:bg-green-900/20">
                          <p className="text-[10px] text-muted-foreground mb-1">Excess (Applied to Principal)</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(
                              amountPaid - selectedLoan.current_due - selectedLoan.overdue_amount - selectedLoan.penalty_amount
                            )}
                          </p>
                        </div>
                      )}
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
