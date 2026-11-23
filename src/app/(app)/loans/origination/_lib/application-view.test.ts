import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INFORMATION_STATUSES,
  applicationActions,
  linkMemberBlocker,
  missingFieldLabel,
  transitionNeedsNote,
  transitionPayload,
} from "./application-view";
import type { ApplicationStatus } from "@/types/loan-origination";
import type { Permission } from "@/types";

const app = (status: ApplicationStatus, extra: { loan_id?: number | null; allowed_transitions?: ApplicationStatus[] } = {}) => ({
  status,
  loan_id: extra.loan_id ?? null,
  allowed_transitions: extra.allowed_transitions ?? [],
});

test("once the hand-off set loan_id, the page offers Open loan and no status actions", () => {
  for (const status of ["pending_approval", "approved", "converted", "rejected", "withdrawn", "under_assessment"] as const) {
    assert.deepEqual(applicationActions(app(status, { loan_id: 41, allowed_transitions: ["rejected"] })), ["open_loan", "note"], status);
  }
});

test("the status moves are the server's allowed_transitions, never a table in the browser", () => {
  assert.ok(applicationActions(app("submitted", { allowed_transitions: ["document_verification"] })).includes("change_status"));
  // The server sent none (a viewer without update, or a status staff can't move).
  assert.ok(!applicationActions(app("submitted")).includes("change_status"));
});

test("Submit for approval is the hand-off, offered only under assessment and before a loan exists", () => {
  assert.ok(applicationActions(app("under_assessment")).includes("hand_off"));
  for (const status of ["submitted", "document_verification", "additional_info_required", "draft"] as const) {
    assert.ok(!applicationActions(app(status)).includes("hand_off"), status);
  }
  // #615's Convert is gone.
  for (const status of ["approved", "pending_approval", "under_assessment"] as const) {
    assert.ok(!(applicationActions(app(status)) as string[]).includes("convert"), status);
  }
});

test("information requests follow the server's statuses, follow-ups included", () => {
  assert.deepEqual([...INFORMATION_STATUSES], ["submitted", "document_verification", "under_assessment", "additional_info_required"]);
  assert.ok(applicationActions(app("additional_info_required")).includes("request_information"));
  assert.ok(!applicationActions(app("draft")).includes("request_information"));
});

test("an unsubmitted application can be reminded; a closed one only takes notes", () => {
  assert.ok(applicationActions(app("incomplete")).includes("remind"));
  assert.ok(!applicationActions(app("submitted")).includes("remind"));
  for (const status of ["rejected", "withdrawn", "expired"] as const) {
    assert.deepEqual(applicationActions(app(status)), ["note"], status);
  }
});

test("a move sends the version read, and the internal note apart from the applicant's message", () => {
  assert.deepEqual(transitionPayload("rejected", 7, "  Income not proven ", " We can't offer a loan now. "), {
    to: "rejected",
    version: 7,
    note: "Income not proven",
    applicant_message: "We can't offer a loan now.",
  });
  // Blanks are left out, never sent as empty strings.
  assert.deepEqual(transitionPayload("document_verification", 0, " ", ""), { to: "document_verification", version: 0 });
});

test("rejecting or withdrawing keeps its reason in the history", () => {
  assert.equal(transitionNeedsNote("rejected"), true);
  assert.equal(transitionNeedsNote("withdrawn"), true);
  assert.equal(transitionNeedsNote("under_assessment"), false);
});

test("linking a member needs update and the permission to view members, refused in the server's words", () => {
  const can = (held: Permission[]) => (p: Permission) => held.includes(p);
  assert.equal(linkMemberBlocker(can(["loan_origination:update", "borrowers:view"])), null);
  assert.equal(
    linkMemberBlocker(can(["loan_origination:update"])),
    "Member matches show members' records, so they need the permission to view members.",
  );
  assert.equal(
    linkMemberBlocker(can(["borrowers:view"])),
    "Working on online applications needs the permission to update online applications.",
  );
});

test("the server's missing field keys read in words", () => {
  assert.equal(missingFieldLabel("personal.gender"), "Gender");
  assert.equal(missingFieldLabel("personal.civil_status"), "Civil status");
  assert.equal(missingFieldLabel("loan.amount"), "Loan amount");
  assert.equal(missingFieldLabel("expenses.existing_loans.0.institution"), "Existing loan 1: lender");
  assert.equal(missingFieldLabel("expenses.existing_loans"), "Existing loans");
  // A key the screen doesn't know still reads as words, never as a raw key.
  assert.equal(missingFieldLabel("personal.some_new_field"), "Some new field");
});
