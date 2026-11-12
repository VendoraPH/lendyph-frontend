import type {
  InterestCrediting,
  InterestRunStatus,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsApprovalKind,
  SavingsApprovalStatus,
  SavingsHolderType,
  SavingsHold,
  SavingsHoldStatus,
  SavingsHoldType,
  SavingsMethod,
  SavingsProductKind,
  SavingsTransaction,
  SavingsTransactionType,
  SavingsUserRef,
} from "@/types";

import { formatCurrency } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/savings/method-labels";

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
  fee: "Excess withdrawal fee",
  share_capital_transfer: "Transfer to share capital",
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

export { METHOD_LABELS };

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
  member_request: "Member request",
};

/** The hold types staff place by hand (loan retention is v2). */
export const HOLD_TYPE_OPTIONS: ReadonlyArray<{ value: "legal" | "manual"; label: string }> = [
  { value: "manual", label: HOLD_TYPE_LABELS.manual },
  { value: "legal", label: HOLD_TYPE_LABELS.legal },
];

/**
 * The line under the account's "On hold" figure naming what members' portal
 * withdrawal requests reserve, in the server's figure; null when there is
 * none or the backend doesn't send it. The member sees the same money as
 * "Pending withdrawal".
 */
export function heldForRequestsNote(account: Pick<SavingsAccount, "held_for_requests">): string | null {
  const held = account.held_for_requests;
  if (typeof held !== "string" || !/^\d+(\.\d+)?$/.test(held) || /^0+(\.0+)?$/.test(held)) return null;
  return `of which ${formatCurrency(held)} for member requests (a pending withdrawal in the Member Portal)`;
}

/** Where a member request's hold is released instead: deciding the request. */
export const MEMBER_REQUEST_HOLD_NOTE = "Decided in Member Portal → Requests";

/**
 * Whether the holds table offers Release on a hold. A Member Portal
 * withdrawal request's hold (`member_request`) is released only by deciding
 * the request (the server refuses a release here with 422), so it shows
 * where that happens instead.
 */
export function holdReleaseOffer(hold: Pick<SavingsHold, "type" | "status">): { release: boolean; note: string | null } {
  if (hold.status !== "active") return { release: false, note: null };
  if (hold.type === "member_request") return { release: false, note: MEMBER_REQUEST_HOLD_NOTE };
  return { release: true, note: null };
}

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
  share_capital_transfer: "Transfer to share capital",
  reactivation: "Account reactivation",
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

export interface StatusOffer {
  status: "frozen" | "active";
  label: string;
}

/**
 * The status changes offered on an account: freeze an active or dormant one,
 * reactivate a dormant one, unfreeze a frozen one. Unfreezing returns the
 * account to the status the server decides (dormant when it was dormant before
 * it was frozen), so the screen shows the server's answer.
 */
export function statusChangeOffers(account: Pick<SavingsAccount, "status">): StatusOffer[] {
  switch (account.status) {
    case "active":
      return [{ status: "frozen", label: "Freeze" }];
    case "dormant":
      return [
        { status: "active", label: "Reactivate" },
        { status: "frozen", label: "Freeze" },
      ];
    case "frozen":
      return [{ status: "active", label: "Unfreeze" }];
    default:
      return [];
  }
}

const NOT_REVERSIBLE: ReadonlySet<SavingsTransactionType> = new Set([
  "interest",
  "withholding_tax",
  "closing",
  "reversal",
]);

/** The server's own refusals (backend `Reverser`), so the button says why before it is pressed. */
export const FEE_NOT_REVERSIBLE =
  "An excess-withdrawal fee is reversed only with its withdrawal. Reverse the withdrawal instead.";
export const SHARE_CAPITAL_TRANSFER_NOT_REVERSIBLE =
  "A transfer to share capital can't be reversed. To correct one, record a share capital entry taking the amount back out of the member's share capital, then a deposit of it into their savings account.";

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
  if (txn.type === "fee") return FEE_NOT_REVERSIBLE;
  if (txn.type === "share_capital_transfer") return SHARE_CAPITAL_TRANSFER_NOT_REVERSIBLE;
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
