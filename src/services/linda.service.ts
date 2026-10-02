/**
 * Linda API client. `POST /linda/chat` is not built on the backend yet; see
 * the note on `API_ENDPOINTS.LINDA`.
 *
 * The request carries only the question and this session's earlier turns. The
 * tenant, branch, role and permissions are the token's, decided by the server;
 * nothing here lets the browser widen what Linda may read.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { normalizeLindaReply } from "@/lib/linda";
import type { LindaChatRequest, LindaReply } from "@/types/linda";

export const lindaService = {
  /**
   * Throws when the body is not a Linda reply, so an unparseable answer shows
   * the "unable to process" state instead of an empty bubble.
   */
  chat: async (request: LindaChatRequest, signal?: AbortSignal): Promise<LindaReply> => {
    const raw = await api.post<unknown>(API_ENDPOINTS.LINDA.CHAT, request, { signal });
    const reply = normalizeLindaReply(raw);
    if (!reply) throw new Error("Unexpected response shape from the Linda API.");
    return reply;
  },
};
