import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { PaginatedResponse } from "@/types";
import type {
  InterestBatch,
  InterestBatchDetail,
  InterestPreview,
  InterestPreviewRequest,
} from "@/types/savings";

/**
 * Interest computation and posting. The server computes every figure; the
 * screens only show them. A batch is unique per product and period, so a
 * second batch for the same period is refused (422). Not built on the
 * backend yet — docs/SAVINGS_BACKEND_HANDOFF.md.
 */
export const savingsInterestService = {
  /** Compute without saving anything. */
  preview: (data: InterestPreviewRequest) =>
    api.post<InterestPreview>(API_ENDPOINTS.SAVINGS.INTEREST_PREVIEW, data),

  /** Save the preview as a draft batch (the server recomputes, never trusts ours). */
  createBatch: (data: InterestPreviewRequest) =>
    api.post<InterestBatch>(API_ENDPOINTS.SAVINGS.INTEREST_BATCHES, data),

  /** Params: `page`, `per_page`, `status`, `savings_product_id`. */
  listBatches: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<InterestBatch>>(API_ENDPOINTS.SAVINGS.INTEREST_BATCHES, { params }),

  getBatch: (id: number) =>
    api.get<InterestBatchDetail>(API_ENDPOINTS.SAVINGS.INTEREST_BATCH(id)),

  /** The server refuses (403) an approver who created the batch. */
  approve: (id: number) =>
    api.post<InterestBatch>(API_ENDPOINTS.SAVINGS.INTEREST_BATCH_APPROVE(id)),

  reject: (id: number, reason: string) =>
    api.post<InterestBatch>(API_ENDPOINTS.SAVINGS.INTEREST_BATCH_REJECT(id), { reason }),

  /** Posts every row; a posted batch cannot be posted again (409). */
  post: (id: number) => api.post<InterestBatch>(API_ENDPOINTS.SAVINGS.INTEREST_BATCH_POST(id)),

  reverse: (id: number, reason: string) =>
    api.post<InterestBatch>(API_ENDPOINTS.SAVINGS.INTEREST_BATCH_REVERSE(id), { reason }),
};
