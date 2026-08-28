import { hasShareCapitalBalance, type ShareCapitalBalance } from "./share-capital";
import type { Collateral, CollateralType, CollateralWithMeta } from "@/types";

/**
 * A collateral row plus whether its value is one the UI will state.
 *
 * `effective_value` stays a plain number because `CollateralWithMeta` says so
 * and every table cell, total and snapshot downstream expects one.
 * `value_unknown` is the flag that stops that number being rendered, summed or
 * booked — it is not "the value is zero", it is "there is no value here".
 */
export type CollateralValueRow = CollateralWithMeta & { value_unknown: boolean };

/**
 * What a collateral is worth, and whether we are willing to say so.
 *
 * Four screens ask this exact question — the collateral listing, the collateral
 * form, a member's collaterals tab, and the two loan forms' security pickers —
 * and every one of them used to answer it with the same three lines:
 *
 *     effective_value: isShareCapital ? scBalance : c.amount
 *
 * where `scBalance` had already been flattened to a number by an old
 * `getShareCapitalBalance` that returned 0 both for a member with no share
 * capital and for a request that failed. Four copies of a rule is how the
 * fix lands in one screen and not the others, so there is now one.
 *
 * The rule itself:
 *
 *  - A `manual`-source collateral is worth its own appraised `amount`. Nothing
 *    about share capital applies, so `balance` is ignored — pass null.
 *  - A `share_capital`-source collateral is worth the member's CURRENT balance,
 *    which is why it is read live rather than stored. If that balance could not
 *    be read in full, the row has no value: `value_unknown` is true and
 *    `effective_value` is a placeholder that callers must not display.
 *
 * `effective_value` is 0 rather than NaN in the unknown case on purpose — NaN
 * propagates into "-₱NaN" the moment one caller forgets to check the flag,
 * whereas 0 at least fails quietly while the flag does the real work. Neither
 * is meant to be shown; the flag is the contract.
 */
export function collateralValue(
  collateral: Pick<Collateral, "amount">,
  type: CollateralType | undefined,
  balance: ShareCapitalBalance | null,
): { effective_value: number; value_unknown: boolean } {
  if (type?.source !== "share_capital") {
    return { effective_value: collateral.amount, value_unknown: false };
  }
  if (balance !== null && hasShareCapitalBalance(balance)) {
    return { effective_value: balance.balance, value_unknown: false };
  }
  return { effective_value: 0, value_unknown: true };
}

/**
 * Sums the rows whose value is known, and counts the ones left out.
 *
 * Every screen showing a collateral total needs both numbers, because a total
 * that silently absorbs an unknown as zero is the same class of quiet wrongness
 * as the clamped ledger it came from. Returning the count alongside the sum is
 * what lets each screen say "excludes N" instead of just being wrong by N rows.
 */
export function sumKnownCollateralValues(
  rows: readonly { effective_value: number; value_unknown: boolean }[],
): { total: number; unknownCount: number } {
  let total = 0;
  let unknownCount = 0;
  for (const row of rows) {
    if (row.value_unknown) unknownCount += 1;
    else total += row.effective_value;
  }
  return { total, unknownCount };
}
