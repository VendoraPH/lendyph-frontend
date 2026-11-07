/**
 * Savings account statuses: labels, badge tones and the changes a user may
 * ask for. The server owns the transitions (it also turns accounts dormant
 * on its own); this only decides which buttons to offer.
 */
import type {
  SavingsAccountStatus,
  SavingsTransactionStatus,
  SavingsTransactionType,
} from "@/types/savings";

export const ACCOUNT_STATUS_LABEL: Record<SavingsAccountStatus, string> = {
  active: "Active",
  dormant: "Dormant",
  frozen: "Frozen",
  closed: "Closed",
};

export type BadgeTone = "success" | "warning" | "danger" | "muted" | "info";

export const ACCOUNT_STATUS_TONE: Record<SavingsAccountStatus, BadgeTone> = {
  active: "success",
  dormant: "warning",
  frozen: "danger",
  closed: "muted",
};

export type StatusAction = "freeze" | "unfreeze" | "reactivate" | "close";

export const STATUS_ACTION: Record<
  StatusAction,
  { label: string; to: SavingsAccountStatus; description: string }
> = {
  freeze: {
    label: "Freeze",
    to: "frozen",
    description: "No deposits, withdrawals or transfers until it is unfrozen.",
  },
  unfreeze: {
    label: "Unfreeze",
    to: "active",
    description: "The account takes transactions again.",
  },
  reactivate: {
    label: "Reactivate",
    to: "active",
    description: "A dormant account becomes active again.",
  },
  close: {
    label: "Close account",
    to: "closed",
    description: "Pays out the balance and accrued interest. This can't be undone.",
  },
};

const ALLOWED: Record<SavingsAccountStatus, StatusAction[]> = {
  active: ["freeze", "close"],
  dormant: ["reactivate", "freeze", "close"],
  frozen: ["unfreeze"],
  closed: [],
};

/** The status changes offered for an account in `status`. */
export function allowedStatusActions(status: SavingsAccountStatus): StatusAction[] {
  return ALLOWED[status] ?? [];
}

export const TRANSACTION_TYPE_LABEL: Record<SavingsTransactionType, string> = {
  opening_deposit: "Initial deposit",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  interest: "Interest",
  closing_withdrawal: "Closing payout",
  reversal: "Reversal",
};

export const TRANSACTION_STATUS_LABEL: Record<SavingsTransactionStatus, string> = {
  posted: "Posted",
  pending_approval: "Pending approval",
  reversed: "Reversed",
  rejected: "Rejected",
};

export const TRANSACTION_STATUS_TONE: Record<SavingsTransactionStatus, BadgeTone> = {
  posted: "success",
  pending_approval: "warning",
  reversed: "muted",
  rejected: "danger",
};

/** A posted, not-yet-reversed transaction that isn't itself a reversal. */
export function isReversible(tx: {
  status: SavingsTransactionStatus;
  type: SavingsTransactionType;
  pending_reversal?: unknown;
}): boolean {
  return tx.status === "posted" && tx.type !== "reversal" && !tx.pending_reversal;
}
