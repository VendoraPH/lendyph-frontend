import type {
  InterestPosting,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsProduct,
  SavingsProductInput,
  SavingsTransactionType,
} from "@/types";

/** A money field as a number: `decimal:2` strings, null and garbage all read safely (garbage as 0). */
export function toAmount(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** A typed amount, or null when it is blank or not a positive number with at most 2 decimals. */
export function parseAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
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
  interest: "Interest",
  withholding_tax: "Withholding tax",
  fee: "Fee",
  adjustment: "Adjustment",
  closing: "Closing payout",
};

export const INTEREST_POSTING_LABELS: Record<InterestPosting, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annually",
  annual: "Annually",
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "check", label: "Check" },
] as const;

/** Deposits are taken on active and dormant accounts (a deposit reactivates a dormant one). */
export function canDeposit(account: Pick<SavingsAccount, "status">): boolean {
  return account.status === "active" || account.status === "dormant";
}

/** Withdrawals only from an active account; dormant and frozen ones need staff action first. */
export function canWithdraw(account: Pick<SavingsAccount, "status">): boolean {
  return account.status === "active";
}

export function canClose(account: Pick<SavingsAccount, "status" | "hold_amount">): boolean {
  return account.status !== "closed" && toAmount(account.hold_amount) === 0;
}

/**
 * Why an opening deposit is refused, or null. The server re-checks; this is
 * so the teller hears it before submitting.
 */
export function openingDepositProblem(
  amount: number | null,
  product: Pick<SavingsProduct, "minimum_opening_balance"> | null,
): string | null {
  if (amount === null) return "Enter the opening deposit.";
  const min = toAmount(product?.minimum_opening_balance);
  if (product && amount < min) return `This product needs at least ${min.toFixed(2)} to open.`;
  return null;
}

/** Why a withdrawal is refused, or null. `available_balance` already nets out holds and the maintaining balance. */
export function withdrawalProblem(
  amount: number | null,
  account: Pick<SavingsAccount, "available_balance">,
): string | null {
  if (amount === null) return "Enter an amount.";
  const available = toAmount(account.available_balance);
  if (amount > available) return `Only ${available.toFixed(2)} is available to withdraw.`;
  return null;
}

/** The fields a product form must fix before saving, by label. */
export function productProblems(input: SavingsProductInput): string[] {
  const problems: string[] = [];
  if (!input.code.trim()) problems.push("Code");
  if (!input.name.trim()) problems.push("Name");
  const rate = toAmount(input.annual_interest_rate);
  if (rate < 0 || rate > 100) problems.push("Interest rate (0–100%)");
  if (toAmount(input.minimum_opening_balance) < 0) problems.push("Minimum opening balance");
  if (toAmount(input.maintaining_balance) < 0) problems.push("Maintaining balance");
  if (toAmount(input.minimum_balance_for_interest) < 0) problems.push("Minimum balance to earn interest");
  if (input.dormant_after_days !== null && (!Number.isInteger(input.dormant_after_days) || input.dormant_after_days < 1)) {
    problems.push("Dormant after (days)");
  }
  return problems;
}

/** Status tabs, in display order, with counts from `meta.stats` (0 when absent). */
export function statusTabs(stats: Record<string, number> | undefined) {
  const order: SavingsAccountStatus[] = ["active", "dormant", "frozen", "closed"];
  const counts = order.map((s) => stats?.[s] ?? 0);
  return [
    { value: "all", label: "All", count: counts.reduce((a, b) => a + b, 0) },
    ...order.map((s, i) => ({ value: s, label: ACCOUNT_STATUS_LABELS[s], count: counts[i] })),
  ];
}
