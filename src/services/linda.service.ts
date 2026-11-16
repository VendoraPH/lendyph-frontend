/**
 * Linda API client: the chat (`POST /linda/chat`) and Settings → Linda
 * (`GET` and `PUT /linda/settings`).
 *
 * A question carries only its text and this session's earlier turns. The
 * tenant, branch, role and permissions are the token's, decided by the server;
 * nothing here lets the browser widen what Linda may read.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { normalizeLindaReply } from "@/lib/linda";
import type { LindaChatRequest, LindaReply, LindaSettings, LindaSettingsInput } from "@/types/linda";

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

  /** The model in use, the choices with their prices, the AI status and this month's cost. */
  getSettings: () => api.get<LindaSettings>(API_ENDPOINTS.LINDA.SETTINGS),

  /** Sends only the chosen model; answers the saved settings. */
  updateSettings: (input: LindaSettingsInput) =>
    api.put<LindaSettings>(API_ENDPOINTS.LINDA.SETTINGS, { model: input.model }),
};
