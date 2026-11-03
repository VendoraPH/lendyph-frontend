import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterestBatch } from "@/types/savings";
import { batchActions, emptyRunForm, interestRequest, previousMonth } from "./interest-batch";

function batch(patch: Partial<InterestBatch> = {}): InterestBatch {
  return {
    id: 1,
    reference_number: "SIB-000001",
    period_from: "2026-10-01",
    period_to: "2026-10-31",
    product: null,
    branch: null,
    status: "draft",
    totals: { accounts: 2, eligible_accounts: 1, total_interest: "12.34" },
    created_by: { id: 7, name: "Maker" },
    approved_by: null,
    posted_by: null,
    created_at: "2026-11-01T00:00:00Z",
    posted_at: null,
    ...patch,
  };
}

const checker = { canApprove: true, canPost: true, userId: 9 };

test("a draft that needs approval is reviewed, not posted", () => {
  const a = batchActions(batch(), checker);
  assert.deepEqual(a, { approve: true, reject: true, post: false, reverse: false, ownBatch: false });
});

test("an unknown approval rule is treated as needing approval", () => {
  assert.equal(batchActions(batch({ requires_approval: undefined }), checker).post, false);
});

test("a draft that needs no approval posts straight away", () => {
  const a = batchActions(batch({ requires_approval: false }), checker);
  assert.equal(a.post, true);
  assert.equal(a.approve, false);
});

test("the maker is flagged on their own batch", () => {
  assert.equal(batchActions(batch(), { ...checker, userId: 7 }).ownBatch, true);
});

test("approved posts; posted reverses; reversed and rejected do nothing", () => {
  assert.equal(batchActions(batch({ status: "approved" }), checker).post, true);
  assert.equal(batchActions(batch({ status: "posted" }), checker).reverse, true);
  assert.equal(batchActions(batch({ status: "posted" }), checker).post, false);
  for (const status of ["reversed", "rejected"] as const) {
    const a = batchActions(batch({ status }), checker);
    assert.equal(a.approve || a.reject || a.post || a.reverse, false, status);
  }
});

test("without permissions nothing is offered", () => {
  const none = { canApprove: false, canPost: false, userId: 9 };
  assert.equal(batchActions(batch(), none).approve, false);
  assert.equal(batchActions(batch({ status: "approved" }), none).post, false);
  assert.equal(batchActions(batch({ status: "posted" }), none).reverse, false);
});

test("previousMonth is the last full calendar month, across years and leap Februaries", () => {
  assert.deepEqual(previousMonth("2026-11-03"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(previousMonth("2026-01-15"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(previousMonth("2028-03-01"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(previousMonth("2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
});

test("the run request carries the period and leaves 'all' filters out", () => {
  const r = interestRequest(emptyRunForm("2026-11-03"), "2026-11-03");
  assert.deepEqual(r, {
    ok: true,
    request: { period_from: "2026-10-01", period_to: "2026-10-31", savings_product_id: null, branch_id: null },
  });
  const f = interestRequest({ periodFrom: "2026-10-01", periodTo: "2026-10-31", productId: "3", branchId: "2" }, "2026-11-03");
  assert.equal(f.ok && f.request.savings_product_id, 3);
  assert.equal(f.ok && f.request.branch_id, 2);
});

test("an impossible period is refused before it reaches the server", () => {
  const base = { productId: "all", branchId: "all" };
  assert.equal(interestRequest({ ...base, periodFrom: null, periodTo: "2026-10-31" }, "2026-11-03").ok, false);
  assert.equal(interestRequest({ ...base, periodFrom: "2026-10-31", periodTo: "2026-10-01" }, "2026-11-03").ok, false);
  assert.equal(interestRequest({ ...base, periodFrom: "2026-11-01", periodTo: "2026-11-04" }, "2026-11-03").ok, false);
  assert.equal(interestRequest({ ...base, periodFrom: "2026-11-03", periodTo: "2026-11-03" }, "2026-11-03").ok, true);
});
