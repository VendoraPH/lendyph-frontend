"use client";

import { useCallback, useState } from "react";
import { useApiResource, type ApiResource } from "@/hooks";
import type { PaginatedResponse } from "@/types/api";

export const CIC_PER_PAGE_OPTIONS = [25, 50, 100] as const;

type Loader<T> = (page: number, perPage: number) => Promise<PaginatedResponse<T>>;

/**
 * One server page of a CIC list at a time. `load` must be stable
 * (`useCallback`); a new one (another filter or date) starts again at page 1.
 */
export function usePagedResource<T>(load: Loader<T>): {
  resource: ApiResource<PaginatedResponse<T>>;
  page: number;
  perPage: number;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
} {
  const [paging, setPaging] = useState<{ load: Loader<T>; page: number }>({ load, page: 1 });
  const [perPage, setPerPageState] = useState<number>(CIC_PER_PAGE_OPTIONS[1]);
  const page = paging.load === load ? paging.page : 1;
  const fetcher = useCallback(() => load(page, perPage), [load, page, perPage]);
  const resource = useApiResource(fetcher);
  const setPage = (next: number) => setPaging({ load, page: next });
  const setPerPage = (next: number) => {
    setPerPageState(next);
    setPaging({ load, page: 1 });
  };
  return { resource, page, perPage, setPage, setPerPage };
}
