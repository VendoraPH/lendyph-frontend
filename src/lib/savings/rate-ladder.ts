import { formatCurrency, formatRate } from "@/lib/format";
import type { SavingsRateTier } from "@/types";

/**
 * A savings rate ladder in words (gap round S2): the staff product screens
 * and the Member Portal read the server's tiers the same way. Rates are shown
 * as sent, never rounded; nothing is worked out.
 */

/** A tier's balance band as the rate dialog heads it: "Any balance" or "₱50,000.00 and up". */
export function tierLabel(minBalance: string | null | undefined): string {
  return minBalance == null ? "Any balance" : `${formatCurrency(minBalance)} and up`;
}

/**
 * A ladder in words, one line a tier: the base tier reads "Below ₱X" (the
 * first tier's minimum) when there are tiers above it, else "Any balance".
 */
export function ladderLines(tiers: ReadonlyArray<Pick<SavingsRateTier, "min_balance" | "annual_rate">>): string[] {
  return tiers.map((t) => `${tierBand(tiers, t.min_balance)}: ${formatRate(t.annual_rate)}% a year`);
}

/**
 * The band of the tier starting at `minBalance` within `ladder`: the base tier
 * reads "Below ₱X" (the next tier's minimum) when a tier sits above it.
 */
export function tierBand(
  ladder: ReadonlyArray<{ min_balance: string | null }>,
  minBalance: string | null | undefined,
): string {
  const above = ladder.find((t) => t.min_balance != null);
  return minBalance == null && above?.min_balance != null ? `Below ${formatCurrency(above.min_balance)}` : tierLabel(minBalance);
}
