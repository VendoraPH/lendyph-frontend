import type { Ref } from "react";
import { ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/format";
import { INSURANCE_PREMIUM_LABEL } from "@/lib/insurance-premium";
import { METHOD_LABELS, STATUS_STYLES, type ReceiptData } from "../_lib/receipt-data";

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono">{value}</span>
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

interface ReceiptCardProps {
  receipt: ReceiptData;
  /**
   * "public" is the shared link's view: it leaves out who collected or voided
   * the payment and the staff remarks, even if a backend ever sends them.
   */
  variant?: "staff" | "public";
  /** The node "Download Image" captures: the whole card, however far it is scrolled. */
  ref?: Ref<HTMLDivElement>;
}

/** The on-screen payment receipt, shared by the staff page and the public link. */
export function ReceiptCard({ receipt, variant = "staff", ref }: ReceiptCardProps) {
  const isPublic = variant === "public";
  const status = STATUS_STYLES[receipt.status] ?? {
    label: receipt.status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div ref={ref} className="mx-auto w-full max-w-md">
      <Card className="overflow-hidden border shadow-md print:shadow-none print:border-0">
        <CardContent className="p-0">
          {/* Brand header */}
          <div className="bg-brand-orange px-6 py-5 text-center text-white print:bg-black print:text-white">
            <div className="flex items-center justify-center gap-2">
              <ReceiptText className="h-5 w-5" />
              <span className="text-xl font-extrabold tracking-tight">LENDY.PH</span>
            </div>
            <p className="mt-0.5 text-sm font-medium opacity-90">Official Payment Receipt</p>
          </div>

          <div className="space-y-5 px-6 py-5">
            {/* Receipt meta */}
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Receipt No.</p>
                <p className="font-mono text-base font-bold">{receipt.receipt_number}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{formatDate(receipt.payment_date)}</p>
              </div>
            </div>

            {/* Voided watermark */}
            {receipt.status === "voided" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-destructive">VOID</p>
                <p className="text-xs text-destructive/80">This receipt has been voided</p>
                {!isPublic && (
                  <p className="text-xs text-destructive/80">Voided by {receipt.voided_by}</p>
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Member Information</SectionHeading>
              <div className="space-y-1.5">
                <ReceiptRow label="Name" value={receipt.borrower_name} />
                <ReceiptRow label="Loan Account" value={receipt.loan_account_number} />
                <ReceiptRow label="Loan Product" value={receipt.loan_product_name} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Payment Details</SectionHeading>
              <div className="space-y-1.5">
                <ReceiptRow label="Payment Date" value={formatDate(receipt.payment_date)} />
                <ReceiptRow
                  label="Payment Method"
                  value={METHOD_LABELS[receipt.method] || receipt.method}
                />
                {receipt.reference_number && (
                  <ReceiptRow label="Reference No." value={receipt.reference_number} />
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Payment Breakdown</SectionHeading>
              <div className="space-y-1.5">
                {receipt.insurance !== null && (
                  <ReceiptRow label={INSURANCE_PREMIUM_LABEL} value={formatCurrency(receipt.insurance)} />
                )}
                <ReceiptRow label="Penalty" value={formatCurrency(receipt.penalty)} />
                <ReceiptRow label="Interest" value={formatCurrency(receipt.interest)} />
                <ReceiptRow label="Principal" value={formatCurrency(receipt.principal)} />
                {receipt.extras.map((line) => (
                  <ReceiptRow key={line.label} label={line.label} value={line.amount} />
                ))}
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Total Paid</span>
                <span className="font-mono text-base">{formatCurrency(receipt.total)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Balance Summary</SectionHeading>
              <div className="space-y-1.5">
                {/* The stored balances are principal only, so they are
                    labelled that way; the premium collected is its own row. */}
                <ReceiptRow
                  label="Principal balance before payment"
                  value={formatCurrency(receipt.previous_balance)}
                />
                <ReceiptRow label="Amount Paid" value={formatCurrency(receipt.total)} />
                {receipt.insurance !== null && (
                  <ReceiptRow
                    label="Insurance premium collected"
                    value={formatCurrency(receipt.insurance)}
                  />
                )}
                <ReceiptRow
                  label="Principal balance after payment"
                  value={formatCurrency(receipt.new_balance)}
                  bold
                />
                {receipt.next_due_date !== "—" && (
                  <ReceiptRow label="Next Due Date" value={formatDate(receipt.next_due_date)} />
                )}
              </div>
            </div>

            {!isPublic && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Collected by</span>
                    <span className="font-medium">{receipt.collected_by}</span>
                  </div>
                  {receipt.remarks && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remarks</span>
                      <span className="max-w-[55%] text-right">{receipt.remarks}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Signature line */}
            <div className="pt-2 text-center">
              <div className="mx-auto w-40 border-t border-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">Authorized Signature</p>
            </div>

            <div className="flex justify-center print:hidden">
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>

            <div className="rounded-md bg-muted/50 px-4 py-3 text-center">
              <p className="text-[11px] text-muted-foreground">This receipt is system-generated.</p>
              <p className="text-[11px] text-muted-foreground">Keep this as proof of payment.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
