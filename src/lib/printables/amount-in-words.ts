/**
 * Peso amounts spelled out in words.
 *
 * Extracted verbatim (in behaviour) from `loan-document-templates.ts` — removed
 * in the reporting & printables release; see git history — where it existed
 * only to fill the "sum of ____ (PHP ____)" clause of a promissory note. It is a module of its own now because four of the eight printables need
 * it — a promissory note, a release voucher, an official receipt and a share
 * capital certificate all state the amount in words, which is what makes the
 * figure legally controlling if the numerals are later altered.
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

/**
 * Spell a whole number. Returns "" for 0 — callers decide whether a zero
 * component is spoken ("Zero Pesos") or simply omitted ("...and Fifty
 * Centavos").
 *
 * Tops out at "Thousand Million" rather than gaining a Billion tier, exactly as
 * the original did. No cooperative loan, share balance or receipt reaches ten
 * figures, and inventing a tier here would silently change the wording of a
 * document that is already in circulation.
 */
function spell(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? " " + ONES[n % 10]! : "");
  if (n < 1000) {
    return ONES[Math.floor(n / 100)]! + " Hundred" + (n % 100 ? " " + spell(n % 100) : "");
  }
  if (n < 1_000_000) {
    return spell(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + spell(n % 1000) : "");
  }
  return spell(Math.floor(n / 1_000_000)) + " Million" + (n % 1_000_000 ? " " + spell(n % 1_000_000) : "");
}

/**
 * `1234.5` -> `"One Thousand Two Hundred Thirty Four Pesos and Fifty Centavos"`.
 *
 * Zero, negative and non-finite amounts all read "Zero Pesos" — a legal
 * document must never print a blank or a `NaN` where a sum belongs.
 *
 * Two degenerate cases the original produced malformed output for are handled
 * here, because both are reachable from a receipt (the original was only ever
 * called with a loan principal, so neither could occur):
 *   - amounts under one peso spelled as `" Pesos and Fifty Centavos"`, with a
 *     leading space and no pesos word at all;
 *   - centavos rounding up to 100, which printed "One Hundred Centavos"
 *     instead of carrying into the pesos.
 * Splitting a single rounded centavo total fixes both and, as a bonus, avoids
 * the float drift in `(amount - Math.floor(amount)) * 100`.
 */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Zero Pesos";

  const totalCentavos = Math.round(amount * 100);
  const pesos = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const words = pesos === 0 ? "Zero Pesos" : `${spell(pesos)} Pesos`;
  return centavos > 0 ? `${words} and ${spell(centavos)} Centavos` : words;
}
