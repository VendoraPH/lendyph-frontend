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
  ApplicationNote,
  Assessment,
  AssessmentResult,
  DocumentDecision,
  DocumentQueueItem,
  DocumentStatus,
  HandOffInput,
  HandOffResult,
  OriginationDashboard,
  OriginationNotice,
  OriginationNotices,
  OriginationSettings,
  OriginationSettingsInput,
  PublishNoticeInput,
  ReminderResult,
  RerunAssessmentInput,
  TransitionInput,
  VerifyDocumentInput,
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
  type?: string;
  branch_id?: number;
  application_id?: number;
  search?: string;
}

export interface AssessmentListFilters {
  page?: number;
  per_page?: number;
  result?: AssessmentResult;
}

/**
 * Staff side of Loan Origination (`routes/api/loan-origination/*`). Lists are
 * Laravel paginators (`getRaw`) so their `meta.stats` survive for the tabs.
 * Every write on an application sends the `version` the page read; the server
 * answers 409 when it moved on. Refusals come back in words.
 */
export const loanOriginationService = {
  dashboard: (filters: DashboardFilters) =>
    api.get<OriginationDashboard>(L.DASHBOARD, { params: filters }),

  listApplications: (filters: ApplicationListFilters = {}) =>
    api.getRaw<ApplicationListResponse>(L.APPLICATIONS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  getApplication: (id: number) => api.get<ApplicationDetail>(L.APPLICATION(id)),
  /** A staff move from the server's `allowed_transitions`; `applicant_message` is logged, never sent. */
  transition: (id: number, input: TransitionInput) => api.post<ApplicationDetail>(L.TRANSITION(id), input),
  /** An officer from `GET /staff?for=origination`, or null to clear. */
  assign: (id: number, officerId: number | null, version: number) =>
    api.post<ApplicationDetail>(L.ASSIGN(id), { officer_id: officerId, version }),
  addNote: (id: number, body: string) => api.post<ApplicationNote>(L.NOTES(id), { body }),
  /** Moves to Additional Information Required and logs the message (never sent). */
  requestInformation: (id: number, input: { message: string; document_types: string[]; version: number }) =>
    api.post<ApplicationDetail>(L.REQUEST_INFO(id), input),
  /** An unsubmitted application, at most once a day; logged, never sent. */
  remind: (id: number) => api.post<ReminderResult>(L.REMIND(id)),
  /** A member in the caller's branches, or null to clear, until the hand-off. */
  linkMember: (id: number, borrowerId: number | null, version: number) =>
    api.post<ApplicationDetail>(L.LINK_MEMBER(id), { borrower_id: borrowerId, version }),
  /** The hand-off: creates and submits the loan; a repeat answers 409 naming it. */
  submitForApproval: (id: number, input: HandOffInput) => api.post<HandOffResult>(L.SUBMIT_FOR_APPROVAL(id), input),

  listAssessments: (filters: AssessmentListFilters = {}) =>
    api.getRaw<PaginatedResponse<Assessment>>(L.ASSESSMENTS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  /** A new revision worked out on the server; figures left out keep the last run's. */
  rerunAssessment: (id: number, input: RerunAssessmentInput) => api.post<Assessment>(L.ASSESSMENT_RERUN(id), input),
  saveFindings: (id: number, data: { officer_findings: string | null; recommendations: string | null }) =>
    api.patch<Assessment>(L.ASSESSMENT(id), data),
  /** The server renders the report, so the PDF matches what it stored. */
  assessmentPdf: (id: number) => api.download(L.ASSESSMENT_PDF(id)),

  listDocuments: (filters: DocumentQueueFilters = {}) =>
    api.getRaw<PaginatedResponse<DocumentQueueItem>>(L.DOCUMENTS, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  /** An ID also sends its type, its name for "others" and its number (422 without them). */
  verifyDocument: (docId: number, input: VerifyDocumentInput) => api.post<DocumentDecision>(L.DOCUMENT_VERIFY(docId), input),
  rejectDocument: (docId: number, reason: string) => api.post<DocumentDecision>(L.DOCUMENT_REJECT(docId), { reason }),
  /** Logs a message asking the applicant for another file (never sent). */
  requestReplacement: (docId: number, reason: string) =>
    api.post<DocumentDecision>(L.DOCUMENT_REQUEST_REPLACEMENT(docId), { reason }),
  /** Needs `borrowers:view` and the application's branch, like its file name. */
  downloadDocument: (docId: number) => api.download(L.DOCUMENT_DOWNLOAD(docId)),

  listLinks: () => api.get<ApplicationLink[]>(L.LINKS),
  createLink: (data: ApplicationLinkInput) => api.post<ApplicationLink>(L.LINKS, data),
  updateLink: (id: number, data: Partial<ApplicationLinkInput>) => api.patch<ApplicationLink>(L.LINK(id), data),

  /** The current version of each notice, the required ones still missing (in words) and every version. */
  listNotices: () => api.get<OriginationNotices>(L.NOTICES),
  /** Publishes a new version, which becomes its type's current one; it can never be edited or removed. */
  publishNotice: (input: PublishNoticeInput) => api.post<OriginationNotice>(L.NOTICES, input),

  getSettings: () => api.get<OriginationSettings>(L.SETTINGS),
  updateSettings: (data: OriginationSettingsInput) => api.put<OriginationSettings>(L.SETTINGS, data),
};
