/**
 * AMLA cases and filings, as lendyph-backend's `AmlaCasePresenter` sends them
 * (Phase 6, AMLA-B6). Every status has its words beside it, money arrives in
 * ₱ words, and a value Lendy doesn't hold reads "Data not available". Notes,
 * reasons and an STR's narrative are decrypted by the server for AMLA screens
 * only; they are never kept outside the component showing them.
 */
import type { AmlaUserRef } from "./amla";
import type { AmlaAlertRow, AmlaMonitoringBranch } from "./amla-monitoring";

export type AmlaCaseStatus = "open" | "investigating" | "str_required" | "closed_no_report" | "closed_str_filed";

/** Who a case or report is about: name and code only. */
export interface AmlaCaseSubject {
  type: "member" | "walk_in" | null;
  id: number | null;
  name: string;
  code: string;
}

export interface AmlaCaseRow {
  id: number;
  reference: string;
  title: string;
  status: AmlaCaseStatus | string;
  status_words: string;
  subject: AmlaCaseSubject;
  branch: AmlaMonitoringBranch;
  assigned_to: AmlaUserRef | null;
  opened_by: AmlaUserRef | null;
  decision: "str" | "no_str" | null;
  determination_date: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

export interface AmlaCaseNote {
  id: number;
  body: string;
  by: AmlaUserRef | null;
  at: string | null;
}

export interface AmlaCaseEvidence {
  id: number;
  name: string;
  description: string | null;
  size: number;
  by: AmlaUserRef | null;
  at: string | null;
}

export interface AmlaCaseHistoryStep {
  action: string;
  action_words: string;
  by: AmlaUserRef | null;
  at: string | null;
}

/** A report prepared from the case: its words only (the case sends no status key). */
export interface AmlaCaseReportRef {
  id: number;
  reference: string;
  status_words: string;
}

export interface AmlaCaseDetail extends AmlaCaseRow {
  decision_words: string | null;
  decision_reason: string | null;
  decided_by: AmlaUserRef | null;
  alerts: AmlaAlertRow[];
  notes: AmlaCaseNote[];
  evidence: AmlaCaseEvidence[];
  history: AmlaCaseHistoryStep[];
  reports: AmlaCaseReportRef[];
}

export type AmlaReportType = "ctr" | "str";

export type AmlaReportStatus =
  | "pending_approval"
  | "returned"
  | "approved"
  | "submitted"
  | "accepted"
  | "rejected"
  | "correction_required";

/** A filing step recorded by hand (the AMLC portal's answer). */
export type AmlaFilingStepStatus = "submitted" | "accepted" | "rejected" | "correction_required";

export interface AmlaReportRow {
  id: number;
  reference: string;
  type: AmlaReportType;
  type_words: string;
  status: AmlaReportStatus | string;
  status_words: string;
  subject: AmlaCaseSubject;
  deadline_from: string;
  due_on: string;
  due_provisional: boolean;
  due_to_verify: boolean;
  format: { code: string; name: string; file_available: boolean };
  prepared_by: AmlaUserRef | null;
  approved_by: AmlaUserRef | null;
  submission_reference: string | null;
  submitted_on: string | null;
  prepared_at: string | null;
}

export interface AmlaReportField {
  label: string;
  value: string;
}

export interface AmlaReportSubmission {
  id: number;
  status: AmlaFilingStepStatus | string;
  status_words: string;
  reference: string;
  date: string;
  note: string | null;
  evidence_name: string;
  by: AmlaUserRef | null;
  at: string | null;
}

export interface AmlaReportDetail extends AmlaReportRow {
  fields: AmlaReportField[];
  /** An STR's narrative; null on a CTR. */
  narrative: string | null;
  returned_reason: string | null;
  ctr_candidate_id: number | null;
  case_id: number | null;
  submissions: AmlaReportSubmission[];
}

export type AmlaDeadlineKind = "report" | "ctr_candidate" | "case";
export type AmlaDeadlineStanding = "overdue" | "due_today" | "upcoming";

/** `GET /amla/filing-deadlines`: a filing still to make. */
export interface AmlaFilingDeadline {
  kind: AmlaDeadlineKind | string;
  id: number;
  reference: string;
  status_words: string;
  due_on: string;
  due_words: string;
  provisional: boolean;
  standing: AmlaDeadlineStanding | null;
}

export interface AmlaCaseDecisionBody {
  decision: "str" | "no_str";
  reason: string;
  determination_date?: string;
}

export interface AmlaEscalateBody {
  case_id?: number;
  title?: string;
  note?: string;
}

export interface AmlaSubmissionBody {
  status: AmlaFilingStepStatus;
  reference: string;
  date: string;
  note: string;
  evidence: File;
}
