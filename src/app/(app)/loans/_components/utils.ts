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
 * Both are resolved server-side and both agree with their own `meta.stats`
 * entry, so a tab built on either cannot disagree with the badge above it:
 *
 *  - `active` expands to `Loan::ACTIVE_STATUSES` — a `whereIn` on
 *    `loans.status`, so it is a set of statuses.
 *  - `past_due` does NOT expand to statuses at all. It resolves to
 *    `Loan::scopePastDue()`: a COLLECTIBLE loan (`released`, `ongoing` or
 *    `defaulted`) holding an unpaid amortization schedule that is past its due
 *    date AND past the loan's `grace_period_days`. It is derived from the
 *    schedule, so it is a subquery rather than a status.
 *
 * The two OVERLAP and neither contains the other. `past_due` reaches
 * `defaulted` loans, which are collectible but not active; `active` holds
 * loans with nothing late. So the badges are free to disagree, they do not sum
 * to the book total, and nothing in this module or the screen above it may
 * imply otherwise.
 *
 * Listed here, once, because `AGGREGATE_STAT_KEYS` on the loans page has to
 * skip exactly these when it sums `meta.stats` into the All count — counting a
 * roll-up alongside the statuses it rolls up is a double count.
 */
export const VIRTUAL_TAB_VALUES = ["active", "past_due"] as const;

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

export const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "for_review", label: "For Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
  // Labelled "Current" but filtered as `ongoing`, matching LOAN_STATUS_LABELS,
  // which renders an `ongoing` row's badge as "Current". The tab used to filter
  // `status=current` — a value no row can hold — so it read 0 and returned
  // nothing while rows badged "Current" sat in the table underneath it.
  { value: "ongoing", label: "Current" },
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
  // It deliberately overlaps Released, Current and the Active card, and it
  // reaches `defaulted` loans that no other tab shows. The tab counts are not a
  // partition and never were.
  { value: "past_due", label: "Past Due" },
  { value: "completed", label: "Completed" },
];

/**
 * Every value `?tab=` accepts, in tab-strip order with the two virtual values
 * first. Derived from FILTER_TABS so a tab cannot exist in one and not the
 * other.
 */
export const TAB_VALUES: FilterTab[] = [
  "all",
  "active",
  ...FILTER_TABS.filter((t) => t.value !== "all").map((t) => t.value),
];

/**
 * `?tab=` values this screen used to accept, mapped to what they mean now.
 *
 * The page keeps its whole state in the URL, so those URLs are bookmarked and
 * shared and cannot simply stop working. `current` was a rename, not a removal
 * — it points at `ongoing`, the status that was always behind the "Current"
 * label, so an old link lands on the tab it meant rather than on All.
 *
 * `past_due` is deliberately NOT aliased, and its absence now means the
 * opposite of what it used to. It was absent because there was nothing to point
 * it at; it is absent now because it needs no alias — it is a live tab value
 * again, so `tabFromParam` resolves it to itself through TAB_VALUES. A
 * bookmarked Past Due link from before the tab was removed lands back on Past
 * Due, which is where it always meant to go.
 */
const LEGACY_TAB_ALIASES: Record<string, FilterTab> = {
  current: "ongoing",
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
