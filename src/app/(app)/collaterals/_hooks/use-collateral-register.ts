import { useCallback, useEffect, useState } from "react";
import { useApiResource } from "@/hooks";
import { collateralService, collateralTypeService } from "@/services";
import { completeRows } from "@/lib/paginate";
import type { CollateralRegisterSort } from "@/types";
import {
  ALL_TYPES,
  DEFAULT_REGISTER_SORT,
  nextRegisterSort,
  pageAfterEmptyResult,
  registerQuery,
  type RegisterSortState,
} from "../_lib/register";

const SEARCH_DEBOUNCE_MS = 300;

export const REGISTER_PER_PAGE_OPTIONS = [10, 20, 50] as const;

// Module-level so it is stable: `useApiResource` refetches whenever its
// fetcher changes identity.
const fetchCollateralTypes = () => collateralTypeService.listAll().then(completeRows);

/**
 * One page of the collateral register, and the view state that selects it.
 *
 * Exactly one request per settled view. `useApiResource` makes the call from an
 * effect, drops a response that lands after the view has moved on, and derives
 * `loading` from whether the answer in hand belongs to the current view — so
 * there is no request id to keep and no `try/finally` to hide this component
 * from the React Compiler.
 */
export function useCollateralRegister() {
  // `searchDraft` is what the box shows; `search` is what has been sent.
  // Keeping them apart is what makes the debounce one request per settled
  // query instead of one per keystroke.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [sort, setSort] = useState<RegisterSortState>(DEFAULT_REGISTER_SORT);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(REGISTER_PER_PAGE_OPTIONS[0]);

  // Every change to what is being asked resets to page 1: page 4 of the whole
  // register is rarely page 4 of one collateral type.
  useEffect(() => {
    const settled = searchDraft.trim();
    if (settled === search) return;
    const t = setTimeout(() => {
      setSearch(settled);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchDraft, search]);

  const changeTypeFilter = (value: string | null) => {
    setTypeFilter(value ?? ALL_TYPES);
    setPage(1);
  };
  const changeSort = (key: CollateralRegisterSort) => {
    setSort((current) => nextRegisterSort(current, key));
    setPage(1);
  };
  const changePerPage = (next: number) => {
    setPerPage(next);
    setPage(1);
  };

  const fetchPage = useCallback(
    () =>
      collateralService.registerPage(
        registerQuery({ search, typeFilter, sort, page, perPage }),
      ),
    [search, typeFilter, sort, page, perPage],
  );
  const register = useApiResource(fetchPage);
  const types = useApiResource(fetchCollateralTypes);

  // `data` outlives a failed request, so it describes the current view only
  // once that view's request has settled without an error.
  const current =
    !register.loading && !register.error && !register.unavailable
      ? register.data
      : null;

  // Adjusted during render rather than in an effect (React's "adjusting state
  // when a prop changes"): the step back is itself a view change, so the
  // render it triggers is already loading the page it steps back to.
  if (current) {
    const back = pageAfterEmptyResult(page, current.data.length, current.meta.last_page);
    if (back !== null) setPage(back);
  }

  return {
    searchDraft,
    setSearchDraft,
    typeFilter,
    changeTypeFilter,
    sort,
    changeSort,
    page,
    setPage,
    perPage,
    changePerPage,
    /** Whether the view being shown is narrowed by a search or a type. */
    filtered: search !== "" || typeFilter !== ALL_TYPES,
    /**
     * The last page that loaded — kept through a reload so the cards do not
     * blank, and dropped on a failure so they do not outlive it either.
     */
    data: register.error || register.unavailable ? null : register.data,
    loading: register.loading,
    error: register.error,
    unavailable: register.unavailable,
    reload: register.refetch,
    types: types.data ?? [],
  };
}
