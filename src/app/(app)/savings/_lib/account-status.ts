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

/**
 * Types a teller may not reverse one by one: a reversal is final, interest is
 * undone by reversing its whole batch, and a closing payout closed the account.
 */
const NOT_REVERSIBLE: ReadonlySet<SavingsTransactionType> = new Set(["reversal", "interest", "closing_withdrawal"]);

/** A posted, not-yet-reversed transaction of a type that is reversed on its own. */
export function isReversible(tx: {
  status: SavingsTransactionStatus;
  type: SavingsTransactionType;
  pending_reversal?: unknown;
}): boolean {
  return tx.status === "posted" && !NOT_REVERSIBLE.has(tx.type) && !tx.pending_reversal;
}

/** What one transaction row offers this user. */
export interface TransactionRowActions {
  reverse: boolean;
  /** A pending reversal this user may approve or reject, if any. */
  review: { reversalId: number; ownRequest: boolean } | null;
}

/**
 * Reverse needs `savings:reverse`; approving needs `savings:approve`. The one
 * who asked for a reversal can't approve it (maker ≠ checker): the action is
 * still listed, marked as theirs, so the screen can say why it is disabled.
 * The server refuses it as well.
 */
export function transactionRowActions(
  tx: Parameters<typeof isReversible>[0] & {
    pending_reversal?: { id: number; requested_by: { id: number } | null } | null;
  },
  user: { canReverse: boolean; canApprove: boolean; userId: number | null },
): TransactionRowActions {
  const pending = tx.pending_reversal ?? null;
  return {
    reverse: user.canReverse && isReversible(tx),
    review:
      user.canApprove && pending
        ? {
            reversalId: pending.id,
            ownRequest: user.userId !== null && pending.requested_by?.id === user.userId,
          }
        : null,
  };
}
