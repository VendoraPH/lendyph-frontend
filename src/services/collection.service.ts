import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Collection } from "@/types";

export const collectionService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Collection[]>(API_ENDPOINTS.COLLECTIONS.LIST, { params }),

  overdue: () =>
    api.get<Collection[]>(API_ENDPOINTS.COLLECTIONS.OVERDUE),

  dueToday: () =>
    api.get<Collection[]>(API_ENDPOINTS.COLLECTIONS.DUE_TODAY),

  upcoming: () =>
    api.get<Collection[]>(API_ENDPOINTS.COLLECTIONS.UPCOMING),

  markCollected: (id: number, data?: Partial<{ amount: number; method: string; reference_number: string }>) =>
    api.post(API_ENDPOINTS.COLLECTIONS.MARK_COLLECTED(id), data),
};
