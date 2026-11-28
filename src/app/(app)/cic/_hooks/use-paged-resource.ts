"use client";

import { useCallback, useState } from "react";
import { useApiResource, type ApiResource } from "@/hooks";

/** Records, issues and captures come 25 a page, fixed by the server. */
export const CIC_SERVER_PAGE = [25] as const;
/** Lists that take `per_page` (submissions). */
export const CIC_PER_PAGE_OPTIONS = [25, 50, 100] as const;

interface Paged {
  meta: { total: number };
}

type Loader<T> = (page: number, perPage: number) => Promise<T>;

/**
 * One server page of a CIC list at a time. `load` must be stable
 * (`useCallback`); a new one (another filter or source) starts again at page 1.
 */
export function usePagedResource<T extends Paged>(
  load: Loader<T>,
  perPageOptions: readonly number[] = CIC_SERVER_PAGE,
): {
  resource: ApiResource<T>;
  pager: {
    page: number;
    perPage: number;
    perPageOptions: readonly number[];
    setPage: (page: number) => void;
    setPerPage: (perPage: number) => void;
  };
} {
  const [paging, setPaging] = useState<{ load: Loader<T>; page: number }>({ load, page: 1 });
  const [perPage, setPerPageState] = useState<number>(perPageOptions[0]);
  const page = paging.load === load ? paging.page : 1;
  const fetcher = useCallback(() => load(page, perPage), [load, page, perPage]);
  const resource = useApiResource(fetcher);
  const setPage = (next: number) => setPaging({ load, page: next });
  const setPerPage = (next: number) => {
    setPerPageState(next);
    setPaging({ load, page: 1 });
  };
  return { resource, pager: { page, perPage, perPageOptions, setPage, setPerPage } };
}
