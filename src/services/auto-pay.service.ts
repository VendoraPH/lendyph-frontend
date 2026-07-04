import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { AutoPayFilter, AutoPayPreview, AutoPayProcessData, AutoPayResult } from "@/types";

export const autoPayService = {
  preview: (params: AutoPayFilter) =>
    api.get<AutoPayPreview>(API_ENDPOINTS.AUTO_PAY.PREVIEW, { params }),

  process: (data: AutoPayProcessData) =>
    api.post<AutoPayResult>(API_ENDPOINTS.AUTO_PAY.PROCESS, data),
};
