import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";

export interface ApiBranch {
  id: number;
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  is_active: boolean;
}

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
}

export interface UpdateBranchData {
  name?: string;
  code?: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export interface PublicBranch {
  id: number;
  name: string;
  city?: string;
}

export const branchService = {
  /**
   * Every branch matching `params` (`active_only`), inactive ones included
   * unless asked otherwise.
   *
   * `BranchController::index()` answers the whole set with `->get()`, not a
   * paginator — one request today. Drained regardless, so a paginator added
   * later cannot silently shorten every branch picker and filter. `DrainResult`
   * for the reason on `borrowerService.listAll`; `page` and `per_page` are set
   * by the drain.
   */
  listAll: (
    params?: Record<string, unknown>,
  ): Promise<DrainResult<ApiBranch>> =>
    fetchAllPages<ApiBranch>(({ page, per_page }) =>
      api.getRaw<{ data: ApiBranch[] }>(API_ENDPOINTS.BRANCHES.LIST, {
        params: { ...params, page, per_page },
      }),
    ),

  // Unauthenticated read for the public registration branch picker.
  // Backend returns a slim shape — no internal fields — and, like `listAll`,
  // every active branch in one `->get()` today; drained for the same reason.
  publicListAll: (): Promise<DrainResult<PublicBranch>> =>
    fetchAllPages<PublicBranch>(({ page, per_page }) =>
      api.getRaw<{ data: PublicBranch[] }>(API_ENDPOINTS.BRANCHES.PUBLIC_LIST, {
        params: { page, per_page },
      }),
    ),

  detail: (id: number) =>
    api.get<ApiBranch>(API_ENDPOINTS.BRANCHES.DETAIL(id)),

  create: (data: CreateBranchData) =>
    api.post<ApiBranch>(API_ENDPOINTS.BRANCHES.CREATE, data),

  update: (id: number, data: UpdateBranchData) =>
    api.put<ApiBranch>(API_ENDPOINTS.BRANCHES.UPDATE(id), data),
};
