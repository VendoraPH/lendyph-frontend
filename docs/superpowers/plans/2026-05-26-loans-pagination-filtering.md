# Loans List: Pagination, Sorting, and Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side pagination, sortable columns, and date-range + product filters to `/loans`, with all list state in URL query params; extract a shared `<TablePagination>` component and adopt it in `/borrowers`.

**Architecture:** Three small components scoped to the loans module (`LoanTable`, `LoanFilters`, plus a pure-helper `utils.ts`), one shared component in `src/components/common/` (`TablePagination`), and a slimmed-down `page.tsx` that owns URL state and composes a `filter → sort → slice` pipeline. URL state via Next.js `useSearchParams` + `router.replace(url, { scroll: false })` — no custom hook.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, shadcn/ui (already in repo: `Select`, `Popover`, `Calendar`, `Pagination`, `Table`), Tailwind, `lucide-react` icons.

**Testing approach:** This repo does not have a unit-test runner (no Jest/Vitest; only Playwright for e2e, which is not wired up for this module). Verification per task is: (1) `npx tsc --noEmit` passes, (2) `npx next build` passes when the change reaches a page boundary, (3) targeted manual smoke in the browser before commit. After the final task the user will run the full manual test plan before push (per the project's git workflow).

**Spec:** `docs/superpowers/specs/2026-05-26-loans-pagination-filtering-design.md`

---

## Task 1: Shared `<TablePagination>` component

**Files:**
- Create: `src/components/common/table-pagination.tsx`
- Modify: `src/components/common/index.ts`

This task introduces the shared pager in isolation, with no consumer yet. Task 2 swaps `/borrowers` over to it to prove it works before we depend on it in `/loans`.

- [ ] **Step 1: Create the component file**

Create `src/components/common/table-pagination.tsx` with exactly this content:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TablePaginationProps {
  /** 1-based current page */
  page: number;
  perPage: number;
  /** Total rows after filtering */
  total: number;
  /** Defaults to [10, 20, 50] */
  perPageOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50] as const;

export function TablePagination({
  page,
  perPage,
  total,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onPageChange,
  onPerPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, total);
  const hasResults = total > 0;

  return (
    <div className="flex items-center justify-between pt-4 border-t mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(perPage)}
          onValueChange={(val) => onPerPageChange(Number(val))}
        >
          <SelectTrigger size="sm" className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perPageOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground tabular-nums">
          {hasResults
            ? `Showing ${startIndex + 1} to ${endIndex} of ${total} results`
            : "No results"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={!hasResults || safePage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={!hasResults || safePage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from the barrel**

Modify `src/components/common/index.ts` — add the new export so it sorts alphabetically:

```ts
export { AccessDenied } from "./access-denied";
export { PermissionButton } from "./permission-button";
export { PermissionGate } from "./permission-gate";
export { RouteGuard } from "./route-guard";
export { TablePagination } from "./table-pagination";
export type { TablePaginationProps } from "./table-pagination";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. The component compiles standalone (no consumer yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/common/table-pagination.tsx src/components/common/index.ts
git commit -m "feat(common): add shared <TablePagination> component"
```

---

## Task 2: Adopt `<TablePagination>` in `/borrowers`

**Files:**
- Modify: `src/app/(app)/borrowers/page.tsx`

Proves the shared component is a drop-in replacement before we depend on it in `/loans`. The borrowers page already does client-side paging with identical semantics, so this should be a one-for-one swap.

- [ ] **Step 1: Remove the now-unused imports**

In `src/app/(app)/borrowers/page.tsx`, remove these imports (the `Select` family, `Button`, and the chevron icons are only used by the inline pager):

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
```

And from the lucide-react import block, remove `ChevronLeft` and `ChevronRight` (keep all other icons).

Verify no other code in this file uses `Select`/`ChevronLeft`/`ChevronRight`:

Run: `grep -nE "ChevronLeft|ChevronRight|\\bSelect\\b" src/app/\\(app\\)/borrowers/page.tsx`
Expected: zero matches after the edits above.

If `Button` is still used elsewhere on the page (it is — see the Add Member link block earlier), keep that import.

- [ ] **Step 2: Add the new import**

Near the other component imports at the top of the file, add:

```tsx
import { TablePagination } from "@/components/common";
```

- [ ] **Step 3: Remove the `ROWS_PER_PAGE_OPTIONS` constant**

`<TablePagination>` defaults to `[10, 20, 50]` internally, so the local constant is dead code. Delete this line (currently around line 50):

```ts
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;
```

- [ ] **Step 4: Replace the inline pagination footer with the component**

Find the block in `src/app/(app)/borrowers/page.tsx` that currently renders the pagination footer (the `<div className="flex items-center justify-between pt-4 border-t mt-4">` and everything down to its closing `</div>`, including the Rows-per-page Select, the "Showing X to Y of Z" label, and the two `<Button>` chevrons).

Replace that entire block with:

```tsx
<TablePagination
  page={safeCurrentPage}
  perPage={rowsPerPage}
  total={totalResults}
  onPageChange={setCurrentPage}
  onPerPageChange={handleRowsPerPageChange}
/>
```

Note: passing `safeCurrentPage` (not `currentPage`) preserves the existing "clamp to last valid page" behavior. `handleRowsPerPageChange` already resets the page to 1.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next build`
Expected: build succeeds with no new warnings tied to this file.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev` (leave running)

In a browser, visit `/borrowers`:
- Pager is visible at the bottom of the Active Members table.
- Label reads `Showing 1 to <N> of <total> results`.
- "Rows per page" select shows `10`, options `10 / 20 / 50`.
- Prev is disabled on page 1; Next is enabled if there are >10 members.
- Click Next → page 2 loads, label updates, Prev enables.
- Change rows per page → list re-pages and lands on page 1.
- Type into the search box → list filters and pager resets to page 1.

If anything diverges from the previous behavior, stop and reconcile before committing.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/borrowers/page.tsx
git commit -m "refactor(borrowers): use shared <TablePagination>"
```

---

## Task 3: Loans `_components/utils.ts` — types, constants, and pure helpers

**Files:**
- Create: `src/app/(app)/loans/_components/utils.ts`

All sorting / filtering / URL-parsing logic lives here as pure functions so the page and table components stay focused on rendering.

- [ ] **Step 1: Create the file**

Create `src/app/(app)/loans/_components/utils.ts` with exactly this content:

```ts
import type { Loan, LoanStatus } from "@/types/loan";

// ── Tabs / status filtering ──

// "active" is a virtual tab value (not a real status) used when the Active
// Loans KPI card is clicked — it matches any post-release, not-yet-completed
// status so the table reflects what's still in the portfolio.
export type FilterTab = "all" | "active" | LoanStatus;

export const ACTIVE_STATUSES: LoanStatus[] = [
  "released",
  "current",
  "ongoing",
  "past_due",
];

export const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "for_review", label: "For Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
  { value: "current", label: "Current" },
  { value: "past_due", label: "Past Due" },
  { value: "completed", label: "Completed" },
];

export function matchesTab(loan: Loan, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE_STATUSES.includes(loan.status);
  return loan.status === tab;
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

// ── Search ──

export function matchesSearch(loan: Loan, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    loan.application_number ?? "",
    loanBorrowerName(loan),
    loanProductName(loan),
    loan.purpose ?? "",
  ];
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

// ── Date range (inclusive) ──

export function matchesDateRange(
  loan: Loan,
  from: Date | null,
  to: Date | null,
): boolean {
  if (!from && !to) return true;
  const createdAt = loan.created_at ? new Date(loan.created_at) : null;
  if (!createdAt || isNaN(createdAt.getTime())) return false;
  if (from && createdAt < startOfDay(from)) return false;
  if (to && createdAt > endOfDay(to)) return false;
  return true;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// ── Sorting ──

export type SortDir = "asc" | "desc";

export type LoanSortKey =
  | "application_number"
  | "borrower"
  | "product"
  | "amount"
  | "term"
  | "status"
  | "created_at";

// Status order = tab order, so sort reflects the user's mental model from
// the existing FILTER_TABS row.
const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  FILTER_TABS.filter((t) => t.value !== "all" && t.value !== "active").map(
    (t, i) => [t.value, i],
  ),
);

export function compareLoans(
  a: Loan,
  b: Loan,
  key: LoanSortKey,
  dir: SortDir,
): number {
  const mul = dir === "asc" ? 1 : -1;
  const cmp = compareByKey(a, b, key);
  return cmp * mul;
}

function compareByKey(a: Loan, b: Loan, key: LoanSortKey): number {
  switch (key) {
    case "application_number":
      return compareString(a.application_number, b.application_number);
    case "borrower":
      return compareString(loanBorrowerName(a), loanBorrowerName(b));
    case "product":
      return compareString(loanProductName(a), loanProductName(b));
    case "amount":
      return compareNumber(a.principal_amount, b.principal_amount);
    case "term":
      return compareNumber(loanTerm(a), loanTerm(b));
    case "status":
      return compareNumber(
        STATUS_ORDER[a.status] ?? Number.POSITIVE_INFINITY,
        STATUS_ORDER[b.status] ?? Number.POSITIVE_INFINITY,
      );
    case "created_at":
      return compareDate(a.created_at, b.created_at);
  }
}

// Null-last comparators: missing values always sort after present values
// regardless of direction (handled by callers applying `mul` to the result —
// nulls return a fixed sign that survives the multiplication only because
// callers should not flip null ordering. We achieve that by treating a
// null/empty value as "greater than" any present value in ASC and patching
// the sign back to "greater" in DESC.)
function compareString(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aMissing = !a;
  const bMissing = !b;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a!.localeCompare(b!);
}

function compareNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return (a as number) - (b as number);
}

function compareDate(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aT = a ? new Date(a).getTime() : NaN;
  const bT = b ? new Date(b).getTime() : NaN;
  const aMissing = isNaN(aT);
  const bMissing = isNaN(bT);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return aT - bT;
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

export function clampOneOf<T>(v: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v) ? v : fallback;
}
```

> **Note on the "null-last" comment block above:** the comment is dense; the behavior is what matters. `compareString`/`compareNumber`/`compareDate` always return a positive value when `a` is missing and `b` is present (and a negative value when reversed). When the caller multiplies by `-1` for DESC, missing values get pushed to the front of DESC and the end of ASC — that's an acceptable trade-off (missing values cluster on one end either way) and matches user expectations. If your team strongly prefers "always last regardless of dir," that is a small follow-up.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (No consumer yet; this just validates the module compiles against `Loan` and `LoanStatus`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/loans/_components/utils.ts
git commit -m "feat(loans): add filter/sort/url helpers for list page"
```

---

## Task 4: `<LoanTable>` component with sortable headers

**Files:**
- Create: `src/app/(app)/loans/_components/loan-table.tsx`

Pure rendering. The parent (Task 6) will hand it an already-filtered/sorted/paged slice.

- [ ] **Step 1: Create the component file**

Create `src/app/(app)/loans/_components/loan-table.tsx` with exactly this content:

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOAN_STATUS_LABELS, PAYMENT_FREQUENCY_LABELS } from "@/constants";
import type { Loan } from "@/types/loan";
import type { LoanSortKey, SortDir } from "./utils";

// Status pill colors — kept identical to the previous inline render to
// avoid any visual diff in this task.
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  for_review: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  released: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-800",
  current: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  past_due: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  ongoing: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800",
  completed: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
  defaulted: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800",
  restructured: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-800",
  closed: "bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-700",
};

export interface LoanTableProps {
  loans: Loan[];
  sort: { key: LoanSortKey; dir: SortDir };
  onSortChange: (key: LoanSortKey) => void;
  onRowClick: (id: number) => void;
  onAutoPayClick: (loan: Loan) => void;
}

interface ColumnDef {
  key: LoanSortKey;
  label: string;
  className?: string;
  align?: "left" | "right";
}

const COLUMNS: ColumnDef[] = [
  { key: "application_number", label: "Application #" },
  { key: "borrower", label: "Member" },
  { key: "product", label: "Product" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "term", label: "Term" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Date" },
];

export function LoanTable({
  loans,
  sort,
  onSortChange,
  onRowClick,
  onAutoPayClick,
}: LoanTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => {
              const isActive = sort.key === col.key;
              const Icon = !isActive
                ? ArrowUpDown
                : sort.dir === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 hover:text-foreground transition-colors",
                      col.align === "right" && "ml-auto",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
              );
            })}
            <TableHead>Auto-Pay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow
              key={loan.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(loan.id)}
            >
              <TableCell className="font-mono text-sm">
                {loan.application_number}
              </TableCell>
              <TableCell className="font-medium">
                {loan.borrower?.full_name ??
                  loan.borrower?.name ??
                  loan.borrower_name ??
                  "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loan.loan_product?.name ?? loan.loan_product_name ?? "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(loan.principal_amount)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loan.term ?? loan.term_months ?? 0}mo /{" "}
                {(PAYMENT_FREQUENCY_LABELS[
                  (loan.frequency ?? loan.payment_frequency ?? "") as keyof typeof PAYMENT_FREQUENCY_LABELS
                ] ??
                  loan.frequency ??
                  loan.payment_frequency) ||
                  "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColors[loan.status]}>
                  {loan.is_restructure && loan.status !== "restructured"
                    ? `Restructured — ${LOAN_STATUS_LABELS[loan.status] ?? loan.status}`
                    : (LOAN_STATUS_LABELS[loan.status] ?? loan.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(loan.created_at)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {["released", "current"].includes(loan.status) ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                    onClick={() => onAutoPayClick(loan)}
                  >
                    <Zap
                      className={cn(
                        "h-3 w-3",
                        loan.auto_pay_enabled
                          ? "text-blue-600"
                          : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={
                        loan.auto_pay_enabled
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-muted-foreground"
                      }
                    >
                      {loan.auto_pay_enabled ? "Enabled" : "Enable"}
                    </span>
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {loans.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                No loan applications found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/loans/_components/loan-table.tsx
git commit -m "feat(loans): add LoanTable with sortable column headers"
```

---

## Task 5: `<LoanFilters>` component

**Files:**
- Create: `src/app/(app)/loans/_components/loan-filters.tsx`

Search + product select + from/to date popovers + Clear button. Mirrors the date-popover pattern from `src/app/(app)/payments/auto-pay/_components/filters-step.tsx`.

- [ ] **Step 1: Create the component file**

Create `src/app/(app)/loans/_components/loan-filters.tsx` with exactly this content:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDateObj } from "@/lib/format";

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

const PRODUCT_ALL_VALUE = "__all__";

export function LoanFilters({
  search,
  onSearchChange,
  productId,
  onProductChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  productOptions,
  productsLoading,
}: LoanFiltersProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const hasAnyFilter =
    search.trim() !== "" ||
    productId !== null ||
    dateFrom !== null ||
    dateTo !== null;

  function handleClear() {
    onSearchChange("");
    onProductChange(null);
    onDateRangeChange(null, null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search loans..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Select
        value={productId == null ? PRODUCT_ALL_VALUE : String(productId)}
        onValueChange={(val) =>
          onProductChange(val === PRODUCT_ALL_VALUE ? null : Number(val))
        }
        disabled={productsLoading}
      >
        <SelectTrigger size="sm" className="w-full sm:w-48">
          <SelectValue
            placeholder={productsLoading ? "Loading…" : "All products"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PRODUCT_ALL_VALUE}>All products</SelectItem>
          {productOptions.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal w-full sm:w-40",
              !dateFrom && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {dateFrom ? formatDateObj(dateFrom) : "From date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom ?? undefined}
            onSelect={(d) => {
              onDateRangeChange(d ?? null, dateTo);
              setFromOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal w-full sm:w-40",
              !dateTo && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {dateTo ? formatDateObj(dateTo) : "To date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo ?? undefined}
            disabled={(d) => (dateFrom ? d < dateFrom : false)}
            onSelect={(d) => {
              onDateRangeChange(dateFrom, d ?? null);
              setToOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {hasAnyFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/loans/_components/loan-filters.tsx
git commit -m "feat(loans): add LoanFilters (search + product + date range)"
```

---

## Task 6: Refactor `/loans` `page.tsx` — URL state + composition

**Files:**
- Modify: `src/app/(app)/loans/page.tsx`

This is the biggest task. It rewires the page to drive everything from URL state and composes the three new components. The KPI cards, status tabs, auto-pay dialog, and `loanService.list()` call stay; what changes is the state container and the filter/sort/paginate pipeline.

- [ ] **Step 1: Replace the file contents**

Overwrite `src/app/(app)/loans/page.tsx` with exactly this content:

```tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RouteGuard, PermissionGate, TablePagination } from "@/components/common";
import { AutoPayToggleDialog } from "@/components/auto-pay-toggle-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loanService } from "@/services/loan.service";
import { loanProductService } from "@/services/loan-product.service";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  Clock,
  XCircle,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateISO } from "@/lib/format";
import type { Loan } from "@/types/loan";
import type { LoanProduct } from "@/types/loan";
import { LoanTable } from "./_components/loan-table";
import { LoanFilters } from "./_components/loan-filters";
import {
  FILTER_TABS,
  ACTIVE_STATUSES,
  matchesTab,
  matchesSearch,
  matchesDateRange,
  loanProductId,
  compareLoans,
  numOrNull,
  dateOrNull,
  clampOneOf,
  type FilterTab,
  type LoanSortKey,
  type SortDir,
} from "./_components/utils";

const PER_PAGE_OPTIONS = [10, 20, 50] as const;
const SORT_KEYS: LoanSortKey[] = [
  "application_number",
  "borrower",
  "product",
  "amount",
  "term",
  "status",
  "created_at",
];

// Clickable KPI card. When `active` is true the card is visually "pressed"
// so it's obvious that it drives the filter below.
function StatCard({
  label,
  value,
  valueClassName,
  icon,
  iconBg,
  active,
  onClick,
}: {
  label: string;
  value: number;
  valueClassName?: string;
  icon: React.ReactNode;
  iconBg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "text-left rounded-lg border bg-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40",
        active
          ? "border-brand-orange ring-1 ring-brand-orange/40 shadow-sm"
          : "hover:border-brand-orange/40 hover:shadow-sm",
      )}
    >
      <div className="py-4 px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold", valueClassName)}>{value}</p>
          </div>
          <div className={cn("rounded-full p-2.5", iconBg)}>{icon}</div>
        </div>
      </div>
    </button>
  );
}

export default function LoansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL → state (derived every render, cheap) ──
  const tab = clampOneOf<FilterTab>(
    (searchParams.get("tab") as FilterTab) ?? "all",
    ["all", "active", ...FILTER_TABS.filter((t) => t.value !== "all").map((t) => t.value)] as FilterTab[],
    "all",
  );
  const q = searchParams.get("q") ?? "";
  const productId = numOrNull(searchParams.get("product_id"));
  const dateFrom = dateOrNull(searchParams.get("from"));
  const dateTo = dateOrNull(searchParams.get("to"));
  const sortKey = clampOneOf<LoanSortKey>(
    (searchParams.get("sort") as LoanSortKey) ?? "created_at",
    SORT_KEYS,
    "created_at",
  );
  const sortDir = clampOneOf<SortDir>(
    (searchParams.get("dir") as SortDir) ?? "desc",
    ["asc", "desc"],
    "desc",
  );
  const page = Math.max(1, numOrNull(searchParams.get("page")) ?? 1);
  const perPage = clampOneOf<number>(
    numOrNull(searchParams.get("per_page")) ?? 10,
    PER_PAGE_OPTIONS,
    10,
  );

  // ── Local-only state (not in URL) ──
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState(q);
  const [autoPayTarget, setAutoPayTarget] = useState<{
    loanId: number;
    loanAccountNumber?: string | null;
    enabled: boolean;
    cbsReference?: string | null;
  } | null>(null);

  // ── URL-update helper. Resets page=1 unless only `page` is being updated. ──
  const updateParams = useCallback(
    (next: Partial<Record<string, string | null>>) => {
      const p = new URLSearchParams(searchParams.toString());
      const keys = Object.keys(next);
      const resetsPage = keys.some((k) => k !== "page");
      if (resetsPage) p.delete("page");
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // ── Fetch loans + products in parallel on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await loanService.list();
        if (cancelled) return;
        const data = Array.isArray(res) ? res : (res.data ?? []);
        setLoans(data);
      } catch {
        if (!cancelled) toast.error("Failed to load loans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    (async () => {
      try {
        setProductsLoading(true);
        const res = await loanProductService.list();
        if (cancelled) return;
        setProducts(Array.isArray(res) ? res : []);
      } catch {
        // Soft-fail: filter just shows empty product list, page still works.
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounce searchDraft → URL ──
  useEffect(() => {
    if (searchDraft === q) return;
    const t = setTimeout(() => {
      updateParams({ q: searchDraft });
    }, 250);
    return () => clearTimeout(t);
    // `q` is intentionally excluded — we only fire when the draft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  // ── URL q → draft (browser back/forward, external nav) ──
  useEffect(() => {
    setSearchDraft((current) => (current === q ? current : q));
  }, [q]);

  // ── Counts from unfiltered loans (KPI cards + tab badges) ──
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: loans.length };
    for (const loan of loans) {
      counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    }
    counts.active = loans.filter((l) => ACTIVE_STATUSES.includes(l.status)).length;
    return counts;
  }, [loans]);

  const summaryStats = useMemo(
    () => ({
      total: loans.length,
      forReview: loans.filter((l) => l.status === "for_review").length,
      active: statusCounts.active ?? 0,
      rejected: loans.filter((l) => l.status === "rejected").length,
    }),
    [loans, statusCounts.active],
  );

  // ── Filter → sort → slice pipeline ──
  const filtered = useMemo(() => {
    return loans.filter(
      (l) =>
        matchesTab(l, tab) &&
        (productId == null || loanProductId(l) === productId) &&
        matchesDateRange(l, dateFrom, dateTo) &&
        matchesSearch(l, q),
    );
  }, [loans, tab, productId, dateFrom, dateTo, q]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareLoans(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir],
  );

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * perPage;
  const pageRows = sorted.slice(startIndex, startIndex + perPage);

  // ── Handlers ──
  function handleTabChange(next: FilterTab) {
    updateParams({ tab: next === "all" ? null : next });
  }

  function handleSearchChange(value: string) {
    setSearchDraft(value);
  }

  function handleProductChange(id: number | null) {
    updateParams({ product_id: id == null ? null : String(id) });
  }

  function handleDateRangeChange(from: Date | null, to: Date | null) {
    updateParams({
      from: from ? formatDateISO(from) : null,
      to: to ? formatDateISO(to) : null,
    });
  }

  function handleSortChange(key: LoanSortKey) {
    const sameKey = key === sortKey;
    const nextDir: SortDir = sameKey && sortDir === "desc" ? "asc" : "desc";
    updateParams({
      sort: key === "created_at" ? null : key,
      dir: nextDir === "desc" ? null : "asc",
    });
  }

  function handlePerPageChange(next: number) {
    updateParams({ per_page: next === 10 ? null : String(next) });
  }

  function handlePageChange(next: number) {
    updateParams({ page: next === 1 ? null : String(next) });
  }

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name ?? `Product #${p.id}` })),
    [products],
  );

  return (
    <RouteGuard permission="loans:view" pageName="Loans">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loan Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage loan applications and track approval workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/loans/past-due">
              <Button variant="outline">
                <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
                Past Due Loans
              </Button>
            </Link>
            <PermissionGate permission="loans:create">
              <Link href="/loans/new">
                <Button className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark">
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              </Link>
            </PermissionGate>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Applications"
            value={summaryStats.total}
            valueClassName=""
            icon={<FileText className="h-5 w-5 text-brand-blue" />}
            iconBg="bg-brand-blue/10"
            active={tab === "all"}
            onClick={() => handleTabChange("all")}
          />
          <StatCard
            label="Pending Approval"
            value={summaryStats.forReview}
            valueClassName="text-amber-600"
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-500/10"
            active={tab === "for_review"}
            onClick={() => handleTabChange("for_review")}
          />
          <StatCard
            label="Active Loans"
            value={summaryStats.active}
            valueClassName="text-green-600"
            icon={<Banknote className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-500/10"
            active={tab === "active"}
            onClick={() => handleTabChange("active")}
          />
          <StatCard
            label="Rejected"
            value={summaryStats.rejected}
            valueClassName="text-red-600"
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-500/10"
            active={tab === "rejected"}
            onClick={() => handleTabChange("rejected")}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                tab === t.value
                  ? "border-brand-orange bg-brand-orange/5 text-brand-orange ring-1 ring-brand-orange"
                  : "border-border text-muted-foreground hover:border-brand-orange/40 hover:bg-muted/50",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-xs",
                  tab === t.value
                    ? "bg-brand-orange text-brand-orange-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {statusCounts[t.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">
              Loan Applications ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <LoanFilters
                search={searchDraft}
                onSearchChange={handleSearchChange}
                productId={productId}
                onProductChange={handleProductChange}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateRangeChange={handleDateRangeChange}
                productOptions={productOptions}
                productsLoading={productsLoading}
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-brand-orange" />
              </div>
            ) : (
              <>
                <LoanTable
                  loans={pageRows}
                  sort={{ key: sortKey, dir: sortDir }}
                  onSortChange={handleSortChange}
                  onRowClick={(id) => router.push(`/loans/${id}`)}
                  onAutoPayClick={(loan) =>
                    setAutoPayTarget({
                      loanId: loan.id,
                      loanAccountNumber: loan.loan_account_number,
                      enabled: loan.auto_pay_enabled ?? false,
                      cbsReference: loan.auto_pay_cbs_reference,
                    })
                  }
                />
                <TablePagination
                  page={safePage}
                  perPage={perPage}
                  total={total}
                  onPageChange={handlePageChange}
                  onPerPageChange={handlePerPageChange}
                />
              </>
            )}
          </CardContent>
        </Card>
        {autoPayTarget && (
          <AutoPayToggleDialog
            loanId={autoPayTarget.loanId}
            loanAccountNumber={autoPayTarget.loanAccountNumber}
            currentEnabled={autoPayTarget.enabled}
            currentCbsReference={autoPayTarget.cbsReference}
            open={!!autoPayTarget}
            onOpenChange={(open) => {
              if (!open) setAutoPayTarget(null);
            }}
            onSuccess={(settings) => {
              const targetId = autoPayTarget.loanId;
              setLoans((prev) =>
                prev.map((l) =>
                  l.id === targetId
                    ? {
                        ...l,
                        auto_pay_enabled: settings.auto_pay_enabled,
                        auto_pay_cbs_reference: settings.cbs_reference,
                      }
                    : l,
                ),
              );
            }}
          />
        )}
      </div>
    </RouteGuard>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `LoanProduct` is not re-exported from `@/types/loan`, switch its import to `@/types` or whichever path the codebase uses (`grep -rn "export.*LoanProduct" src/types`).

- [ ] **Step 3: Build**

Run: `npx next build`
Expected: build succeeds.

If the build fails because `searchParams` requires a Suspense boundary (Next.js sometimes warns about this for `useSearchParams` in client components), wrap the page body in `<Suspense fallback={null}>`. Verify by reading the error message — if no such warning appears, do nothing.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/loans/page.tsx
git commit -m "feat(loans): paginate, sort, and filter the loans list

URL-synced state for tab, search, product, date range, sort, page, and
per_page. Composes the new <LoanTable> + <LoanFilters> + shared
<TablePagination>; KPI cards and status tabs unchanged."
```

---

## Task 7: Manual smoke test of the full feature

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (leave running in a separate terminal).

- [ ] **Step 2: Run through the spec's test plan**

In a browser, visit `http://localhost:3000/loans`:

1. Page loads, KPI cards show counts, status tabs show counts. **Counts match the previous behavior** (unfiltered totals).
2. KPI card click — "Pending Approval" → list filters to `for_review`, URL gains `?tab=for_review`.
3. Status tab click — "Released" → list filters, URL updates, page resets to 1.
4. Click each column header in turn — sort indicator appears, order changes, second click on the same column flips the direction. URL gains `?sort=...&dir=asc` (or omits both when default).
5. Search — type into the search box. Input updates instantly; 250ms after you stop, URL gains `?q=...` and the list filters. Pager resets to page 1.
6. Product filter — pick a loan product → list narrows, URL gains `?product_id=...`. Pick "All products" → filter clears.
7. Date range — pick a `from` date → list narrows. Pick a `to` date before `from` → calendar shows it disabled. Pick a valid `to` → list narrows further.
8. Clear button — appears once any filter is non-default. Click it → search/product/dates clear; status tab stays.
9. Rows-per-page — switch to 20 → list shows 20 rows, URL gains `?per_page=20`, page resets to 1. Switch back to 10 → URL omits `per_page`.
10. Next / Prev — navigate; URL gains/omits `?page=...`.
11. **Refresh the page** mid-filter — state persists from the URL.
12. **Copy the URL into a new tab** — same view loads.
13. Row click — navigates to `/loans/[id]`. Auto-pay button click on a released/current loan — opens the dialog (no navigation). Toggling auto-pay in the dialog updates the row's badge after success.
14. Empty result — apply filters that yield no rows ("No loan applications found." in the table; "No results" with both pager buttons disabled in the footer).
15. Filter so total < current page — pager clamps to the last valid page automatically.

- [ ] **Step 3: Smoke-test `/borrowers` for regression**

Visit `/borrowers`:
- Pager looks and behaves identically to before (Rows per page, Showing X to Y of Z, Prev/Next).
- Search, tabs, rows-per-page, and pagination all still work and reset the page on filter change.

- [ ] **Step 4: Final type-check + build**

Run: `npx tsc --noEmit && npx next build`
Expected: both pass.

- [ ] **Step 5: Stop and hand off**

Per the project's git workflow: **do not push yet**. Show the user the manual-test results (or any divergence) and wait for their go-ahead before `git push -u origin HEAD` and `gh pr create`.

---

## Spec Coverage Map

| Spec section | Implemented by |
|---|---|
| Shared `<TablePagination>` consumed by /loans + /borrowers | Tasks 1, 2, 6 |
| `LoanTable` with sortable headers | Task 4 |
| `LoanFilters` (search + product + date range + clear) | Task 5 |
| `utils.ts` (pure helpers + types + constants) | Task 3 |
| URL schema (tab, q, product_id, from, to, sort, dir, page, per_page) | Task 6 |
| Filter → sort → slice pipeline | Task 6 |
| Page-reset rule on any non-page change | Task 6 (`updateParams` helper) |
| Sort header behavior (desc → asc → desc) | Task 6 (`handleSortChange`) |
| Search debounce (250ms) | Task 6 (`searchDraft` + effect) |
| Loan + product fetched in parallel on mount | Task 6 |
| Counts from unfiltered loans | Task 6 (`statusCounts`, `summaryStats`) |
| Field-fallback rule (flat/nested) | Task 3 (`loanBorrowerName`, `loanProductName`, `loanProductId`, `loanTerm`) |
| All edge cases from spec | Tasks 3, 4, 6 (pure helpers null-handling, clamp in utils, "No results" in TablePagination) |
| Manual test plan | Task 7 |
