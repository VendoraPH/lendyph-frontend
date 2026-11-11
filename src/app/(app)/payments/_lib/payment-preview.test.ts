import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepaymentPreview } from "@/services/repayment.service";
import {
  postPaymentErrorMessage,
  previewAllocation,
  previewBadge,
  previewExcessCells,
  previewExcessTiles,
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

// LN-000001 has no build-up: ₱416.66 over the instalment was kept as an
// overpayment, but the preview said "will credit member's SCB ledger".
test("on a loan with no build-up, the excess is an advance / overpayment, never share capital", () => {
  const tiles = previewExcessTiles({ ...partial, excess: 416.66 }, false);
  assert.deepEqual(tiles.map((t) => [t.label, t.amount]), [["Advance / Overpayment", 416.66]]);
  assert.ok(tiles.every((t) => !/share capital|SCB/i.test(`${t.label} ${t.note}`)));
});

test("on a build-up loan, the excess goes to the member's share capital", () => {
  const tiles = previewExcessTiles({ ...partial, excess: 250 }, true);
  assert.deepEqual(tiles.map((t) => [t.key, t.amount]), [["build_up", 250]]);
  assert.match(tiles[0].note ?? "", /share capital/i);
});

test("while it isn't known whether the loan has a build-up, the excess claims neither", () => {
  const tiles = previewExcessTiles({ ...partial, excess: 100 }, null);
  assert.deepEqual(tiles.map((t) => [t.key, t.label, t.amount]), [["excess", "Excess", 100]]);
});

test("the server's own split wins when the preview sends it", () => {
  const split = { ...partial, excess: 666.66, build_up_credited: "250.00", overpayment_kept: "416.66" };
  assert.deepEqual(
    previewExcessTiles(split, true).map((t) => [t.key, t.amount]),
    [["build_up", 250], ["overpayment", 416.66]],
  );
  // A build-up the server credited nothing to shows no share capital tile.
  const kept = { ...partial, excess: 416.66, build_up_credited: "0.00", overpayment_kept: "416.66" };
  assert.deepEqual(previewExcessTiles(kept, true).map((t) => t.key), ["overpayment"]);
});

test("no excess, no tile", () => {
  assert.deepEqual(previewExcessTiles(partial, true), []);
  assert.deepEqual(previewExcessTiles({ ...partial, excess: undefined }, false), []);
});

test("the allocation grid's excess cell is named by the loan, never SCB on a loan without build-up", () => {
  const ln1 = { ...partial, excess: 416.66 };
  assert.deepEqual(previewExcessCells(ln1, false), [{ key: "overpayment", label: "Overpayment", amount: "₱416.66" }]);
  assert.deepEqual(previewExcessCells(ln1, true), [{ key: "build_up", label: "Share Capital", amount: "₱416.66" }]);
  assert.deepEqual(previewExcessCells(ln1, null), [{ key: "excess", label: "Excess", amount: "₱416.66" }]);
});

test("with nothing over, the cell shows the server's ₱0.00; with no figure, a dash", () => {
  assert.deepEqual(previewExcessCells(partial, false), [{ key: "overpayment", label: "Overpayment", amount: "₱0.00" }]);
  assert.deepEqual(previewExcessCells({ ...partial, excess: undefined }, true), [{ key: "build_up", label: "Share Capital", amount: "—" }]);
});

test("the server's split fills one cell per part", () => {
  const split = { ...partial, excess: 666.66, build_up_credited: "250.00", overpayment_kept: "416.66" };
  assert.deepEqual(previewExcessCells(split, true).map((c) => [c.label, c.amount]), [
    ["Share Capital", "₱250.00"],
    ["Overpayment", "₱416.66"],
  ]);
});

test("the loan page's Record Payment names the excess by the same rule as Payment Entry", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.doesNotMatch(page, /Excess \/ SCB/);
  assert.doesNotMatch(page, /Excess → Share Capital \/ Future Periods/);
  assert.match(page, /previewExcessCells\(paymentPreview, loanHasBuildUp\(loan\?\.scb_amount\)\)/);
  assert.match(page, /previewExcessTiles\(paymentPreview, loanHasBuildUp\(loan\?\.scb_amount\)\)/);
});
