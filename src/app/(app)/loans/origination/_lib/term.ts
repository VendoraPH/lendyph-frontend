/**
 * A loan term in words with its unit. The staff application and assessment
 * send the term as a number with the loan product's unit beside it
 * (`term_unit`). A term with no unit means months, as on the server
 * (`term_unit ?? months`) and on the app's loan pages.
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
