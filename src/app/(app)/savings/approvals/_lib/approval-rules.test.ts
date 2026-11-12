import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsApproval } from "@/types";
import {
  approvalAmountText,
  approvalFeeText,
  approvalHref,
  approvalOffer,
  approvalProgress,
  approvalSubject,
} from "./approval-rules";

const approval = (over: Partial<SavingsApproval> = {}) =>
  ({
    id: 1,
    kind: "withdrawal",
    status: "pending",
    account_id: 5,
    account_number: "SAV-2026-000005",
    time_deposit_id: null,
    target_transaction_id: null,
    amount: "15000.00",
    required_checkers: 1,
    requested_by: { id: 10, name: "Maker" },
    first_checker: null,
    ...over,
  }) as SavingsApproval;

test("the maker sees Approve and Reject disabled with the reason, and may cancel", () => {
  const offer = approvalOffer(approval(), 10);
  assert.equal(offer.approveBlocked, "You made this request; another user must decide it.");
  assert.ok(offer.rejectBlocked);
  assert.equal(offer.canCancel, true);
});

test("another user may approve or reject, but not cancel", () => {
  assert.deepEqual(approvalOffer(approval(), 11), { approveBlocked: null, rejectBlocked: null, canCancel: false });
});

test("above the second tier, the first checker can't approve twice", () => {
  const twoChecker = approval({ required_checkers: 2, first_checker: { id: 11, name: "Checker" } });
  assert.match(approvalOffer(twoChecker, 11).approveBlocked ?? "", /different approver/);
  assert.equal(approvalOffer(twoChecker, 12).approveBlocked, null);
  assert.equal(approvalProgress(twoChecker), "1 of 2 approvals");
  assert.equal(approvalProgress(approval()), null);
});

test("a decided request offers nothing", () => {
  for (const status of ["approved", "rejected", "cancelled", "expired"] as const) {
    const offer = approvalOffer(approval({ status }), 11);
    assert.ok(offer.approveBlocked && offer.rejectBlocked, status);
    assert.equal(offer.canCancel, false);
  }
});

test("the subject and link follow the account or the time deposit", () => {
  assert.equal(approvalSubject(approval({ target_reference: "SVT-20261110-000001" })), "SAV-2026-000005 · SVT-20261110-000001");
  assert.equal(approvalHref(approval()), "/savings/accounts/5");
  assert.equal(approvalHref(approval({ time_deposit_id: 3, account_id: null })), "/savings/time-deposits/3");
});

// Browser check 3: the fee beside the amount, and no ₱0.00 on a reactivation.
test("an approval's money reads the amount and its fee as the server sent them", () => {
  const base = approval({ amount: "500.00", fee_amount: "25.00" });
  assert.equal(approvalAmountText(base), "₱500.00");
  assert.equal(approvalFeeText(base), "Excess-withdrawal fee ₱25.00");
  assert.equal(approvalFeeText({ ...base, fee_amount: "0.00" }), null);
  assert.equal(approvalAmountText({ ...base, kind: "reactivation", amount: "0.00" }), "—");
});
