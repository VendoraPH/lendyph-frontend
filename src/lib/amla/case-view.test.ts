import { test } from "node:test";
import assert from "node:assert/strict";
import type { AmlaCaseRow, AmlaFilingDeadline, AmlaReportDetail } from "@/types/amla-cases";
import {
  AMLA_CASE_STATUS_OPTIONS,
  AMLA_FILING_STEP_WORDS,
  AMLA_REPORT_STATUS_OPTIONS,
  amlaCaseRow,
  amlaDecisionBody,
  amlaDeadlineRow,
  amlaEscalateBody,
  amlaEvidenceProblem,
  amlaNoteBody,
  amlaReportFacts,
  amlaReportRow,
  amlaStrBody,
  amlaSubmissionBody,
} from "./case-view";

const caseRow = (over: Partial<AmlaCaseRow> = {}): AmlaCaseRow => ({
  id: 4,
  reference: "CASE-0004",
  title: "Cash in and out",
  status: "investigating",
  status_words: "Investigating",
  subject: { type: "member", id: 7, name: "Ana Cruz", code: "BRW-7" },
  branch: { id: 1, name: "Main" },
  assigned_to: null,
  opened_by: { id: 1, name: "Opener" },
  decision: null,
  determination_date: null,
  opened_at: "2026-11-19T01:00:00Z",
  closed_at: null,
  ...over,
});

test("case and report statuses read in the server's words", () => {
  assert.deepEqual(
    AMLA_CASE_STATUS_OPTIONS.map((o) => o.value),
    ["open", "investigating", "str_required", "closed_no_report", "closed_str_filed"],
  );
  assert.equal(AMLA_CASE_STATUS_OPTIONS.find((o) => o.value === "str_required")?.label, "Suspicion established: STR to file");
  assert.equal(AMLA_REPORT_STATUS_OPTIONS.find((o) => o.value === "approved")?.label, "Approved, ready for filing");
  assert.equal(AMLA_FILING_STEP_WORDS.correction_required, "Correction required");
});

test("a case row reads its status in words, its assignee, and no branch as organisation-wide", () => {
  const row = amlaCaseRow(caseRow());
  assert.equal(row.href, "/amla/cases/4");
  assert.equal(row.status, "Investigating");
  assert.equal(row.assignee, "Not assigned");
  assert.equal(row.branch, "Main");
  assert.equal(amlaCaseRow(caseRow({ branch: { id: null, name: "Head office" } })).branch, "Organisation-wide");
  assert.equal(amlaCaseRow(caseRow({ assigned_to: { id: 2, name: "Inv" } })).assignee, "Inv");
});

const report = (over: Partial<AmlaReportDetail> = {}): AmlaReportDetail => ({
  id: 3,
  reference: "RPT-STR-0003",
  type: "str",
  type_words: "Suspicious transaction report (STR)",
  status: "pending_approval",
  status_words: "Waiting for approval",
  subject: { type: "member", id: 7, name: "Ana Cruz", code: "BRW-7" },
  deadline_from: "2026-11-18",
  due_on: "2026-11-19",
  due_provisional: true,
  due_to_verify: true,
  format: { code: "internal_v1", name: "Internal review copy", file_available: false },
  prepared_by: { id: 5, name: "Preparer" },
  approved_by: null,
  submission_reference: null,
  submitted_on: null,
  prepared_at: "2026-11-18T03:00:00Z",
  fields: [{ label: "Reason for suspicion", value: "Layering" }],
  narrative: "Secret narrative text",
  returned_reason: null,
  ctr_candidate_id: null,
  case_id: 4,
  submissions: [],
  ...over,
});

test("a report row never carries the narrative or the fields, even when handed a whole report", () => {
  const row = amlaReportRow(report());
  assert.equal("narrative" in row, false);
  assert.equal("fields" in row, false);
  assert.doesNotMatch(JSON.stringify(row), /Secret narrative/);
  assert.doesNotMatch(JSON.stringify(row), /Layering/);
});

test("a report row reads its due date with its provisional and to-verify notes, and dashes for what isn't filed", () => {
  const row = amlaReportRow(report());
  assert.equal(row.href, "/amla/filings/3");
  assert.equal(row.status, "Waiting for approval");
  assert.match(row.due, /Nov 19, 2026/);
  assert.deepEqual(row.dueNotes, ["Provisional: the calendar for that year isn't confirmed", "Deadline rule still to verify"]);
  assert.equal(row.submitted, "—");
  assert.equal(row.submissionReference, "—");
  assert.equal(row.preparedBy, "Preparer");
  const filed = amlaReportRow(report({ submitted_on: "2026-11-19", submission_reference: "AMLC-1", due_provisional: false, due_to_verify: false }));
  assert.match(filed.submitted, /Nov 19, 2026/);
  assert.equal(filed.submissionReference, "AMLC-1");
  assert.deepEqual(filed.dueNotes, []);
});

test("report facts name the format, and say an export is an internal review copy when no file adapter exists", () => {
  const facts = amlaReportFacts(report());
  assert.ok(facts.some(([label, value]) => label === "Format" && value === "Internal review copy"));
  assert.ok(facts.some(([label]) => label === "Prepared by"));
  assert.equal(facts.find(([label]) => label === "Approved by")?.[1], "Not yet");
});

const deadline = (over: Partial<AmlaFilingDeadline> = {}): AmlaFilingDeadline => ({
  kind: "report",
  id: 3,
  reference: "RPT-CTR-0003",
  status_words: "Approved, ready for filing",
  due_on: "2026-11-20",
  due_words: "Nov 20, 2026",
  provisional: false,
  standing: "upcoming",
  ...over,
});

test("the server's deadline states read in words, with a tone each", () => {
  const all = { cases: true, ctr: true };
  assert.equal(amlaDeadlineRow(deadline({ standing: "overdue" }), all).standing, "Overdue");
  assert.equal(amlaDeadlineRow(deadline({ standing: "overdue" }), all).tone, "destructive");
  assert.equal(amlaDeadlineRow(deadline({ standing: "due_today" }), all).standing, "Due today");
  assert.equal(amlaDeadlineRow(deadline({ standing: "upcoming" }), all).standing, "Due soon");
  assert.equal(amlaDeadlineRow(deadline({ standing: null }), all).standing, "Not due yet");
  assert.equal(amlaDeadlineRow(deadline({ provisional: true }), all).due, "Nov 20, 2026 (provisional)");
});

test("each deadline links where the caller can open it, and says what is still to file", () => {
  const all = { cases: true, ctr: true };
  assert.equal(amlaDeadlineRow(deadline(), all).href, "/amla/filings/3");
  assert.equal(amlaDeadlineRow(deadline(), all).what, "Report to file");
  const candidate = deadline({ kind: "ctr_candidate", id: 8, reference: "CTR-0008" });
  assert.equal(amlaDeadlineRow(candidate, all).href, "/amla/ctr-candidates/8");
  assert.equal(amlaDeadlineRow(candidate, all).what, "CTR to prepare");
  assert.equal(amlaDeadlineRow(candidate, { cases: true, ctr: false }).href, null);
  const caseDue = deadline({ kind: "case", id: 4, reference: "CASE-0004" });
  assert.equal(amlaDeadlineRow(caseDue, all).href, "/amla/cases/4");
  assert.equal(amlaDeadlineRow(caseDue, all).what, "STR to prepare");
  assert.equal(amlaDeadlineRow(caseDue, { cases: false, ctr: true }).href, null);
});

test("a decision needs a choice and a reason; suspicion established needs a determination date not after today", () => {
  const today = "2026-11-19";
  assert.deepEqual(amlaDecisionBody({ decision: "", reason: "x", date: "" }, today), { error: "Pick no STR or suspicion established." });
  assert.deepEqual(amlaDecisionBody({ decision: "no_str", reason: " ", date: "" }, today), { error: "Give the reason for the decision." });
  assert.deepEqual(amlaDecisionBody({ decision: "no_str", reason: " Ordinary salary ", date: "2026-11-01" }, today), {
    body: { decision: "no_str", reason: "Ordinary salary" },
  });
  assert.deepEqual(amlaDecisionBody({ decision: "str", reason: "Layering", date: "" }, today), { error: "Give the date suspicion was established." });
  assert.deepEqual(amlaDecisionBody({ decision: "str", reason: "Layering", date: "2026-11-20" }, today), {
    error: "The determination date can't be after today.",
  });
  assert.deepEqual(amlaDecisionBody({ decision: "str", reason: "Layering", date: "2026-11-19" }, today), {
    body: { decision: "str", reason: "Layering", determination_date: "2026-11-19" },
  });
  assert.ok("error" in amlaDecisionBody({ decision: "no_str", reason: "x".repeat(5001), date: "" }, today));
});

test("a narrative and a note are required and kept within the server's limits", () => {
  assert.deepEqual(amlaStrBody("  "), { error: "Write the narrative." });
  assert.deepEqual(amlaStrBody(" What happened "), { body: "What happened" });
  assert.ok("error" in amlaStrBody("x".repeat(20001)));
  assert.deepEqual(amlaNoteBody(""), { error: "Write the note." });
  assert.deepEqual(amlaNoteBody(" Called the member "), { body: "Called the member" });
  assert.ok("error" in amlaNoteBody("x".repeat(10001)));
});

const file = (name: string, size = 1000) => ({ name, size }) as File;

test("evidence is a picture, PDF or Word document up to 10 MB, judged by its name before the server checks its contents", () => {
  assert.equal(amlaEvidenceProblem(file("slip.PDF")), null);
  assert.equal(amlaEvidenceProblem(file("photo.jfif")), null);
  assert.match(amlaEvidenceProblem(file("run.exe")) ?? "", /picture \(JPG or PNG\), a PDF or a Word document/);
  assert.match(amlaEvidenceProblem(file("big.pdf", 10 * 1024 * 1024 + 1)) ?? "", /at most 10 MB/);
});

test("a filing step needs one of the allowed steps, the portal's reference, a date not after today and evidence", () => {
  const today = "2026-11-19";
  const evidence = file("ack.pdf");
  const form = { status: "submitted", reference: " AMLC-77 ", date: "2026-11-19", note: "", evidence };
  assert.deepEqual(amlaSubmissionBody({ ...form, status: "" }, ["submitted"], today), { error: "Pick the step to record." });
  assert.deepEqual(amlaSubmissionBody({ ...form, status: "accepted" }, ["submitted"], today), { error: "Pick the step to record." });
  assert.deepEqual(amlaSubmissionBody({ ...form, reference: "" }, ["submitted"], today), { error: "Give the reference the AMLC portal gave." });
  assert.deepEqual(amlaSubmissionBody({ ...form, date: "2026-11-20" }, ["submitted"], today), { error: "The date can't be after today." });
  assert.deepEqual(amlaSubmissionBody({ ...form, evidence: null }, ["submitted"], today), {
    error: "Upload the acknowledgement or response as evidence.",
  });
  assert.deepEqual(amlaSubmissionBody(form, ["submitted"], today), {
    body: { status: "submitted", reference: "AMLC-77", date: "2026-11-19", note: "", evidence },
  });
});

test("an alert opens a new case, its title optional, or joins an open case picked by the user", () => {
  assert.deepEqual(amlaEscalateBody({ mode: "new", title: "  ", caseId: null, note: "" }), { body: {} });
  assert.deepEqual(amlaEscalateBody({ mode: "new", title: " Layering ", caseId: null, note: " see txns " }), {
    body: { title: "Layering", note: "see txns" },
  });
  assert.deepEqual(amlaEscalateBody({ mode: "existing", title: "", caseId: null, note: "" }), { error: "Pick the open case to add the alert to." });
  assert.deepEqual(amlaEscalateBody({ mode: "existing", title: "ignored", caseId: 4, note: "" }), { body: { case_id: 4 } });
});
