import type { LoanStatus, Loan } from "@/types/loan";

// ── Tabs / status filtering ──
//
// Filtering, searching, date-ranging and sorting are all done by the API now
// (`status` — comma-separated for the virtual `active` tab —, `search`,
// `loan_product_id`, `date_from`/`date_to`, `sort`/`dir`), so this module only
// describes the vocabulary the URL and the request share. The predicates and
// comparators that used to live here were dead the moment the list stopped
// being a client-side slice, and a stale second implementation of "what counts
// as active" is exactly how a table and its KPI cards drift apart.

/**
 * `?status=` values the API accepts that NO ROW CAN HOLD.
 *
 * All three are resolved server-side and each agrees with its own `meta.stats`
 * entry, so a tab or card built on one cannot disagree with its count:
 *
 *  - `active` expands to `Loan::ACTIVE_STATUSES` (a `whereIn` on `loans.status`),
 *    past-due loans included. The Active Loans card selects it.
 *  - `current` is the same loans less the past-due ones: what the Current tab
 *    lists, so a loan past grace is not badged "Past Due" under "Current".
 *  - `past_due` does NOT expand to statuses at all. It resolves to
 *    `Loan::scopePastDue()`: a COLLECTIBLE loan (`released`, `ongoing` or
 *    `defaulted`) holding an unpaid amortization schedule that is past its due
 *    date AND past the loan's `grace_period_days`. It is derived from the
 *    schedule, so it is a subquery rather than a status.
 *
 * `active` and `past_due` OVERLAP and neither contains the other: `past_due`
 * reaches `defaulted` loans, which are collectible but not active, and `active`
 * holds loans with nothing late. So the badges are free to disagree, they do not
 * sum to the book total, and nothing in this module or the screen above it may
 * imply otherwise.
 *
 * Listed here, once, because `allCountFromStats` has to skip exactly these when
 * it sums `meta.stats` into the All count: counting a roll-up alongside the
 * statuses it rolls up is a double count.
 */
export const VIRTUAL_TAB_VALUES = ["active", "current", "past_due"] as const;

export type VirtualTabValue = (typeof VIRTUAL_TAB_VALUES)[number];

/**
 * Every value the tab strip and `?tab=` share.
 *
 * `past_due` is a member of `LoanStatus` too, as a legacy union member kept so
 * responses from older backends still parse — but that is not why it is here.
 * It is here as a virtual value, and the two meanings must not be confused: no
 * loan row carries `past_due` as its status, and adding it to the
 * `loans.status` enum is explicitly the wrong repair.
 */
export type FilterTab = "all" | VirtualTabValue | LoanStatus;

/**
 * The statuses the Active Loans card stands for.
 *
 * Only members of the `loans.status` enum belong here. This used to also list
 * `current` and `past_due`, which the column has no member for — they matched
 * nothing, so removing them changes no result set; it only stops the constant
 * claiming statuses that cannot exist.
 *
 * The API owns the real definition (`Loan::ACTIVE_STATUSES`, which
 * `status=active` expands to and `meta.stats.active` is summed from). This copy
 * exists ONLY as the fallback for `meta.stats.active` being absent, so keep it
 * in step with the backend constant — never send it as a filter.
 */
export const ACTIVE_STATUSES: LoanStatus[] = ["released", "ongoing"];

/**
 * Whether a loan row offers the auto-pay control. Both `released` and
 * `ongoing` read "Current" and the backend's auto-pay covers both, so a
 * Current loan offers it whichever of the two it stores.
 */
export function offersAutoPay(status: string | null | undefined): boolean {
  return !!status && (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "for_review", label: "For Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  // "Current" is `released` and `ongoing` loans with nothing past grace: the tab
  // sends the API's own `current` and its badge reads `meta.stats.current`. A
  // loan past grace reads "Past Due" and is listed under the Past Due tab
  // instead. There is no separate Released tab: it would list rows badged
  // "Current" under another name. The Active Loans card keeps `active`, which
  // has no tab of its own and still counts past-due loans.
  { value: "current", label: "Current" },
  // Past due is a FILTER, not a status — see VIRTUAL_TAB_VALUES. It sends
  // `status=past_due`, which the API resolves through Loan::scopePastDue(), and
  // its badge reads `meta.stats.past_due`, which is counted through that same
  // scope. Both narrow by branch and borrower together, so the tab and the badge
  // cannot drift.
  //
  // This is the difference from the tab that was removed. That one filtered
  // `status=past_due` when nothing resolved it, so it matched no row, read 0
  // forever, and sat above an empty table — the same shape as the old `current`
  // tab documented above. The value looks identical; what changed is that there
  // is now something on the other end of it.
  //
  // It deliberately overlaps the Active card, and it reaches `defaulted` loans
  // that no other tab shows. The tab counts are not a partition and never were.
  { value: "past_due", label: "Past Due" },
  { value: "completed", label: "Completed" },
];

/**
 * Every value `?tab=` accepts: the tab strip's, plus `active`, the Active Loans
 * card's filter. Derived from FILTER_TABS so a tab cannot exist in one and not
 * the other.
 */
export const TAB_VALUES: FilterTab[] = [
  "all",
  "active",
  ...FILTER_TABS.filter((t) => t.value !== "all" && t.value !== "active").map((t) => t.value),
];

/**
 * `?tab=` values this screen used to accept, mapped to what they mean now.
 *
 * The page keeps its whole state in the URL, so those URLs are bookmarked and
 * shared and cannot simply stop working. The `ongoing` and `released` tabs were
 * folded into Current when both statuses came to read "Current", so an old link
 * lands on the tab it meant rather than on All.
 */
const LEGACY_TAB_ALIASES: Record<string, FilterTab> = {
  ongoing: "current",
  released: "current",
};

/**
 * The `?tab=` contract in one place: alias a legacy value if we know it, then
 * fall back to "all" for anything unrecognised — a removed tab, a typo, or a
 * hand-edited URL. Never returns a tab that is not in the strip, so the screen
 * cannot end up with a selected-but-invisible filter or an unexplained empty
 * table.
 */
export function tabFromParam(raw: string | null): FilterTab {
  const value = (raw != null && LEGACY_TAB_ALIASES[raw]) || raw;
  return clampOneOf<FilterTab>((value ?? "all") as FilterTab, TAB_VALUES, "all");
}

// ── Counts (`meta.stats`) ──

/**
 * Global loan counts by status, read straight from the list response's
 * `meta.stats`. Deliberately an open record rather than a fixed shape: the API
 * reports every status it knows about, including legacy ones such as `ongoing`
 * and `restructured` that have no tab of their own, and each consumer only reads
 * the keys it needs.
 *
 * These counts ignore the request's own `status`/search/product/date filters,
 * which is exactly why the KPI cards and tab badges can be driven from the same
 * request that fetches one page of rows.
 */
export type LoanStats = Record<string, number>;

/**
 * Keys in `meta.stats` that are NOT statuses of their own, and so must never be
 * added into a total alongside the statuses they overlap. Derived from
 * `VIRTUAL_TAB_VALUES`, so a virtual filter cannot reach the tab strip without
 * being excluded here. `all` is here for the case where the API ever sends a
 * total of its own.
 */
const AGGREGATE_STAT_KEYS = new Set<string>(["all", ...VIRTUAL_TAB_VALUES]);

export function allCountFromStats(stats: LoanStats): number {
  if (typeof stats.all === "number") return stats.all;
  let sum = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (!AGGREGATE_STAT_KEYS.has(key)) sum += value;
  }
  return sum;
}

/** The Current tab's count, or null when the server sent none (shown as a dash). */
export function currentCountFromStats(stats: LoanStats): number | null {
  return typeof stats.current === "number" ? stats.current : null;
}

// ── Field-fallback helpers (Loan carries both flat and nested shapes) ──

export function loanBorrowerName(loan: Loan): string {
  return (
    loan.borrower?.full_name ??
    loan.borrower?.name ??
    loan.borrower_name ??
    ""
  );
}

export function loanProductName(loan: Loan): string {
  return loan.loan_product?.name ?? loan.loan_product_name ?? "";
}

export function loanProductId(loan: Loan): number | null {
  return loan.loan_product_id ?? loan.loan_product?.id ?? null;
}

export function loanTerm(loan: Loan): number | null {
  return loan.term ?? loan.term_months ?? null;
}

// ── Sorting ──
//
// The keys the API whitelists for `sort`; the frontend only sends them and
// renders the header arrows.

export type SortDir = "asc" | "desc";

export type LoanSortKey =
  | "application_number"
  | "borrower"
  | "product"
  | "amount"
  | "term"
  | "status"
  | "created_at";

// ── The list request ──

/**
 * `GET /loans` for what the screen shows. `view=summary` is enough: the table
 * reads no schedules, and those rows are what make the full list heavy. Each tab
 * value goes as `status` verbatim, and All sends none.
 */
export function loanListParams(state: {
  tab: FilterTab;
  page: number;
  perPage: number;
  sortKey: LoanSortKey;
  sortDir: SortDir;
  search: string;
  productId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Record<string, string | number> {
  return {
    view: "summary",
    page: state.page,
    per_page: state.perPage,
    sort: state.sortKey,
    dir: state.sortDir,
    ...(state.tab !== "all" && { status: state.tab }),
    ...(state.search && { search: state.search }),
    ...(state.productId != null && { loan_product_id: state.productId }),
    ...(state.dateFrom && { date_from: state.dateFrom }),
    ...(state.dateTo && { date_to: state.dateTo }),
  };
}

// ── URL parsers ──

export function numOrNull(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function dateOrNull(v: string | null): Date | null {
  if (!v) return null;
  // Accept only YYYY-MM-DD to keep URL stable and avoid TZ surprises.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Same validation as `dateOrNull`, but hands back the `YYYY-MM-DD` string.
 * The API wants that string and so does any effect dependency array — a Date
 * re-parsed on every render is a new object each time, which would re-trigger
 * the fetch forever.
 */
export function isoDateOrNull(v: string | null): string | null {
  return dateOrNull(v) ? v : null;
}

export function clampOneOf<T>(v: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v) ? v : fallback;
}
