/**
 * Savings auto-credit (gap round S3): members' standing instructions (the
 * 15th, the 30th, or both) and the run that credits them. `savings:view`
 * reads instructions; `savings:post` writes them and previews and processes a
 * run. The server plans every run and works out every figure; the preview
 * writes nothing, and a re-run of a cycle posts nothing. Past runs read with
 * `savings:view`.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type {
  SavingsAutoCreditInstruction,
  SavingsAutoCreditInstructionInput,
  SavingsAutoCreditInstructionUpdate,
  SavingsAutoCreditInstructionsResponse,
  SavingsAutoCreditRunDetail,
  SavingsAutoCreditRunInput,
  SavingsAutoCreditRunResult,
  SavingsAutoCreditRunsResponse,
} from "@/types/savings-servicing";

const E = API_ENDPOINTS.SAVINGS;

export const savingsAutoCreditService = {
  /**
   * One page, newest first, `getRaw` so `meta` survives. Params: `page`,
   * `per_page` (≤ 100), `account_id`, `borrower_id`, `schedule`, `active`.
   */
  instructions: (params?: Record<string, unknown>) =>
    api.getRaw<SavingsAutoCreditInstructionsResponse>(E.AUTO_CREDIT_INSTRUCTIONS, { params }),
  instruction: (id: number) => api.get<SavingsAutoCreditInstruction>(E.AUTO_CREDIT_INSTRUCTION(id)),
  /** One active instruction per account per slot (422 in words otherwise). */
  create: (data: SavingsAutoCreditInstructionInput) =>
    api.post<SavingsAutoCreditInstruction>(E.AUTO_CREDIT_INSTRUCTIONS, data),
  /** Any field but the account; `active: false` deactivates it. */
  update: (id: number, data: SavingsAutoCreditInstructionUpdate) =>
    api.put<SavingsAutoCreditInstruction>(E.AUTO_CREDIT_INSTRUCTION(id), data),
  /** Only before it has credited (422 after: deactivate it instead). */
  remove: (id: number) => api.delete<void>(E.AUTO_CREDIT_INSTRUCTION(id)),
  /** The plan a run would post now, written nowhere. */
  preview: (params: SavingsAutoCreditRunInput) =>
    api.get<SavingsAutoCreditRunResult>(E.AUTO_CREDIT_PREVIEW, { params }),
  /** Posts the plan. Needs the form's Idempotency-Key; 409 in words when another run got there first. */
  process: (data: SavingsAutoCreditRunInput, key: string | null) =>
    api.post<SavingsAutoCreditRunResult>(E.AUTO_CREDIT_PROCESS, data, idempotencyHeaders(key)),
  /** Past runs, newest first, one page (`getRaw` so `meta` survives); `savings:view` (gap round B7). */
  runs: (params?: { page?: number; per_page?: number }) =>
    api.getRaw<SavingsAutoCreditRunsResponse>(E.AUTO_CREDIT_RUNS, { params }),
  /** One past run with what it posted and skipped; 404 outside the caller's branches. */
  run: (id: number) => api.get<SavingsAutoCreditRunDetail>(E.AUTO_CREDIT_RUN(id)),
};
