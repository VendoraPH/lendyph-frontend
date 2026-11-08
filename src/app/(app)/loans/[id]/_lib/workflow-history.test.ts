import { test } from "node:test";
import assert from "node:assert/strict";
import type { Loan } from "@/types/loan";
import { workflowEvents, type WorkflowLoan } from "./workflow-history";

const LOAN: WorkflowLoan = {
  status: "for_review",
  created_at: "2026-10-01T02:00:00Z",
  updated_at: "2026-11-05T02:00:00Z",
  submitted_at: "2026-10-02T02:00:00Z",
};

const keys = (loan: WorkflowLoan) => workflowEvents(loan).map((e) => e.key);
const submitted = (loan: WorkflowLoan) =>
  workflowEvents(loan).find((e) => e.key === "submitted");

test("Submitted for approval is dated by submitted_at, never updated_at", () => {
  const event = submitted(LOAN);
  assert.equal(event?.label, "Submitted for approval");
  assert.equal(event?.date, "2026-10-02T02:00:00Z");
});

test("a later edit to the loan doesn't move the submission", () => {
  const event = submitted({ ...LOAN, status: "approved", updated_at: "2026-12-25T02:00:00Z" });
  assert.equal(event?.date, "2026-10-02T02:00:00Z");
});

test("events sort by their dates, the submission included", () => {
  const events = workflowEvents({
    ...LOAN,
    status: "released",
    approved_at: "2026-10-03T02:00:00Z",
    released_at: "2026-10-04T02:00:00Z",
    // Submitted after a first rejection: it must follow that rejection.
    rejected_at: "2026-10-01T09:00:00Z",
    submitted_at: "2026-10-02T02:00:00Z",
  });
  assert.deepEqual(
    events.map((e) => e.key),
    ["created", "rejected", "submitted", "approved", "released"],
  );
});

test("a draft that was never submitted has no submission", () => {
  assert.deepEqual(keys({ ...LOAN, status: "draft", submitted_at: null }), ["created"]);
});

test("a voided draft that was never submitted has no submission", () => {
  assert.deepEqual(keys({ ...LOAN, status: "void", submitted_at: null }), ["created"]);
});

test("a loan sent back to draft keeps its real submission", () => {
  assert.deepEqual(keys({ ...LOAN, status: "draft" }), ["created", "submitted"]);
});

test("a submitted loan the server has no date for reads no date, right after creation", () => {
  const events = workflowEvents({
    ...LOAN,
    status: "approved",
    submitted_at: null,
    approved_at: "2026-10-03T02:00:00Z",
  });
  assert.deepEqual(
    events.map((e) => [e.key, e.date]),
    [
      ["created", "2026-10-01T02:00:00Z"],
      ["submitted", null],
      ["approved", "2026-10-03T02:00:00Z"],
    ],
  );
});

test("a full Loan is accepted as it is, and names keep their fallbacks", () => {
  const loan = {
    ...LOAN,
    status: "approved",
    approved_at: "2026-10-03T02:00:00Z",
    approved_by: "Ana",
    approval_remarks: "ok",
  } as unknown as Loan;
  const event = workflowEvents(loan).find((e) => e.key === "approved");
  assert.equal(event?.label, "Approved by Ana");
  assert.equal(event?.detail, "ok");
});
