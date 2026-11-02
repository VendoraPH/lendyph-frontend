import { test } from "node:test";
import assert from "node:assert/strict";
import type { Loan } from "@/types";
import { loanOutstandingCell } from "./loan-outstanding-cell";

const row = (fields: Record<string, unknown>) => ({ id: 1, ...fields }) as unknown as Loan;

// Decision 1(a): "Outstanding" is everything owed. `outstanding_balance` is the
// deprecated principal + premium figure (₱60,400 on a fresh ₱60,000 loan that
// owes ₱70,800 in all).
test("Outstanding reads total_outstanding, not the deprecated outstanding_balance", () => {
  assert.equal(
    loanOutstandingCell(row({ total_outstanding: 70_800, outstanding_balance: 60_400 })),
    "₱70,800.00",
  );
});

test("a decimal string from the server reads as a number", () => {
  assert.equal(loanOutstandingCell(row({ total_outstanding: "1500.50" })), "₱1,500.50");
});

test("a completed loan that owes nothing reads Paid", () => {
  assert.equal(loanOutstandingCell(row({ status: "completed", total_outstanding: 0 })), "Paid");
});

// Draft, for-review, approved, rejected and restructured loans owe 0 too, and
// none of them was paid. Zero is a real figure, so they show ₱0.00.
test("a draft that owes nothing shows ₱0.00, not Paid", () => {
  assert.equal(loanOutstandingCell(row({ status: "draft", total_outstanding: 0 })), "₱0.00");
});

test("Paid only for a completed loan: restructured, rejected and approved show the figure", () => {
  for (const status of ["for_review", "approved", "rejected", "restructured"]) {
    assert.equal(loanOutstandingCell(row({ status, total_outstanding: 0 })), "₱0.00", status);
  }
});

test("a figure the server did not send shows a dash, never the old field", () => {
  assert.equal(loanOutstandingCell(row({ outstanding_balance: 60_400 })), "—");
  assert.equal(loanOutstandingCell(row({ total_outstanding: null })), "—");
});
