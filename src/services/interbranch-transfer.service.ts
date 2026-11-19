import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type {
  BranchCounts,
  InterbranchInTransitReport,
  InterbranchTransfer,
  InterbranchTransferInput,
  InterbranchTransferPage,
  InterbranchTransferResult,
  InterbranchTransferStatus,
} from "@/types/interbranch-transfer";

const E = API_ENDPOINTS.INTERBRANCH_TRANSFERS;

export interface InterbranchTransferQuery {
  status?: InterbranchTransferStatus;
  /** Source or destination; another branch answers 403. */
  branch_id?: number;
  page?: number;
  per_page?: number;
}

type WriteBody = { data: InterbranchTransfer; warnings?: string[] };

const result = (body: WriteBody): InterbranchTransferResult => ({
  transfer: body.data,
  warnings: Array.isArray(body.warnings) ? body.warnings.filter((w) => typeof w === "string" && w) : [],
});

/**
 * Interbranch transfers (Phase 6 MB-BE5). Every amount is centavos. Approve,
 * receive and reverse post journals, so they carry the dialog's
 * Idempotency-Key: a retry after a lost answer gets the first answer back.
 */
export const interbranchTransferService = {
  list: (query: InterbranchTransferQuery = {}) =>
    api.getRaw<InterbranchTransferPage>(E.LIST, { params: query }),

  show: (id: number) => api.get<InterbranchTransfer>(E.DETAIL(id)),

  /** Nothing posts until someone other than the maker approves it. */
  create: async (input: InterbranchTransferInput) => result(await api.rawPost<WriteBody>(E.CREATE, input)),

  approve: async (id: number, key: string | null) =>
    result(await api.rawPost<WriteBody>(E.ACTION(id, "approve"), {}, idempotencyHeaders(key))),

  receive: async (id: number, key: string | null) =>
    result(await api.rawPost<WriteBody>(E.ACTION(id, "receive"), {}, idempotencyHeaders(key))),

  reverse: async (id: number, reason: string, key: string | null) =>
    result(await api.rawPost<WriteBody>(E.ACTION(id, "reverse"), { reason }, idempotencyHeaders(key))),

  reject: async (id: number, note: string) => result(await api.rawPost<WriteBody>(E.ACTION(id, "reject"), { note })),

  cancel: async (id: number) => result(await api.rawPost<WriteBody>(E.ACTION(id, "cancel"), {})),

  inTransit: () => api.get<InterbranchInTransitReport>(E.IN_TRANSIT),

  counts: () => api.get<BranchCounts>(E.BRANCH_COUNTS),
};
