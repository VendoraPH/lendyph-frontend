/**
 * Centavo arithmetic for the accounting module.
 *
 * Every amount in accounting is an integer number of centavos. Pesos are a
 * display format and nothing else. The reason is narrow and non-negotiable: a
 * posted journal must satisfy `debit === credit` exactly, and IEEE-754 cannot
 * represent 0.1 — sum a few thousand peso floats and the books drift off
 * balance by a centavo that no one can account for. Integers have no such
 * failure mode below 2^53 centavos (≈ ₱90 trillion), which is comfortably
 * beyond any portfolio this system will hold.
 *
 * Convert at the edges: `toCentavos` where user input and API payloads come
 * in, `formatCentavos` where figures go out.
 */

/** Matches a positive decimal with at most one dot. Grouping is stripped first. */
const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Parses user input or an API decimal string into centavos.
 *
 * Returns `null` for anything that is not a usable amount — blank, whitespace,
 * text, or negative. Blank is deliberately `null` rather than `0`: in a
 * journal line an empty debit box means "this side is unused", while ₱0.00
 * means "this side is zero", and the entry form has to tell them apart.
 *
 * Negatives are refused because direction belongs to the column, not the sign.
 * A "-100" debit is a 100 credit, and accepting both spellings would let two
 * visually different entries post the same numbers.
 */
export function toCentavos(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return roundHalfUp(value * 100);
  }

  // Strip what people and currency formatters add: peso sign, thousands
  // separators, spaces (including the narrow no-break space Intl emits).
  const cleaned = value.replace(/[₱,\s  ]/g, "");
  if (!cleaned) return null;
  if (!DECIMAL.test(cleaned)) return null;

  const pesos = Number(cleaned);
  if (!Number.isFinite(pesos)) return null;
  return roundHalfUp(pesos * 100);
}

/**
 * Rounds to a whole centavo, half away from zero.
 *
 * `Math.round` is half-UP, which biases positive, and multiplying by 100 can
 * land a hair below the true value (1.555 * 100 === 155.49999999999997). The
 * epsilon nudge pulls such cases back onto the intended boundary before
 * rounding, so 1.555 becomes 156 rather than 155.
 */
function roundHalfUp(centavos: number): number {
  const nudged = centavos + Math.sign(centavos) * Number.EPSILON * Math.abs(centavos);
  return Math.round(nudged);
}

/** Centavos back to pesos, for display or for an API that wants decimals. */
export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

/**
 * Peso-formatted for display.
 *
 * Kept here rather than reusing `@/lib/format`'s `formatCurrency` because that
 * one takes pesos and this module's unit is centavos — routing through it
 * would mean every call site doing its own division, which is exactly the
 * conversion this module exists to centralise.
 */
export function formatCentavos(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const pesos = Math.abs(centavos) / 100;
  return `${sign}₱${pesos.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Total of a list, skipping absent values. Exact, because integers.
 *
 * `string` is in the signature because it is in the responses. Laravel's
 * `decimal:2` cast serialises to a JSON STRING — `"150050"`, not `150050` —
 * and every centavo field here is typed `number` on the strength of a contract
 * no compiler checks at the wire. The old body tested `typeof value === "number"`
 * and so skipped those silently: each card on Cash & Bank formatted correctly
 * (`formatCentavos` coerces via arithmetic) while the "Total across all money
 * accounts" beside them read ₱0.00. A total that disagrees with the rows above
 * it is worse than no total, and nothing in the types could ever have caught it.
 *
 * Coercion follows the house pattern already proven in `toShareCapitalBalance`:
 * `Number()`, then skip anything non-finite rather than let one bad row poison
 * the sum into `NaN` and render "₱NaN".
 *
 * Fractional values are rounded to a whole centavo through the same
 * `roundHalfUp` `toCentavos` uses. This is a no-op for every legitimate caller —
 * integers round to themselves — and exists only so sub-centavo dust cannot
 * accumulate into a total that fails `isBalanced` against an exact one. It
 * cannot rescue a field that arrives in PESOS where centavos were promised;
 * that is a backend contract breach, and no client-side policy fixes it.
 */
export function sumCentavos(
  values: Array<number | string | null | undefined>
): number {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const amount = Number(value);
    if (!Number.isFinite(amount)) continue;
    total += Number.isInteger(amount) ? amount : roundHalfUp(amount);
  }
  return total;
}

/**
 * Whether two sides agree. Exact equality, on purpose — there is no tolerance
 * band in double-entry bookkeeping, and integers make none necessary.
 */
export function isBalanced(debit: number, credit: number): boolean {
  return debit === credit;
}
