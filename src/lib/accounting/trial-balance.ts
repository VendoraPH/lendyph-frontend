/**
 * Trial balance assembly and general-ledger running balances.
 *
 * The trial balance is the proof that the books hold together: every account's
 * net balance, placed in the column it naturally falls on, with the two
 * columns adding to the same figure. If a properly built posting engine is the
 * only thing writing journals, this can never fail — which is exactly why it
 * is worth showing. A difference here means something wrote to the ledger
 * without going through the double-entry gate.
 */

import { signedBalance } from "./account";
import type {
  Account,
  TrialBalance,
  TrialBalanceRow,
} from "@/types/accounting";

/** An account plus its total movement over the period, in centavos. */
export interface AccountBalanceInput {
  account: Account;
  debit: number;
  credit: number;
}

/**
 * Builds the trial balance as of a date.
 *
 * Three things happen to each account, and all three matter:
 *
 * 1. It is NETTED. An account debited ₱500 and credited ₱200 is one ₱300
 *    debit, not both figures side by side — otherwise the totals double-count
 *    every account that saw movement in both directions.
 * 2. It is PLACED by where it actually landed, not by where it should be. An
 *    overdrawn cash account has a credit balance and is shown in the credit
 *    column; recording it as a negative debit would make the columns balance
 *    on paper while hiding a condition someone needs to see.
 * 3. It is DROPPED if it nets to zero, so the report shows the accounts that
 *    moved rather than the whole chart.
 *
 * Group headers are excluded entirely: their balance is the sum of their
 * children, so including both would count the same money twice.
 */
export function buildTrialBalance(
  balances: AccountBalanceInput[],
  asOf: string
): TrialBalance {
  const rows: TrialBalanceRow[] = [];

  for (const { account, debit, credit } of balances) {
    if (account.is_group) continue;

    const net = signedBalance(account, debit, credit);
    if (net === 0) continue;

    // `net` is positive when the account sits on its normal side. A negative
    // net means it swung the other way, so the amount belongs in the opposite
    // column — as a positive number, because a trial balance has no negatives.
    const onNormalSide = net > 0;
    const amount = Math.abs(net);
    const isDebitColumn =
      account.normal_balance === "debit" ? onNormalSide : !onNormalSide;

    rows.push({
      account_id: account.id,
      account_code: account.code,
      account_name: account.name,
      type: account.type,
      debit: isDebitColumn ? amount : 0,
      credit: isDebitColumn ? 0 : amount,
    });
  }

  // Codes are fixed-width numeric strings, so lexical order is statement
  // order: 1010 → 1110 → 2010 → 4010.
  const sorted = rows.sort((a, b) => a.account_code.localeCompare(b.account_code));

  const total_debit = sorted.reduce((sum, r) => sum + r.debit, 0);
  const total_credit = sorted.reduce((sum, r) => sum + r.credit, 0);
  const difference = total_debit - total_credit;

  return {
    as_of: asOf,
    rows: sorted,
    total_debit,
    total_credit,
    difference,
    is_balanced: difference === 0,
  };
}

/**
 * The running balance after each posting, for one account's ledger page.
 *
 * Accumulates in the account's normal direction, so a cash ledger reads as the
 * cash actually on hand rather than as a raw debit-minus-credit that would go
 * negative for every credit-normal account.
 *
 * Returns one figure per movement, in the order given — the caller is
 * responsible for handing them over already sorted by date, since "running"
 * means nothing against an arbitrary order.
 */
export function runningBalances(
  account: Pick<Account, "normal_balance">,
  movements: Array<{ debit: number; credit: number }>,
  openingBalance: number
): number[] {
  let balance = openingBalance;
  return movements.map((movement) => {
    balance += signedBalance(account, movement.debit, movement.credit);
    return balance;
  });
}
