/**
 * The loan id in `?edit={loanId}`, or null for a new application.
 *
 * Shared by the form and the page's guard: edit mode needs `loans:update` and
 * a new application `loans:create`, so the two must agree on which mode a URL
 * means — a malformed id is a new application to both.
 */
export function parseEditLoanId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
