import type { Loan, PaginatedResponse } from "@/types";

/**
 * The `status` value this screen sends.
 *
 * `active` is a virtual status the API expands server-side from
 * `Loan::ACTIVE_STATUSES` (`Loan::scopeForStatus()`), so the set of statuses
 * that counts as "active" is defined once, on the server, and this screen holds
 * no opinion about it. It used to hold one — a private four-entry set including
 * `current` and `past_due`, neither of which is a member of the `loans.status`
 * enum, so neither ever matched a row.
 *
 * Do NOT replace this with the expansion. Spelling the statuses out here would
 * work today and would be a copy that goes stale the day the set changes — it
 * already changed once.
 */
export const ACTIVE_STATUS = "active";

/**
 * The largest page the API will actually serve.
 *
 * `LoanController::index()` paginates with `min(max(per_page, 1), 100)`. A
 * larger number is not rejected, it is silently reduced — which is exactly how
 * this screen lost loans: it asked for 500, was given 100, and had no way to
 * tell. Asking for precisely the documented ceiling is the fewest round trips
 * this can take, and it is a number derived from the contract rather than
 * guessed against today's row count.
 */
export const LOANS_PER_PAGE = 100;

/**
 * Runaway guard. NOT a limit on how many loans this screen can show.
 *
 * The loop is driven by the server's own `meta.last_page`; this only bounds the
 * damage when that value is missing, absurd, or the paginator never returns a
 * short page. It is the one number here that is not derived from the contract,
 * so it is built to be harmless: reaching it sets `truncated`, and the screen
 * renders that as a visible warning naming how many loans it is missing.
 *
 * That is the whole difference from the bug this replaces. `per_page: 500` was
 * a limit that lied — it silently produced 100 rows and looked complete.
 * Correctness here does not depend on this number being big enough; only the
 * cost of a pathological response does.
 */
export const MAX_ACTIVE_LOAN_PAGES = 20;

/** Fetches one page of loans. Injected so this is testable without a network. */
export type LoanPageFetcher = (params: {
  status: string;
  page: number;
  per_page: number;
}) => Promise<PaginatedResponse<Loan>>;

export interface ActiveLoansResult {
  /** Every active loan the API handed over, in the order it returned them. */
  loans: Loan[];
  /**
   * `meta.total` — how many active loans EXIST, as opposed to how many are in
   * `loans`. Null when the response carried no usable total, in which case the
   * caller has nothing better to show than `loans.length`.
   */
  total: number | null;
  /**
   * True when the page guard stopped the loop with pages still outstanding, so
   * `loans` is knowingly incomplete. The caller must surface this: an
   * incomplete list of who can pay today is the failure being fixed here, and
   * it is only acceptable when the screen says so.
   */
  truncated: boolean;
}

/** Rows out of a paginator body, tolerating a bare array or a missing `data`. */
function pageRows(response: unknown): Loan[] {
  if (Array.isArray(response)) return response as Loan[];
  const data = (response as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) ? (data as Loan[]) : [];
}

function pageMeta(response: unknown): PaginatedResponse<Loan>["meta"] | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const meta = (response as { meta?: unknown }).meta;
  return meta && typeof meta === "object"
    ? (meta as PaginatedResponse<Loan>["meta"])
    : null;
}

/** A positive, finite integer, or null. Rejects 0, NaN and Infinity alike. */
function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * Every active loan, across as many pages as the API needs to hand them over.
 *
 * This screen takes payments over the counter, so it needs the whole set rather
 * than a page of it, and the reason is not convenience — it is that two of the
 * three things it does with the set cannot be moved to the server as the API
 * stands:
 *
 *  - It orders the queue by "overdue first, then earliest next due date".
 *    `overdue_amount` and `next_due_date` are not columns; `LoanResource`
 *    derives them per row from the loaded amortization schedules, after the
 *    page has already been selected. `?sort=` accepts no equivalent key, so a
 *    server-paged page 1 would be the newest applications, not the most urgent
 *    — a queue that looks sorted and is not.
 *  - Its "Overdue" and "Total Outstanding" cards are aggregates over those same
 *    derived values. `meta.stats` is a `GROUP BY status` row count and has no
 *    money in it, so under server paging both cards would quietly describe
 *    whichever page was loaded. That is the same silent wrongness as the bug,
 *    moved from the table to the cards.
 *
 * Only search could move server-side, and moving search alone would fix
 * nothing. If the API ever grows a schedule-derived sort and totals, this
 * screen should page properly and this function should go.
 *
 * The loop follows the server's `meta.last_page` and stops on the first short
 * page; `MAX_ACTIVE_LOAN_PAGES` only bounds a runaway, and reaching it is
 * reported rather than hidden.
 */
export async function fetchAllActiveLoans(
  fetchPage: LoanPageFetcher,
  options: { perPage?: number; maxPages?: number } = {},
): Promise<ActiveLoansResult> {
  const perPage = options.perPage ?? LOANS_PER_PAGE;
  const maxPages = options.maxPages ?? MAX_ACTIVE_LOAN_PAGES;

  const loans: Loan[] = [];
  let total: number | null = null;
  let truncated = false;
  let page = 1;

  for (;;) {
    const response = await fetchPage({
      status: ACTIVE_STATUS,
      page,
      per_page: perPage,
    });

    const rows = pageRows(response);
    loans.push(...rows);

    const meta = pageMeta(response);
    const metaTotal = positiveInt(meta?.total);
    // 0 is a legitimate total and positiveInt rejects it, so read it directly
    // rather than losing "this coop has no active loans" to the null fallback.
    if (metaTotal !== null) total = metaTotal;
    else if (meta?.total === 0) total = 0;

    // Nothing came back: the paginator is past the end whatever it claims.
    if (rows.length === 0) break;

    const lastPage = positiveInt(meta?.last_page);
    if (lastPage !== null) {
      if (page >= lastPage) break;
    } else {
      // No `last_page` to follow, so a short page is the only end-of-list
      // signal available. Measure "short" against the size the server actually
      // used, NOT the size we asked for: `per_page` is clamped server-side, so
      // a full page can be smaller than the request. Comparing against our own
      // number is how this function stopped after one page of 5 when it had
      // asked for 100 — the same mistake as the bug it exists to fix.
      const effectivePerPage = positiveInt(meta?.per_page) ?? perPage;
      if (rows.length < effectivePerPage) break;
    }

    if (page >= maxPages) {
      truncated = true;
      break;
    }
    page += 1;
  }

  return { loans, total, truncated };
}
