import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { FormPreview, FormPreviewRequest } from "./loan-preview";

/**
 * `POST /loans/preview` for the loan form and the restructure page: the
 * collateral total, security status, "Short by", deductions, schedule and, for
 * a restructure, the shortfall, all worked out by the server. Writes nothing.
 * Needs `loans:create` or `loans:update` (403 otherwise); malformed input, or
 * a share capital collateral the role may not value, is a 422. `signal` lets a
 * superseded preview be cancelled.
 *
 * Posted here rather than through `loanService.preview`, whose shared request
 * type still requires a `snapshot_value` per collateral.
 */
export function postLoanFormPreview(body: FormPreviewRequest, signal?: AbortSignal): Promise<FormPreview> {
  return api.post<FormPreview>(API_ENDPOINTS.LOANS.PREVIEW, body, { signal });
}
