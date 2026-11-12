import { toCentavos } from "@/lib/accounting/money";

/** The server's limit on a transfer's reference. */
export const TRANSFER_REFERENCE_MAX = 64;

export interface TransferForm {
  date: string;
  fromId: number | null;
  toId: number | null;
  /** As typed, in pesos. */
  amount: string;
  charge: string;
  reference: string;
  description: string;
  /**
   * The branch picked by a `branches:view_all` caller (null: No branch).
   * Undefined for a branch user, who sees no picker: nothing is sent and the
   * server records their own branch.
   */
  branchId?: number | null;
}

/** What `POST /accounting/cash-accounts/transfer` takes. Centavos. */
export interface TransferPayload {
  date: string;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  charge?: number;
  description: string;
  /** Left out when blank, so a transfer without one sends the same body as before. */
  reference?: string;
  /** Sent only for a `branches:view_all` caller; see `TransferForm.branchId`. */
  branch_id?: number | null;
}

/**
 * The transfer body, or null while the form can't be sent: both accounts,
 * two different ones, an amount above zero, a description, and a reference
 * within the server's limit.
 */
export function buildTransferPayload(form: TransferForm): TransferPayload | null {
  const amount = toCentavos(form.amount);
  const charge = toCentavos(form.charge);
  const description = form.description.trim();
  const reference = form.reference.trim();

  if (form.fromId === null || form.toId === null || form.fromId === form.toId) return null;
  if (amount === null || amount <= 0) return null;
  if (!description) return null;
  if (reference.length > TRANSFER_REFERENCE_MAX) return null;

  const payload: TransferPayload = {
    date: form.date,
    from_account_id: form.fromId,
    to_account_id: form.toId,
    amount,
    description,
  };
  if (charge !== null) payload.charge = charge;
  if (reference) payload.reference = reference;
  if (form.branchId !== undefined) payload.branch_id = form.branchId;
  return payload;
}
