// src/hooks/use-registrations.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  registrationService,
  Registration,
  RegistrationStatus,
} from "@/services/registration.service";

interface Options {
  status?: RegistrationStatus;
  /** 1-based. Omitted means "let the server decide", i.e. page 1. */
  page?: number;
  /**
   * Required, with no default on purpose.
   *
   * This used to default to 100 — the server's clamp ceiling
   * (`min((int) per_page, 100)` in BorrowerController@index) — so that the
   * un-paginated registrations table could show "as many as possible". That is
   * not the same as "all": a co-op with 137 pending applicants got 100 rows
   * under a badge reading 137, and no way to reach the other 37. Now that the
   * table paginates, a silent 100 is a trap for the next caller rather than a
   * convenience, so every caller states its page size.
   *
   * The server clamps anything above 100 without saying so; to read every row,
   * drain it with fetchAllPages() from @/lib/paginate instead.
   */
  per_page: number;
  /**
   * Skip the request entirely. For a tab that has not been opened yet: a
   * disabled hook reports `loading: false` with no rows rather than an eternal
   * spinner, and fires nothing until the tab becomes visible.
   */
  enabled?: boolean;
}

export function useRegistrations(options: Options) {
  const { status, page, per_page, enabled = true } = options;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  /** `meta.last_page`, so a caller can snap an out-of-range cursor back. */
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Everything the request depends on, as one comparable value.
  const argsKey = enabled ? `${status ?? ""}|${page ?? ""}|${per_page}` : null;

  // Adjust state during render when the args change, rather than waiting for
  // the effect below (React's "adjusting state when a prop changes"; the same
  // pattern borrower-table.tsx uses to drop a stale row selection).
  //
  // Without this, `loading` is still false for the render that FOLLOWS a change
  // and precedes the effect — so opening the Rejected tab for the first time
  // painted a full "No rejected applications" empty state, asserting there are
  // none before the request for them existed. Same flash on every page change,
  // and a stale `error` from a previous visit flashed the same way.
  const [prevArgsKey, setPrevArgsKey] = useState(argsKey);
  if (argsKey !== prevArgsKey) {
    setPrevArgsKey(argsKey);
    setLoading(argsKey !== null);
    setError(null);
  }

  // Guards against out-of-order responses. `page` and `per_page` are driven by
  // clicks now, so two requests really can be in flight: click Next twice
  // quickly and, if page 2 lands after page 3, the table would paint page 2's
  // rows under a paginator reading "Showing 21 to 30" and stay that way until
  // the next interaction. Mirrors fetchBorrowers on the members page.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    // Bumped before the early return as well: leaving a tab mid-flight must
    // invalidate the response still coming, or it lands and clears `loading`
    // on a hook nobody is rendering.
    const requestId = ++requestIdRef.current;
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await registrationService.list({ status, page, per_page });
      if (requestId !== requestIdRef.current) return;
      const list = res.data ?? [];
      // Belt-and-braces only: the backend does honour the `status` query param
      // (BorrowerController@index filters on it). This just guarantees a
      // mislabelled row can never surface on the "Pending Registrations" tab.
      // The cost, now that this is one page of many, is that a mislabelled row
      // shortens the page rather than replacing it — a visibly short page is a
      // far better failure than a rejected applicant listed as pending.
      const filtered = status ? list.filter((r) => r.status === status) : list;
      // `meta.total` counts every row matching the filter, not just this page —
      // that is what makes the sidebar badge and the tab count truthful.
      setRegistrations(filtered);
      setTotal(res.meta?.total ?? filtered.length);
      setLastPage(Math.max(1, res.meta?.last_page ?? 1));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError("We couldn't load the registrations. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [status, page, per_page, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { registrations, total, lastPage, loading, error, refresh };
}
