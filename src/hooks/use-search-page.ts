import { useCallback, useEffect, useRef, useState } from "react";

/** How long typing has to pause before the server is asked. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The `search` to send for what was typed: trimmed, inner whitespace collapsed,
 * because the server matches a whole name with single spaces.
 */
export function normaliseSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** One answered search. */
export interface SearchPage<T> {
  query: string;
  rows: T[];
  total: number;
}

/** What the search holds, as far as the picker needs it. */
export interface SearchState<T> {
  /** The search box, as typed. */
  query: string;
  /** The normalised query last sent. Null after a failure, until the next keystroke. */
  asked: string | null;
  /** The query whose request failed, if the latest one did. */
  failedQuery: string | null;
  /** The latest answer, whichever query it was for. */
  page: SearchPage<T> | null;
  /** The answer to the empty query, kept so reopening the popup needs no request. */
  firstPage: SearchPage<T> | null;
}

export interface SearchView {
  query: string;
  shown: number;
  total: number;
  /** Typing has not settled yet, or the request for it is still out. */
  pending: boolean;
  failed: boolean;
}

// One instance, so an empty list keeps its identity across renders.
const NO_ROWS: never[] = [];

/**
 * The rows to list and how to describe them. Until the answer for the typed
 * query arrives, the previous rows stay up and the search reads as pending, so
 * nothing is presented as matching a query it was not fetched for.
 */
export function viewSearch<T>(state: SearchState<T>): { rows: T[]; view: SearchView } {
  const { asked, failedQuery, page, firstPage } = state;
  const query = normaliseSearchQuery(state.query);
  const answered = asked === "" && firstPage ? firstPage : page;
  const failed = asked === null && query === failedQuery;
  const pending = !failed && (query !== asked || answered?.query !== asked);
  const rows: T[] = failed || !answered ? NO_ROWS : answered.rows;
  return {
    rows,
    view: { query, shown: rows.length, total: answered?.total ?? 0, pending, failed },
  };
}

/** The words a picker's status line uses for what it lists. */
export interface SearchWords {
  /** "members", as in "Loading members…". */
  plural: string;
  /** What to type before anything has been typed: "a name". */
  firstHint: string;
}

/** The line under the list. Empty when there is nothing to add. */
export function searchStatus(view: SearchView, words: SearchWords): string {
  if (view.pending) return view.shown === 0 ? `Loading ${words.plural}…` : "Searching…";
  if (view.failed) return `Couldn't load ${words.plural}. Keep typing to try again.`;
  if (view.total > view.shown) {
    const narrow = view.query === "" ? `Type ${words.firstHint}` : "Keep typing";
    return `Showing ${view.shown} of ${view.total}. ${narrow} to narrow.`;
  }
  return "";
}

/** What the list says when a settled search found nothing. Null otherwise. */
export function searchEmptyMessage(view: SearchView, singular: string): string | null {
  if (view.pending || view.failed || view.shown > 0) return null;
  return view.query === "" ? `No ${singular} found.` : `No ${singular} matches “${view.query}”.`;
}

export interface SearchPageResult<T> {
  /** The search box, as typed. */
  query: string;
  /** Debounced: the server is asked once typing pauses. */
  setQuery: (query: string) => void;
  /** Straight back to the first page, for when the popup closes. */
  reset: () => void;
  rows: T[];
  view: SearchView;
}

/**
 * Search-as-you-type, one page per settled query, for the screens that pick one
 * record out of thousands. It never drains the list, which stopped at 2,000 and
 * cost every form opening the whole table.
 *
 * - `fetchPage` must be stable: pass a module-level function.
 * - `enabled` holds the first request back until the popup first opens, so a
 *   form with several pickers asks for nothing it doesn't use. Pass the
 *   caller's permission into it too.
 * - A response to a query the user has typed past is dropped, so a slow answer
 *   never replaces a newer one.
 * - The first page is kept, so closing the popup needs no second request. A
 *   failure waits for the next keystroke or the next opening.
 */
export function useSearchPage<T>({
  enabled,
  fetchPage,
}: {
  enabled: boolean;
  fetchPage: (query: string) => Promise<SearchPage<T>>;
}): SearchPageResult<T> {
  const [query, setQueryState] = useState("");
  const [asked, setAsked] = useState<string | null>("");
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [page, setPage] = useState<SearchPage<T> | null>(null);
  const [firstPage, setFirstPage] = useState<SearchPage<T> | null>(null);
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
      () => setAsked(normaliseSearchQuery(next)),
      SEARCH_DEBOUNCE_MS,
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
    fetchPage(asked)
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
  }, [enabled, asked, firstPage, fetchPage]);

  const { rows, view } = viewSearch<T>({ query, asked, failedQuery, page, firstPage });

  return { query, setQuery, reset, rows, view };
}
