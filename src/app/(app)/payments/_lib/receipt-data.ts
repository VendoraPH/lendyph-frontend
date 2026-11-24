import { repaymentInsuranceApplied } from "@/lib/insurance-premium";
import { readablePaymentRemarks } from "@/lib/printables/legacy-remarks";
import { receiptExtraLines, type ReceiptExtraLine } from "@/lib/receipt-extras";
import { voidedByName } from "../history/_lib/payment-history";
import type { Repayment } from "@/types";

/**
 * One payment receipt as the receipt card shows it. The staff page
 * (/payments/{id}) builds it with `mapPaymentToReceipt`.
 */
export interface ReceiptData {
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
  /** Insurance premium owed on the loan that this payment collected first. */
  insurance: number | null;
  /** Share Capital Build-Up and Advance / Overpayment, as the server sent them. */
  extras: ReceiptExtraLine[];
  total: number;
  previous_balance: number;
  new_balance: number;
  next_due_date: string;
  collected_by: string;
  remarks: string;
  voided_by: string;
  status: "completed" | "voided" | "pending";
}

export const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  online: "Online",
};

export const STATUS_STYLES: Record<ReceiptData["status"], { label: string; className: string }> = {
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

/** Map an API repayment to the receipt card's shape. */
export function mapPaymentToReceipt(payment: Repayment): ReceiptData {
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
    reference_number: (p.reference_number as string | null) || undefined,
    penalty: (p.penalty_amount as number) || (p.penalty_paid as number) || 0,
    interest: (p.interest_amount as number) || (p.interest_paid as number) || 0,
    principal: (p.principal_amount as number) || (p.principal_paid as number) || 0,
    insurance: repaymentInsuranceApplied(p),
    extras: receiptExtraLines(p),
    total: p.amount_paid,
    previous_balance: (p.previous_balance as number) || 0,
    new_balance: (p.new_balance as number) || 0,
    next_due_date: (p.next_due_date as string) || "—",
    collected_by: (p.collected_by as string) || "—",
    remarks: readablePaymentRemarks(p.remarks),
    voided_by: voidedByName(p),
    status: p.status,
  };
}
