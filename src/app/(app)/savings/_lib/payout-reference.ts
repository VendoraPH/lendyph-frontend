/**
 * A payout's reference recorded after the transfer (finish run round 6). A
 * withdrawal, closing payout or time deposit payout sent by bank transfer,
 * GCash or Maya is often posted before its reference exists, so it can be
 * recorded once afterwards. Whether a row offers "Record reference" is the
 * server's `can_record_reference`; these are the field's own checks, in the
 * server's words, and the "Payouts missing a reference" list's filters. The
 * count on the dashboard is the server's. Dependency-free, so it runs under
 * `tsx --test`.
 */

/** The longest reference each record takes, as its posting request allows. */
export const RECORD_REFERENCE_MAX = {
  transaction: 64,
  time_deposit: 100,
} as const;

export type PayoutSource = keyof typeof RECORD_REFERENCE_MAX;

/** Why the typed reference can't be sent, in the server's words, or null. */
export function recordReferenceProblem(reference: string, source: PayoutSource): string | null {
  const typed = reference.trim();
  if (typed === "") return "Enter the reference of this payout.";
  const max = RECORD_REFERENCE_MAX[source];
  return typed.length > max ? `The reference can be at most ${max} characters.` : null;
}

/** The typed (outside) reference of a line, or a dash. */
export function typedReference(value: string | null | undefined): string {
  const typed = (value ?? "").trim();
  return typed === "" ? "—" : typed;
}

export const MISSING_REFERENCE_METHOD_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
] as const;

export interface MissingReferenceFilters {
  page: number;
  branchId: number | undefined;
  dateFrom: string;
  dateTo: string;
  /** "all" or a method. */
  method: string;
}

/** `GET /savings/payouts/missing-reference`'s params, leaving out what isn't chosen. */
export function missingReferenceParams(filters: MissingReferenceFilters): Record<string, string | number> {
  const params: Record<string, string | number> = { page: filters.page };
  if (filters.branchId !== undefined) params.branch_id = filters.branchId;
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  if (filters.method !== "all") params.method = filters.method;
  return params;
}

export type RegisterView = "all" | "missing-reference";

/** Savings Transactions opened on "Payouts missing a reference" (the dashboard's link). */
export const MISSING_REFERENCE_HREF = "/savings/transactions?view=missing-reference";

/** The register's tab from its `view` param: the full register unless the missing list is asked for. */
export function registerViewOf(param: string | null | undefined): RegisterView {
  return param === "missing-reference" ? "missing-reference" : "all";
}

/** The dashboard's line for the server's count, or null when the server sent none. */
export function missingReferenceCountText(count: number | null | undefined): string | null {
  if (count === null || count === undefined) return null;
  if (count === 0) return "Every non-cash payout has its reference.";
  return count === 1
    ? "1 payout by bank transfer, GCash or Maya has no reference yet."
    : `${count} payouts by bank transfer, GCash or Maya have no reference yet.`;
}

/** The method in the empty list's words. */
const EMPTY_METHOD_WORDS: Readonly<Record<string, string>> = {
  bank_transfer: "bank transfer",
  gcash: "GCash",
  maya: "Maya",
};

/**
 * The empty "Payouts missing a reference" list: every payout has its reference
 * only when no filter is on; otherwise none match the filters.
 */
export function missingReferenceEmptyText(filters: {
  method: string;
  branchFiltered: boolean;
  dateFrom: string;
  dateTo: string;
}): string {
  const methodWords = EMPTY_METHOD_WORDS[filters.method];
  if (!methodWords && !filters.branchFiltered && !filters.dateFrom && !filters.dateTo) {
    return "Every payout by bank transfer, GCash or Maya has its reference.";
  }
  return `No ${methodWords ? `${methodWords} ` : ""}payouts are missing a reference for these filters.`;
}

/** A Record reference button's accessible name, with its SVT- or TD- number. */
export function recordReferenceLabel(number: string): string {
  return `Record reference for ${number}`;
}
