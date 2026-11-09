/**
 * The Expenses list: one server page at a time, filtered and searched on the
 * server. Its figures are `meta.totals` and `meta.stats`, never a sum of rows.
 */
import { normaliseSearchQuery } from "@/hooks/use-search-page";
import type { ExpenseStatus } from "@/types";
import type { ExpensePageQuery } from "@/services/accounting.service";
import { expenseStatusLabel } from "../../_lib/display-labels";

/** Rows per page of the expense list. */
export const EXPENSE_PAGE_SIZE = 25;

/** In the Status filter's order. */
const EXPENSE_STATUSES: readonly ExpenseStatus[] = ["unpaid", "partially_paid", "paid", "overdue"];

export interface ExpenseListFilters {
  /** A status, or the filter's "any". */
  status: string;
  search: string;
  page: number;
}

/** What `GET /accounting/expenses` is asked. Only a known status is sent. */
export function expenseListQuery(filters: ExpenseListFilters): ExpensePageQuery {
  const query: ExpensePageQuery = { page: filters.page, per_page: EXPENSE_PAGE_SIZE };
  if ((EXPENSE_STATUSES as readonly string[]).includes(filters.status)) {
    query.status = filters.status as ExpenseStatus;
  }
  const search = normaliseSearchQuery(filters.search);
  if (search) query.search = search;
  return query;
}

/** Identifies one request. `reload` asks again for the same filters, as after a save. */
export function expenseListKey(query: ExpensePageQuery, reload: number): string {
  return `${JSON.stringify(query)}#${reload}`;
}

/**
 * The page to go back to when a page came back empty: a payment or a filter can
 * leave it past the end. Always lower than `page`. Null when this page stands.
 */
export function expensePageToStepBackTo(answer: {
  rows: number;
  page: number;
  lastPage?: number;
}): number | null {
  if (answer.rows > 0 || answer.page <= 1) return null;
  return Math.max(1, Math.min(answer.lastPage ?? 1, answer.page - 1));
}

export interface ExpenseStatusCount {
  status: ExpenseStatus;
  label: string;
  count: number;
}

/** The server's per-status counts (`meta.stats`), in the filter's order and words. */
export function expenseStatusCounts(
  stats: Partial<Record<ExpenseStatus, number>> | undefined,
): ExpenseStatusCount[] {
  if (!stats) return [];
  return EXPENSE_STATUSES.filter((status) => typeof stats[status] === "number").map((status) => ({
    status,
    label: expenseStatusLabel(status),
    count: stats[status] as number,
  }));
}
