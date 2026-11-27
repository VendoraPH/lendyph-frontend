import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError } from "@/lib/notify";
import { loanService } from "@/services";
import {
  ACTIVE_LOANS_PER_PAGE,
  ACTIVE_LOAN_SEARCH_DEBOUNCE_MS,
  activeLoanCardParams,
  activeLoanListParams,
  mapLoanToActiveLoan,
  withSummaryPenaltyNote,
  normaliseLoanSearch,
  pageAfterEmptyAnswer,
  readActiveLoanPage,
  type ActiveLoan,
  type ActiveLoanPage,
  type ActiveLoanTotals,
} from "./active-loans";

/** What the cards state, and the reload it was read for. Figures null when unknown. */
interface LoanCards {
  reload: number;
  total: number | null;
  totals: ActiveLoanTotals | null;
}

function requestKey(request: { query: string; page: number; perPage: number; reload: number }) {
  return `${request.reload}|${request.perPage}|${request.page}|${request.query}`;
}

/**
 * Payment Entry's table: one summary page of active loans at a time, searched
 * on the server, and the cards above it.
 *
 * - A response to a search or page the cashier has moved past is dropped, so a
 *   slow answer never replaces a newer one.
 * - The last rows stay up while the next page is on its way.
 * - The cards describe every active loan, so a search doesn't move them. They
 *   read an unsearched answer: the table's own when there is no search, and a
 *   one-row read of their own when a reload happens during one.
 */
export function useActiveLoanPage() {
  const [search, setSearchState] = useState("");
  const [request, setRequest] = useState({
    query: "",
    page: 1,
    perPage: ACTIVE_LOANS_PER_PAGE,
    reload: 0,
  });
  const [shown, setShown] = useState<{ page: ActiveLoanPage; rows: ActiveLoan[] } | null>(null);
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [cards, setCards] = useState<LoanCards | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const timer = debounce;
    return () => clearTimeout(timer.current);
  }, []);

  const key = requestKey(request);

  useEffect(() => {
    let cancelled = false;
    loanService
      .list(activeLoanListParams(request))
      .then((response) => {
        if (cancelled) return;
        const page = readActiveLoanPage(response);
        const back = pageAfterEmptyAnswer({
          requested: request.page,
          lastPage: page.lastPage,
          rowCount: page.rows.length,
        });
        if (back !== null) {
          setRequest((current) => ({ ...current, page: back }));
          return;
        }
        setShown({ page, rows: page.rows.map(mapLoanToActiveLoan) });
        setAnsweredKey(requestKey(request));
        setFailure(null);
        if (request.query === "") {
          setCards({ reload: request.reload, total: page.total, totals: page.totals });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A failed load must not look like an empty one, and the cards can't
        // state a figure the server didn't just confirm.
        console.error("Failed to load active loans", err);
        notifyError(err, "We couldn't load the active loans. Please try again.");
        setFailure({ key: requestKey(request), message: "We couldn't load the active loans." });
        setAnsweredKey(requestKey(request));
        if (request.query === "") setCards({ reload: request.reload, total: null, totals: null });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const cardsReload = cards?.reload ?? null;
  useEffect(() => {
    if (request.query === "" || cardsReload === request.reload) return;
    const reload = request.reload;
    let cancelled = false;
    loanService
      .list(activeLoanCardParams())
      .then((response) => {
        if (cancelled) return;
        const page = readActiveLoanPage(response);
        setCards({ reload, total: page.total, totals: page.totals });
      })
      .catch(() => {
        if (!cancelled) setCards({ reload, total: null, totals: null });
      });
    return () => {
      cancelled = true;
    };
  }, [request.query, request.reload, cardsReload]);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const query = normaliseLoanSearch(next);
      setRequest((current) =>
        current.query === query ? current : { ...current, query, page: 1 },
      );
    }, ACTIVE_LOAN_SEARCH_DEBOUNCE_MS);
  }, []);

  const setPage = useCallback((page: number) => {
    setRequest((current) => ({ ...current, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setRequest((current) => ({ ...current, perPage, page: 1 }));
  }, []);

  /** Read the page and the cards again: after a payment, or from Retry. */
  const reload = useCallback(() => {
    setRequest((current) => ({ ...current, reload: current.reload + 1 }));
  }, []);

  return {
    search,
    setSearch,
    query: request.query,
    page: request.page,
    perPage: request.perPage,
    setPage,
    setPerPage,
    reload,
    rows: shown?.rows ?? [],
    /** Rows matching the search, for the pagination. */
    total: shown?.page.total ?? shown?.rows.length ?? 0,
    /** The answer for what is on screen hasn't arrived. */
    pending: answeredKey !== key,
    error: failure?.key === key ? failure.message : null,
    cards,
  };
}

/**
 * The selected loan's full data and its summary's penalty note, read only
 * once it is selected. Until it
 * arrives, `loan` is the table's row. `attempt` makes every read its own, so a
 * loan reopened after a payment never shows the figures from before it.
 */
export function useSelectedLoan() {
  const [row, setRow] = useState<ActiveLoan | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<{ attempt: number; loan: ActiveLoan | null; error: string | null } | null>(null);
  const loanId = row?.id ?? null;

  useEffect(() => {
    if (loanId === null) return;
    let cancelled = false;
    // The summary only adds the penalty's "N month(s) late" note: when it
    // fails, the loan's figures still show, without the note.
    Promise.allSettled([loanService.detail(loanId), loanService.summary(loanId)]).then(([detail, summary]) => {
      if (cancelled) return;
      if (detail.status === "rejected") {
        setAnswer({ attempt, loan: null, error: getErrorMessage(detail.reason) });
        return;
      }
      const loan = withSummaryPenaltyNote(
        mapLoanToActiveLoan(detail.value),
        summary.status === "fulfilled" ? summary.value : null,
      );
      setAnswer({ attempt, loan, error: null });
    });
    return () => {
      cancelled = true;
    };
  }, [loanId, attempt]);

  const current = answer?.attempt === attempt ? answer : null;

  const select = useCallback((next: ActiveLoan) => {
    setRow(next);
    setAttempt((value) => value + 1);
  }, []);
  const clear = useCallback(() => setRow(null), []);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    loan: row === null ? null : (current?.loan ?? row),
    /** True once the full data is on screen. */
    loaded: row !== null && Boolean(current?.loan),
    detailError: row === null ? null : (current?.error ?? null),
    select,
    clear,
    retry,
  };
}
