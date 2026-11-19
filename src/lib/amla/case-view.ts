import { formatDate, formatDateTime } from "@/lib/format";
import { DOCUMENT_EXTENSIONS } from "@/lib/file-validation";
import { NO_BRANCH, type AmlaBadgeTone } from "@/lib/amla/cdd-view";
import type { AmlaOption } from "@/lib/amla/settings-view";
import type {
  AmlaCaseDecisionBody,
  AmlaCaseRow,
  AmlaEscalateBody,
  AmlaFilingDeadline,
  AmlaFilingStepStatus,
  AmlaReportRow,
  AmlaSubmissionBody,
} from "@/types/amla-cases";

/**
 * AMLA cases and filings in words (Phase 6, AMLA-B6). The server decides every
 * status, deadline and step; these helpers only word what it sends, and check
 * the forms for what is plainly wrong before the server decides.
 */

type Result<T> = { body: T } | { error: string };

const DASH = "—";

/** `AmlaCase::STATUS_WORDS`. */
export const AMLA_CASE_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "str_required", label: "Suspicion established: STR to file" },
  { value: "closed_no_report", label: "Closed: no STR, with a documented reason" },
  { value: "closed_str_filed", label: "Closed: STR filed" },
];

/** `AmlaReport::STATUS_WORDS`. */
export const AMLA_REPORT_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "pending_approval", label: "Waiting for approval" },
  { value: "returned", label: "Returned to the preparer" },
  { value: "approved", label: "Approved, ready for filing" },
  { value: "submitted", label: "Submitted on the AMLC portal" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected by the reporting facility" },
  { value: "correction_required", label: "Correction required" },
];

export const AMLA_FILING_STEP_WORDS: Readonly<Record<AmlaFilingStepStatus, string>> = {
  submitted: "Submitted on the AMLC portal",
  accepted: "Accepted",
  rejected: "Rejected by the reporting facility",
  correction_required: "Correction required",
};

const CASE_TONES: Readonly<Record<string, AmlaBadgeTone>> = {
  open: "secondary",
  investigating: "secondary",
  str_required: "destructive",
  closed_no_report: "outline",
  closed_str_filed: "outline",
};

const REPORT_TONES: Readonly<Record<string, AmlaBadgeTone>> = {
  pending_approval: "secondary",
  returned: "outline",
  approved: "default",
  submitted: "default",
  accepted: "outline",
  rejected: "destructive",
  correction_required: "destructive",
};

function tone(map: Readonly<Record<string, AmlaBadgeTone>>, status: string): AmlaBadgeTone {
  return Object.hasOwn(map, status) ? map[status] : "outline";
}

export function amlaCaseStatusTone(status: string): AmlaBadgeTone {
  return tone(CASE_TONES, status);
}

export function amlaReportStatusTone(status: string): AmlaBadgeTone {
  return tone(REPORT_TONES, status);
}

/** Multi-branch decision 6: no branch reads "Organisation-wide". */
function branchWords(branch: { id: number | null; name: string }): string {
  return branch.id === null ? NO_BRANCH : branch.name;
}

const when = (value: string | null) => (value ? formatDateTime(value) : DASH);

export function amlaCaseRow(row: AmlaCaseRow) {
  return {
    id: row.id,
    href: `/amla/cases/${row.id}`,
    reference: row.reference,
    title: row.title,
    status: row.status_words,
    tone: amlaCaseStatusTone(row.status),
    subject: row.subject.name,
    code: row.subject.code,
    branch: branchWords(row.branch),
    assignee: row.assigned_to?.name ?? "Not assigned",
    openedBy: row.opened_by?.name ?? "System",
    opened: when(row.opened_at),
    closed: when(row.closed_at),
  };
}

/** What a list shows of a report: never its fields or an STR's narrative, which show on its own page only. */
export function amlaReportRow(row: AmlaReportRow) {
  const dueNotes: string[] = [];
  if (row.due_provisional) dueNotes.push("Provisional: the calendar for that year isn't confirmed");
  if (row.due_to_verify) dueNotes.push("Deadline rule still to verify");
  return {
    id: row.id,
    href: `/amla/filings/${row.id}`,
    reference: row.reference,
    type: row.type_words,
    status: row.status_words,
    tone: amlaReportStatusTone(row.status),
    subject: row.subject.name,
    code: row.subject.code,
    due: formatDate(row.due_on),
    dueNotes,
    preparedBy: row.prepared_by?.name ?? DASH,
    approvedBy: row.approved_by?.name ?? "Not yet",
    submitted: row.submitted_on ? formatDate(row.submitted_on) : DASH,
    submissionReference: row.submission_reference ?? DASH,
  };
}

/** A report's own facts, label and value, for its page. */
export function amlaReportFacts(report: AmlaReportRow): [string, string][] {
  const row = amlaReportRow(report);
  return [
    ["Type", row.type],
    ["About", `${row.subject} · ${row.code}`],
    ["Deadline counted from", formatDate(report.deadline_from)],
    ["Due", row.due],
    ["Format", report.format.name],
    ["Prepared by", `${row.preparedBy}${report.prepared_at ? `, ${formatDateTime(report.prepared_at)}` : ""}`],
    ["Approved by", row.approvedBy],
    ["Submitted", row.submitted],
    ["Submission reference", row.submissionReference],
  ];
}

const STANDING: Readonly<Record<string, { words: string; tone: AmlaBadgeTone }>> = {
  overdue: { words: "Overdue", tone: "destructive" },
  due_today: { words: "Due today", tone: "destructive" },
  upcoming: { words: "Due soon", tone: "secondary" },
};

const DEADLINE_WHAT: Readonly<Record<string, string>> = {
  report: "Report to file",
  ctr_candidate: "CTR to prepare",
  case: "STR to prepare",
};

/** A filing still to make, its deadline state in words, and where the caller can open it. */
export function amlaDeadlineRow(row: AmlaFilingDeadline, open: { cases: boolean; ctr: boolean }) {
  const standing = row.standing !== null && Object.hasOwn(STANDING, row.standing) ? STANDING[row.standing] : null;
  let href: string | null = null;
  if (row.kind === "report") href = `/amla/filings/${row.id}`;
  if (row.kind === "ctr_candidate" && open.ctr) href = `/amla/ctr-candidates/${row.id}`;
  if (row.kind === "case" && open.cases) href = `/amla/cases/${row.id}`;
  return {
    key: `${row.kind}:${row.id}`,
    reference: row.reference,
    what: Object.hasOwn(DEADLINE_WHAT, row.kind) ? DEADLINE_WHAT[row.kind] : "Filing",
    status: row.status_words,
    due: row.provisional ? `${row.due_words} (provisional)` : row.due_words,
    standing: standing?.words ?? "Not due yet",
    tone: standing?.tone ?? ("outline" as AmlaBadgeTone),
    href,
  };
}

function text(value: string, max: number, missing: string, tooLong: string): Result<string> {
  const trimmed = value.trim();
  if (trimmed === "") return { error: missing };
  if (trimmed.length > max) return { error: tooLong };
  return { body: trimmed };
}

export interface AmlaDecisionForm {
  decision: "" | "str" | "no_str";
  reason: string;
  date: string;
}

export function amlaDecisionBody(form: AmlaDecisionForm, today: string): Result<AmlaCaseDecisionBody> {
  if (form.decision !== "str" && form.decision !== "no_str") return { error: "Pick no STR or suspicion established." };
  const reason = text(form.reason, 5000, "Give the reason for the decision.", "Keep the reason to 5,000 characters.");
  if ("error" in reason) return reason;
  if (form.decision === "no_str") return { body: { decision: "no_str", reason: reason.body } };
  if (form.date === "") return { error: "Give the date suspicion was established." };
  if (form.date > today) return { error: "The determination date can't be after today." };
  return { body: { decision: "str", reason: reason.body, determination_date: form.date } };
}

export function amlaStrBody(narrative: string): Result<string> {
  return text(narrative, 20000, "Write the narrative.", "Keep the narrative to 20,000 characters.");
}

export function amlaNoteBody(body: string): Result<string> {
  return text(body, 10000, "Write the note.", "Keep the note to 10,000 characters.");
}

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

/** The server's evidence rule by the file's name and size; it also checks the contents. */
export function amlaEvidenceProblem(file: Pick<File, "name" | "size">): string | null {
  const lower = file.name.toLowerCase();
  if (!DOCUMENT_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return "The file must be a picture (JPG or PNG), a PDF or a Word document.";
  }
  if (file.size > EVIDENCE_MAX_BYTES) return "The file can be at most 10 MB.";
  return null;
}

export interface AmlaSubmissionForm {
  status: string;
  reference: string;
  date: string;
  note: string;
  evidence: File | null;
}

export function amlaSubmissionBody(form: AmlaSubmissionForm, allowed: readonly AmlaFilingStepStatus[], today: string): Result<AmlaSubmissionBody> {
  const status = allowed.find((step) => step === form.status);
  if (status === undefined) return { error: "Pick the step to record." };
  const reference = text(form.reference, 100, "Give the reference the AMLC portal gave.", "Keep the reference to 100 characters.");
  if ("error" in reference) return reference;
  if (form.date === "") return { error: "Give the date of this step." };
  if (form.date > today) return { error: "The date can't be after today." };
  if (form.note.trim().length > 2000) return { error: "Keep the note to 2,000 characters." };
  if (form.evidence === null) return { error: "Upload the acknowledgement or response as evidence." };
  const problem = amlaEvidenceProblem(form.evidence);
  if (problem) return { error: problem };
  return { body: { status, reference: reference.body, date: form.date, note: form.note.trim(), evidence: form.evidence } };
}

export interface AmlaEscalateForm {
  mode: "new" | "existing";
  title: string;
  caseId: number | null;
  note: string;
}

/** A new case (its title optional), or an open case about the same subject, which the server checks. */
export function amlaEscalateBody(form: AmlaEscalateForm): Result<AmlaEscalateBody> {
  const body: AmlaEscalateBody = {};
  if (form.mode === "existing") {
    if (form.caseId === null) return { error: "Pick the open case to add the alert to." };
    body.case_id = form.caseId;
  } else if (form.title.trim() !== "") {
    if (form.title.trim().length > 200) return { error: "Keep the title to 200 characters." };
    body.title = form.title.trim();
  }
  if (form.note.trim().length > 2000) return { error: "Keep the note to 2,000 characters." };
  if (form.note.trim() !== "") body.note = form.note.trim();
  return { body };
}
