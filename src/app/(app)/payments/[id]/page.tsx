"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
// Mock data
// ---------------------------------------------------------------------------

const MOCK_RECEIPTS: ReceiptData[] = [
  {
    id: 1,
    receipt_number: "OR-20260001",
    borrower_name: "Rosario D. Santos",
    loan_account_number: "LN-20260001",
    loan_product_name: "Salary Loan",
    payment_date: "2026-03-15",
    method: "gcash",
    reference_number: "GC-20260315-001",
    penalty: 0,
    interest: 600,
    principal: 3333,
    total: 3933,
    previous_balance: 15000,
    new_balance: 11067,
    next_due_date: "2026-04-15",
    collected_by: "Juan Cashier",
    remarks: "Monthly payment",
    status: "completed",
  },
  {
    id: 2,
    receipt_number: "OR-20260002",
    borrower_name: "Roberto Garcia",
    loan_account_number: "LN-20260002",
    loan_product_name: "Business Loan",
    payment_date: "2026-03-20",
    method: "cash",
    reference_number: undefined,
    penalty: 500,
    interest: 1500,
    principal: 7417,
    total: 9417,
    previous_balance: 75000,
    new_balance: 65583,
    next_due_date: "2026-04-20",
    collected_by: "Maria Cashier",
    remarks: "Payment with penalty for late",
    status: "completed",
  },
  {
    id: 3,
    receipt_number: "OR-20260003",
    borrower_name: "Maria L. Reyes",
    loan_account_number: "LN-20260003",
    loan_product_name: "Emergency Loan",
    payment_date: "2026-03-28",
    method: "maya",
    reference_number: "MY-20260328-001",
    penalty: 0,
    interest: 350,
    principal: 608,
    total: 958,
    previous_balance: 7000,
    new_balance: 6042,
    next_due_date: "2026-04-05",
    collected_by: "Juan Cashier",
    remarks: "Weekly payment",
    status: "completed",
  },
  {
    id: 4,
    receipt_number: "OR-20260004",
    borrower_name: "Eduardo Mendoza",
    loan_account_number: "LN-20260004",
    loan_product_name: "OFW Loan",
    payment_date: "2026-03-25",
    method: "bank_transfer",
    reference_number: "BDO-20260325-001",
    penalty: 0,
    interest: 600,
    principal: 4108,
    total: 4708,
    previous_balance: 30000,
    new_balance: 25292,
    next_due_date: "2026-04-25",
    collected_by: "Juan Cashier",
    remarks: "",
    status: "completed",
  },
  {
    id: 5,
    receipt_number: "OR-20260005",
    borrower_name: "Roberto Garcia",
    loan_account_number: "LN-20260002",
    loan_product_name: "Business Loan",
    payment_date: "2026-02-20",
    method: "cash",
    reference_number: undefined,
    penalty: 0,
    interest: 1500,
    principal: 7917,
    total: 9417,
    previous_balance: 84417,
    new_balance: 75000,
    next_due_date: "2026-03-20",
    collected_by: "Maria Cashier",
    remarks: "Regular monthly",
    status: "voided",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const METHOD_LABELS: Record<ReceiptData["method"], string> = {
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
    className: "bg-green-100 text-green-800 border-green-200",
  },
  voided: {
    label: "Voided",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
};

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
  const receiptId = parseInt(id, 10);

  const receipt = MOCK_RECEIPTS.find((r) => r.id === receiptId);

  if (!receipt) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
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

  const status = STATUS_STYLES[receipt.status];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Screen-only header                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Payments
        </Link>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Reprint
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Receipt card                                                         */}
      {/* ------------------------------------------------------------------ */}
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
                    value={METHOD_LABELS[receipt.method]}
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
                  <ReceiptRow
                    label="Next Due Date"
                    value={formatDate(receipt.next_due_date)}
                  />
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
