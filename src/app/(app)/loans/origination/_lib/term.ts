/**
 * A loan term in words with its unit. The staff application and assessment
 * send the term as a number only, in the loan product's own unit, so the unit
 * comes from the product (`term_unit`). A product with none means months, as
 * on the server (`term_unit ?? months`) and on the app's loan pages.
 */

const UNITS: Record<string, [one: string, many: string]> = {
  days: ["day", "days"],
  weeks: ["week", "weeks"],
  months: ["month", "months"],
};

export function termText(term: number | null | undefined, unit: string | null | undefined): string | null {
  if (term === null || term === undefined) return null;
  const [one, many] = UNITS[unit ?? "months"] ?? UNITS.months;
  return `${term} ${term === 1 ? one : many}`;
}

/** The unit of a loan product's term, from the products the page read; undefined when it isn't known. */
export function termUnitOf(
  products: readonly { id: number; term_unit?: string | null }[],
  productId: number | null | undefined,
): string | undefined {
  if (productId === null || productId === undefined) return undefined;
  return products.find((p) => p.id === productId)?.term_unit ?? undefined;
}
