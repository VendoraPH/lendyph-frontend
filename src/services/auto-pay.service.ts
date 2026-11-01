import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { AutoPayPreview, AutoPayPreviewQuery, AutoPayProcessData, AutoPayResult } from "@/types";

export const autoPayService = {
  /**
   * The preview for a filter. With `include_schedule_ids` (part-paid rows of
   * the preview's own `partial_rows`, else 422) its summary also carries
   * `partial_total` and `grand_total`, what the run posts for that selection.
   */
  preview: (params: AutoPayPreviewQuery, signal?: AbortSignal) =>
    api.get<AutoPayPreview>(API_ENDPOINTS.AUTO_PAY.PREVIEW, { params, signal }),

  process: (data: AutoPayProcessData) =>
    api.post<AutoPayResult>(API_ENDPOINTS.AUTO_PAY.PROCESS, data),
};
