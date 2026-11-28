/**
 * CIC reporting API client (`routes/api/cic/*.php` in the backend).
 *
 * The server captures each month-end, builds and validates the records,
 * builds the file from a capture, zips and encrypts it with CIC's verified
 * public key, and serves only the `.zip.gpg`. Lists are paged on the server
 * (25 a page for records, issues and captures). A record's member name and
 * values come back only for a caller holding `borrowers:view`.
 */
import { api } from "@/lib/api-client";
import axiosClient from "@/lib/axios-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { filenameFrom } from "@/lib/content-disposition";
import { readBlobError } from "@/lib/amla/case-api";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PaginatedResponse } from "@/types/api";
import type {
  CicAcknowledgementData,
  CicCapture,
  CicCodeMappings,
  CicIssue,
  CicIssueFilters,
  CicIssuesMeta,
  CicLoanOverride,
  CicPage,
  CicProductMappings,
  CicPublicKey,
  CicReadiness,
  CicRecordDetail,
  CicRecordFilters,
  CicRecordRow,
  CicSettings,
  CicSourceFilter,
  CicStatus,
  CicSubmissionDetail,
  CicSubmissionFilters,
  CicSubmissionRow,
  CreateCicCaptureData,
  CreateCicLoanOverride,
  GenerateCicSubmissionData,
  SaveCicCodeMapping,
  SaveCicProductMapping,
  UpdateCicLoanOverride,
  UpdateCicSettingsData,
} from "@/types/cic";

const C = API_ENDPOINTS.CIC;

export interface CicDownloadedFile {
  blob: Blob;
  filename: string | null;
}

export const cicService = {
  getStatus: () => api.get<CicStatus>(C.STATUS),

  getSettings: () => api.get<CicSettings>(C.SETTINGS),
  updateSettings: (data: Partial<UpdateCicSettingsData>) => api.put<CicSettings>(C.SETTINGS, data),

  /** Every key, newest first; nothing is ever deleted, so this is the key history. */
  listPublicKeys: () => api.get<CicPublicKey[]>(C.PUBLIC_KEYS),
  /** An ASCII-armored public key, pasted. It is stored pending until a second person verifies it. */
  uploadPublicKeyText: (armored: string) => api.post<CicPublicKey>(C.PUBLIC_KEYS, { armored }),
  uploadPublicKeyFile: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.upload<CicPublicKey>(C.PUBLIC_KEYS, body);
  },
  /** `fingerprint` is the one the verifier checked with CIC, typed, never copied from the screen. */
  verifyPublicKey: (id: number, fingerprint: string) =>
    api.post<CicPublicKey>(C.PUBLIC_KEY_VERIFY(id), { fingerprint }),
  retirePublicKey: (id: number, reason: string) => api.post<CicPublicKey>(C.PUBLIC_KEY_RETIRE(id), { reason }),

  getProductMappings: () => api.get<CicProductMappings>(C.PRODUCT_MAPPINGS),
  /** Products not listed are left as they are. */
  saveProductMappings: (mappings: SaveCicProductMapping[]) =>
    api.put<CicProductMappings>(C.PRODUCT_MAPPINGS, { mappings }),

  loanOverridesPage: (page: number) =>
    api.getRaw<PaginatedResponse<CicLoanOverride>>(C.LOAN_OVERRIDES, { params: { page, per_page: 25 } }),
  createLoanOverride: (data: CreateCicLoanOverride) => api.post<CicLoanOverride>(C.LOAN_OVERRIDES, data),
  updateLoanOverride: (id: number, data: UpdateCicLoanOverride) => api.put<CicLoanOverride>(C.LOAN_OVERRIDE(id), data),
  deleteLoanOverride: (id: number, reason: string) => api.delete<null>(C.LOAN_OVERRIDE(id), { data: { reason } }),

  getCodeMappings: () => api.get<CicCodeMappings>(C.CODE_MAPPINGS),
  /** Only what is sent is saved: a suggestion is kept only when sent back. */
  saveCodeMappings: (mappings: SaveCicCodeMapping[]) => api.put<CicCodeMappings>(C.CODE_MAPPINGS, { mappings }),

  /** The live picture, built now as of `referenceDate` (today at the latest). */
  getReadiness: (referenceDate: string) =>
    api.get<CicReadiness>(C.READINESS, { params: { reference_date: referenceDate } }),

  recordsPage: (source: CicSourceFilter, filters: CicRecordFilters) =>
    api.getRaw<CicPage<CicRecordRow>>(C.RECORDS, { params: { ...source, ...filters } }),
  getRecord: (type: string, key: string, source: CicSourceFilter) =>
    api.get<CicRecordDetail>(C.RECORD(type, key), { params: source }),

  issuesPage: (source: CicSourceFilter, filters: CicIssueFilters) =>
    api.getRaw<CicPage<CicIssue, CicIssuesMeta>>(C.ISSUES, { params: { ...source, ...filters } }),

  /** Every capture, newest reference date first. */
  listAllCaptures: (): Promise<DrainResult<CicCapture>> =>
    fetchAllPages<CicCapture>(({ page }) => api.getRaw(C.CAPTURES, { params: { page } })),
  /** A test capture (staging, while test captures are on) or a correction of a month-end capture. */
  createCapture: (data: CreateCicCaptureData) => api.post<CicCapture>(C.CAPTURES, data),

  submissionsPage: (filters: CicSubmissionFilters) =>
    api.getRaw<PaginatedResponse<CicSubmissionRow>>(C.SUBMISSIONS, { params: filters }),
  /** The pre-encryption review and the file's record. */
  getSubmission: (id: number) => api.get<CicSubmissionDetail>(C.SUBMISSION(id)),
  generate: (data: GenerateCicSubmissionData) => api.post<CicSubmissionDetail>(C.SUBMISSIONS, data),
  /** Zips and encrypts the file with the active key, after the explicit confirmation. */
  encrypt: (id: number) => api.post<CicSubmissionDetail>(C.SUBMISSION_ENCRYPT(id), { confirm: true }),
  /** The `.zip.gpg` only; the server never serves a plain file. */
  download: async (id: number): Promise<CicDownloadedFile> => {
    try {
      const response = await axiosClient.get<Blob>(C.SUBMISSION_DOWNLOAD(id), { responseType: "blob" });
      return { blob: response.data, filename: filenameFrom(response.headers?.["content-disposition"]) };
    } catch (err) {
      throw await readBlobError(err);
    }
  },
  markSubmitted: (id: number) => api.post<CicSubmissionDetail>(C.SUBMISSION_MARK_SUBMITTED(id)),
  acknowledge: (id: number, data: CicAcknowledgementData) =>
    api.post<CicSubmissionDetail>(C.SUBMISSION_ACKNOWLEDGE(id), data),
};
