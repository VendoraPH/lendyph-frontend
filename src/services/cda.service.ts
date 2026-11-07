/**
 * CDA Compliance.
 *
 * NONE of these endpoints exist yet — see `API_ENDPOINTS.CDA` and
 * `docs/CDA_BACKEND_HANDOFF.md`. Wired now against the contract in
 * `@/types/cda`, so the screens fill in the day the backend lands.
 */

import { api } from "@/lib/api-client";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  CdaCalendarEntry,
  CdaComplianceDocument,
  CdaDashboard,
  CdaDocumentVersion,
  CdaLoanClassification,
  CdaMediationCase,
  CdaOfficer,
  CdaPesosAssessment,
  CdaRegulatoryProfile,
  CdaReport,
  CdaReportType,
  CdaReportUpdate,
  CdaReportingPeriod,
  CdaSettings,
  CdaSocialProgram,
  CdaSubmission,
  CdaTemplate,
  CdaTemplateInput,
  CdaTraining,
  CdaWorkflowRequest,
} from "@/types/cda";

const C = API_ENDPOINTS.CDA;

/** Every row of a paginated register. `page`/`per_page` are set by the drain. */
function drain<T>(url: string, params?: Record<string, unknown>): Promise<DrainResult<T>> {
  return fetchAllPages<T>(({ page, per_page }) =>
    api.getRaw<{ data: T[] }>(url, { params: { ...params, page, per_page } }),
  );
}

/**
 * Multipart body for a record that may carry a file. `null`/`undefined` values
 * are left out rather than sent as the string "null"; arrays go as `key[]`.
 */
export function toFormData(data: object, file?: File | null, fileKey = "file"): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => form.append(`${key}[]`, String(v)));
    else if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else form.append(key, String(value));
  }
  if (file) form.append(fileKey, file);
  return form;
}

/** What a register form sends: any writable subset. Server-computed fields (hours completed, uploader, file URLs) are ignored on write. */
export type CdaRecordInput<T> = Partial<Omit<T, "id">>;

export const cdaService = {
  // ── Periods and dashboard ──
  listPeriods: () => api.get<CdaReportingPeriod[]>(C.PERIODS),
  openPeriod: (year: number) => api.post<CdaReportingPeriod>(C.PERIODS, { year }),
  /** Record (or clear, with null) a CDA-granted deadline extension for the year. */
  setExtendedDeadline: (year: number, extendedDeadline: string | null) =>
    api.patch<CdaReportingPeriod>(C.PERIOD(year), { extended_deadline: extendedDeadline }),
  getDashboard: (year: number) => api.get<CdaDashboard>(C.DASHBOARD(year)),
  getCalendar: (year: number) => api.get<CdaCalendarEntry[]>(C.CALENDAR(year)),

  // ── Template-driven reports ──
  getReport: (year: number, type: CdaReportType) => api.get<CdaReport>(C.REPORT(year, type)),
  updateReport: (year: number, type: CdaReportType, data: CdaReportUpdate) =>
    api.put<CdaReport>(C.REPORT(year, type), data),
  transition: (year: number, type: CdaReportType, data: CdaWorkflowRequest) =>
    api.post<CdaReport>(C.REPORT_WORKFLOW(year, type), data),

  // ── Read-only computations ──
  getLoanClassification: (year: number) =>
    api.get<CdaLoanClassification>(C.LOAN_CLASSIFICATION(year)),
  getPesos: (year: number) => api.get<CdaPesosAssessment>(C.PESOS(year)),

  // ── Officers and trainings ──
  listOfficers: () => drain<CdaOfficer>(C.OFFICERS),
  createOfficer: (data: CdaRecordInput<CdaOfficer>) => api.post<CdaOfficer>(C.OFFICERS, data),
  updateOfficer: (id: number, data: CdaRecordInput<CdaOfficer>) =>
    api.put<CdaOfficer>(C.OFFICER(id), data),
  deleteOfficer: (id: number) => api.delete<void>(C.OFFICER(id)),

  listTrainings: () => drain<CdaTraining>(C.TRAININGS),
  createTraining: (data: CdaRecordInput<CdaTraining>, file?: File | null) =>
    api.upload<CdaTraining>(C.TRAININGS, toFormData(data, file, "certificate")),
  updateTraining: (id: number, data: CdaRecordInput<CdaTraining>) =>
    api.put<CdaTraining>(C.TRAINING(id), data),
  deleteTraining: (id: number) => api.delete<void>(C.TRAINING(id)),

  // ── Social audit programs ──
  listSocialPrograms: (year: number) => drain<CdaSocialProgram>(C.SOCIAL_PROGRAMS(year)),
  createSocialProgram: (year: number, data: CdaRecordInput<CdaSocialProgram>) =>
    api.post<CdaSocialProgram>(C.SOCIAL_PROGRAMS(year), data),
  updateSocialProgram: (id: number, data: CdaRecordInput<CdaSocialProgram>) =>
    api.put<CdaSocialProgram>(C.SOCIAL_PROGRAM(id), data),
  deleteSocialProgram: (id: number) => api.delete<void>(C.SOCIAL_PROGRAM(id)),

  // ── Mediation & conciliation (restricted) ──
  listMediationCases: (year: number) => drain<CdaMediationCase>(C.MEDIATION_CASES(year)),
  createMediationCase: (year: number, data: CdaRecordInput<CdaMediationCase>) =>
    api.post<CdaMediationCase>(C.MEDIATION_CASES(year), data),
  updateMediationCase: (id: number, data: CdaRecordInput<CdaMediationCase>) =>
    api.put<CdaMediationCase>(C.MEDIATION_CASE(id), data),
  deleteMediationCase: (id: number) => api.delete<void>(C.MEDIATION_CASE(id)),

  // ── Compliance documents (versioned; a new file never overwrites) ──
  listDocuments: (year: number) => drain<CdaComplianceDocument>(C.DOCUMENTS(year)),
  uploadDocument: (
    year: number,
    data: Pick<CdaComplianceDocument, "title" | "category" | "report_type"> & { notes?: string },
    file: File,
  ) => api.upload<CdaComplianceDocument>(C.DOCUMENTS(year), toFormData(data, file)),
  listDocumentVersions: (id: number) => api.get<CdaDocumentVersion[]>(C.DOCUMENT_VERSIONS(id)),
  uploadDocumentVersion: (id: number, file: File, notes?: string) =>
    api.upload<CdaComplianceDocument>(C.DOCUMENT_VERSIONS(id), toFormData({ notes }, file)),

  // ── Submission history ──
  listSubmissions: (year: number) => drain<CdaSubmission>(C.SUBMISSIONS(year)),
  createSubmission: (year: number, data: CdaRecordInput<CdaSubmission>, proof?: File | null) =>
    api.upload<CdaSubmission>(C.SUBMISSIONS(year), toFormData(data, proof, "proof")),
  updateSubmission: (id: number, data: CdaRecordInput<CdaSubmission>) =>
    api.put<CdaSubmission>(C.SUBMISSION(id), data),

  // ── Settings ──
  getRegulatoryProfile: () => api.get<CdaRegulatoryProfile>(C.REGULATORY_PROFILE),
  updateRegulatoryProfile: (data: CdaRegulatoryProfile) =>
    api.put<CdaRegulatoryProfile>(C.REGULATORY_PROFILE, data),
  getSettings: () => api.get<CdaSettings>(C.SETTINGS),
  updateSettings: (data: CdaSettings) => api.put<CdaSettings>(C.SETTINGS, data),
  listTemplates: () => api.get<CdaTemplate[]>(C.TEMPLATES),
  createTemplate: (data: CdaTemplateInput) => api.post<CdaTemplate>(C.TEMPLATES, data),
  updateTemplate: (id: number, data: CdaTemplateInput) =>
    api.put<CdaTemplate>(C.TEMPLATE(id), data),
};
