import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsTransaction } from "@/types";
import {
  ACCOUNT_STATUS_LABELS,
  APPROVAL_KIND_LABELS,
  APPROVAL_STATUS_LABELS,
  HOLDER_TYPE_LABELS,
  HOLD_TYPE_LABELS,
  HOLD_TYPE_OPTIONS,
  INTEREST_CREDITING_LABELS,
  METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  TRANSACTION_TYPE_LABELS,
  UNKNOWN_LABEL,
  actorName,
  canDeposit,
  canOfferClose,
  canPlaceHold,
  canWithdraw,
  heldForRequestsNote,
  holdReleaseOffer,
  labelOf,
  reversalBlocker,
  statusChangeOffers,
  statusTabs,
} from "./savings-rules";

test("every key reads in words, and an unknown key never shows raw", () => {
  assert.equal(labelOf(TRANSACTION_TYPE_LABELS, "transfer_out"), "Transfer out");
  assert.equal(labelOf(TRANSACTION_TYPE_LABELS, "withholding_tax"), "Withholding tax");
  assert.equal(labelOf(METHOD_LABELS, "bank_transfer"), "Bank transfer");
  assert.equal(labelOf(APPROVAL_KIND_LABELS, "td_payout"), "Time deposit payout");
  assert.equal(labelOf(INTEREST_CREDITING_LABELS, "semi_annual"), "Semi-annually");
  assert.equal(labelOf(HOLD_TYPE_LABELS, "legal"), "Legal order");
  assert.equal(labelOf(TRANSACTION_TYPE_LABELS, "some_new_type"), UNKNOWN_LABEL);
  assert.equal(labelOf(TRANSACTION_TYPE_LABELS, "toString"), UNKNOWN_LABEL);
  assert.equal(labelOf(TRANSACTION_TYPE_LABELS, null), "—");
  // A walk-in is never a "Non-member" on screen.
  assert.equal(HOLDER_TYPE_LABELS.non_member, "Walk-ins");
});

test("no label is a raw key: none has an underscore", () => {
  const maps = [
    ACCOUNT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, METHOD_LABELS, APPROVAL_KIND_LABELS,
    APPROVAL_STATUS_LABELS, HOLD_TYPE_LABELS, INTEREST_CREDITING_LABELS, HOLDER_TYPE_LABELS,
  ];
  for (const map of maps) for (const label of Object.values(map)) assert.doesNotMatch(label, /_/, label);
});

test("over the counter money comes in by cash, bank, GCash or Maya; savings is the transfer form's", () => {
  assert.deepEqual(PAYMENT_METHOD_OPTIONS.map((o) => o.value), ["cash", "bank_transfer", "gcash", "maya"]);
});

test("the actions an account offers follow its status", () => {
  assert.equal(canDeposit({ status: "dormant" }), true);
  assert.equal(canDeposit({ status: "frozen" }), false);
  assert.equal(canWithdraw({ status: "dormant" }), false);
  assert.equal(canWithdraw({ status: "active" }), true);
  assert.equal(canPlaceHold({ status: "frozen" }), true);
  assert.equal(canPlaceHold({ status: "closed" }), false);
  assert.equal(canOfferClose({ status: "closed" }), false);
  assert.deepEqual(statusChangeOffers({ status: "active" }), [{ status: "frozen", label: "Freeze" }]);
  assert.deepEqual(statusChangeOffers({ status: "dormant" }).map((o) => o.label), ["Reactivate", "Freeze"]);
  assert.deepEqual(statusChangeOffers({ status: "frozen" }), [{ status: "active", label: "Unfreeze" }]);
  assert.deepEqual(statusChangeOffers({ status: "closed" }), []);
});

const txn = (over: Partial<SavingsTransaction>) =>
  ({
    type: "deposit",
    time_deposit_id: null,
    reversed_by_transaction_id: null,
    pending_reversal_approval_id: null,
    ...over,
  }) as SavingsTransaction;

test("a reversal can be asked for on deposits, withdrawals and transfers only, once", () => {
  assert.equal(reversalBlocker(txn({})), null);
  assert.equal(reversalBlocker(txn({ type: "transfer_out" })), null);
  for (const type of ["interest", "withholding_tax", "closing", "reversal"] as const) {
    assert.ok(reversalBlocker(txn({ type })), type);
  }
  assert.ok(reversalBlocker(txn({ time_deposit_id: 4 })));
  assert.equal(reversalBlocker(txn({ reversed_by_transaction_id: 9 })), "Already reversed.");
  assert.equal(reversalBlocker(txn({ pending_reversal_approval_id: 3 })), "A reversal is waiting for approval.");
});

test("the system is named when the server sends no user", () => {
  assert.equal(actorName(null), "System");
  assert.equal(actorName({ id: 1, name: "Ana" }), "Ana");
});

test("status tabs read counts from meta.stats and add no total in the browser", () => {
  const tabs = statusTabs({ active: 4, closed: 1 });
  assert.equal(tabs[0].count, null);
  assert.deepEqual(tabs.slice(1).map((t) => t.count), [4, 0, 0, 1]);
});

// lendyph-backend `SavingsHold::TYPES`: a Member Portal withdrawal request
// reserves its money with a `member_request` hold.
test("every hold type the backend sends reads in words", () => {
  for (const type of ["legal", "manual", "loan_retention", "member_request"]) {
    assert.notEqual(labelOf(HOLD_TYPE_LABELS, type), UNKNOWN_LABEL, type);
  }
  assert.equal(labelOf(HOLD_TYPE_LABELS, "member_request"), "Member request");
});

test("staff can't place a member request hold by hand", () => {
  assert.deepEqual(HOLD_TYPE_OPTIONS.map((o) => o.value), ["manual", "legal"]);
});

// Backend P4 (#292): `held_for_requests`, the part of the holds that members'
// portal withdrawal requests reserve (the member sees it as "Pending withdrawal").
test("the holds card says how much is held for member requests, when there is some", () => {
  assert.equal(
    heldForRequestsNote({ held_for_requests: "10000.00" }),
    "of which ₱10,000.00 for member requests (a pending withdrawal in the Member Portal)",
  );
  assert.equal(heldForRequestsNote({ held_for_requests: "0.00" }), null);
  assert.equal(heldForRequestsNote({ held_for_requests: "0" }), null);
  assert.equal(heldForRequestsNote({}), null);
  assert.equal(heldForRequestsNote({ held_for_requests: null }), null);
});

// A member request's hold is released only by deciding the request: the
// server refuses `POST /savings/holds/{id}/release` on it (422).
test("an active member request hold offers no Release, only where it is decided", () => {
  assert.deepEqual(holdReleaseOffer({ type: "member_request", status: "active" }), {
    release: false,
    note: "Decided in Member Portal → Requests",
  });
});

test("other active holds offer Release; a released or expired one offers nothing", () => {
  for (const type of ["manual", "legal", "loan_retention"] as const) {
    assert.deepEqual(holdReleaseOffer({ type, status: "active" }), { release: true, note: null }, type);
  }
  assert.deepEqual(holdReleaseOffer({ type: "manual", status: "released" }), { release: false, note: null });
  assert.deepEqual(holdReleaseOffer({ type: "member_request", status: "expired" }), { release: false, note: null });
});
