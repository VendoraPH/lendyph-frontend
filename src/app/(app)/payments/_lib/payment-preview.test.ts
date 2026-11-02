import { test } from "node:test";
import assert from "node:assert/strict";
import type { RepaymentPreview } from "@/services/repayment.service";
import {
  postPaymentErrorMessage,
  previewAllocation,
  previewBadge,
  previewTotalOutstandingAfter,
  previewTotalOutstandingBefore,
} from "./payment-preview";

/**
 * The server's preview for ₱10,000 against an ₱11,800 instalment: the case
 * the page used to badge "Full Payment (with arrears)" from its own estimate.
 */
const partial: RepaymentPreview = {
  amount_paid: 10000,
  total_paid: 10000,
  total_penalty: 0,
  total_interest: 1800,
  total_principal: 8200,
  excess: 0,
  allocated_to_next_interest: 0,
  allocated_to_next_principal: 0,
  payment_type: "advance",
  payment_badge: { type: "partial", label: "Partial Payment" },
  allocations: [
    {
      schedule_id: 11,
      period: 1,
      due_date: "2026-02-15",
      penalty: 0,
      interest: 1800,
      principal: 8200,
      amount_applied: 10000,
      remaining_balance: 1800,
    },
  ],
};

test("the badge is the one the server's preview gave, not the stored payment type", () => {
  assert.deepEqual(previewBadge(partial), { label: "Partial Payment", variant: "destructive" });
});

test("each badge type keeps its colour", () => {
  const badge = (type: "exact" | "advance", label: string) =>
    previewBadge({ ...partial, payment_badge: { type, label } });
  assert.deepEqual(badge("exact", "Exact Payment"), { label: "Exact Payment", variant: "default" });
  assert.deepEqual(badge("advance", "Advance Payment"), { label: "Advance Payment", variant: "secondary" });
});

test("no badge until the server has given one", () => {
  assert.equal(previewBadge({ ...partial, payment_badge: undefined }), null);
});

test("the allocation is read from the server preview, not estimated", () => {
  assert.deepEqual(previewAllocation(partial), {
    penaltyApplied: 0,
    interestApplied: 1800,
    principalApplied: 8200,
    scbApplied: 0,
    nextInterestApplied: 0,
    nextPrincipalApplied: 0,
    insuranceApplied: 0,
  });
});

test("insurance owed that the payment collects first is its own part of the allocation", () => {
  // ₱10,000 with ₱200 of insurance premium owed on the loan: the server
  // collects the ₱200 first, then the rest goes to the instalment.
  const withInsurance: RepaymentPreview = {
    ...partial,
    total_interest: 1800,
    total_principal: 8000,
    allocated_to_insurance: 200,
    total_insurance: 200,
  };
  assert.equal(previewAllocation(withInsurance).insuranceApplied, 200);
});

// Decision 1: the New Outstanding Balance is everything owed, the same figure
// as the loan page, never the principal-only balance_before/after.
test("the outstanding balance reads total_outstanding_before/after, not balance_before/after", () => {
  const preview = {
    balance_before: 33333.34,
    balance_after: 25000.01,
    total_outstanding_before: 39333.34,
    total_outstanding_after: "29500.01",
  };
  assert.equal(previewTotalOutstandingBefore(preview), 39333.34);
  assert.equal(previewTotalOutstandingAfter(preview), 29500.01);
});

test("the outstanding balance is null (a dash) when not sent, ₱0.00 kept", () => {
  assert.equal(previewTotalOutstandingAfter({ balance_after: 25000.01 }), null);
  assert.equal(previewTotalOutstandingBefore({ balance_before: 33333.34 }), null);
  assert.equal(previewTotalOutstandingAfter(null), null);
  assert.equal(previewTotalOutstandingAfter({ total_outstanding_after: "abc" }), null);
  assert.equal(previewTotalOutstandingAfter({ total_outstanding_after: "0.00" }), 0);
});

// Decision 4: a refused payment says why, not "check your connection".
test("a refused Post Payment states the server's field error", () => {
  const message = "The payment date can't be before the loan's release date (2026-11-02).";
  const err = {
    isAxiosError: true,
    request: {},
    response: { status: 422, data: { message, errors: { payment_date: [message] } } },
  };
  assert.equal(postPaymentErrorMessage(err), message);
});

test("a Post Payment that failed with nothing to explain keeps the fallback", () => {
  assert.equal(postPaymentErrorMessage(new Error("boom")), "We couldn't post the payment. Please try again.");
});
