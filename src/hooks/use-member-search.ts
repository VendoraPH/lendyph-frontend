import { borrowerService } from "@/services/borrower.service";
import type { Borrower } from "@/types";
import {
  SEARCH_DEBOUNCE_MS,
  normaliseSearchQuery,
  searchEmptyMessage,
  searchStatus,
  useSearchPage,
  viewSearch,
  type SearchPage,
  type SearchState,
  type SearchView,
} from "./use-search-page";

/** Rows per search, and what shows before typing. The status line says when there are more. */
export const MEMBER_PAGE_SIZE = 25;

/** How long typing has to pause before the server is asked. */
export const MEMBER_SEARCH_DEBOUNCE_MS = SEARCH_DEBOUNCE_MS;

/** A member as the pickers hold it. A saved loan's co-maker comes with no code. */
export interface MemberOption {
  id: number;
  full_name: string;
  borrower_code?: string;
}

export function toMemberOption(member: Borrower): MemberOption {
  return {
    id: member.id,
    full_name: member.full_name ?? `${member.first_name} ${member.last_name}`,
    borrower_code: member.borrower_code,
  };
}

/**
 * The `search` to send for what was typed: trimmed, inner whitespace collapsed,
 * because the server matches a whole name with single spaces.
 */
export const normaliseMemberQuery = normaliseSearchQuery;

/**
 * Members only: pending and rejected applicants can't take or back a loan, and
 * `StoreLoanRequest` only validates `exists:borrowers,id`, so nothing behind
 * these pickers would refuse one.
 */
export function memberSearchParams(query: string): Record<string, unknown> {
  return {
    members_only: 1,
    per_page: MEMBER_PAGE_SIZE,
    ...(query ? { search: query } : {}),
  };
}

/** One answered search. */
export type MemberPage = SearchPage<MemberOption>;

/** One page for one query, and nothing more: the pickers never drain the membership. */
export async function fetchMemberPage(
  list: (params: Record<string, unknown>) => Promise<{ data?: Borrower[]; meta?: { total?: number } }>,
  query: string,
): Promise<MemberPage> {
  const response = await list(memberSearchParams(query));
  const rows = (response.data ?? []).map(toMemberOption);
  return { query, rows, total: response.meta?.total ?? rows.length };
}

export type MemberSearchState = SearchState<MemberOption>;

export type MemberSearchView = SearchView;

/** See `viewSearch`. */
export function viewMemberSearch(state: MemberSearchState): {
  rows: MemberOption[];
  view: MemberSearchView;
} {
  return viewSearch(state);
}

/** The line under the list. Empty when there is nothing to add. */
export function memberSearchStatus(view: MemberSearchView): string {
  return searchStatus(view, { plural: "members", firstHint: "a name" });
}

/** What the list says when a settled search found nobody. Null otherwise. */
export function memberEmptyMessage(view: MemberSearchView): string | null {
  return searchEmptyMessage(view, "member");
}

/** The rows a picker offers: not the loan's member, nor a co-maker picked in another slot. */
export function selectableMembers(
  rows: MemberOption[],
  excluded: readonly (number | null)[],
): MemberOption[] {
  return rows.filter((row) => !excluded.includes(row.id));
}

/**
 * The form's memory of members by id. A search only holds its latest page, so
 * the form keeps what it has picked, and what a saved loan named, to show those
 * names whatever the search has moved on to.
 */
export function rememberMembers(
  known: Record<number, MemberOption>,
  members: MemberOption[],
): Record<number, MemberOption> {
  const next = { ...known };
  for (const member of members) next[member.id] = member;
  return next;
}

export interface MemberSearch {
  /** The search box, as typed. */
  query: string;
  /** Debounced: the server is asked once typing pauses. */
  setQuery: (query: string) => void;
  /** Straight back to the first page, for when the popup closes. */
  reset: () => void;
  rows: MemberOption[];
  /** Typing has not settled, or its request is still out. */
  pending: boolean;
  /** The line under the list; see `memberSearchStatus`. */
  status: string;
  emptyMessage: string | null;
}

const fetchMembers = (query: string) => fetchMemberPage(borrowerService.list, query);

/**
 * Search-as-you-type over `GET /borrowers?members_only=1`, for the screens that
 * pick a member: the first 25 before typing, then one page per settled query.
 * See `useSearchPage` for `enabled`, debouncing and dropped answers.
 */
export function useMemberSearch({ enabled = true }: { enabled?: boolean } = {}): MemberSearch {
  const { query, setQuery, reset, rows, view } = useSearchPage({ enabled, fetchPage: fetchMembers });
  return {
    query,
    setQuery,
    reset,
    rows,
    pending: view.pending,
    status: memberSearchStatus(view),
    emptyMessage: memberEmptyMessage(view),
  };
}
