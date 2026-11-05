import { useCallback, useEffect, useRef, useState } from "react";
import { borrowerService } from "@/services/borrower.service";
import type { Borrower } from "@/types";

/** Rows per search, and what shows before typing. The status line says when there are more. */
export const MEMBER_PAGE_SIZE = 25;

/** How long typing has to pause before the server is asked. */
export const MEMBER_SEARCH_DEBOUNCE_MS = 300;

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
export function normaliseMemberQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

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
export interface MemberPage {
  query: string;
  rows: MemberOption[];
  total: number;
}

/** One page for one query, and nothing more: the pickers never drain the membership. */
export async function fetchMemberPage(
  list: (params: Record<string, unknown>) => Promise<{ data?: Borrower[]; meta?: { total?: number } }>,
  query: string,
): Promise<MemberPage> {
  const response = await list(memberSearchParams(query));
  const rows = (response.data ?? []).map(toMemberOption);
  return { query, rows, total: response.meta?.total ?? rows.length };
}

/** What the search holds, as far as the picker needs it. */
export interface MemberSearchState {
  /** The search box, as typed. */
  query: string;
  /** The normalised query last sent. Null after a failure, until the next keystroke. */
  asked: string | null;
  /** The query whose request failed, if the latest one did. */
  failedQuery: string | null;
  /** The latest answer, whichever query it was for. */
  page: MemberPage | null;
  /** The answer to the empty query, kept so reopening the popup needs no request. */
  firstPage: MemberPage | null;
}

export interface MemberSearchView {
  query: string;
  shown: number;
  total: number;
  /** Typing has not settled yet, or the request for it is still out. */
  pending: boolean;
  failed: boolean;
}

// One instance, so an empty list keeps its identity across renders.
const NO_ROWS: MemberOption[] = [];

/**
 * The rows to list and how to describe them. Until the answer for the typed
 * query arrives, the previous rows stay up and the search reads as pending, so
 * nothing is presented as matching a query it was not fetched for.
 */
export function viewMemberSearch(state: MemberSearchState): {
  rows: MemberOption[];
  view: MemberSearchView;
} {
  const { asked, failedQuery, page, firstPage } = state;
  const query = normaliseMemberQuery(state.query);
  const answered = asked === "" && firstPage ? firstPage : page;
  const failed = asked === null && query === failedQuery;
  const pending = !failed && (query !== asked || answered?.query !== asked);
  const rows = failed || !answered ? NO_ROWS : answered.rows;
  return {
    rows,
    view: { query, shown: rows.length, total: answered?.total ?? 0, pending, failed },
  };
}

/** The line under the list. Empty when there is nothing to add. */
export function memberSearchStatus(view: MemberSearchView): string {
  if (view.pending) return view.shown === 0 ? "Loading members…" : "Searching…";
  if (view.failed) return "Couldn't load members. Keep typing to try again.";
  if (view.total > view.shown) {
    const narrow = view.query === "" ? "Type a name" : "Keep typing";
    return `Showing ${view.shown} of ${view.total}. ${narrow} to narrow.`;
  }
  return "";
}

/** What the list says when a settled search found nobody. Null otherwise. */
export function memberEmptyMessage(view: MemberSearchView): string | null {
  if (view.pending || view.failed || view.shown > 0) return null;
  return view.query === "" ? "No member found." : `No member matches “${view.query}”.`;
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

/**
 * Search-as-you-type over `GET /borrowers?members_only=1`, for the screens that
 * pick a member: the first 25 before typing, then one page per settled query.
 * It never drains the membership, which stopped at 2,000 and cost every form
 * opening the whole list.
 *
 * - `enabled` holds the first request back until the popup first opens, so a
 *   form with several pickers asks for nothing it doesn't use. Pass the
 *   caller's `borrowers:view` into it too.
 * - A response to a query the user has typed past is dropped, so a slow answer
 *   never replaces a newer one.
 * - The first page is kept, so closing the popup needs no second request. A
 *   failure waits for the next keystroke or the next opening.
 */
export function useMemberSearch({ enabled = true }: { enabled?: boolean } = {}): MemberSearch {
  const [query, setQueryState] = useState("");
  const [asked, setAsked] = useState<string | null>("");
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [page, setPage] = useState<MemberPage | null>(null);
  const [firstPage, setFirstPage] = useState<MemberPage | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const timer = debounce;
    return () => clearTimeout(timer.current);
  }, []);

  // Debounced here rather than in an effect on `query`, so only a keystroke
  // starts the timer.
  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => setAsked(normaliseMemberQuery(next)),
      MEMBER_SEARCH_DEBOUNCE_MS,
    );
  }, []);

  const reset = useCallback(() => {
    clearTimeout(debounce.current);
    setQueryState("");
    setAsked("");
  }, []);

  useEffect(() => {
    if (!enabled || asked === null) return;
    if (asked === "" && firstPage) return;
    let cancelled = false;
    fetchMemberPage(borrowerService.list, asked)
      .then((answered) => {
        if (cancelled) return;
        setPage(answered);
        if (asked === "") setFirstPage(answered);
        setFailedQuery(null);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedQuery(asked);
        setAsked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, asked, firstPage]);

  const { rows, view } = viewMemberSearch({ query, asked, failedQuery, page, firstPage });

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
