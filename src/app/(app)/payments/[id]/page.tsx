"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Receipt, Ban, Loader2 } from "lucide-react";
import { usePrintables } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { repaymentService } from "@/services";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Repayment } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReceiptData {
  id: number;
  receipt_number: string;
  borrower_name: string;
  loan_account_number: string;
  loan_product_name: string;
  payment_date: string;
  method: "cash" | "bank_transfer" | "gcash" | "maya" | "online";
  reference_number?: string;
  penalty: number;
  interest: number;
  principal: number;
  total: number;
  previous_balance: number;
  new_balance: number;
  next_due_date: string;
  collected_by: string;
  remarks: string;
  status: "completed" | "voided" | "pending";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

const STATUS_STYLES: Record<
  ReceiptData["status"],
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  },
  voided: {
    label: "Voided",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
};

/** Map API Repayment response to local ReceiptData shape */
function mapPaymentToReceipt(payment: Repayment): ReceiptData {
  const p = payment as Repayment & Record<string, unknown>;
  const loanRel = p.loan as
    | {
        loan_account_number?: string;
        application_number?: string;
        loan_product?: { name?: string };
        loan_product_name?: string;
        borrower?: { full_name?: string; name?: string };
        borrower_name?: string;
      }
    | undefined;
  const borrowerRel = p.borrower as { full_name?: string; name?: string } | undefined;
  return {
    id: p.id,
    receipt_number: (p.receipt_number as string) || `OR-${String(p.id).padStart(8, "0")}`,
    borrower_name:
      loanRel?.borrower?.full_name ||
      loanRel?.borrower?.name ||
      loanRel?.borrower_name ||
      borrowerRel?.full_name ||
      borrowerRel?.name ||
      (p.borrower_name as string) ||
      "—",
    loan_account_number:
      loanRel?.loan_account_number ||
      loanRel?.application_number ||
      (p.loan_account_number as string) ||
      "—",
    loan_product_name:
      loanRel?.loan_product?.name ||
      loanRel?.loan_product_name ||
      (p.loan_product_name as string) ||
      "—",
    payment_date: p.payment_date || p.created_at,
    method: (p.method as ReceiptData["method"]) || "cash",
    reference_number: p.reference_number as string | undefined,
    penalty: (p.penalty_amount as number) || (p.penalty_paid as number) || 0,
    interest: (p.interest_amount as number) || (p.interest_paid as number) || 0,
    principal: (p.principal_amount as number) || (p.principal_paid as number) || 0,
    total: p.amount_paid,
    previous_balance: (p.previous_balance as number) || 0,
    new_balance: (p.new_balance as number) || 0,
    next_due_date: (p.next_due_date as string) || "—",
    collected_by: (p.collected_by as string) || "—",
    remarks: p.remarks || "",
    status: p.status,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReceiptRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  // The card below stays the on-screen view; what comes off the printer is the
  // catalog's Official Receipt — two copies, Borrower's and File.
  const printables = usePrintables();

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    try {
      const repayment = await repaymentService.detail(Number(id));
      if (!repayment) {
        setNotFound(true);
        return;
      }
      setReceipt(mapPaymentToReceipt(repayment));
    } catch {
      setNotFound(true);
      toast.error("We couldn't load the receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  async function handleVoid() {
    if (!receipt || !voidReason.trim()) return;
    setVoiding(true);
    try {
      await repaymentService.void(receipt.id, { void_reason: voidReason.trim() });
      toast.success("Payment voided");
      setShowVoidConfirm(false);
      setVoidReason("");
      fetchReceipt();
    } catch {
      toast.error("We couldn't void the payment. Please try again.");
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (notFound || !receipt) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-4">
        <Receipt className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Receipt not found</p>
        <p className="text-sm text-muted-foreground">
          No receipt exists for ID {id}.
        </p>
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Payments
        </Link>
      </div>
    );
  }

  const status = STATUS_STYLES[receipt.status] ?? {
    label: receipt.status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      {/* Screen-only header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Payments
        </Link>

        <div className="flex gap-2">
          {receipt.status === "completed" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowVoidConfirm(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Void Payment
            </Button>
          )}
          {/* Both buttons open the same document, and that is deliberate: an
              Official Receipt is issued under the payment's own receipt number,
              so a reprint is the same paper, not a new one. Printing the React
              card instead — which is what these used to do — produced an
              on-screen mock-up with no letterhead and only one copy. */}
          <Button
            variant="outline"
            size="sm"
            disabled={printables.isPreparing}
            onClick={() => printables.open("official_receipt", receipt.id)}
          >
            {printables.isPreparing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {printables.isPreparing ? "Preparing…" : "Print Receipt"}
          </Button>
          <Button
            size="sm"
            disabled={printables.isPreparing}
            onClick={() => printables.open("official_receipt", receipt.id)}
          >
            <Printer className="mr-2 h-4 w-4" />
            Reprint
          </Button>
        </div>
      </div>

      {/* Void confirmation dialog */}
      {showVoidConfirm && (
        <div className="print:hidden">
          <Card className="mx-auto max-w-md border-destructive/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Void this payment?</p>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. The payment of ₱{formatCurrency(receipt.total)} for {receipt.borrower_name} will be voided.
              </p>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Reason for voiding (required)"
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowVoidConfirm(false);
                    setVoidReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={voiding || !voidReason.trim()}
                  onClick={handleVoid}
                >
                  {voiding ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt card */}
      <div className="mx-auto w-full max-w-md">
        <Card className="overflow-hidden border shadow-md print:shadow-none print:border-0">
          <CardContent className="p-0">
            {/* Brand header */}
            <div className="bg-brand-orange px-6 py-5 text-center text-white print:bg-black print:text-white">
              <div className="flex items-center justify-center gap-2">
                <Receipt className="h-5 w-5" />
                <span className="text-xl font-extrabold tracking-tight">
                  LENDY.PH
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium opacity-90">
                Official Payment Receipt
              </p>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* Receipt meta */}
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Receipt No.</p>
                  <p className="font-mono text-base font-bold">
                    {receipt.receipt_number}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">
                    {formatDate(receipt.payment_date)}
                  </p>
                </div>
              </div>

              {/* Voided watermark */}
              {receipt.status === "voided" && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-center">
                  <p className="text-sm font-bold uppercase tracking-widest text-destructive">
                    VOID
                  </p>
                  <p className="text-xs text-destructive/80">
                    This receipt has been voided
                  </p>
                </div>
              )}

              <Separator />

              {/* Borrower information */}
              <div className="space-y-2">
                <SectionHeading>Borrower Information</SectionHeading>
                <div className="space-y-1.5">
                  <ReceiptRow label="Name" value={receipt.borrower_name} />
                  <ReceiptRow
                    label="Loan Account"
                    value={receipt.loan_account_number}
                  />
                  <ReceiptRow
                    label="Loan Product"
                    value={receipt.loan_product_name}
                  />
                </div>
              </div>

              <Separator />

              {/* Payment details */}
              <div className="space-y-2">
                <SectionHeading>Payment Details</SectionHeading>
                <div className="space-y-1.5">
                  <ReceiptRow
                    label="Payment Date"
                    value={formatDate(receipt.payment_date)}
                  />
                  <ReceiptRow
                    label="Payment Method"
                    value={METHOD_LABELS[receipt.method] || receipt.method}
                  />
                  {receipt.reference_number && (
                    <ReceiptRow
                      label="Reference No."
                      value={receipt.reference_number}
                    />
                  )}
                </div>
              </div>

              <Separator />

              {/* Payment breakdown */}
              <div className="space-y-2">
                <SectionHeading>Payment Breakdown</SectionHeading>
                <div className="space-y-1.5">
                  <ReceiptRow
                    label="Penalty"
                    value={`₱ ${formatCurrency(receipt.penalty)}`}
                  />
                  <ReceiptRow
                    label="Interest"
                    value={`₱ ${formatCurrency(receipt.interest)}`}
                  />
                  <ReceiptRow
                    label="Principal"
                    value={`₱ ${formatCurrency(receipt.principal)}`}
                  />
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total Paid</span>
                  <span className="font-mono text-base">
                    ₱ {formatCurrency(receipt.total)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Balance summary */}
              <div className="space-y-2">
                <SectionHeading>Balance Summary</SectionHeading>
                <div className="space-y-1.5">
                  <ReceiptRow
                    label="Previous Balance"
                    value={`₱ ${formatCurrency(receipt.previous_balance)}`}
                  />
                  <ReceiptRow
                    label="Amount Paid"
                    value={`₱ ${formatCurrency(receipt.total)}`}
                  />
                  <ReceiptRow
                    label="New Balance"
                    value={`₱ ${formatCurrency(receipt.new_balance)}`}
                    bold
                  />
                  {receipt.next_due_date !== "—" && (
                    <ReceiptRow
                      label="Next Due Date"
                      value={formatDate(receipt.next_due_date)}
                    />
                  )}
                </div>
              </div>

              <Separator />

              {/* Collected by / remarks */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Collected by</span>
                  <span className="font-medium">{receipt.collected_by}</span>
                </div>
                {receipt.remarks && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remarks</span>
                    <span className="max-w-[55%] text-right">
                      {receipt.remarks}
                    </span>
                  </div>
                )}
              </div>

              {/* Signature line */}
              <div className="pt-2 text-center">
                <div className="mx-auto w-40 border-t border-foreground" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Authorized Signature
                </p>
              </div>

              {/* Status badge */}
              <div className="flex justify-center print:hidden">
                <Badge
                  variant="outline"
                  className={status.className}
                >
                  {status.label}
                </Badge>
              </div>

              {/* Footer note */}
              <div className="rounded-md bg-muted/50 px-4 py-3 text-center">
                <p className="text-[11px] text-muted-foreground">
                  This receipt is system-generated.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Keep this as proof of payment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
