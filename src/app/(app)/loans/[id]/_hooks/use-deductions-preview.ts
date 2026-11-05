import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import type { LoanDeductionsPreview, LoanStatus } from "@/types/loan";
import { usePreviewRead } from "./use-preview-read";

const readDeductionsPreview = (loanId: number) =>
  api.get<LoanDeductionsPreview>(API_ENDPOINTS.LOANS.DEDUCTIONS_PREVIEW(loanId));

/**
 * `GET /loans/{id}/deductions-preview` for the release details card. Read again
 * when the loan's status moves on, since `provisional` depends on it.
 */
export function useDeductionsPreview(loanId: number, status: LoanStatus | undefined, enabled: boolean) {
  return usePreviewRead({
    read: readDeductionsPreview,
    failureMessage: "We couldn't load the estimated deductions. Please try again.",
    loanId,
    enabled,
    source: `${loanId}:${status}`,
  });
}
