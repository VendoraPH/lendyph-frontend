import { test } from "node:test";
import assert from "node:assert/strict";
import type { RepaymentPreview } from "@/services/repayment.service";
import { previewAllocation, previewBadge } from "./payment-preview";

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
  });
});
