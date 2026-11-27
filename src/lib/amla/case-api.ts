/**
 * The AMLA cases and filings API client (Phase 6, AMLA-B6). The server logs
 * every view of a case, a report and the deadlines, and every download and
 * export, so screens call the reads through `once`. Answers stay in the calling
 * component's state: nothing here feeds Linda, notifications or the command
 * palette.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { only, paged } from "@/lib/amla/api";
import type { AmlaPage } from "@/types/amla";
import type {
  AmlaCaseDecisionBody,
  AmlaCaseDetail,
  AmlaCaseRow,
  AmlaEscalateBody,
  AmlaFilingDeadline,
  AmlaReportDetail,
  AmlaReportRow,
  AmlaSubmissionBody,
} from "@/types/amla-cases";

const A = API_ENDPOINTS.AMLA;

export interface AmlaCaseFilters {
  status: string;
  search: string;
  page: number;
}

export interface AmlaReportFilters {
  /** `ctr`, `str`, or "" for both. */
  type: string;
  status: string;
  page: number;
}

export const amlaCaseApi = {
  cases: (f: AmlaCaseFilters) =>
    paged(api.getRaw<AmlaPage<AmlaCaseRow>>(A.CASES, { params: only({ status: f.status, search: f.search.trim(), page: f.page }) })),
  case: (id: number) => api.get<AmlaCaseDetail>(A.CASE(id)),
  assign: (id: number, assigneeId: number) => api.post<AmlaCaseDetail>(A.CASE_ASSIGN(id), { assignee_id: assigneeId }),
  note: (id: number, body: string) => api.post<AmlaCaseDetail>(A.CASE_NOTES(id), { body }),
  evidence: (id: number, file: File, description: string) => {
    const form = new FormData();
    form.append("file", file);
    if (description.trim() !== "") form.append("description", description.trim());
    return api.upload<{ id: number; name: string; size: number }>(A.CASE_EVIDENCE(id), form);
  },
  caseEvidence: (id: number, evidenceId: number) => api.download(A.CASE_EVIDENCE_FILE(id, evidenceId)),
  decide: (id: number, body: AmlaCaseDecisionBody) => api.post<AmlaCaseDetail>(A.CASE_DECISION(id), body),
  prepareStr: (id: number, narrative: string) => api.post<AmlaReportDetail>(A.CASE_STR(id), { narrative }),
  /** Opens a new case from the alert, or adds it to an open case about the same subject. */
  escalate: (alertId: number, body: AmlaEscalateBody) => api.post<AmlaCaseDetail>(A.ALERT_ESCALATE(alertId), body),
  prepareCtr: (candidateId: number) => api.post<AmlaReportDetail>(A.CTR_CANDIDATE_REPORT(candidateId), {}),

  reports: (f: AmlaReportFilters) =>
    paged(api.getRaw<AmlaPage<AmlaReportRow>>(A.REPORTS, { params: only({ type: f.type, status: f.status, page: f.page }) })),
  report: (id: number) => api.get<AmlaReportDetail>(A.REPORT(id)),
  approveReport: (id: number) => api.post<AmlaReportDetail>(A.REPORT_APPROVE(id), {}),
  returnReport: (id: number, reason: string) => api.post<AmlaReportDetail>(A.REPORT_RETURN(id), { reason: reason.trim() }),
  recordSubmission: (id: number, body: AmlaSubmissionBody) => {
    const form = new FormData();
    form.append("status", body.status);
    form.append("reference", body.reference);
    form.append("date", body.date);
    if (body.note !== "") form.append("note", body.note);
    form.append("evidence", body.evidence);
    return api.upload<AmlaReportDetail>(A.REPORT_SUBMISSIONS(id), form);
  },
  submissionEvidence: (id: number, submissionId: number) => api.download(A.REPORT_SUBMISSION_EVIDENCE(id, submissionId)),
  /** An internal review copy (JSON); never the GoTRACS file, and never a submission. */
  exportReport: (id: number) => api.download(A.REPORT_EXPORT(id)),
  deadlines: () => api.get<AmlaFilingDeadline[]>(A.FILING_DEADLINES),
};

/**
 * A refused download's body is a Blob, so its JSON message can't be read where
 * other errors are. This reads it back into `response.data`, so the toast shows
 * the server's words.
 */
export async function readBlobError(err: unknown): Promise<unknown> {
  const response = (err as { response?: { data?: unknown } } | null)?.response;
  const data = response?.data;
  if (!response || typeof Blob === "undefined" || !(data instanceof Blob)) return err;
  try {
    response.data = JSON.parse(await data.text());
  } catch {
    response.data = {};
  }
  return err;
}
