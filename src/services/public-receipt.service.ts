import axios from "axios";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { env } from "@/config/env";
import { API_BASE_URL } from "@/lib/axios-client";
import type { Repayment } from "@/types";

/**
 * Its own axios instance, not the staff client: whoever opens a shared receipt
 * has no Lendy account, and a staff member opening one in the same browser
 * must not send their bearer token, nor have a 401 here end their session.
 */
const publicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: env.api.timeout,
  headers: { Accept: "application/json" },
});

export const publicReceiptService = {
  /**
   * The shared receipt: the same field names as a repayment, without the
   * staff-only ones (collector, voider, remarks) and with the loan account
   * and reference numbers masked by the server.
   */
  detail: async (token: string): Promise<Repayment> =>
    (await publicClient.get<{ data: Repayment }>(API_ENDPOINTS.PUBLIC_RECEIPTS.DETAIL(token))).data.data,
};

/** What the public page says when the receipt cannot be shown. */
export function publicReceiptErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404 || status === 410) {
    return "This receipt link is invalid or no longer available. Please ask the cooperative for a new link.";
  }
  if (status === 501) return "Shared receipts are not available yet. Please contact the cooperative.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  return "We couldn't load this receipt. Please check your connection and try again.";
}
