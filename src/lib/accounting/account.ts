/**
 * Account classification rules — which side an account grows on, which
 * statement it lands on, and whether it may be posted to at all.
 *
 * Everything here is derived from the account's own properties rather than
 * looked up per screen, so the balance sheet, the trial balance and the
 * general ledger cannot disagree about what an account means.
 */

import type {
  Account,
  AccountType,
  NormalBalance,
} from "@/types/accounting";

/** Leading digit → classification, the convention the default chart follows. */
const TYPE_BY_PREFIX: Record<string, AccountType> = {
  "1": "asset",
  "2": "liability",
  "3": "equity",
  "4": "income",
  "5": "expense",
};

/**
 * The classification implied by an account code.
 *
 * Returns `null` for a code outside the 1–5 ranges rather than guessing.
 * Administrators can add accounts, and an unclassifiable code should surface
 * as a validation error at the point of creation, not be quietly filed under
 * "asset" and then misreported on every statement afterwards.
 */
export function accountTypeFromCode(code: string): AccountType | null {
  if (!code) return null;
  const first = code.trim()[0];
  return TYPE_BY_PREFIX[first] ?? null;
}

/**
 * Which side increases this account.
 *
 * Assets and expenses are debit-normal; liabilities, equity and income are
 * credit-normal. A contra account inverts its type — "1200 Allowance for
 * Credit Losses" is an asset that carries a credit balance and subtracts from
 * the assets above it.
 */
export function normalBalanceFor(
  type: AccountType,
  isContra: boolean
): NormalBalance {
  const base: NormalBalance =
    type === "asset" || type === "expense" ? "debit" : "credit";
  if (!isContra) return base;
  return base === "debit" ? "credit" : "debit";
}

/**
 * The account's balance expressed in its own normal direction, in centavos.
 *
 * A positive result means the account sits where it should; a negative one
 * means it has swung the other way — an overdrawn cash account, say — which is
 * a real condition and is reported rather than clamped to zero.
 *
 * Because contra accounts are credit-normal, an allowance returns a POSITIVE
 * number here, and callers subtract it from the gross figure.
 */
export function signedBalance(
  account: Pick<Account, "normal_balance">,
  debit: number,
  credit: number
): number {
  return account.normal_balance === "debit" ? debit - credit : credit - debit;
}

export type StatementSection = "balance_sheet" | "income_statement";

/** Which of the two primary statements an account reports on. */
export function belongsToStatement(type: AccountType): StatementSection {
  return type === "income" || type === "expense"
    ? "income_statement"
    : "balance_sheet";
}

/**
 * Whether a journal line may reference this account.
 *
 * Group headers are excluded because their displayed balance is the sum of
 * their subtree: posting to "1100 Loans Receivable" as well as its child
 * "1110 Current Loans Receivable" would count the same money twice. Inactive
 * accounts are excluded so a deactivated account stops accepting new history
 * while keeping the history it already has.
 */
export function isPostable(account: Account): boolean {
  return account.is_active && !account.is_group;
}

/**
 * Accounts in statement order.
 *
 * Codes are fixed-width numeric strings, so a plain lexical compare already
 * yields 1010 → 1020 → 1100 → 2010, which is the order every statement and
 * the chart of accounts tree present. Returns a new array; the caller's is
 * untouched, since these lists usually come straight from a query cache.
 */
export function sortAccounts<T extends Pick<Account, "code">>(
  accounts: T[]
): T[] {
  return [...accounts].sort((a, b) => a.code.localeCompare(b.code));
}
