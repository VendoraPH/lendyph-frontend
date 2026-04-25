"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { repaymentService } from "@/services";
import type { Repayment } from "@/types";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Receipt,
  Ban,
  AlertTriangle,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

type PaymentMethod = "cash" | "bank_transfer" | "gcash" | "maya" | "online";
type PaymentStatus = "completed" | "voided";

interface MockPayment {
  id: number;
  receipt_number: string;
  borrower_name: string;
  borrower_id: number;
  loan_account: string;
  loan_id: number;
  date: string;
  amount: number;
  penalty_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  collected_by: string;
  balance_before: number;
  balance_after: number;
  reference_number?: string;
  remarks?: string;
  void_reason?: string;
  voided_by?: string;
  voided_at?: string;
}

function mapRepaymentToRow(r: Repayment): MockPayment {
  const p = r as Repayment & Record<string, unknown>;
  const loanRel = p.loan as
    | {
        id?: number;
        loan_account_number?: string;
        application_number?: string;
        borrower?: { id?: number; full_name?: string; name?: string };
        borrower_id?: number;
        borrower_name?: string;
      }
    | undefined;
  const borrowerRel = p.borrower as
    | { id?: number; full_name?: string; name?: string }
    | undefined;
  return {
    id: p.id,
    receipt_number: (p.receipt_number as string) || `RCP-${String(p.id).padStart(8, "0")}`,
    borrower_name:
      loanRel?.borrower?.full_name ||
      loanRel?.borrower?.name ||
      loanRel?.borrower_name ||
      borrowerRel?.full_name ||
      borrowerRel?.name ||
      (p.borrower_name as string) ||
      "—",
    borrower_id:
      loanRel?.borrower?.id ??
      loanRel?.borrower_id ??
      borrowerRel?.id ??
      (p.borrower_id as number) ??
      0,
    loan_account:
      loanRel?.loan_account_number ||
      loanRel?.application_number ||
      (p.loan_account_number as string) ||
      (p.loan_account as string) ||
      "—",
    loan_id: p.loan_id ?? loanRel?.id ?? 0,
    date: p.payment_date,
    amount:
      (p.amount as number) ||
      p.amount_paid ||
      0,
    penalty_amount:
      (p.penalty_applied as number) ||
      (p.penalty_paid as number) ||
      (p.penalty_amount as number) ||
      0,
    method: ((p.method as PaymentMethod) || "cash"),
    status: (p.status === "voided" ? "voided" : "completed") as PaymentStatus,
    collected_by: (p.collected_by as string) || "—",
    balance_before: (p.balance_before as number) || 0,
    balance_after: (p.balance_after as number) || 0,
    reference_number: p.reference_number as string | undefined,
    remarks: p.remarks || undefined,
    void_reason: p.void_reason || undefined,
    voided_by: p.voided_by || undefined,
    voided_at: p.voided_at || undefined,
  };
}

// ── Helpers ──

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Void Payment Dialog ──

interface VoidDialogProps {
  payment: MockPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoid: (id: number, reason: string) => void;
}

function VoidPaymentDialog({
  payment,
  open,
  onOpenChange,
  onVoid,
}: VoidDialogProps) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = reason.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || !canSubmit) return;
    onVoid(payment.id, reason.trim());
    setReason("");
    setPassword("");
    onOpenChange(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setReason("");
      setPassword("");
    }
    onOpenChange(v);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Void Payment
          </DialogTitle>
          <DialogDescription>
            This will reverse the payment and restore the loan balance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Summary */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt #</span>
              <span className="font-mono font-medium">
                {payment.receipt_number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Borrower</span>
              <span className="font-medium">{payment.borrower_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Account</span>
              <span className="font-mono">{payment.loan_account}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold text-green-700">
                {formatPHP(payment.amount + payment.penalty_amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(payment.date)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance Before</span>
              <span>{formatPHP(payment.balance_before)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance After Void</span>
              <span className="text-brand-orange font-medium">
                {formatPHP(payment.balance_before)}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="void-reason">
              Reason for Voiding{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="void-reason"
              placeholder="Explain why this payment is being voided..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              This action requires admin authorization and cannot be undone. The
              loan balance will be restored to{" "}
              <strong>{formatPHP(payment.balance_before)}</strong>.
            </p>
          </div>

          {/* Password Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="void-password">
              Admin Password Confirmation{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="void-password"
              type="password"
              placeholder="Enter your password to confirm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              <Ban className="h-4 w-4 mr-1" />
              Void Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Status Badge ──

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "completed") {
    return (
      <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1">
      <XCircle className="h-3 w-3" />
      <span className="line-through">Voided</span>
    </Badge>
  );
}

// ── Mobile Payment Card ──

function PaymentCard({
  payment,
  onVoidClick,
}: {
  payment: MockPayment;
  onVoidClick: (p: MockPayment) => void;
}) {
  const isVoided = payment.status === "voided";

  return (
    <Card className={cn("overflow-hidden", isVoided && "opacity-75")}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {payment.receipt_number}
            </p>
            <p className="font-semibold text-sm mt-0.5">
              {payment.borrower_name}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {payment.loan_account}
            </p>
          </div>
          <StatusBadge status={payment.status} />
        </div>

        <Separator />

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(payment.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Amount</p>
            <p
              className={cn(
                "font-bold",
                isVoided
                  ? "text-muted-foreground line-through"
                  : "text-green-700"
              )}
            >
              {formatPHP(payment.amount + payment.penalty_amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Method</p>
            <p className="font-medium">{METHOD_LABELS[payment.method]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected By</p>
            <p className="font-medium text-xs">{payment.collected_by}</p>
          </div>
        </div>

        {/* Void audit trail */}
        {isVoided && payment.voided_by && (
          <div className="rounded bg-red-50 border border-red-100 p-2 text-xs text-red-700">
            <p className="font-medium">
              Voided by {payment.voided_by} on{" "}
              {payment.voided_at ? formatDateTime(payment.voided_at) : "—"}
            </p>
            <p className="mt-0.5 text-red-600">
              Reason: {payment.void_reason}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Link href={`/payments/${payment.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1">
              <Eye className="h-3 w-3" />
              View Receipt
            </Button>
          </Link>
          {!isVoided && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => onVoidClick(payment)}
            >
              <Ban className="h-3 w-3" />
              Void
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<MockPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [voidTarget, setVoidTarget] = useState<MockPayment | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repaymentService.listAll({ per_page: 100 });
      const rows = Array.isArray(res)
        ? (res as unknown as Repayment[])
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setPayments(rows.map(mapRepaymentToRow));
    } catch (err) {
      console.error("Failed to load payment history", err);
      setPayments([]);
      toast.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Filter logic
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.receipt_number.toLowerCase().includes(q) ||
        p.borrower_name.toLowerCase().includes(q) ||
        p.loan_account.toLowerCase().includes(q);

      const matchStatus =
        statusTab === "all" ||
        (statusTab === "completed" && p.status === "completed") ||
        (statusTab === "voided" && p.status === "voided");

      const payDate = new Date(p.date);
      const matchFrom = !dateFrom || payDate >= new Date(dateFrom);
      const matchTo = !dateTo || payDate <= new Date(dateTo);

      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [payments, search, statusTab, dateFrom, dateTo]);

  // Summary cards (over the full unfiltered set for totals context, over filtered for display)
  const totalCollected = useMemo(
    () =>
      filtered
        .filter((p) => p.status === "completed")
        .reduce((s, p) => s + p.amount + p.penalty_amount, 0),
    [filtered]
  );
  const totalVoided = useMemo(
    () =>
      filtered
        .filter((p) => p.status === "voided")
        .reduce((s, p) => s + p.amount + p.penalty_amount, 0),
    [filtered]
  );
  const transactionCount = filtered.length;

  const handleVoidClick = (p: MockPayment) => {
    setVoidTarget(p);
    setVoidDialogOpen(true);
  };

  const handleVoid = async (id: number, reason: string) => {
    try {
      await repaymentService.void(id, { void_reason: reason });
      toast.success("Payment voided");
      fetchPayments();
    } catch {
      toast.error("Failed to void payment");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground">
          View and manage all payment transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Collected
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {formatPHP(totalCollected)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              From completed payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Voided</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatPHP(totalVoided)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reversed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Transactions Count
            </CardTitle>
            <Receipt className="h-4 w-4 text-brand-orange" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{transactionCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.filter((p) => p.status === "completed").length}{" "}
              completed,{" "}
              {filtered.filter((p) => p.status === "voided").length} voided
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Search */}
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Receipt #, borrower name, or loan account..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Date range */}
            <div className="flex gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>

            {/* Reset filters */}
            {(search || dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Tabs + Table */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium">
              Transactions ({filtered.length})
            </CardTitle>
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="voided">Voided</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Loan Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((payment) => {
                  const isVoided = payment.status === "voided";
                  return (
                    <TableRow
                      key={payment.id}
                      className={cn(isVoided && "opacity-60")}
                    >
                      <TableCell>
                        <span className="font-mono text-xs">
                          {payment.receipt_number}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {payment.borrower_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID #{payment.borrower_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {payment.loan_account}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(payment.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            isVoided
                              ? "text-muted-foreground line-through"
                              : "text-green-700"
                          )}
                        >
                          {formatPHP(payment.amount + payment.penalty_amount)}
                        </span>
                        {payment.penalty_amount > 0 && (
                          <p className="text-xs text-amber-600 text-right">
                            incl. {formatPHP(payment.penalty_amount)} penalty
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {METHOD_LABELS[payment.method]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge status={payment.status} />
                          {isVoided && payment.voided_by && (
                            <p className="text-xs text-muted-foreground">
                              by {payment.voided_by}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/payments/${payment.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                            >
                              <Eye className="h-3 w-3" />
                              Receipt
                            </Button>
                          </Link>
                          {!isVoided && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                              onClick={() => handleVoidClick(payment)}
                            >
                              <Ban className="h-3 w-3" />
                              Void
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Loading payments...
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No payments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Void audit details under the table */}
            {filtered.some((p) => p.status === "voided") && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Void Audit Trail
                </p>
                {filtered
                  .filter((p) => p.status === "voided")
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/50 px-4 py-2 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-red-700">
                          {p.receipt_number}
                        </span>{" "}
                        —{" "}
                        <span className="text-red-600">
                          Voided by {p.voided_by} on{" "}
                          {p.voided_at ? formatDateTime(p.voided_at) : "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          — Reason: {p.void_reason}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onVoidClick={handleVoidClick}
              />
            ))}
            {loading && (
              <div className="py-12 text-center text-muted-foreground text-sm inline-flex w-full items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading payments...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No payments found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Void Payment Dialog */}
      <VoidPaymentDialog
        payment={voidTarget}
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onVoid={handleVoid}
      />
    </div>
  );
}
