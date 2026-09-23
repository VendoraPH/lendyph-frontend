import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { CoMaker } from "@/types";

export interface CreateCoMakerData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  address?: string;
  contact_number?: string;
  occupation?: string;
  employer?: string;
  monthly_income?: number;
  relationship_to_borrower?: string;
}

/**
 * `PUT /co-makers/{id}`, rule for rule with `UpdateCoMakerRequest`. Every key
 * is optional — one left out keeps its column as it is — and the columns the
 * request marks `nullable` also take an explicit `null`, which is the only way
 * to clear one. `first_name` / `last_name` are `sometimes|string`: they can be
 * left out but never nulled.
 */
export interface UpdateCoMakerData {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  suffix?: string | null;
  address?: string | null;
  contact_number?: string | null;
  occupation?: string | null;
  employer?: string | null;
  monthly_income?: number | null;
  relationship_to_borrower?: string | null;
  status?: "active" | "inactive";
}

export const coMakerService = {
  list: (borrowerId: number) =>
    api.get<CoMaker[]>(API_ENDPOINTS.CO_MAKERS.LIST(borrowerId)),

  create: (borrowerId: number, data: CreateCoMakerData) =>
    api.post<CoMaker>(API_ENDPOINTS.CO_MAKERS.CREATE(borrowerId), data),

  detail: (id: number) =>
    api.get<CoMaker>(API_ENDPOINTS.CO_MAKERS.DETAIL(id)),

  update: (id: number, data: UpdateCoMakerData) =>
    api.put<CoMaker>(API_ENDPOINTS.CO_MAKERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.CO_MAKERS.DELETE(id)),
};
