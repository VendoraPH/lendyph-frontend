/**
 * The AMLA screening and orders API client (Phase 6, AMLA-B5). The server logs
 * every read, so screens call the reads through `once`. Nothing here feeds
 * Linda, notifications or the command palette.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { only, paged } from "@/lib/amla/api";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type { AmlaPage } from "@/types/amla";
import type {
  AmlaOrder,
  AmlaOrderBody,
  AmlaOrderDetail,
  AmlaScreeningMatch,
  AmlaScreeningMatchDetail,
  AmlaWatchlist,
  AmlaWatchlistSource,
  AmlaWatchlistVersion,
} from "@/types/amla-screening";

const A = API_ENDPOINTS.AMLA;

/** A note is sent only when there is one: approve and withdraw take it as optional. */
function note(text: string): { note?: string } {
  const trimmed = text.trim();
  return trimmed === "" ? {} : { note: trimmed };
}

export const amlaScreeningApi = {
  lists: () => api.get<AmlaWatchlist[]>(A.SCREENING_LISTS),
  /** Multipart `file` (the UN list's XML, or a CSV from the template) and an optional label. */
  upload: (source: AmlaWatchlistSource, file: Blob, fileName: string, label: string) => {
    const form = new FormData();
    form.append("file", file, fileName);
    if (label.trim() !== "") form.append("version_label", label.trim());
    return api.upload<AmlaWatchlistVersion>(A.SCREENING_LIST_UPLOAD(source), form);
  },
  rescreen: () => api.post<{ queued_versions: number }>(A.SCREENING_RESCREEN),

  matches: (filters: { status: string; subject_type: string; page: number }) =>
    paged(api.getRaw<AmlaPage<AmlaScreeningMatch>>(A.SCREENING_MATCHES, { params: only(filters) })),
  match: (id: number) => api.get<AmlaScreeningMatchDetail>(A.SCREENING_MATCH(id)),
  confirm: (id: number, reason: string) => api.post<AmlaScreeningMatchDetail>(A.SCREENING_MATCH_CONFIRM(id), { reason: reason.trim() }),
  clear: (id: number, reason: string) => api.post<AmlaScreeningMatchDetail>(A.SCREENING_MATCH_CLEAR(id), { reason: reason.trim() }),

  orders: (filters: { status: string; page: number }) =>
    paged(api.getRaw<AmlaPage<AmlaOrder>>(A.ORDERS, { params: only(filters) })),
  order: (id: number) => api.get<AmlaOrderDetail>(A.ORDER(id)),
  /** Needs the form's `Idempotency-Key`: a retry answers the first reply, so an order is never recorded twice. */
  placeOrder: (body: AmlaOrderBody, key: string | null) =>
    api.post<{ id: number; status: string }>(A.ORDERS, body, idempotencyHeaders(key)),
  requestRelease: (id: number, body: { reason: string; release_reference: string }) => api.post<AmlaOrderDetail>(A.ORDER_RELEASE(id), body),
  approveRelease: (id: number, text: string) => api.post<AmlaOrderDetail>(A.ORDER_RELEASE_APPROVE(id), note(text)),
  rejectRelease: (id: number, text: string) => api.post<AmlaOrderDetail>(A.ORDER_RELEASE_REJECT(id), { note: text.trim() }),
  withdrawRelease: (id: number, text: string) => api.post<AmlaOrderDetail>(A.ORDER_RELEASE_WITHDRAW(id), note(text)),
};
