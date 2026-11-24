import axios from "axios";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { env } from "@/config/env";
import type { PublicReceipt } from "@/types/receipt-share";

/** The same-origin proxy in the browser; the API itself anywhere else. */
function apiBase(): string {
  if (typeof window !== "undefined") return "/api/proxy";
  return process.env.NEXT_PUBLIC_API_URL || env.api.baseUrl;
}

/**
 * Its own axios instance, never the staff client: a member opening a shared
 * receipt has no Lendy account, and a staff member opening one in the same
 * browser must not send their bearer token, nor have a refusal here end their
 * staff session.
 */
const publicReceiptClient = axios.create({
  baseURL: apiBase(),
  timeout: env.api.timeout,
  headers: { Accept: "application/json" },
});

export const publicReceiptService = {
  /** The masked receipt a working link opens. Any refusal is the same 404. */
  show: async (token: string): Promise<PublicReceipt> =>
    (await publicReceiptClient.get<{ data: PublicReceipt }>(API_ENDPOINTS.PUBLIC_RECEIPTS.SHOW(token))).data.data,
};

/**
 * The cooperative's logo, from the receipt's `logo_url` API path, as a plain
 * same-origin image request through the proxy (so "Download image" can draw
 * it). Anything that isn't a plain path is refused.
 */
export function publicReceiptLogoUrl(path: string | null): string | null {
  if (path === null || !/^\/[A-Za-z0-9/_.-]*$/.test(path) || path.startsWith("//") || path.includes("..")) return null;
  return `${apiBase().replace(/\/$/, "")}${path}`;
}
