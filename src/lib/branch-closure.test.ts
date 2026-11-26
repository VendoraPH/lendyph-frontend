import test from "node:test";
import assert from "node:assert/strict";

import {
  CLOSURE_STATUS_LABELS,
  checklistItemWords,
  closureActions,
  closureState,
  type BranchClosureInfo,
} from "./branch-closure";

const ME = 7;
const OTHER = 11;

const clearList = [
  { key: "open_loans", label: "Open loans", count: 0, amount: null, clear: true },
  { key: "assigned_users", label: "Assigned users", count: 0, amount: null, clear: true },
];
const blocked = [
  { key: "open_loans", label: "Open loans", count: 3, amount: null, clear: false },
  { key: "money_in_accounts", label: "Money in its cash and bank accounts", count: 2, amount: "1500.00", clear: false },
  { key: "assigned_users", label: "Assigned users", count: 0, amount: null, clear: true },
];

// A branch is suspended before anyone asks to close it (backend #354), so the
// usual starting point is a suspended branch.
function info(over: Partial<BranchClosureInfo> = {}): BranchClosureInfo {
  return { branch_id: 4, status: "suspended", can_close: true, checklist: clearList, request: null, ...over };
}

const SUSPEND_FIRST = "Suspend this branch before asking to close it.";

function pending(requester: number) {
  return {
    id: 1,
    branch_id: 4,
    status: "pending" as const,
    effective_on: "2026-11-19",
    reason: "Merged into North",
    requested_by: { id: requester, full_name: requester === ME ? "Ana Reyes" : "Ben Cruz" },
    requested_at: "2026-11-19T02:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_note: null,
  };
}

const branch = { is_main_office: false };

test("request statuses read in words", () => {
  assert.deepEqual(CLOSURE_STATUS_LABELS, {
    pending: "Waiting for approval",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  });
});

test("the closure state reads in words", () => {
  assert.equal(closureState(info(), branch), "Ready to close: nothing keeps this branch open.");
  assert.equal(
    closureState(info({ can_close: false, checklist: blocked }), branch),
    "Can't close yet: 2 items keep this branch open.",
  );
  assert.equal(
    closureState(info({ can_close: false, checklist: [blocked[0]] }), branch),
    "Can't close yet: 1 item keeps this branch open.",
  );
  assert.equal(
    closureState(info({ request: pending(OTHER) }), branch),
    "Waiting for approval: Ben Cruz asked to close it on Nov 19, 2026.",
  );
  assert.equal(closureState(info({ status: "closed", can_close: false }), branch), "This branch is closed.");
  assert.equal(
    closureState(info({ can_close: false }), { is_main_office: true }),
    "The main office stays open. Make another branch the main office first.",
  );
});

test("checklist items read with their count, and money with the server's ₱ amount", () => {
  assert.equal(checklistItemWords(blocked[0]), "Open loans: 3");
  assert.equal(checklistItemWords(blocked[1]), "Money in its cash and bank accounts: 2 (₱1,500.00)");
  assert.equal(checklistItemWords(blocked[2]), "Assigned users: none");
});

test("anyone who may manage can ask, once nothing keeps the branch open", () => {
  assert.deepEqual(closureActions(info(), branch, ME, true), {
    request: true,
    requestDisabledReason: null,
    approve: false,
    reject: false,
    cancel: false,
  });
  assert.deepEqual(closureActions(info({ can_close: false, checklist: blocked }), branch, ME, true), {
    request: true,
    requestDisabledReason: "Clear every item on the checklist first.",
    approve: false,
    reject: false,
    cancel: false,
  });
});

test("an active branch is suspended first: Ask to close shows, disabled, with the reason", () => {
  assert.equal(closureState(info({ status: "active", can_close: false }), branch), SUSPEND_FIRST);
  assert.deepEqual(closureActions(info({ status: "active", can_close: false }), branch, ME, true), {
    request: true,
    requestDisabledReason: SUSPEND_FIRST,
    approve: false,
    reject: false,
    cancel: false,
  });
  // The main office reads its own reason before the suspend-first one.
  assert.equal(
    closureState(info({ status: "active", can_close: false }), { is_main_office: true }),
    "The main office stays open. Make another branch the main office first.",
  );
  // A request already waiting still reads as waiting, whatever the status.
  assert.equal(
    closureState(info({ status: "active", request: pending(OTHER) }), branch),
    "Waiting for approval: Ben Cruz asked to close it on Nov 19, 2026.",
  );
});

test("the main office and a closed branch offer no request", () => {
  assert.equal(closureActions(info({ can_close: false }), { is_main_office: true }, ME, true).request, false);
  assert.equal(closureActions(info({ status: "closed", can_close: false }), branch, ME, true).request, false);
});

test("a different user approves or rejects; the requester can only cancel", () => {
  assert.deepEqual(closureActions(info({ request: pending(OTHER) }), branch, ME, true), {
    request: false,
    requestDisabledReason: null,
    approve: true,
    reject: true,
    cancel: false,
  });
  assert.deepEqual(closureActions(info({ request: pending(ME) }), branch, ME, true), {
    request: false,
    requestDisabledReason: null,
    approve: false,
    reject: false,
    cancel: true,
  });
});

test("without branches:manage plus view_all, nobody acts", () => {
  assert.deepEqual(closureActions(info({ request: pending(OTHER) }), branch, ME, false), {
    request: false,
    requestDisabledReason: null,
    approve: false,
    reject: false,
    cancel: false,
  });
  assert.equal(closureActions(info(), branch, ME, false).request, false);
});

test("the round 7 loan adjustments line reads in the server's words", () => {
  assert.equal(
    checklistItemWords({ key: "loan_adjustments", label: "Loan adjustments to approve, cancel or apply", count: 2, amount: null, clear: false }),
    "Loan adjustments to approve, cancel or apply: 2",
  );
});
