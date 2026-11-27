import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { BinhsPrefill, BinhsRequest, BinhsResult } from "@/lib/binhs";

/**
 * `POST /loans/amortization-calculator/binhs` (`loans:view`): the Ideal, Worst
 * Case and Custom schedules for the inputs, worked out by the server. Writes
 * nothing; a bad input is a 422. `signal` lets a superseded request be
 * cancelled.
 */
export function calculateBinhs(body: BinhsRequest, signal?: AbortSignal): Promise<BinhsResult> {
  return api.post<BinhsResult>(API_ENDPOINTS.LOANS.AMORTIZATION_CALCULATOR_BINHS, body, { signal });
}

/**
 * The same endpoint with `loan_id` alone: that loan's starting inputs, its
 * rate converted to a rate a year by the server. Another branch's loan, or a
 * missing one, is a 404.
 */
export async function binhsPrefill(loanId: number): Promise<BinhsPrefill | null> {
  const result = await api.post<BinhsResult>(API_ENDPOINTS.LOANS.AMORTIZATION_CALCULATOR_BINHS, { loan_id: loanId });
  return result.prefill;
}
