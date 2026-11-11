import type { Account } from "@/types";

/**
 * The money accounts the New reconciliation form offers. They come from
 * `GET /accounting/reconciliations/accounts`, which needs only
 * `accounting:reconcile`; an older backend without it (404) falls back to
 * the chart's money accounts, as the form read before.
 */

/** One reconcilable cash or bank account, as the server sends it. */
export interface ReconcilableAccount {
  id: number;
  code: string;
  name: string;
  /** The account's type in words ("Cash", "Bank"). */
  type?: string | null;
}

/** What the picker needs of an account. */
export type StartAccount = Pick<Account, "id" | "code" | "name">;

export type StartAccountsAnswer =
  | { state: "loading" }
  | { state: "list"; accounts: ReconcilableAccount[] }
  /** The backend has no such list (404): use the chart's money accounts. */
  | { state: "missing" }
  | { state: "failed" };

export interface ChartMoneyAccounts {
  loading: boolean;
  /** The chart couldn't be read (no permission, or not built), so its accounts aren't real. */
  isTemplate: boolean;
  /** The chart's active, postable accounts that carry a cash kind. */
  moneyAccounts: Account[];
}

export type StartAccounts =
  | { status: "loading" }
  | { status: "ready"; accounts: StartAccount[] }
  | { status: "unavailable"; reason: string };

export const CHART_UNAVAILABLE = "The chart of accounts isn't available, so no account can be picked.";
export const START_ACCOUNTS_FAILED = "The money accounts couldn't be loaded. Reload the page to try again.";
export const NO_MONEY_ACCOUNT = "No money account is set up yet.";

export function startAccounts(answer: StartAccountsAnswer, chart: ChartMoneyAccounts): StartAccounts {
  switch (answer.state) {
    case "loading":
      return { status: "loading" };
    case "list":
      return { status: "ready", accounts: answer.accounts };
    case "failed":
      return { status: "unavailable", reason: START_ACCOUNTS_FAILED };
    case "missing":
      if (chart.loading) return { status: "loading" };
      if (chart.isTemplate) return { status: "unavailable", reason: CHART_UNAVAILABLE };
      return { status: "ready", accounts: chart.moneyAccounts };
  }
}

/** Why New reconciliation is disabled, as far as the accounts go; null when it isn't. */
export function startAccountsReason(accounts: StartAccounts): string | null {
  if (accounts.status === "unavailable") return accounts.reason;
  if (accounts.status === "ready" && accounts.accounts.length === 0) return NO_MONEY_ACCOUNT;
  return null;
}
