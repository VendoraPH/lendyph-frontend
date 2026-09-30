// The Account Officer picker's search rules, kept out of the component so they
// can be tested without a browser. Dependency-free, so it runs under
// `tsx --test`.

import type { StaffMember } from "@/types";

/** Rows per search. Enough to scan; the status line says when there are more. */
export const STAFF_PAGE_SIZE = 20;

/** How long typing has to pause before the server is asked. */
export const STAFF_SEARCH_DEBOUNCE_MS = 300;

/** `ListStaffRequest` answers a longer `search` with a 422. */
export const STAFF_SEARCH_MAX_LENGTH = 100;

/**
 * The `search` to send for what was typed: trimmed, inner whitespace collapsed
 * and cut to the server's limit. Collapsing matters because the server matches
 * "first last" against `CONCAT(first_name, ' ', last_name)`, so a double space
 * would match nobody.
 */
export function normaliseStaffQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, STAFF_SEARCH_MAX_LENGTH).trimEnd();
}

/** A 403: the caller holds none of `loans:create`, `loans:update` or `loans:restructure`. */
export function isStaffListForbidden(err: unknown): boolean {
  return (err as { response?: { status?: number } } | null)?.response?.status === 403;
}

/** One answered search. */
export interface StaffPage {
  query: string;
  rows: StaffMember[];
  total: number;
}

/** Everything `useStaffSearch` holds. */
export interface StaffSearchState {
  /** The search box, as typed. */
  query: string;
  /** The normalised query last sent. Null after a failure, until the next keystroke. */
  asked: string | null;
  /** The query whose request failed, if the latest one did. */
  failedQuery: string | null;
  /** The latest answer, whichever query it was for. */
  page: StaffPage | null;
  /** The answer to the empty query, kept so reopening the popup needs no request. */
  firstPage: StaffPage | null;
  forbidden: boolean;
}

/** What the picker knows about the search on screen. */
export interface StaffSearchView {
  /** The normalised query. */
  query: string;
  /** Rows in the list. */
  shown: number;
  /** `meta.total` for the query. */
  total: number;
  /** Typing has not settled yet, or the request for it is still out. */
  pending: boolean;
  /** The request for this query failed, with anything but a 403. */
  failed: boolean;
}

// One instance, so an empty list keeps its identity across renders.
const NO_ROWS: StaffMember[] = [];

/**
 * The rows to list and how to describe them. Until the answer for the typed
 * query arrives, the previous rows stay up and the search reads as pending, so
 * nothing is presented as matching a query it was not fetched for.
 */
export function viewStaffSearch(state: StaffSearchState): {
  rows: StaffMember[];
  view: StaffSearchView;
} {
  const { asked, failedQuery, page, firstPage, forbidden } = state;
  const query = normaliseStaffQuery(state.query);
  const answered = asked === "" && firstPage ? firstPage : page;
  const failed = asked === null && query === failedQuery;
  const pending = !forbidden && !failed && (query !== asked || answered?.query !== asked);
  const rows = failed || !answered ? NO_ROWS : answered.rows;
  return {
    rows,
    view: { query, shown: rows.length, total: answered?.total ?? 0, pending, failed },
  };
}

/**
 * The line under the list. Empty when there is nothing to add: it renders into
 * a live region that has to stay mounted either way.
 */
export function staffSearchStatus(view: StaffSearchView): string {
  if (view.pending) return view.shown === 0 ? "Loading staff…" : "Searching…";
  if (view.failed) return "Couldn't load staff. Keep typing to try again.";
  if (view.total > view.shown) {
    const narrow = view.query === "" ? "type a name" : "keep typing";
    return `Showing ${view.shown} of ${view.total} — ${narrow} to narrow.`;
  }
  return "";
}

/** What the list says when a settled search found nobody. Null otherwise. */
export function staffEmptyMessage(view: StaffSearchView): string | null {
  if (view.pending || view.failed || view.shown > 0) return null;
  return view.query === "" ? "No active staff found." : `No active staff match “${view.query}”.`;
}
