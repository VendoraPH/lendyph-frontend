/**
 * CIC reporting API client. Contract in docs/CIC_BACKEND_HANDOFF.md; none of
 * it is built in lendyph-backend yet, so every call answers 404 and the
 * screens show "Not connected yet".
 *
 * The backend maps Lendy's members and loans to CIC records, generates the
 * file and encrypts it with CIC's public key. The frontend validates the
 * records it is served with `src/lib/cic/` so staff see every problem before
 * they generate, and previews the file in the same format.
 *
 * No fixtures: a CIC file built from invented data must never look real.
 */
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type {
  CicAcknowledgementData,
  CicContractRecord,
  CicProductMapping,
  CicPublicKey,
  CicReadiness,
  CicRecordFilters,
  CicSettings,
  CicSubjectRecord,
  CicSubmission,
  CicSubmissionDetail,
  GenerateCicSubmissionData,
  SaveCicProductMapping,
  UpdateCicSettingsData,
} from "@/types/cic";

const C = API_ENDPOINTS.CIC;

export const cicService = {
  getSettings: () => api.get<CicSettings>(C.SETTINGS),
  updateSettings: (data: UpdateCicSettingsData) => api.put<CicSettings>(C.SETTINGS, data),

  /** Upload the armored public key CIC issued. The server reads its fingerprint and expiry. */
  uploadPublicKey: (file: File) => {
    const body = new FormData();
    body.append("public_key", file);
    return api.upload<CicPublicKey>(C.PUBLIC_KEY, body);
  },
  removePublicKey: () => api.delete<null>(C.PUBLIC_KEY),

  /** One row per loan product, mapped or not. Small, so one unpaginated list. */
  getProductMappings: () => api.get<CicProductMapping[]>(C.PRODUCT_MAPPINGS),
  saveProductMappings: (mappings: SaveCicProductMapping[]) =>
    api.put<CicProductMapping[]>(C.PRODUCT_MAPPINGS, { mappings }),

  getReadiness: (referenceDate: string) =>
    api.get<CicReadiness>(C.READINESS, { params: { reference_date: referenceDate } }),

  /** Every subject record as of `reference_date`, drained. Callers render `IncompleteListNotice` on `truncated`. */
  listAllSubjects: (filters: CicRecordFilters): Promise<DrainResult<CicSubjectRecord>> =>
    fetchAllPages<CicSubjectRecord>(({ page, per_page }) =>
      api.getRaw(C.SUBJECTS, { params: { ...filters, page, per_page } }),
    ),
  listAllContracts: (filters: CicRecordFilters): Promise<DrainResult<CicContractRecord>> =>
    fetchAllPages<CicContractRecord>(({ page, per_page }) =>
      api.getRaw(C.CONTRACTS, { params: { ...filters, page, per_page } }),
    ),

  listAllSubmissions: (): Promise<DrainResult<CicSubmission>> =>
    fetchAllPages<CicSubmission>(({ page, per_page }) =>
      api.getRaw(C.SUBMISSIONS, { params: { page, per_page } }),
    ),
  getSubmission: (id: number) => api.get<CicSubmissionDetail>(C.SUBMISSION(id)),
  generate: (data: GenerateCicSubmissionData) => api.post<CicSubmissionDetail>(C.SUBMISSIONS, data),
  encrypt: (id: number) => api.post<CicSubmission>(C.SUBMISSION_ENCRYPT(id)),
  /** The encrypted file once encrypted, the plain one before. */
  download: (id: number) => api.download(C.SUBMISSION_DOWNLOAD(id)),
  markSubmitted: (id: number) => api.post<CicSubmission>(C.SUBMISSION_MARK_SUBMITTED(id)),
  acknowledge: (id: number, data: CicAcknowledgementData) =>
    api.post<CicSubmission>(C.SUBMISSION_ACKNOWLEDGE(id), data),
};
