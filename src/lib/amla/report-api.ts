/**
 * The AMLA reports' API client (Phase 6, AMLA-B7). The catalog lists only the
 * reports the caller may open; each report, export and download is checked
 * and logged by the server, so screens call the reads through `once`.
 */

import { api } from "@/lib/api-client";
import axiosClient from "@/lib/axios-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { filenameFrom } from "@/lib/content-disposition";
import { only } from "@/lib/amla/api";
import type {
  AmlaComplianceReport,
  AmlaComplianceReportFilters,
  AmlaComplianceReportSummary,
  AmlaDashboardCounts,
  AmlaExportFormat,
  AmlaReportExport,
} from "@/types/amla-reports";

const A = API_ENDPOINTS.AMLA;

const DOWNLOAD_PATH = /\/amla\/exports\/\d{1,18}\/download$/;

/**
 * The API-relative path of an export's signed download link, with its query
 * string exactly as signed (the signature covers it). The download also needs
 * the bearer token, so it goes through the API client, never a plain link.
 * Anything that isn't an AMLA export link is refused (null).
 */
export function exportDownloadPath(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const match = DOWNLOAD_PATH.exec(parsed.pathname);
  return match ? `${match[0]}${parsed.search}` : null;
}

export interface AmlaDownloadedExport {
  blob: Blob;
  filename: string | null;
}

export const amlaReportApi = {
  catalog: () => api.get<AmlaComplianceReportSummary[]>(A.COMPLIANCE_REPORTS),
  /** An as-of-today report ignores the dates, so they're sent only for a period report. */
  report: (key: string, filters: AmlaComplianceReportFilters) =>
    api.get<AmlaComplianceReport>(A.COMPLIANCE_REPORT(key), { params: only({ ...filters }) }),
  exportReport: (key: string, filters: AmlaComplianceReportFilters, format: AmlaExportFormat) =>
    api.post<AmlaReportExport>(A.COMPLIANCE_REPORT_EXPORTS(key), { ...only({ ...filters }), format }),
  /** The file behind a signed link, and the name the server gave it. */
  download: async (downloadUrl: string): Promise<AmlaDownloadedExport> => {
    const path = exportDownloadPath(downloadUrl);
    if (path === null) throw new Error("The server sent a download link this page can't open. Export the report again.");
    const response = await axiosClient.get<Blob>(path, { responseType: "blob" });
    return { blob: response.data, filename: filenameFrom(response.headers?.["content-disposition"]) };
  },
  dashboardCounts: () => api.get<AmlaDashboardCounts>(A.DASHBOARD_COUNTS),
};
