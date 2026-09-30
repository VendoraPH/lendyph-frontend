import { useCallback, useEffect, useRef, useState } from "react";
import { staffService } from "@/services/staff.service";
import {
  STAFF_PAGE_SIZE,
  STAFF_SEARCH_DEBOUNCE_MS,
  isStaffListForbidden,
  normaliseStaffQuery,
  staffEmptyMessage,
  staffSearchStatus,
  viewStaffSearch,
  type StaffPage,
} from "@/lib/staff-search";
import type { StaffMember } from "@/types";

export interface StaffSearch {
  /** The search box, as typed. */
  query: string;
  /** Debounced: the server is asked once typing pauses. */
  setQuery: (query: string) => void;
  /** Straight back to the first page, for when the popup closes. */
  reset: () => void;
  rows: StaffMember[];
  /** Typing has not settled, or its request is still out. */
  pending: boolean;
  /** A 403: this user may not list staff. Nothing more is requested. */
  forbidden: boolean;
  /** The line under the list; see `staffSearchStatus`. */
  status: string;
  emptyMessage: string | null;
}

/**
 * Search-as-you-type over `GET /staff` for the Account Officer pickers: the
 * first page on mount, then one page per settled query.
 *
 * - A response to a query the user has typed past is dropped (the effect's
 *   `cancelled` flag), so a slow answer never replaces a newer one.
 * - The first page is kept, so closing the popup, which clears the box, does
 *   not ask for it again.
 * - A failure waits for the next keystroke instead of retrying on its own, and
 *   a 403 stops the search for good.
 */
export function useStaffSearch(): StaffSearch {
  const [query, setQueryState] = useState("");
  const [asked, setAsked] = useState<string | null>("");
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [page, setPage] = useState<StaffPage | null>(null);
  const [firstPage, setFirstPage] = useState<StaffPage | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const timer = debounce;
    return () => clearTimeout(timer.current);
  }, []);

  // Debounced here rather than in an effect on `query`, so only a keystroke
  // starts the timer. An effect would also fire once on mount, and re-ask a
  // first page that had just failed.
  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => setAsked(normaliseStaffQuery(next)),
      STAFF_SEARCH_DEBOUNCE_MS,
    );
  }, []);

  const reset = useCallback(() => {
    clearTimeout(debounce.current);
    setQueryState("");
    setAsked("");
  }, []);

  useEffect(() => {
    if (asked === null || forbidden) return;
    if (asked === "" && firstPage) return;
    let cancelled = false;
    staffService
      .list({ search: asked || undefined, per_page: STAFF_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        const rows = res.data ?? [];
        const answered = { query: asked, rows, total: res.meta?.total ?? rows.length };
        setPage(answered);
        if (asked === "") setFirstPage(answered);
        setFailedQuery(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isStaffListForbidden(err)) {
          setForbidden(true);
          return;
        }
        setFailedQuery(asked);
        setAsked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [asked, firstPage, forbidden]);

  const { rows, view } = viewStaffSearch({ query, asked, failedQuery, page, firstPage, forbidden });

  return {
    query,
    setQuery,
    reset,
    rows,
    pending: view.pending,
    forbidden,
    status: staffSearchStatus(view),
    emptyMessage: staffEmptyMessage(view),
  };
}
