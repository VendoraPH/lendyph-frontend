import { test } from "node:test";
import assert from "node:assert/strict";
import { approvalEditPayload, approvalEditSavedMessage, isApprovalEdit } from "./approval-edit-save";
import type { SelectedCollateral } from "./edit-collaterals";

/** The payload the form builds for an edit, as handleSubmit builds it. */
const FORM_PAYLOAD = {
  borrower_id: 7,
  co_maker_ids: [11, 12],
  loan_product_id: 3,
  principal_amount: 80000,
  term: 12,
  frequency: "semi_monthly",
  interest_rate: 2.5,
  start_date: "2026-12-05",
  scb_amount: 200,
  deductions: [{ name: "Processing Fee", amount: 2, type: "percentage" as const }],
  purpose: "Store expansion",
  policy_exception: true,
  policy_exception_details: "Long-time member",
};

const row = (id: number) => ({ collateral: { id } }) as unknown as SelectedCollateral;

function build(overrides: Partial<Parameters<typeof approvalEditPayload>[0]> = {}) {
  return approvalEditPayload({
    payload: FORM_PAYLOAD,
    version: "v1",
    scbAmount: 200,
    purpose: "Store expansion",
    coMakerIds: [11, 12],
    storedCoMakerIds: [12, 11],
    canPickMembers: true,
    selected: [],
    attached: null,
    ...overrides,
  });
}

test("the approval edit opens only with ?approval=1 beside a loan to edit", () => {
  assert.equal(isApprovalEdit(12, "1"), true);
  assert.equal(isApprovalEdit(12, null), false);
  assert.equal(isApprovalEdit(12, "true"), false);
  assert.equal(isApprovalEdit(null, "1"), false);
});

test("it states the terms, the version, the build-up and the purpose, never the member, product or policy exception", () => {
  assert.deepEqual(build(), {
    version: "v1",
    principal_amount: 80000,
    term: 12,
    frequency: "semi_monthly",
    interest_rate: 2.5,
    start_date: "2026-12-05",
    deductions: [{ name: "Processing Fee", amount: 2, type: "percentage" }],
    scb_amount: 200,
    purpose: "Store expansion",
  });
});

test("a cleared build-up and purpose are stated, so the edit can clear them", () => {
  const body = build({ scbAmount: 0, purpose: "   " });
  assert.equal(body.scb_amount, 0);
  assert.equal(body.purpose, null);
});

test("co-makers go up only when they changed, and only for a role that can pick members", () => {
  assert.equal("co_maker_ids" in build(), false, "the same members in another order is no change");
  assert.deepEqual(build({ coMakerIds: [11] }).co_maker_ids, [11]);
  assert.deepEqual(build({ coMakerIds: [] }).co_maker_ids, []);
  assert.equal("co_maker_ids" in build({ coMakerIds: [11], canPickMembers: false }), false);
});

test("collaterals go up only when they changed and the role may change them", () => {
  assert.equal("collaterals" in build({ selected: [row(5)], attached: null }), false);
  assert.equal("collaterals" in build({ selected: [row(5)], attached: [row(5)] }), false);
  assert.deepEqual(build({ selected: [row(5), row(6)], attached: [row(5)] }).collaterals, [
    { collateral_id: 5 },
    { collateral_id: 6 },
  ]);
});

test("the account officer goes up only when the form stated a change", () => {
  assert.equal("account_officer_id" in build(), false);
  assert.equal(build({ payload: { ...FORM_PAYLOAD, account_officer_id: 9 } }).account_officer_id, 9);
});

test("the save says the loan still waits at the step", () => {
  assert.equal(approvalEditSavedMessage("BOD Chairwoman"), "It's still at the \"BOD Chairwoman\" step for you to approve or forward.");
  assert.equal(approvalEditSavedMessage(null), "It's still at your approval step for you to approve or forward.");
});
