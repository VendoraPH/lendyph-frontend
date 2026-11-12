import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { CdaApprovalStep, CdaCalendarRow, CdaRequirement } from "@/types/cda";
import {
  REVIEW_HISTORY_LABELS,
  approveInput,
  approveNote,
  calendarRowKey,
  isRequirementRow,
  requirementForm,
  requirementMissing,
  requirementPayload,
  requirementStatusMeta,
  reviewRound,
  stepStatusMeta,
} from "./review-chain";
import { cdaErrorMessage, refusalInWords } from "./refusals";
import { labelOf } from "./labels";

function step(overrides: Partial<CdaApprovalStep>): CdaApprovalStep {
  return {
    id: 1,
    round: 1,
    step_order: 1,
    name: "Manager review",
    role: "manager",
    role_label: "Branch Manager",
    status_label: null,
    status: "pending",
    acted_by: null,
    acted_by_name: null,
    acted_at: null,
    remarks: null,
    closed: false,
    ...overrides,
  };
}

const CHAIN = [
  step({ id: 1, step_order: 1, name: "Manager review", status: "approved", acted_by: { id: 7, name: "Ana Cruz" }, acted_by_name: "Ana Cruz", acted_at: "2026-11-12T01:00:00Z" }),
  step({ id: 2, step_order: 2, name: "Board review", role: "bod1", role_label: "BOD Chairwoman", status: "pending" }),
];

function report(overrides: Partial<Parameters<typeof approveNote>[0]> = {}): Parameters<typeof approveNote>[0] {
  return {
    status: "for_review",
    available_actions: ["return"],
    submitted_for_review_by: { id: 3 },
    approval_steps: CHAIN,
    ...overrides,
  };
}

describe("review steps on a report", () => {
  test("each step status reads in words; an unknown one never shows its key", () => {
    assert.equal(stepStatusMeta("waiting").label, "Waiting");
    assert.equal(stepStatusMeta("pending").label, "Awaiting approval");
    assert.equal(stepStatusMeta("approved").label, "Approved");
    assert.equal(stepStatusMeta("returned").label, "Returned for changes");
    assert.equal(stepStatusMeta("cancelled").label, "Cancelled");
    assert.equal(stepStatusMeta("something_new").label, "Other");
  });

  test("the round names its pending step, and is closed only when every step is", () => {
    const round = reviewRound(CHAIN);
    assert.equal(round?.round, 1);
    assert.equal(round?.closed, false);
    assert.equal(round?.pending?.name, "Board review");
    assert.equal(reviewRound([]), null);
    const closed = reviewRound(CHAIN.map((s) => ({ ...s, closed: true, status: s.status === "pending" ? "cancelled" : s.status })));
    assert.equal(closed?.closed, true);
    assert.equal(closed?.pending, null);
  });

  test("the history reads an earlier step's approval in words", () => {
    assert.equal(labelOf(REVIEW_HISTORY_LABELS, "approve_step"), "Approved a review step");
    assert.equal(labelOf(REVIEW_HISTORY_LABELS, "approve"), "Approve");
  });
});

describe("Approve follows the server's available actions", () => {
  test("nothing to explain when the server offers Approve, or the user can't approve at all", () => {
    assert.equal(approveNote(report({ available_actions: ["approve", "return"] }), 9, true), null);
    assert.equal(approveNote(report(), 9, false), null);
    assert.equal(approveNote(report({ status: "draft" }), 9, true), null);
  });

  test("the submitter is told someone else approves", () => {
    assert.equal(
      approveNote(report(), 3, true),
      "You submitted this report for review, so someone else has to approve it.",
    );
    assert.equal(
      approveNote(report({ approval_steps: [] }), "3", true),
      "You submitted this report for review, so someone else has to approve it.",
    );
  });

  test("an earlier step's approver is told someone else approves this one", () => {
    assert.equal(
      approveNote(report(), 7, true),
      "You approved an earlier step of this review, so someone else has to approve this one.",
    );
  });

  test("anyone else is told whose step it is, by the role's name", () => {
    assert.equal(approveNote(report(), 9, true), "The “Board review” step is for the BOD Chairwoman role.");
  });

  test("a single review with nobody to explain to says nothing", () => {
    assert.equal(approveNote(report({ approval_steps: [] }), 9, true), null);
  });
});

describe("the approve request", () => {
  test("a chained report names the pending step it approves, with remarks when given", () => {
    const pending = CHAIN[1];
    assert.deepEqual(approveInput(pending, null), { action: "approve", step_id: 2 });
    assert.deepEqual(approveInput(pending, "Checked the figures"), { action: "approve", step_id: 2, reason: "Checked the figures" });
  });

  test("the single review sends approve alone", () => {
    assert.deepEqual(approveInput(null, null), { action: "approve" });
  });
});

describe("refusals never show a permission key", () => {
  test("a known key reads as the role editor names it", () => {
    assert.equal(
      refusalInWords("Returning this report needs the cda:review permission.", "Fallback."),
      "Returning this report needs the “CDA Compliance: Review” permission.",
    );
    assert.equal(
      refusalInWords("This needs the cda:review or cda:approve permission.", "Fallback."),
      "This needs the “CDA Compliance: Review” or “CDA Compliance: Approve” permission.",
    );
  });

  test("a key in brackets after words that already say it is dropped", () => {
    assert.equal(
      refusalInWords("CDA reports cover the whole cooperative, so they need access to every branch (branches:view_all).", "Fallback."),
      "CDA reports cover the whole cooperative, so they need access to every branch.",
    );
  });

  test("an unknown key gives way to the caller's sentence", () => {
    assert.equal(refusalInWords("This needs the reports:secret permission.", "You can't do that here."), "You can't do that here.");
  });

  test("words with no key pass as sent, times included", () => {
    const text = "You approved an earlier step of this review, so someone else has to approve this one.";
    assert.equal(refusalInWords(text, "Fallback."), text);
    assert.equal(refusalInWords("Try again at 10:30.", "Fallback."), "Try again at 10:30.");
  });

  test("a server 403 reaches the screen in words", () => {
    const err = { response: { status: 403, data: { message: "Approving a CDA report needs the cda:approve permission." } } };
    assert.equal(cdaErrorMessage(err, "Could not approve"), "Approving a CDA report needs the “CDA Compliance: Approve” permission.");
  });
});

function requirement(overrides: Partial<CdaRequirement> = {}): CdaRequirement {
  return {
    kind: "requirement",
    id: 4,
    year: 2026,
    title: "BIR annual registration",
    description: null,
    reference: "RR 8-2026",
    status: "pending",
    display_status: "pending",
    applicable: true,
    filed: false,
    filed_on: null,
    default_due_on: "2027-01-31",
    extended_due_on: null,
    effective_deadline: "2027-01-31",
    days_remaining: 80,
    created_by: { id: 1, name: "Admin" },
    updated_by: { id: 1, name: "Admin" },
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("calendar rows of both kinds", () => {
  const reportRow = { kind: "report", id: 4 } as CdaCalendarRow;

  test("a requirement row is told apart from a report row", () => {
    assert.equal(isRequirementRow(requirement()), true);
    assert.equal(isRequirementRow(reportRow), false);
  });

  test("a report and a requirement with the same id get different keys", () => {
    assert.notEqual(calendarRowKey(reportRow), calendarRowKey(requirement()));
  });

  test("a requirement's status reads in words", () => {
    assert.equal(requirementStatusMeta("pending").label, "Pending");
    assert.equal(requirementStatusMeta("filed").label, "Filed");
    assert.equal(requirementStatusMeta("not_applicable").label, "Not applicable");
    assert.equal(requirementStatusMeta("other_key").label, "Other");
  });
});

describe("the requirement dialog", () => {
  test("an edit opens with the row's values, blanks as empty text", () => {
    const form = requirementForm(requirement());
    assert.equal(form.title, "BIR annual registration");
    assert.equal(form.description, "");
    assert.equal(form.reference, "RR 8-2026");
    assert.equal(requirementForm(null).status, "pending");
  });

  test("the title, the due date and, once filed, the filing date are required", () => {
    const blank = requirementForm(null);
    assert.deepEqual(requirementMissing(blank), ["Title", "Due date"]);
    assert.deepEqual(requirementMissing({ ...blank, title: "X", default_due_on: "2027-01-31", status: "filed" }), ["Date filed"]);
  });

  test("the payload trims text, sends blanks as null, and a filing date only when filed", () => {
    const form = {
      ...requirementForm(null),
      title: "  Annual BIR filing ",
      description: "   ",
      default_due_on: "2027-01-31",
      extended_due_on: "",
      reference: " RMC 1 ",
      status: "pending" as const,
      filed_on: "2026-11-01",
    };
    assert.deepEqual(requirementPayload(form), {
      title: "Annual BIR filing",
      description: null,
      default_due_on: "2027-01-31",
      extended_due_on: null,
      reference: "RMC 1",
      status: "pending",
      filed_on: null,
    });
    assert.equal(requirementPayload({ ...form, status: "filed" }).filed_on, "2026-11-01");
  });
});
