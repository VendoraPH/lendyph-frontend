import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import type { AmlaCaseDetail, AmlaReportDetail } from "@/types/amla-cases";
import {
  AMLA_CTR_READ,
  AMLA_REPORT_READ,
  AMLA_STR_READ,
  amlaCaseAccess,
  amlaCaseActions,
  amlaReportActions,
} from "./case-access";

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const HEAD = ["amla:view", "branches:view_all"];

test("the reading keys are the server's: CTRs and STRs each take their own key or approve, submit or export", () => {
  assert.deepEqual([...AMLA_CTR_READ], ["amla:ctr", "amla:approve", "amla:submit", "amla:export"]);
  assert.deepEqual([...AMLA_STR_READ], ["amla:str", "amla:approve", "amla:submit", "amla:export"]);
  assert.deepEqual([...AMLA_REPORT_READ], ["amla:ctr", "amla:str", "amla:approve", "amla:submit", "amla:export"]);
});

test("Compliance Cases needs amla:cases with every branch, under the /amla guard's amla:view", () => {
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:cases")).cases, true);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:cases")).cases, false);
  assert.equal(amlaCaseAccess(holds("branches:view_all", "amla:cases")).cases, false);
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:alerts")).cases, false);
});

test("STRs need an STR reading key with every branch; CTRs a CTR reading key in the caller's branches", () => {
  for (const key of AMLA_STR_READ) {
    assert.equal(amlaCaseAccess(holds(...HEAD, key)).strFilings, true, key);
    assert.equal(amlaCaseAccess(holds("amla:view", key)).strFilings, false, key);
  }
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:ctr")).strFilings, false);
  for (const key of AMLA_CTR_READ) assert.equal(amlaCaseAccess(holds("amla:view", key)).ctrFilings, true, key);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:str")).ctrFilings, false);
});

test("Regulatory Submissions opens on any reporting key; Audit & Compliance History needs amla:audit with every branch", () => {
  for (const key of AMLA_REPORT_READ) assert.equal(amlaCaseAccess(holds("amla:view", key)).submissions, true, key);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:cases")).submissions, false);
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:audit")).history, true);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:audit")).history, false);
});

test("opening a case from an alert needs amla:alerts and amla:cases with every branch; a CTR needs amla:ctr", () => {
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:alerts", "amla:cases")).escalate, true);
  assert.equal(amlaCaseAccess(holds(...HEAD, "amla:alerts")).escalate, false);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:alerts", "amla:cases")).escalate, false);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:ctr")).prepareCtr, true);
  assert.equal(amlaCaseAccess(holds("amla:view", "amla:approve")).prepareCtr, false);
});

const caseOf = (over: Partial<AmlaCaseDetail> = {}): AmlaCaseDetail => ({
  id: 4,
  reference: "CASE-0004",
  title: "Cash in and out",
  status: "investigating",
  status_words: "Investigating",
  subject: { type: "member", id: 7, name: "Ana Cruz", code: "BRW-7" },
  branch: { id: 1, name: "Main" },
  assigned_to: { id: 2, name: "Inv" },
  opened_by: { id: 1, name: "Opener" },
  decision: null,
  determination_date: null,
  opened_at: "2026-11-19T01:00:00Z",
  closed_at: null,
  decision_words: null,
  decision_reason: null,
  decided_by: null,
  alerts: [],
  notes: [],
  evidence: [],
  history: [],
  reports: [],
  ...over,
});

const CASES = [...HEAD, "amla:cases"];

test("an active case takes notes, evidence and an assignment; a decided one takes nothing", () => {
  const open = amlaCaseActions(caseOf(), 9, holds(...CASES));
  assert.equal(open.note, true);
  assert.equal(open.evidence, true);
  assert.equal(open.assignToMe, true);
  assert.equal(amlaCaseActions(caseOf(), 2, holds(...CASES)).assignToMe, false, "already mine");
  const decided = amlaCaseActions(caseOf({ status: "str_required" }), 9, holds(...CASES, "amla:approve", "amla:str"));
  assert.equal(decided.note, false);
  assert.equal(decided.evidence, false);
  assert.equal(decided.assignToMe, false);
  assert.equal(decided.decide, false);
});

test("deciding needs amla:approve, and no STR is never offered to the case's opener or assignee", () => {
  assert.equal(amlaCaseActions(caseOf(), 9, holds(...CASES)).decide, false);
  const other = amlaCaseActions(caseOf(), 9, holds(...CASES, "amla:approve"));
  assert.equal(other.decide, true);
  assert.equal(other.decideNoStr, true);
  for (const own of [1, 2]) {
    const mine = amlaCaseActions(caseOf(), own, holds(...CASES, "amla:approve"));
    assert.equal(mine.decide, true, "suspicion established stays open to them");
    assert.equal(mine.decideNoStr, false, `user ${own}`);
  }
});

test("an STR is prepared once suspicion is established, with amla:str, unless one is already standing", () => {
  const due = caseOf({ status: "str_required", decision: "str" });
  assert.equal(amlaCaseActions(due, 9, holds(...CASES, "amla:str")).prepareStr, true);
  assert.equal(amlaCaseActions(due, 9, holds(...CASES)).prepareStr, false);
  assert.equal(amlaCaseActions(caseOf(), 9, holds(...CASES, "amla:str")).prepareStr, false);
  const standing = caseOf({ status: "str_required", reports: [{ id: 3, reference: "RPT-STR-0003", status_words: "Waiting for approval" }] });
  assert.equal(amlaCaseActions(standing, 9, holds(...CASES, "amla:str")).prepareStr, false);
  const returned = caseOf({ status: "str_required", reports: [{ id: 3, reference: "RPT-STR-0003", status_words: "Returned to the preparer" }] });
  assert.equal(amlaCaseActions(returned, 9, holds(...CASES, "amla:str")).prepareStr, true);
});

test("with no signed-in user, nothing that depends on who you are is offered", () => {
  const none = amlaCaseActions(caseOf(), null, holds(...CASES, "amla:approve"));
  assert.equal(none.assignToMe, false);
  assert.equal(none.decideNoStr, false);
});

const reportOf = (over: Partial<AmlaReportDetail> = {}): AmlaReportDetail => ({
  id: 3,
  reference: "RPT-STR-0003",
  type: "str",
  type_words: "Suspicious transaction report (STR)",
  status: "pending_approval",
  status_words: "Waiting for approval",
  subject: { type: "member", id: 7, name: "Ana Cruz", code: "BRW-7" },
  deadline_from: "2026-11-18",
  due_on: "2026-11-19",
  due_provisional: false,
  due_to_verify: true,
  format: { code: "internal_v1", name: "Internal", file_available: false },
  prepared_by: { id: 5, name: "Preparer" },
  approved_by: null,
  submission_reference: null,
  submitted_on: null,
  prepared_at: "2026-11-18T03:00:00Z",
  fields: [],
  narrative: "The narrative.",
  returned_reason: null,
  ctr_candidate_id: null,
  case_id: 4,
  submissions: [],
  ...over,
});

test("the preparer gets no Approve and no Return, super_admin included; another approver gets both", () => {
  const all = holds(...HEAD, "amla:approve", "amla:str", "amla:submit", "amla:export");
  const preparer = amlaReportActions(reportOf(), 5, all);
  assert.equal(preparer.approve, false);
  assert.equal(preparer.return, false);
  const other = amlaReportActions(reportOf(), 6, all);
  assert.equal(other.approve, true);
  assert.equal(other.return, true);
  assert.equal(amlaReportActions(reportOf(), 6, holds(...HEAD, "amla:str")).approve, false);
  assert.equal(amlaReportActions(reportOf(), null, all).approve, false);
  assert.equal(amlaReportActions(reportOf({ status: "approved" }), 6, all).approve, false);
});

test("an STR's steps need every branch; a CTR's follow its branch", () => {
  const branchApprover = holds("amla:view", "amla:approve", "amla:submit", "amla:export");
  assert.equal(amlaReportActions(reportOf(), 6, branchApprover).approve, false);
  assert.equal(amlaReportActions(reportOf({ type: "ctr", narrative: null }), 6, branchApprover).approve, true);
  assert.equal(amlaReportActions(reportOf({ status: "approved" }), 6, branchApprover).export, false);
  assert.equal(amlaReportActions(reportOf({ type: "ctr", status: "approved" }), 6, branchApprover).export, true);
});

test("filing steps follow the server's order and need amla:submit", () => {
  const submit = holds(...HEAD, "amla:submit");
  assert.deepEqual(amlaReportActions(reportOf({ status: "pending_approval" }), 6, submit).record, []);
  assert.deepEqual(amlaReportActions(reportOf({ status: "approved" }), 6, submit).record, ["submitted"]);
  assert.deepEqual(amlaReportActions(reportOf({ status: "submitted" }), 6, submit).record, ["accepted", "rejected", "correction_required"]);
  assert.deepEqual(amlaReportActions(reportOf({ status: "rejected" }), 6, submit).record, ["submitted"]);
  assert.deepEqual(amlaReportActions(reportOf({ status: "correction_required" }), 6, submit).record, ["submitted"]);
  assert.deepEqual(amlaReportActions(reportOf({ status: "accepted" }), 6, submit).record, []);
  assert.deepEqual(amlaReportActions(reportOf({ status: "returned" }), 6, submit).record, []);
  assert.deepEqual(amlaReportActions(reportOf({ status: "approved" }), 6, holds(...HEAD, "amla:approve")).record, []);
});

test("the narrative shows only on an STR, to an STR reading key with every branch", () => {
  assert.equal(amlaReportActions(reportOf(), 6, holds(...HEAD, "amla:str")).narrative, true);
  assert.equal(amlaReportActions(reportOf(), 6, holds(...HEAD, "amla:approve")).narrative, true);
  assert.equal(amlaReportActions(reportOf(), 6, holds(...HEAD, "amla:ctr")).narrative, false);
  assert.equal(amlaReportActions(reportOf(), 6, holds("amla:view", "amla:str")).narrative, false);
  assert.equal(amlaReportActions(reportOf({ type: "ctr", narrative: null }), 6, holds(...HEAD, "amla:ctr")).narrative, false);
});
