/**
 * What the Pledge Entry page posts: a member's entry (`POST
 * /share-capital/ledger`) and the bulk batch (`POST /pledges/bulk-entries`),
 * each with how the money came in or went out. The bulk batch takes one method
 * and reference for every row. A reference is required unless cash, and is
 * asked for here before anything is posted.
 */
import type { RecordPaymentMethod } from "@/constants/payment-methods";
import { paymentMethodFields, paymentReferenceError } from "@/lib/payment-reference";
import type { BulkPledgeEntryData, CreateLedgerEntryData } from "@/types/share-capital";

export type EntryType = "credit" | "debit";

export type EntryRequest<T> = { ok: true; data: T } | { ok: false; message: string };

export interface ManualEntryInput {
  borrowerId: number;
  type: EntryType;
  amount: number;
  date: string;
  method: RecordPaymentMethod;
  reference: string;
}

export function manualEntryRequest(input: ManualEntryInput): EntryRequest<CreateLedgerEntryData> {
  const problem = paymentReferenceError(input.method, input.reference, "share_capital");
  if (problem !== null) return { ok: false, message: problem };
  return {
    ok: true,
    data: {
      borrower_id: input.borrowerId,
      date: input.date,
      description: `Manual ${input.type} entry`,
      type: input.type,
      amount: input.amount,
      ...paymentMethodFields(input.method, input.reference),
    },
  };
}

export interface BulkEntryRow {
  pledgeId: number;
  amount: number;
  type: EntryType;
}

export function bulkEntriesRequest(
  rows: BulkEntryRow[],
  date: string,
  method: RecordPaymentMethod,
  reference: string,
): EntryRequest<BulkPledgeEntryData> {
  const problem = paymentReferenceError(method, reference, "share_capital");
  if (problem !== null) return { ok: false, message: problem };
  return {
    ok: true,
    data: {
      // `ShareCapitalBulkEntryRequest` requires a date on every entry.
      entries: rows.map((row) => ({ pledge_id: row.pledgeId, amount: row.amount, type: row.type, date })),
      ...paymentMethodFields(method, reference),
    },
  };
}
