import { ANY_SOURCE, journalSourceItems } from "./select-items";

/** The general ledger's page size, and the sizes it offers (the server allows up to 100). */
export const LEDGER_PER_PAGE = 25;
export const LEDGER_PER_PAGE_OPTIONS = [25, 50, 100] as const;

/** What the general ledger keeps in its URL. */
export interface LedgerUrlState {
  accountId: number | null;
  from: string;
  to: string;
  /** A journal source, or `ANY_SOURCE`. */
  source: string;
  page: number;
  perPage: number;
}

export interface LedgerDefaults {
  from: string;
  to: string;
}

interface ParamReader {
  get(name: string): string | null;
}

const SOURCES = new Set(journalSourceItems.map((item) => item.value));

function positiveInt(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/** A real calendar date in `YYYY-MM-DD`, else null. */
function isoDate(value: string | null): string | null {
  const match = value === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? value
    : null;
}

/** The ledger's filters from the URL; anything missing or bad takes its default. */
export function readLedgerQuery(params: ParamReader, defaults: LedgerDefaults): LedgerUrlState {
  const source = params.get("source");
  const perPage = positiveInt(params.get("per_page"));
  return {
    accountId: positiveInt(params.get("account_id")),
    from: isoDate(params.get("from")) ?? defaults.from,
    to: isoDate(params.get("to")) ?? defaults.to,
    source: source !== null && source !== ANY_SOURCE && SOURCES.has(source) ? source : ANY_SOURCE,
    page: positiveInt(params.get("page")) ?? 1,
    perPage:
      perPage !== null && (LEDGER_PER_PAGE_OPTIONS as readonly number[]).includes(perPage)
        ? perPage
        : LEDGER_PER_PAGE,
  };
}

/** The URL query for the ledger's filters, leaving out every default. */
export function ledgerQueryString(state: LedgerUrlState, defaults: LedgerDefaults): string {
  const params = new URLSearchParams();
  if (state.accountId !== null) params.set("account_id", String(state.accountId));
  if (state.from !== defaults.from) params.set("from", state.from);
  if (state.to !== defaults.to) params.set("to", state.to);
  if (state.source !== ANY_SOURCE) params.set("source", state.source);
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.perPage !== LEDGER_PER_PAGE) params.set("per_page", String(state.perPage));
  return params.toString();
}

/** A link to one account's ledger, optionally over a range (Cash & Bank links here). */
export function ledgerHref(target: { accountId: number; from?: string; to?: string }): string {
  const params = new URLSearchParams({ account_id: String(target.accountId) });
  if (target.from) params.set("from", target.from);
  if (target.to) params.set("to", target.to);
  return `/accounting/general-ledger?${params.toString()}`;
}

/**
 * Why the range can't be sent (the server answers 422 on `to`), or null. Both
 * are `YYYY-MM-DD`, so comparing the strings compares the dates.
 */
export function ledgerRangeError(from: string, to: string): string | null {
  return to < from ? "To must be on or after From." : null;
}

/** The server's own message for `to` from a 422, or null for any other error. */
export function ledgerToFieldError(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } } | null)
    ?.response;
  if (response?.status !== 422) return null;
  const messages = response.data?.errors?.to;
  return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null;
}
