import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import { MAX_PER_PAGE } from "@/lib/paginate";
import type { PaginatedResponse } from "@/types/api";
import type {
  ApplicationDetail,
  ApplicationLink,
  ApplicationLinkInput,
  ApplicationListFilters,
  ApplicationListResponse,
  ApplicationStatus,
  Assessment,
  AssessmentResult,
  DocumentQueueItem,
  DocumentStatus,
  OriginationDashboard,
  OriginationSettings,
} from "@/types/loan-origination";

const L = API_ENDPOINTS.LOAN_ORIGINATION;

export interface DashboardFilters {
  date_from?: string;
  date_to?: string;
  branch_id?: number;
}

export interface DocumentQueueFilters {
  page?: number;
  per_page?: number;
  status?: DocumentStatus;
  search?: string;
}

export interface AssessmentListFilters {
  page?: number;
  per_page?: number;
  result?: AssessmentResult;
  search?: string;
}

/**
 * Staff side of Loan Origination. Lists come back as Laravel paginators
 * (`getRaw`) so their `meta` (and `meta.stats` for the status tabs) survives.
 * Not built on the backend yet; every call answers 404 until it is.
 */
export const loanOriginationService = {
  dashboard: (filters: DashboardFilters) =>
    api.get<OriginationDashboard>(L.DASHBOARD, { params: filters }),

  listApplications: (filters: ApplicationListFilters = {}) =>
    api.getRaw<ApplicationListResponse>(L.APPLICATIONS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  getApplication: (id: number) => api.get<ApplicationDetail>(L.APPLICATION(id)),
  /** The server checks the move against its own transition table. */
  transition: (id: number, to: ApplicationStatus, note: string) =>
    api.post<ApplicationDetail>(L.TRANSITION(id), { to, note }),
  assign: (id: number, officerId: number | null) =>
    api.post<ApplicationDetail>(L.ASSIGN(id), { officer_id: officerId }),
  addNote: (id: number, body: string) => api.post<ApplicationDetail>(L.NOTES(id), { body }),
  /** Moves the application to Additional Information Required and tells the applicant. */
  requestInformation: (id: number, message: string, documentTypes: string[]) =>
    api.post<ApplicationDetail>(L.REQUEST_INFO(id), { message, document_types: documentTypes }),
  /** Reminds an applicant whose draft is incomplete, through the configured channel. */
  remind: (id: number) => api.post<{ channel: string; sent_at: string }>(L.REMIND(id)),
  /** Links to an existing member after review, or `null` to create one on conversion. */
  linkMember: (id: number, borrowerId: number | null) =>
    api.post<ApplicationDetail>(L.LINK_MEMBER(id), { borrower_id: borrowerId }),
  /** Hands the application to the existing loan approval chain. */
  submitForApproval: (id: number) => api.post<ApplicationDetail>(L.SUBMIT_FOR_APPROVAL(id)),
  /** Creates the loan record once; a repeat answers 409 naming the same loan. */
  convert: (id: number) => api.post<{ loan_id: number }>(L.CONVERT(id)),

  listAssessments: (filters: AssessmentListFilters = {}) =>
    api.getRaw<PaginatedResponse<Assessment>>(L.ASSESSMENTS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  rerunAssessment: (id: number) => api.post<Assessment>(L.ASSESSMENT_RERUN(id)),
  saveFindings: (id: number, data: { officer_findings: string; recommendations: string }) =>
    api.patch<Assessment>(L.ASSESSMENT(id), data),
  assessmentHistory: (id: number) => api.get<Assessment[]>(L.ASSESSMENT_HISTORY(id)),
  /** The server renders the report, so the PDF matches what it stored. */
  assessmentPdf: (id: number) => api.download(L.ASSESSMENT_PDF(id)),

  listDocuments: (filters: DocumentQueueFilters = {}) =>
    api.getRaw<PaginatedResponse<DocumentQueueItem>>(L.DOCUMENTS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  verifyDocument: (docId: number, notes: string) =>
    api.post<DocumentQueueItem>(L.DOCUMENT_VERIFY(docId), { notes }),
  rejectDocument: (docId: number, reason: string) =>
    api.post<DocumentQueueItem>(L.DOCUMENT_REJECT(docId), { reason }),
  requestReplacement: (docId: number, reason: string) =>
    api.post<DocumentQueueItem>(L.DOCUMENT_REQUEST_REPLACEMENT(docId), { reason }),
  downloadDocument: (docId: number) => api.download(L.DOCUMENT_DOWNLOAD(docId)),

  listLinks: () => api.get<ApplicationLink[]>(L.LINKS),
  createLink: (data: ApplicationLinkInput) => api.post<ApplicationLink>(L.LINKS, data),
  updateLink: (id: number, data: Partial<ApplicationLinkInput>) =>
    api.patch<ApplicationLink>(L.LINK(id), data),
  uploadLinkLogo: (id: number, formData: FormData) =>
    api.upload<ApplicationLink>(L.LINK_LOGO(id), formData),

  getSettings: () => api.get<OriginationSettings>(L.SETTINGS),
  updateSettings: (data: OriginationSettings) => api.put<OriginationSettings>(L.SETTINGS, data),
};
