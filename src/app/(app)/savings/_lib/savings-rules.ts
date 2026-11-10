import type {
  InterestCrediting,
  InterestRunStatus,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsApprovalKind,
  SavingsApprovalStatus,
  SavingsHolderType,
  SavingsHoldStatus,
  SavingsHoldType,
  SavingsMethod,
  SavingsProductKind,
  SavingsTransaction,
  SavingsTransactionType,
  SavingsUserRef,
} from "@/types";

/**
 * Savings words and the rules that decide which actions a screen offers.
 * Nothing here reads a money figure: balances, holds, pending amounts and
 * what can be withdrawn are the server's, shown as sent.
 */

/** A key the screen has no words for reads as this, never as the raw key. */
export const UNKNOWN_LABEL = "Other";

/** The words for `key`, or `UNKNOWN_LABEL`; never the key itself. */
export function labelOf<K extends string>(map: Record<K, string>, key: string | null | undefined): string {
  if (key === null || key === undefined || key === "") return "—";
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key as K] : UNKNOWN_LABEL;
}

export const ACCOUNT_STATUS_LABELS: Record<SavingsAccountStatus, string> = {
  active: "Active",
  dormant: "Dormant",
  frozen: "Frozen",
  closed: "Closed",
};

export const TRANSACTION_TYPE_LABELS: Record<SavingsTransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  interest: "Interest",
  withholding_tax: "Withholding tax",
  closing: "Closing payout",
  reversal: "Reversal",
};

export const INTEREST_CREDITING_LABELS: Record<InterestCrediting, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annually",
  annual: "Annually",
};

export const PRODUCT_KIND_LABELS: Record<SavingsProductKind, string> = {
  regular: "Regular savings",
  time_deposit: "Time deposit",
};

export const METHOD_LABELS: Record<SavingsMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  maya: "Maya",
  savings: "Savings account",
};

/** Ways money comes in or goes out over the counter (a savings transfer has its own form). */
export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: Exclude<SavingsMethod, "savings">; label: string }> = [
  { value: "cash", label: METHOD_LABELS.cash },
  { value: "bank_transfer", label: METHOD_LABELS.bank_transfer },
  { value: "gcash", label: METHOD_LABELS.gcash },
  { value: "maya", label: METHOD_LABELS.maya },
];

export const HOLD_TYPE_LABELS: Record<SavingsHoldType, string> = {
  legal: "Legal order",
  manual: "Staff hold",
  loan_retention: "Loan retention",
};

/** The hold types staff place by hand (loan retention is v2). */
export const HOLD_TYPE_OPTIONS: ReadonlyArray<{ value: "legal" | "manual"; label: string }> = [
  { value: "manual", label: HOLD_TYPE_LABELS.manual },
  { value: "legal", label: HOLD_TYPE_LABELS.legal },
];

export const HOLD_STATUS_LABELS: Record<SavingsHoldStatus, string> = {
  active: "Active",
  released: "Released",
  expired: "Expired",
};

export const APPROVAL_KIND_LABELS: Record<SavingsApprovalKind, string> = {
  withdrawal: "Withdrawal",
  close: "Account closing",
  td_payout: "Time deposit payout",
  pretermination: "Time deposit pre-termination",
  reversal: "Reversal",
};

export const APPROVAL_STATUS_LABELS: Record<SavingsApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const HOLDER_TYPE_LABELS: Record<SavingsHolderType, string> = {
  member: "Members",
  non_member: "Walk-ins",
};

export const INTEREST_RUN_STATUS_LABELS: Record<InterestRunStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  posted: "Posted",
  rejected: "Rejected",
  reversed: "Reversed",
};

/** Why an interest line earns nothing. */
export const SKIP_REASON_LABELS: Record<string, string> = {
  below_minimum_adb: "Average daily balance below the product's minimum",
  no_balance: "No balance in the period",
  no_days: "Not open in the period",
  closed: "Account closed",
  no_rate: "No rate in force",
};

/** Who did something; the system when the server sent no user. */
export function actorName(user: SavingsUserRef | null | undefined): string {
  return user?.name ?? "System";
}

/** Deposits are taken on active and dormant accounts (a deposit reactivates a dormant one). */
export function canDeposit(account: Pick<SavingsAccount, "status">): boolean {
  return account.status === "active" || account.status === "dormant";
}

/** Withdrawals and transfers out only from an active account. */
export function canWithdraw(account: Pick<SavingsAccount, "status">): boolean {
  return account.status === "active";
}

/** Holds go on any account that is not closed. */
export function canPlaceHold(account: Pick<SavingsAccount, "status">): boolean {
  return account.status !== "closed";
}

/** Closing is offered while the account is open; the server's closing quote says whether it can go ahead. */
export function canOfferClose(account: Pick<SavingsAccount, "status">): boolean {
  return account.status !== "closed";
}

/** The status change offered on an account, or null: freeze an active or dormant one, unfreeze a frozen one. */
export function statusChangeOffer(
  account: Pick<SavingsAccount, "status">,
): { status: "frozen" | "active"; label: string } | null {
  if (account.status === "frozen") return { status: "active", label: "Unfreeze" };
  if (account.status === "active" || account.status === "dormant") return { status: "frozen", label: "Freeze" };
  return null;
}

const NOT_REVERSIBLE: ReadonlySet<SavingsTransactionType> = new Set([
  "interest",
  "withholding_tax",
  "closing",
  "reversal",
]);

/**
 * Why a transaction can't be reversed, or null when a reversal can be
 * requested. The server refuses the same rows (422, or 409 when reversed or
 * pending).
 */
export function reversalBlocker(
  txn: Pick<
    SavingsTransaction,
    "type" | "time_deposit_id" | "reversed_by_transaction_id" | "pending_reversal_approval_id"
  >,
): string | null {
  if (NOT_REVERSIBLE.has(txn.type) || txn.time_deposit_id !== null) {
    return "Interest, tax, closing, time deposit and reversal lines can't be reversed.";
  }
  if (txn.reversed_by_transaction_id) return "Already reversed.";
  if (txn.pending_reversal_approval_id) return "A reversal is waiting for approval.";
  return null;
}

/** Status tabs, in display order, with counts from `meta.stats` (0 when absent). */
export function statusTabs(stats: Partial<Record<SavingsAccountStatus, number>> | undefined) {
  const order: SavingsAccountStatus[] = ["active", "dormant", "frozen", "closed"];
  return [
    { value: "all", label: "All", count: null as number | null },
    ...order.map((s) => ({ value: s, label: ACCOUNT_STATUS_LABELS[s], count: stats?.[s] ?? 0 })),
  ];
}

export { isNilAmount } from "@/lib/savings/amount-text";
