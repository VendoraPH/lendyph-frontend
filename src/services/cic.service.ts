/**
 * CIC reporting API client. Contract in docs/CIC_BACKEND_HANDOFF.md; none of
 * it is built in lendyph-backend yet, so every call answers 404 and the
 * screens show "Not connected yet".
 *
 * The backend maps Lendy's members and loans to CIC records, validates them,
 * builds the file, masks its preview, zips and encrypts it with CIC's public
 * key. Lists are paged on the server and carry counts, issues and masked
 * labels only: a record's personal data never reaches the browser, and the
 * plain file is never served.
 *
 * No fixtures: a CIC file built from invented data must never look real.
 */
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PaginatedResponse } from "@/types/api";
import type {
  CicAcknowledgementData,
  CicFilePreview,
  CicIssue,
  CicIssueFilters,
  CicProductMapping,
  CicPublicKey,
  CicPublicKeyHistoryEntry,
  CicReadiness,
  CicRecordFilters,
  CicRecordSummary,
  CicSettings,
  CicSubmission,
  EncryptCicSubmissionData,
  GenerateCicSubmissionData,
  SaveCicProductMapping,
  UpdateCicSettingsData,
} from "@/types/cic";

const C = API_ENDPOINTS.CIC;

/** The issue filters minus paging, for the server-built CSV. */
type IssueExportFilters = Pick<CicIssueFilters, "severity">;

export const cicService = {
  getSettings: () => api.get<CicSettings>(C.SETTINGS),
  updateSettings: (data: UpdateCicSettingsData) => api.put<CicSettings>(C.SETTINGS, data),

  /**
   * Upload the armored public key CIC issued. The server reads its fingerprint
   * and expiry and stores it unverified; a key it replaces moves to the
   * history with `reason`.
   */
  uploadPublicKey: (file: File, reason?: string) => {
    const body = new FormData();
    body.append("public_key", file);
    if (reason) body.append("reason", reason);
    return api.upload<CicPublicKey>(C.PUBLIC_KEY, body);
  },
  /** Confirm the stored key's fingerprint matches the one CIC gave out of band. */
  verifyPublicKey: (fingerprint: string) => api.post<CicPublicKey>(C.PUBLIC_KEY_VERIFY, { fingerprint }),
  removePublicKey: (reason: string) => api.delete<null>(C.PUBLIC_KEY, { data: { reason } }),
  /** Every key that was replaced or removed, newest first. Small, so one list. */
  getPublicKeyHistory: () => api.get<CicPublicKeyHistoryEntry[]>(C.PUBLIC_KEY_HISTORY),

  /** One row per loan product, mapped or not. Small, so one unpaginated list. */
  getProductMappings: () => api.get<CicProductMapping[]>(C.PRODUCT_MAPPINGS),
  saveProductMappings: (mappings: SaveCicProductMapping[]) =>
    api.put<CicProductMapping[]>(C.PRODUCT_MAPPINGS, { mappings }),

  getReadiness: (referenceDate: string) =>
    api.get<CicReadiness>(C.READINESS, { params: { reference_date: referenceDate } }),

  /** One page of subject records, searched and filtered on the server. */
  subjectsPage: (filters: CicRecordFilters) =>
    api.getRaw<PaginatedResponse<CicRecordSummary>>(C.SUBJECTS, { params: filters }),
  contractsPage: (filters: CicRecordFilters) =>
    api.getRaw<PaginatedResponse<CicRecordSummary>>(C.CONTRACTS, { params: filters }),

  /** One page of the issues in the file as of `referenceDate`. */
  issuesPage: (referenceDate: string, filters: CicIssueFilters) =>
    api.getRaw<PaginatedResponse<CicIssue>>(C.ISSUES, { params: { reference_date: referenceDate, ...filters } }),
  /** Every issue as a CSV the server builds and audits. */
  exportIssues: (referenceDate: string, filters: IssueExportFilters) =>
    api.download(C.ISSUES_EXPORT, { params: { reference_date: referenceDate, ...filters } }),

  listAllSubmissions: (): Promise<DrainResult<CicSubmission>> =>
    fetchAllPages<CicSubmission>(({ page, per_page }) =>
      api.getRaw(C.SUBMISSIONS, { params: { page, per_page } }),
    ),
  getSubmission: (id: number) => api.get<CicSubmission>(C.SUBMISSION(id)),
  submissionIssuesPage: (id: number, filters: CicIssueFilters) =>
    api.getRaw<PaginatedResponse<CicIssue>>(C.SUBMISSION_ISSUES(id), { params: filters }),
  exportSubmissionIssues: (id: number, filters: IssueExportFilters) =>
    api.download(C.SUBMISSION_ISSUES_EXPORT(id), { params: filters }),
  /** The stored file's masked preview, for the review before encryption. */
  getPreview: (id: number) => api.get<CicFilePreview>(C.SUBMISSION_PREVIEW(id)),

  generate: (data: GenerateCicSubmissionData) => api.post<CicSubmission>(C.SUBMISSIONS, data),
  /** Zips the stored TXT and encrypts it to `….zip.gpg`, once the reviewer has confirmed. */
  encrypt: (id: number, data: EncryptCicSubmissionData) =>
    api.post<CicSubmission>(C.SUBMISSION_ENCRYPT(id), data),
  /** The encrypted file only. The server refuses before encryption. */
  download: (id: number) => api.download(C.SUBMISSION_DOWNLOAD(id)),
  markSubmitted: (id: number) => api.post<CicSubmission>(C.SUBMISSION_MARK_SUBMITTED(id)),
  acknowledge: (id: number, data: CicAcknowledgementData) =>
    api.post<CicSubmission>(C.SUBMISSION_ACKNOWLEDGE(id), data),
};
