/**
 * A Ledger row's Ref No, picked from the payment it names; nothing is added
 * up. Pure, so it runs under `tsx --test`.
 */
type ReceiptRef = { id: number; receipt_number?: string | null };

/** A repayment row's Ref No: its receipt number, else its id as an OR number. */
export function repaymentRefNo(repayment: ReceiptRef): string {
  return repayment.receipt_number || `OR-${String(repayment.id).padStart(6, "0")}`;
}
