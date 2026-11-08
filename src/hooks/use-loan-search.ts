import { loanService } from "@/services/loan.service";
import type { Loan } from "@/types";
import {
  searchEmptyMessage,
  searchStatus,
  useSearchPage,
  type SearchPage,
  type SearchView,
} from "./use-search-page";

/** Rows per search, and what shows before typing. The status line says when there are more. */
export const LOAN_PAGE_SIZE = 25;

/** A loan as the pickers hold it. */
export interface LoanOption {
  id: number;
  label: string;
  /** The member who holds it. */
  hint?: string;
}

export function toLoanOption(loan: Loan): LoanOption {
  return {
    id: loan.id,
    label: loan.loan_account_number ?? loan.application_number ?? `Loan #${loan.id}`,
    hint: loan.borrower?.full_name ?? loan.borrower?.name,
  };
}

/**
 * Every loan that has ever been released, because this picker is how a statement
 * is asked for, and a member with a paid-off, defaulted or restructured loan can
 * ask for a final one. `view=summary` leaves the schedules out, which a list of
 * names and numbers has no use for.
 */
const STATEMENT_LOAN_STATUSES = "released,ongoing,completed,defaulted,restructured";

export function loanSearchParams(query: string): Record<string, unknown> {
  return {
    status: STATEMENT_LOAN_STATUSES,
    view: "summary",
    per_page: LOAN_PAGE_SIZE,
    ...(query ? { search: query } : {}),
  };
}

/** One page for one query, and nothing more. */
export async function fetchLoanPage(
  list: (params: Record<string, unknown>) => Promise<{ data?: Loan[]; meta?: { total?: number } }>,
  query: string,
): Promise<SearchPage<LoanOption>> {
  const response = await list(loanSearchParams(query));
  const rows = (response.data ?? []).map(toLoanOption);
  return { query, rows, total: response.meta?.total ?? rows.length };
}

/** The line under the list. Empty when there is nothing to add. */
export function loanSearchStatus(view: SearchView): string {
  return searchStatus(view, { plural: "loans", firstHint: "a name or loan number" });
}

/** What the list says when a settled search found nothing. Null otherwise. */
export function loanEmptyMessage(view: SearchView): string | null {
  return searchEmptyMessage(view, "loan");
}

export interface LoanSearch {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
  rows: LoanOption[];
  pending: boolean;
  status: string;
  emptyMessage: string | null;
}

const fetchLoans = (query: string) => fetchLoanPage(loanService.list, query);

/**
 * Search-as-you-type over `GET /loans?view=summary`, every released loan, for the
 * screens that pick a loan by number or member. See `useSearchPage`.
 */
export function useLoanSearch({ enabled = true }: { enabled?: boolean } = {}): LoanSearch {
  const { query, setQuery, reset, rows, view } = useSearchPage({ enabled, fetchPage: fetchLoans });
  return {
    query,
    setQuery,
    reset,
    rows,
    pending: view.pending,
    status: loanSearchStatus(view),
    emptyMessage: loanEmptyMessage(view),
  };
}
