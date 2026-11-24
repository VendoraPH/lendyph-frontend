import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { ReceiptShareLinkCreated, ReceiptShareLinkState } from "@/types/receipt-share";

/**
 * A receipt's share link, staff side (`payments:view` and the payment's
 * branch). Every call answers 404 while the server switch is off.
 */
export const receiptShareLinkService = {
  /** The receipt's newest link, never its token. */
  status: (repaymentId: number) => api.get<ReceiptShareLinkState>(API_ENDPOINTS.REPAYMENTS.SHARE_LINK(repaymentId)),

  /** A new link and its token, answered once. 409 while one is still working. */
  create: (repaymentId: number) => api.post<ReceiptShareLinkCreated>(API_ENDPOINTS.REPAYMENTS.SHARE_LINK(repaymentId)),

  /** Stops the working link at once. */
  revoke: (repaymentId: number) => api.patch<ReceiptShareLinkState>(API_ENDPOINTS.REPAYMENTS.SHARE_LINK_REVOKE(repaymentId)),
};
