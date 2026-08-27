import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

/**
 * The largest `per_page` the report endpoints accept.
 *
 * `ReportController::reportFilters()` runs every report's query string through
 * `'per_page' => ['nullable','integer','min:1','max:1000']`. Reports VALIDATE
 * this rather than clamp it — unlike the paginated indexes, which quietly cap at
 * 100 — so one over the line is a 422 with no rows at all, not a short page.
 * That is how the Past Due Loans screen came to render an empty table: it asked
 * for 9999.
 *
 * Nothing about correctness depends on this number, which is the difference
 * between it and the `9999` it replaced. That was a limit chosen to exceed the
 * row count, so it silently became wrong as a cooperative grew. This is a
 * transfer chunk size: every value from 1..1000 yields the identical complete
 * result set, because `collectReportPages()` keeps going until the server's own
 * `meta.last_page`. 1000 is picked purely to minimise round trips — a screen
 * that aggregates needs the whole set before it can render, so each extra page
 * is latency in front of the user, and the `api` group is throttled to 60
 * requests/minute per user.
 *
 * If the backend ever lowers the cap, page 1 fails with a 422 and the caller's
 * error branch reports it as a client-side bug — which is the correct diagnosis.
 */
export const REPORT_MAX_PER_PAGE = 1000;

/**
 * Hard ceiling on the pages one `collectReportPages()` call will walk.
 *
 * The loop's real terminator is the server's `meta.last_page`, but that is a
 * number the client does not control: a bug or a malformed response could hold
 * it above `current_page` forever and spin the browser through unbounded
 * requests. At `REPORT_MAX_PER_PAGE` this still admits 25,000 rows, far beyond
 * any cooperative's arrears book, and a run that hits it returns
 * `complete: false` so the caller can say the list is partial instead of
 * presenting a truncated set as the whole picture.
 */
const MAX_REPORT_PAGES = 25;

interface PaginatorMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface CollectedPages {
  rows: unknown[];
  /** `meta.total` as reported by the server, or null if it never sent one. */
  total: number | null;
  pagesFetched: number;
  /** False when the walk stopped early — `rows` is then a partial set. */
  complete: boolean;
}

/**
 * Rows out of one page of a report response.
 *
 * `listOfDuePastDue()` answers `{ data, totals, meta }`, but the reports are not
 * uniform — some return the rows bare — so both are accepted, plus the
 * double-wrapped `{ data: { data: [] } }` an envelope change would produce.
 */
const extractRows = (body: unknown): unknown[] => {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const r = body as { data?: unknown };
    if (Array.isArray(r.data)) return r.data;
    if (r.data && typeof r.data === "object") {
      const inner = (r.data as { data?: unknown }).data;
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
};

const extractMeta = (body: unknown): PaginatorMeta | null => {
  if (!body || typeof body !== "object") return null;
  const meta = (body as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  return meta as PaginatorMeta;
};

/** An integer >= `min`, or null for anything that is not one. */
const asInt = (v: unknown, min: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  return n >= min ? n : null;
};

/**
 * Walk a paginated report from page 1 to `meta.last_page` and concatenate the
 * rows.
 *
 * For screens that aggregate across the whole result set, where one page is not
 * a smaller version of the answer but a wrong one. Takes the per-page fetcher so
 * the loop is unit-testable without a network or a mocked axios.
 *
 * Termination is guarded three ways, because `last_page` comes from the server:
 * the page counter only ever increases, `MAX_REPORT_PAGES` caps the walk
 * regardless of what the server claims, and a page that comes back empty while
 * the server still claims more stops the loop rather than looping on nothing.
 */
export async function collectReportPages(
  fetchPage: (page: number) => Promise<unknown>,
  options: {
    maxPages?: number;
    onProgress?: (loaded: number, total: number | null) => void;
  } = {}
): Promise<CollectedPages> {
  const maxPages = options.maxPages ?? MAX_REPORT_PAGES;
  const rows: unknown[] = [];
  let total: number | null = null;
  let lastPage = 1;
  let page = 1;
  let pagesFetched = 0;
  let complete = true;

  while (page <= lastPage) {
    if (page > maxPages) {
      complete = false;
      break;
    }

    const body = await fetchPage(page);
    pagesFetched += 1;
    const batch = extractRows(body);
    for (const row of batch) rows.push(row);

    const meta = extractMeta(body);
    // An empty report legitimately reports 0, so `total` allows it; a page
    // number below 1 is nonsense, so `last_page` does not.
    total = asInt(meta?.total, 0) ?? total;
    // A response with no usable `last_page` is treated as the entire set, which
    // keeps a non-paginated report to exactly one request.
    lastPage = asInt(meta?.last_page, 1) ?? 1;

    options.onProgress?.(rows.length, total);

    if (batch.length === 0 && page < lastPage) {
      // The server says there is more but served none of it. Continuing would
      // add nothing and could run to `maxPages` on empty bodies.
      complete = false;
      break;
    }

    page += 1;
  }

  return { rows, total, pagesFetched, complete };
}

export const reportService = {
  // The three list endpoints return a Laravel paginator envelope
  // ({ data, meta, totals }) rather than the { success, data } wrapper, so they
  // use getRaw — unwrapping to `data` would throw away the server-side totals
  // and row count the reports need to avoid summing a single page.
  duePastDue: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.DUE_PAST_DUE, { params }),

  /**
   * Every due/past-due schedule the filters match, across all pages.
   *
   * One row is one amortization schedule, and `duePastDueQuery()` orders them by
   * `due_date` then `id` — NOT grouped by loan. A loan's unpaid periods are
   * therefore scattered through the result set by age, so any single page holds
   * a fraction of most loans' periods. A caller that rolls schedules up into
   * per-loan figures (days past due, amount owed) gets an under-reported answer
   * from anything less than the full set, which is why this walks every page
   * instead of asking for one big one.
   *
   * `params` takes the server-side filters `reportFilters()` accepts —
   * `date_from`, `date_to`, `branch_id`. `per_page` and `page` are set here and
   * anything passed for them is ignored.
   */
  duePastDueAll: (
    params?: Record<string, unknown>,
    onProgress?: (loaded: number, total: number | null) => void
  ): Promise<CollectedPages> =>
    collectReportPages(
      (page) =>
        api.getRaw(API_ENDPOINTS.REPORTS.DUE_PAST_DUE, {
          params: { ...params, per_page: REPORT_MAX_PER_PAGE, page },
        }),
      { onProgress }
    ),

  loanBalanceSummary: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.LOAN_BALANCE_SUMMARY, { params }),

  releases: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.RELEASES, { params }),

  repayments: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.REPAYMENTS, { params }),

  statementOfAccount: (loanId: number) =>
    api.get(API_ENDPOINTS.REPORTS.STATEMENT_OF_ACCOUNT(loanId)),

  // Accepts date_from/date_to to window the payment history.
  subsidiaryLedger: (borrowerId: number, params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SUBSIDIARY_LEDGER(borrowerId), { params }),

  dailyCollection: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DAILY_COLLECTION, { params }),

  income: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.INCOME, { params }),

  aging: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.AGING, { params }),

  borrowers: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.BORROWERS, { params }),

  disbursements: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DISBURSEMENTS, { params }),

  // The six financial/performance reports below are `{ success, data }`-wrapped
  // summaries rather than paginators — there is no envelope worth preserving,
  // so they use `api.get` and the builders receive the summary object directly.
  cashFlow: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.CASH_FLOW, { params }),

  collectionEfficiency: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.COLLECTION_EFFICIENCY, { params }),

  portfolioByProduct: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PORTFOLIO_BY_PRODUCT, { params }),

  // Accepts branch_id: the ledger has no branch column, so the API resolves
  // the filter through the member's branch and echoes back `branch_scope`.
  shareCapital: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SHARE_CAPITAL, { params }),

  performance: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PERFORMANCE, { params }),

  provisioning: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PROVISIONING, { params }),

  // One member's share capital statement: opening balance, entries with a
  // running balance, period credits/debits, closing balance. Accepts
  // date_from/date_to to window the entries.
  shareCapitalStatement: (borrowerId: number, params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SHARE_CAPITAL_STATEMENT(borrowerId), { params }),

  exportReleases: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_RELEASES, { params }),

  exportRepayments: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_REPAYMENTS, { params }),

  exportDuePastDue: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_DUE_PAST_DUE, { params }),
};
