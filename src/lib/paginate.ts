/**
 * Draining a Laravel paginator, once, for every resource.
 *
 * Every list endpoint in this API paginates with `paginate(min(per_page, 100))`.
 * The clamp is silent: asking for more than 100 is not a 422 and not a warning,
 * it is simply fewer rows than were requested, in a response whose shape is
 * indistinguishable from a complete one. A screen that asks for 9999 and renders
 * `res.data` therefore shows the first 100 rows and looks finished.
 *
 * That has now been the same bug four times over — `per_page: 500` on payments,
 * `per_page: 9999` on the past-due report, `per_page: 9999` on the collateral
 * screens, `per_page: 200` on the loan forms. Every one of those numbers was a
 * reasonable guess at "more than we will ever have", and every one of them was
 * already wrong on the day it shipped, because the ceiling was never the number
 * in the client. It was 100, on the server, all along.
 *
 * So this module holds no opinion about how many rows exist. It asks for the
 * documented maximum page, follows the server's own `meta.last_page`, and when
 * it cannot finish it says so instead of returning a short list that looks whole.
 */

/**
 * The largest page any of these endpoints will actually serve.
 *
 * Not a guess and not a tuning knob: `min((int) request('per_page', 15), 100)`
 * in `BorrowerController::index()`, and the same clamp in
 * `LoanController::index()`. Asking for exactly the ceiling is the fewest round
 * trips a full drain can take. If the server ever raises it, this constant is
 * the one place that changes — and until it does, sending a bigger number buys
 * nothing at all.
 */
export const MAX_PER_PAGE = 100;

/**
 * Runaway guard. NOT a limit on how many rows a caller can receive.
 *
 * The loop is driven by the server's `meta.last_page`; this only bounds the
 * damage when that value is missing, absurd, or the paginator never returns a
 * short page. It is the only number here not derived from the contract, so it is
 * built to be harmless: reaching it sets `truncated`, and callers are expected
 * to render that rather than swallow it.
 *
 * At `MAX_PER_PAGE` this is 2,000 rows — comfortably past any single co-op's
 * membership, and low enough that a pathological response costs 20 requests
 * instead of an open-ended flood.
 */
export const DEFAULT_MAX_PAGES = 20;

/** Fetches one page. Injected so this is testable without a network. */
export type PageFetcher = (params: {
  page: number;
  per_page: number;
}) => Promise<unknown>;

export interface DrainResult<T> {
  /** Every row the API handed over, in the order it returned them. */
  rows: T[];
  /**
   * `meta.total` — how many rows EXIST, as opposed to how many are in `rows`.
   * Null when the response carried no usable total, in which case the caller has
   * nothing better to show than `rows.length`.
   */
  total: number | null;
  /**
   * True when the page guard stopped the loop with pages still outstanding, so
   * `rows` is knowingly incomplete. The caller must surface this. An incomplete
   * list that does not admit it is the entire failure this module exists to
   * prevent; returning it silently would just relocate the bug.
   */
  truncated: boolean;
  /** How many requests were actually made. Useful in tests and diagnostics. */
  pagesFetched: number;
}

/** Rows out of a paginator body, tolerating a bare array or a missing `data`. */
function pageRows<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const data = (response as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

interface PageMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

function pageMeta(response: unknown): PageMeta | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const meta = (response as { meta?: unknown }).meta;
  return meta && typeof meta === "object" ? (meta as PageMeta) : null;
}

/** A positive, finite integer, or null. Rejects 0, NaN and Infinity alike. */
function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * Every row of a paginated endpoint, across as many pages as it takes.
 *
 * The loop follows `meta.last_page` when the server sends one and falls back to
 * "stop on the first short page" when it does not. `maxPages` only bounds a
 * runaway, and reaching it is reported in `truncated` rather than hidden.
 *
 * Pages are fetched in sequence, not in parallel: the stop condition depends on
 * the response, and firing N speculative requests to save latency on a list that
 * is usually one page is the wrong trade.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher,
  options: { perPage?: number; maxPages?: number } = {},
): Promise<DrainResult<T>> {
  const perPage = options.perPage ?? MAX_PER_PAGE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const rows: T[] = [];
  let total: number | null = null;
  let truncated = false;
  let page = 1;
  let pagesFetched = 0;

  for (;;) {
    const response = await fetchPage({ page, per_page: perPage });
    pagesFetched += 1;

    const batch = pageRows<T>(response);
    rows.push(...batch);

    const meta = pageMeta(response);
    const metaTotal = positiveInt(meta?.total);
    // 0 is a legitimate total and positiveInt rejects it, so read it directly
    // rather than losing "this co-op has no members" to the null fallback.
    if (metaTotal !== null) total = metaTotal;
    else if (meta?.total === 0) total = 0;

    // Nothing came back: the paginator is past the end whatever it claims.
    if (batch.length === 0) break;

    const lastPage = positiveInt(meta?.last_page);
    if (lastPage !== null) {
      if (page >= lastPage) break;
    } else {
      // No `last_page` to follow, so a short page is the only end-of-list signal
      // available. Measure "short" against the size the server actually used,
      // NOT the size we asked for: `per_page` is clamped server-side, so a full
      // page can be smaller than the request. Comparing against our own number
      // is how a drain stops after one page of 100 when it asked for 9999 —
      // the very mistake this exists to fix.
      const effectivePerPage = positiveInt(meta?.per_page) ?? perPage;
      if (batch.length < effectivePerPage) break;
    }

    if (page >= maxPages) {
      truncated = true;
      break;
    }
    page += 1;
  }

  return { rows, total, truncated, pagesFetched };
}
