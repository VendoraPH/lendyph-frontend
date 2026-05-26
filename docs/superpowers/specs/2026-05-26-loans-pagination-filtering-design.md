# Loans List: Pagination, Sorting, and Filtering — Design

**Date:** 2026-05-26
**Branch:** `feat/loans-pagination-filtering`
**Status:** Design (pre-implementation)

## Problem

`/loans` (`src/app/(app)/loans/page.tsx`) currently loads every loan with `loanService.list()` and renders them in a single ungrouped table. There is no pagination, no column sorting, and the only filtering is the existing status tabs + KPI cards + a text search. As the portfolio grows, the page becomes harder to scan and operators have no way to narrow by date or product.

`/borrowers` already has working client-side pagination but it is implemented inline, duplicating UI that the loans page now needs as well.

## Goal

Add a full-featured client-side list experience to `/loans`:

- Pagination (10 / 20 / 50 per page, default 10)
- Sortable columns on every header
- Filtering by date range (`created_at`) and loan product, in addition to the existing status tabs and text search
- All list state reflected in URL query params so the view is bookmarkable, shareable, and refresh-safe

In the same change, extract the duplicated pagination footer into one shared `<TablePagination>` component and have `/borrowers` adopt it.

## Non-Goals

- Server-side pagination, sorting, or filtering — deferred until client-side hits a real performance ceiling.
- Saved filter presets, column visibility toggles, multi-column sort, column reordering/resizing.
- Bulk actions on loans, export-to-CSV with current filter applied.
- Adopting `<TablePagination>` in any list beyond `/borrowers` (e.g., `/users`, `/branches`) — do it when those pages are next touched.

## Architecture

### New files

- `src/components/common/table-pagination.tsx` — shared pager: rows-per-page select, Prev / Next, "Showing X to Y of Z results". Consumed by `/loans` and `/borrowers`.
- `src/app/(app)/loans/_components/loan-table.tsx` — pure table render with sortable column headers. Receives the already paged/sorted/filtered slice plus a `sort` prop and `onSortChange` callback.
- `src/app/(app)/loans/_components/loan-filters.tsx` — search input, date-range popover (from/to), loan-product select, and a "Clear" button that appears only when any filter is non-default.
- `src/app/(app)/loans/_components/utils.ts` — pure helpers: `compareLoans`, `matchesSearch`, `matchesDateRange`, `matchesTab`, plus the URL parsers (`numOrNull`, `dateOrNull`, `clamp`).

### Modified files

- `src/app/(app)/loans/page.tsx` — drops from ~453 to ~220 lines. Owns URL state, data fetch, the filter / sort / paginate pipeline, KPI cards, status tabs, and renders the three new components. The auto-pay dialog and its handlers stay here unchanged.
- `src/app/(app)/borrowers/page.tsx` — swaps its inline pagination footer for `<TablePagination>` (~30-line reduction).

### Why this split

- `LoanTable` and `LoanFilters` mirror the `_components/` structure already used by `/borrowers`, so contributors recognize the pattern.
- Status tabs + KPI cards stay in `page.tsx` because they are tightly coupled to the summary cards directly above them — extracting them would force prop-drilling counts and an unnecessary component boundary.
- `<TablePagination>` lives in `src/components/common/` because it is reused across feature modules. It is the only piece introduced as a shared component; everything else stays scoped to the loans module.
- URL state lives in `page.tsx` (no custom hook) — small enough that a hook would be premature abstraction. If a second page needs it, extract then.

## URL Schema

All list state mirrors into query params via `useSearchParams` and `router.replace(url, { scroll: false })`. On mount the page hydrates from the URL; on user action the URL is updated and React re-derives.

| Param | Type | Default | Notes |
|---|---|---|---|
| `tab` | `all` \| `active` \| `LoanStatus` | `all` | Existing KPI / tab filter |
| `q` | string | `""` | Search across application_number, borrower name, product, purpose |
| `product_id` | number | unset | Loan product filter |
| `from` | `YYYY-MM-DD` | unset | `created_at >= from` (start of day) |
| `to` | `YYYY-MM-DD` | unset | `created_at <= to` (inclusive end of day) |
| `sort` | column key | `created_at` | One of: `application_number`, `borrower`, `product`, `amount`, `term`, `status`, `created_at` |
| `dir` | `asc` \| `desc` | `desc` | Sort direction |
| `page` | number | `1` | 1-based current page |
| `per_page` | `10` \| `20` \| `50` | `10` | Page size |

With no query string, `/loans` renders identically to today (plus the new pager footer). Invalid values (`per_page=999`, `dir=xyz`, `sort=foo`, `from=banana`) fall back to defaults silently — never throw.

## Data Flow

```
loans
  → filterByTab
  → filterByProduct
  → filterByDateRange
  → filterBySearch
  → sort
  → total = .length
  → slice(start, end)
  → rendered rows
```

The full pipeline runs inside `useMemo` blocks in `page.tsx` (one for `filtered`, one for `sorted`). Counts shown on KPI cards and status tabs come from the unfiltered `loans` array so users always see the full picture even when a filter is active — matches current behavior.

**Page-reset rule:** any change to `tab`, `q`, `product_id`, `from`, `to`, `sort`, `dir`, or `per_page` resets `page=1`. Sorting also resets to page 1 to avoid the "I'm on page 5 of a different ordering" confusion. The reset is handled by a single `updateParams` helper: if any non-`page` key is being updated, `page` is deleted from the params.

**Sort header behavior:** first click on a column → `desc`; second click on the same column → `asc`; third click → `desc` again. Clicking a different column starts at `desc`.

**Search debounce:** `searchDraft` is local React state that updates every keystroke (input feels instant); a 250ms `setTimeout` then pushes the value into the URL. Avoids a URL-replace storm and one re-render per character.

**Fetches:** loans and loan products fetched in parallel on mount. Products list populates the filter dropdown; if products haven't loaded yet, the select shows "Loading…" and is disabled.

## Component Interfaces

```tsx
// src/components/common/table-pagination.tsx
export interface TablePaginationProps {
  page: number;                       // 1-based current page
  perPage: number;
  total: number;                      // total rows after filtering
  perPageOptions?: readonly number[]; // default [10, 20, 50]
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}
```
Renders `"Rows per page [select] | Showing X to Y of Z results [<] [>]"`. Prev disabled when `page <= 1`; Next disabled when `page >= ceil(total/perPage)`. When `total === 0`, label reads "No results" and both buttons are disabled.

```tsx
// src/app/(app)/loans/_components/loan-table.tsx
export type SortDir = "asc" | "desc";
export type LoanSortKey =
  | "application_number" | "borrower" | "product"
  | "amount" | "term" | "status" | "created_at";

export interface LoanTableProps {
  loans: Loan[];                                 // already filtered + sorted + paged
  sort: { key: LoanSortKey; dir: SortDir };
  onSortChange: (key: LoanSortKey) => void;      // toggles dir if same key
  onRowClick: (id: number) => void;
  onAutoPayClick: (loan: Loan) => void;
}
```
Column headers become `<button>`s with a chevron-up / chevron-down indicator on the active sort column. Body markup stays as close to today's as possible to keep the visual diff small.

```tsx
// src/app/(app)/loans/_components/loan-filters.tsx
export interface LoanFiltersProps {
  search: string;
  onSearchChange: (q: string) => void;
  productId: number | null;
  onProductChange: (id: number | null) => void;
  dateFrom: Date | null;
  dateTo: Date | null;
  onDateRangeChange: (from: Date | null, to: Date | null) => void;
  productOptions: { id: number; name: string }[];
  productsLoading: boolean;
}
```
Layout: `[Search ...........] [Product select] [From popover] [To popover] [Clear]`. "Clear" only renders when any of search/product/dates are non-default. Date popovers mirror the existing pattern in `src/app/(app)/payments/auto-pay/_components/filters-step.tsx` (Popover + Calendar single mode).

```tsx
// src/app/(app)/loans/_components/utils.ts
export function compareLoans(a: Loan, b: Loan, key: LoanSortKey, dir: SortDir): number;
export function matchesSearch(loan: Loan, q: string): boolean;
export function matchesDateRange(loan: Loan, from: Date | null, to: Date | null): boolean;
export function matchesTab(loan: Loan, tab: FilterTab): boolean;
export function numOrNull(v: string | null): number | null;
export function dateOrNull(v: string | null): Date | null;
export function clamp<T extends number>(v: T, allowed: readonly T[]): T;
```
`compareLoans` uses locale compare for strings, numeric for amount/term, `Date` arithmetic for `created_at`, and the existing `FILTER_TABS` order for status. Nulls sort last regardless of direction. `matchesSearch` uses the same fallback chain the table renders (`borrower.full_name ?? borrower.name ?? borrower_name`, `loan_product?.name ?? loan_product_name`) so what you see matches what gets searched.

**Field-fallback rule applied throughout filters and sort:** the `Loan` type carries both flat and nested shapes for some fields (e.g., `loan_product_id` and `loan_product?.id`; `borrower_name` and `borrower?.full_name`). Every comparator and matcher must consult both — `loan.loan_product_id ?? loan.loan_product?.id` for the product filter, the existing fallback chain for borrower display/search/sort — so behavior is consistent regardless of which shape the backend returns for a given row.

## Edge Cases

- **Empty results after filtering** — existing "No loan applications found." row; pager shows "No results" with both buttons disabled.
- **`page` in URL past the end** — `safePage = min(page, totalPages)` clamps it without rewriting the URL (avoids a redirect loop). Rendered page is always valid.
- **Filters reduce total below current page** — same clamp covers it; user lands on the last valid page automatically.
- **Invalid URL values** — fall back to defaults via the parsers, silently.
- **Date range with only `from` or only `to`** — both supported (open-ended). `to` is inclusive end-of-day so a loan created at 14:30 on the `to` date is included.
- **`product_id` for a deleted/missing product** — passes through the filter (rows simply don't match); select shows the raw id until the product list loads, then renders the name.
- **Sort on null/missing fields** (e.g., `term`, `loan_product_name`) — nulls sort last regardless of direction.
- **Status tab `active`** — keeps current virtual-tab semantics; `matchesTab` handles it as a special case.
- **Auto-pay click inside a row** — keeps `e.stopPropagation()` so row click navigates and the button opens the dialog.
- **`/borrowers` regression risk** — swapping the inline pager for `<TablePagination>` must preserve disabled-state, label text, and reset-on-change behavior identically. Build catches type changes; a manual smoke test on `/borrowers` is required before push.

## Testing Plan (manual, before push)

1. `pnpm build` (or repo equivalent) passes with no type errors.
2. `/loans` loads, KPI cards still filter, status tabs still filter, search still works.
3. Click each column header — sort indicator appears, order changes, second click flips direction.
4. Pick a date range — list narrows; clear button removes it.
5. Pick a loan product — list narrows.
6. Change rows-per-page → list re-pages, lands on page 1.
7. Refresh the page mid-filter — state persists from URL.
8. Copy URL into a new tab — same view loads.
9. `/borrowers` pager looks and behaves identically to before.
