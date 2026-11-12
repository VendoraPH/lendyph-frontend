/**
 * CDA Compliance API client (CDA design §3). Every route needs
 * `branches:view_all` and its own `cda:*` permission, and restricted reports
 * (mediation, audit, tax) their view permission: screens check before calling.
 *
 * Reports and their workflow are addressed by id; a screen finds its report
 * by year and type (`reportByType`) and works on its id from then on. Money is
 * sent as typed and read as two-decimal text; deadlines, readiness, issues and
 * file links are the server's.
 */

import { api } from "@/lib/api-client";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  CdaCalendarRow,
  CdaDashboard,
  CdaDocument,
  CdaDocumentVersion,
  CdaExport,
  CdaExportFormat,
  CdaFieldInput,
  CdaLoanClassificationPage,
  CdaMediationCase,
  CdaOfficer,
  CdaPeriod,
  CdaPesos,
  CdaProfileFields,
  CdaRegulatoryProfile,
  CdaReport,
  CdaReportPart,
  CdaReportRow,
  CdaReportType,
  CdaRequirement,
  CdaRequirementInput,
  CdaReviewChain,
  CdaReviewChainStep,
  CdaSettings,
  CdaSnapshot,
  CdaSnapshotCheck,
  CdaSnapshotSummary,
  CdaSocialProgram,
  CdaSocialTotals,
  CdaSubmission,
  CdaTemplate,
  CdaTemplateInput,
  CdaTemplateValidation,
  CdaTraining,
  CdaWorkflowInput,
} from "@/types/cda";

const C = API_ENDPOINTS.CDA;

type Params = Record<string, string | number | undefined>;

/** Every row of a paginated CDA register. */
function drain<T>(url: string, params?: Params): Promise<DrainResult<T>> {
  return fetchAllPages<T>(({ page, per_page }) => api.getRaw(url, { params: { ...params, page, per_page } }));
}

/**
 * A multipart body: blank values are left out, booleans go as 1 or 0, and
 * the file (when there is one) under `fileKey`.
 */
export function toFormData(data: Record<string, unknown>, file?: File | null, fileKey = "file"): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === "") continue;
    form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  if (file) form.append(fileKey, file);
  return form;
}

/**
 * A PUT that carries a file goes as a POST with `_method=PUT`: PHP reads
 * uploaded files only from a POST body.
 */
function putWithFile<T>(url: string, data: Record<string, unknown>, file: File, fileKey: string): Promise<T> {
  const form = toFormData(data, file, fileKey);
  form.append("_method", "PUT");
  return api.upload<T>(url, form);
}

export type CdaOfficerInput = Partial<Omit<CdaOfficer, "id" | "member" | "position_label" | "trainings">>;
export type CdaTrainingInput = Partial<Omit<CdaTraining, "id" | "officer" | "certificate">>;
export type CdaSocialProgramInput = Partial<
  Omit<CdaSocialProgram, "id" | "period_id" | "year" | "category_label" | "funding_source_label" | "responsible_officer">
> & { responsible_officer_id?: number | null };
export type CdaMediationCaseInput = Partial<
  Omit<CdaMediationCase, "id" | "case_number" | "year" | "halves" | "status_label">
>;

/** The register rows a document can be attached to (`CdaDocumentRequest::SUBJECT_TYPES`). */
export type CdaDocumentSubjectType = "training" | "program" | "case";

export interface CdaDocumentUpload {
  title: string;
  category: string;
  report_id?: number | null;
  /** The register row the document is about (Attach on a training, program or case). */
  subject_type?: CdaDocumentSubjectType;
  subject_id?: number;
  description?: string | null;
  expires_on?: string | null;
  version_label?: string | null;
  notes?: string | null;
  final?: boolean;
}

export interface CdaSocialPrograms extends DrainResult<CdaSocialProgram> {
  totals: CdaSocialTotals | null;
}

export const cdaService = {
  // ── Periods, dashboard and calendar ──
  listPeriods: () => api.get<CdaPeriod[]>(C.PERIODS),
  getPeriod: (year: number) => api.get<CdaPeriod>(C.PERIOD(year)),
  openPeriod: (year: number) => api.post<CdaPeriod>(C.PERIODS, { year }),
  /** CDA's extension for the year's annual reports; null removes it. */
  setExtension: (year: number, extendedDeadline: string | null, reference: string | null) =>
    api.patch<CdaPeriod>(C.PERIOD(year), { extended_deadline: extendedDeadline, extension_reference: reference }),
  getDashboard: (year: number) => api.get<CdaDashboard>(C.DASHBOARD(year)),
  getCalendar: (year: number) => api.get<CdaCalendarRow[]>(C.CALENDAR(year)),

  // ── Custom compliance requirements (cda:prepare writes; the calendar lists them) ──
  listRequirements: (year: number) => drain<CdaRequirement>(C.REQUIREMENTS(year)),
  createRequirement: (year: number, data: CdaRequirementInput) =>
    api.post<CdaRequirement>(C.REQUIREMENTS(year), data),
  updateRequirement: (id: number, data: Partial<CdaRequirementInput>) =>
    api.put<CdaRequirement>(C.REQUIREMENT(id), data),
  deleteRequirement: (id: number) => api.delete<void>(C.REQUIREMENT(id)),

  // ── The review chain (Settings → Approval Workflow, `cda`; cda:settings and every branch) ──
  getReviewChain: () =>
    api.get<CdaReviewChain>(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, { params: { type: "cda" } }),
  saveReviewChain: (steps: CdaReviewChainStep[]) =>
    api.put<CdaReviewChain>(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, { type: "cda", steps }),
  /** Back to the single review: the saved chain is deleted. */
  resetReviewChain: () =>
    api.delete<CdaReviewChain>(API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW, { params: { type: "cda" } }),

  // ── Reports ──
  reportByType: (year: number, type: CdaReportType, part?: CdaReportPart) =>
    api.get<CdaReport>(C.REPORT_BY_TYPE(year, type), { params: part && part !== "annual" ? { part } : undefined }),
  getReport: (id: number) => api.get<CdaReport>(C.REPORT(id)),
  saveReport: (id: number, fields: CdaFieldInput[]) => api.put<CdaReport>(C.REPORT(id), { fields }),
  runWorkflow: (id: number, input: CdaWorkflowInput) => api.post<CdaReport>(C.REPORT_WORKFLOW(id), input),
  /** The report's own deadline (cda:settings); null removes it. Answers the report row with the server's deadline. */
  setReportDeadline: (id: number, overrideOn: string | null, reference: string | null) =>
    api.patch<CdaReportRow>(C.REPORT_DEADLINE(id), { override_on: overrideOn, reference }),
  /** Every finalized version, newest first, kept when a reopen supersedes it. */
  listSnapshots: (id: number) => api.get<CdaSnapshotSummary[]>(C.REPORT_SNAPSHOTS(id)),
  getSnapshot: (id: number, version: number) => api.get<CdaSnapshot>(`${C.REPORT_SNAPSHOTS(id)}/${version}`),
  /** The server recomputes the stored payload's SHA-256 against its checksum. */
  verifySnapshot: (id: number, version: number) =>
    api.post<CdaSnapshotCheck>(`${C.REPORT_SNAPSHOTS(id)}/${version}/verify`),
  listExports: (id: number) => api.get<CdaExport[]>(C.REPORT_EXPORTS(id)),
  createExport: (id: number, format: CdaExportFormat) => api.post<CdaExport>(C.REPORT_EXPORTS(id), { format }),

  // ── Read-only figures ──
  getLoanClassification: (year: number, params: { page?: number; per_page?: number; bucket?: string } = {}) =>
    api.getRaw<CdaLoanClassificationPage>(C.LOAN_CLASSIFICATION(year), { params }),
  getPesos: (year: number) => api.get<CdaPesos>(C.PESOS(year)),

  // ── Officers and trainings ──
  listOfficers: (params?: { year?: number; status?: CdaOfficer["status"] }) => drain<CdaOfficer>(C.OFFICERS, params),
  createOfficer: (data: CdaOfficerInput) => api.post<CdaOfficer>(C.OFFICERS, data),
  updateOfficer: (id: number, data: CdaOfficerInput) => api.put<CdaOfficer>(C.OFFICER(id), data),
  deleteOfficer: (id: number) => api.delete<void>(C.OFFICER(id)),

  listTrainings: (params?: { year?: number }) => drain<CdaTraining>(C.TRAININGS, params),
  createTraining: (data: CdaTrainingInput, certificate: File | null) =>
    certificate
      ? api.upload<CdaTraining>(C.TRAININGS, toFormData(data, certificate, "certificate"))
      : api.post<CdaTraining>(C.TRAININGS, data),
  updateTraining: (id: number, data: CdaTrainingInput, certificate: File | null) =>
    certificate
      ? putWithFile<CdaTraining>(C.TRAINING(id), data, certificate, "certificate")
      : api.put<CdaTraining>(C.TRAINING(id), data),
  deleteTraining: (id: number) => api.delete<void>(C.TRAINING(id)),

  // ── Social programs (with the server's totals) ──
  listSocialPrograms: async (year: number): Promise<CdaSocialPrograms> => {
    let totals: CdaSocialTotals | null = null;
    const result = await fetchAllPages<CdaSocialProgram>(async ({ page, per_page }) => {
      const body = await api.getRaw<{ meta?: { totals?: CdaSocialTotals } }>(C.SOCIAL_PROGRAMS(year), {
        params: { page, per_page },
      });
      if (page === 1) totals = body.meta?.totals ?? null;
      return body;
    });
    return { ...result, totals };
  },
  createSocialProgram: (year: number, data: CdaSocialProgramInput) =>
    api.post<CdaSocialProgram>(C.SOCIAL_PROGRAMS(year), data),
  updateSocialProgram: (id: number, data: CdaSocialProgramInput) =>
    api.put<CdaSocialProgram>(C.SOCIAL_PROGRAM(id), data),
  deleteSocialProgram: (id: number) => api.delete<void>(C.SOCIAL_PROGRAM(id)),

  // ── Mediation (restricted) ──
  listMediationCases: (year: number, half?: "h1" | "h2") =>
    drain<CdaMediationCase>(C.MEDIATION_CASES(year), half ? { half } : undefined),
  createMediationCase: (year: number, data: CdaMediationCaseInput) =>
    api.post<CdaMediationCase>(C.MEDIATION_CASES(year), data),
  updateMediationCase: (id: number, data: CdaMediationCaseInput) =>
    api.put<CdaMediationCase>(C.MEDIATION_CASE(id), data),
  deleteMediationCase: (id: number) => api.delete<void>(C.MEDIATION_CASE(id)),

  // ── Documents (versioned; a new file never overwrites) ──
  listDocuments: (year: number, params?: { report_id?: number; status?: string }) =>
    drain<CdaDocument>(C.DOCUMENTS(year), params),
  uploadDocument: (year: number, data: CdaDocumentUpload, file: File) =>
    api.upload<CdaDocument>(C.DOCUMENTS(year), toFormData({ ...data }, file)),
  listVersions: (id: number) => api.get<CdaDocumentVersion[]>(C.DOCUMENT_VERSIONS(id)),
  addVersion: (id: number, file: File, data: { version_label?: string | null; notes?: string | null; final?: boolean }) =>
    api.upload<CdaDocument>(C.DOCUMENT_VERSIONS(id), toFormData({ ...data }, file)),
  withdrawDocument: (id: number, reason: string) => api.post<CdaDocument>(C.DOCUMENT_WITHDRAW(id), { reason }),

  // ── Filings ──
  listSubmissions: (year: number) => api.get<CdaSubmission[]>(C.SUBMISSIONS(year)),
  updateSubmission: (
    id: number,
    data: Partial<Pick<CdaSubmission, "cda_reference_no" | "acknowledgment_no" | "submitted_by_name" | "remarks">>,
  ) => api.put<CdaSubmission>(C.SUBMISSION(id), data),
  uploadProof: (id: number, file: File, notes: string | null) =>
    api.upload<{ submission_id: number; document: CdaDocument }>(C.SUBMISSION_PROOF(id), toFormData({ notes }, file)),

  // ── Settings ──
  getProfile: () => api.get<CdaRegulatoryProfile>(C.REGULATORY_PROFILE),
  updateProfile: (data: Partial<CdaProfileFields>) => api.put<CdaRegulatoryProfile>(C.REGULATORY_PROFILE, data),
  getSettings: () => api.get<CdaSettings>(C.SETTINGS),
  updateSettings: (data: Partial<Omit<CdaSettings, "updated_by" | "updated_at">>) =>
    api.put<CdaSettings>(C.SETTINGS, data),

  // ── Templates (super_admin) ──
  listTemplates: () => api.get<CdaTemplate[]>(C.TEMPLATES),
  /** One template with its definition (cda:view). */
  getTemplate: (id: number) => api.get<CdaTemplate>(C.TEMPLATE(id)),
  createTemplate: (data: CdaTemplateInput) => api.post<CdaTemplate>(C.TEMPLATES, data),
  /** A draft's report type is fixed, so it isn't sent. */
  updateTemplate: (id: number, data: CdaTemplateInput) =>
    api.put<CdaTemplate>(C.TEMPLATE(id), { ...data, report_type: undefined }),
  activateTemplate: (id: number) => api.post<CdaTemplate>(C.TEMPLATE_ACTIVATE(id)),
  retireTemplate: (id: number, reason: string) => api.post<CdaTemplate>(C.TEMPLATE_RETIRE(id), { reason }),
  attachWorkbook: (id: number, file: File) => api.upload<CdaTemplate>(C.TEMPLATE_EXCEL_FILE(id), toFormData({}, file)),
  validateTemplate: (reportType: CdaReportType, definition: Record<string, unknown>) =>
    api.post<CdaTemplateValidation>(C.TEMPLATE_VALIDATE, { report_type: reportType, definition }),
};
