import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EDIT_BRANCH_FILL_CAPTION,
  EDIT_BRANCH_LOCKED_CAPTION,
  REASON_MAX,
  canTransferMember,
  editBranchLocked,
  memberBranchId,
  transferDestinations,
  transferFailure,
  transferRequest,
} from "./member-transfer";

const main = { id: 1, name: "Main", code: "MAIN", is_active: true };
const north = { id: 2, name: "North", code: "NTH", is_active: true };
const south = { id: 3, name: "South", code: "STH", is_active: true };
const east = { id: 4, name: "East", code: "EST", is_active: false };
const west = { id: 5, name: "West", code: "WST", is_active: true, status: "suspended" };
const listed = [main, north, south, east, west];

function refusal(status: number, errors?: Record<string, string[]>, message?: string) {
  return { isAxiosError: true, response: { status, data: { message, ...(errors ? { errors } : {}) } } };
}

/** A `can()` that answers yes only for the keys given. */
function holds(...keys: string[]) {
  return (permission: string) => keys.includes(permission);
}

/** A 422 the way MemberTransfer refuses: the words under `branch_id` and as the message. */
function refusedInWords(words: string) {
  return refusal(422, { branch_id: [words] }, words);
}

// ── Edit Member's branch picker ──

test("Edit Member's branch picker is read-only once the member has a branch", () => {
  assert.equal(editBranchLocked({ branch: { id: 2, name: "North", code: "NTH" } }), true);
  assert.equal(editBranchLocked({ branch: null, branch_id: 2 }), true);
});

test("it stays editable only while the branch is missing", () => {
  assert.equal(editBranchLocked({ branch: null, branch_id: null }), false);
  assert.equal(editBranchLocked({}), false);
});

test("its caption says moves go through Transfer member, in words", () => {
  assert.match(EDIT_BRANCH_LOCKED_CAPTION, /Transfer member/);
  assert.doesNotMatch(EDIT_BRANCH_LOCKED_CAPTION, /branch_id|borrowers:/);
  assert.match(EDIT_BRANCH_FILL_CAPTION, /Transfer member/);
});

test("the member's branch is read from the relation, else the bare id", () => {
  assert.equal(memberBranchId({ branch: { id: 3, name: "South", code: "STH" }, branch_id: 9 }), 3);
  assert.equal(memberBranchId({ branch_id: 9 }), 9);
  assert.equal(memberBranchId({}), null);
});

// ── Who sees Transfer member ──

test("Transfer member needs both the member view and the member transfer permission", () => {
  assert.equal(canTransferMember(holds("borrowers:view", "borrowers:transfer"), { branch_id: 1 }), true);
  assert.equal(canTransferMember(holds("borrowers:transfer"), { branch_id: 1 }), false);
  assert.equal(canTransferMember(holds("borrowers:view"), { branch_id: 1 }), false);
  assert.equal(canTransferMember(holds(), { branch_id: 1 }), false);
});

test("a member with no branch gets a branch by editing, so Transfer member isn't offered", () => {
  assert.equal(canTransferMember(holds("borrowers:view", "borrowers:transfer"), { branch: null, branch_id: null }), false);
});

// ── The destination list ──

test("view_all: every active branch except the member's own", () => {
  const ids = transferDestinations(listed, { viewAll: true, own: [] }, 1).map((b) => b.id);
  assert.deepEqual(ids, [2, 3]);
});

test("a branch user: only their own branches, minus the member's, active ones only", () => {
  const own = [main, north, west];
  const ids = transferDestinations(listed, { viewAll: false, own }, 1).map((b) => b.id);
  assert.deepEqual(ids, [2]);
});

test("an inactive, suspended or closed branch is never offered", () => {
  const closed = { id: 6, name: "Closed", code: "CLS", is_active: true, status: "closed" };
  const ids = transferDestinations([...listed, closed], { viewAll: true, own: [] }, 2).map((b) => b.id);
  assert.deepEqual(ids, [1, 3]);
});

test("a branch user's own branches are offered even when they're missing from the loaded list", () => {
  const ids = transferDestinations([], { viewAll: false, own: [main, south] }, 1).map((b) => b.id);
  assert.deepEqual(ids, [3]);
});

// ── The request ──

test("the request needs a destination and a reason, in the server's words", () => {
  assert.deepEqual(transferRequest(null, "Moved house"), {
    ok: false,
    errors: { branch_id: "Choose the branch to move this member to." },
  });
  assert.deepEqual(transferRequest("2", "   "), { ok: false, errors: { reason: "Give a reason for the transfer." } });
  assert.deepEqual(transferRequest("2", "  Moved to the north office  "), {
    ok: true,
    body: { branch_id: 2, reason: "Moved to the north office" },
  });
});

test("a reason longer than 500 characters is refused before sending", () => {
  assert.equal(REASON_MAX, 500);
  assert.deepEqual(transferRequest("2", "a".repeat(501)), {
    ok: false,
    errors: { reason: "The reason can be at most 500 characters." },
  });
  assert.equal(transferRequest("2", "a".repeat(500)).ok, true);
});

// ── A refusal ──

/** Neither a retry nor a member out of reach: the form or the member's records need changing first. */
const noRetry = { retry: false, outOfReach: false };

test("422: what's still open is shown in the server's words, with no retry", () => {
  const words =
    "This member can't be transferred while they have 1 loan still being paid, 1 loan application not yet released, " +
    "2 open savings accounts, 1 open time deposit, 1 open portal request and 1 GCash Cash In not yet paid. " +
    "Loans, savings, time deposits, portal requests and GCash Cash Ins stay in the branch where they were opened, so close or settle them first.";
  assert.deepEqual(transferFailure(refusedInWords(words)), { reason: null, general: words, ...noRetry });
});

test("422: a hidden or invalid destination, a suspended or closed one, or the member's own branch reads in the server's words", () => {
  for (const words of [
    "Choose one of your branches.",
    "North (NTH) is suspended, so it can't receive members.",
    "South (STH) is closed, so it can't receive members.",
    "This member is already in North (NTH).",
    "This member has no branch yet. Assign one by editing the member.",
  ]) {
    assert.deepEqual(transferFailure(refusedInWords(words)), { reason: null, general: words, ...noRetry });
  }
});

test("422: a refusal of the reason shows under the reason", () => {
  const failure = transferFailure(refusal(422, { reason: ["Give a reason for the transfer."] }));
  assert.deepEqual(failure, { reason: "Give a reason for the transfer.", general: null, ...noRetry });
});

test("409: the member busy or changed at the same moment reads in the server's words, with a way to try again", () => {
  for (const words of [
    "This member's branch is being changed. Try again in a moment.",
    "This member changed at the same moment. Reload and try again.",
  ]) {
    assert.deepEqual(transferFailure(refusal(409, undefined, words)), {
      reason: null,
      general: words,
      retry: true,
      outOfReach: false,
    });
  }
});

test("409 with no readable words still says what happened, never the generic conflict copy", () => {
  for (const err of [refusal(409), refusal(409, undefined, "SQLSTATE[40001]: Serialization failure: 1213 Deadlock")]) {
    const failure = transferFailure(err);
    assert.equal(failure.general, "This member is busy or was changed at the same moment. Try again in a moment.");
    assert.equal(failure.retry, true);
  }
});

test("404: a member outside the caller's branches reads in words, never the framework's text, and offers no retry", () => {
  const failure = transferFailure(refusal(404, undefined, "No query results for model [App\\Models\\Borrower] 7"));
  assert.deepEqual(failure, {
    reason: null,
    general: "This member is outside your branches now, or no longer exists, so they can't be transferred.",
    retry: false,
    outOfReach: true,
  });
});

test("403: a missing permission reads in the server's words, never the permission keys", () => {
  const words = "Transferring a member to another branch needs the member transfer and member view permissions.";
  const failure = transferFailure(refusal(403, undefined, words));
  assert.deepEqual(failure, { reason: null, general: words, ...noRetry });
  assert.doesNotMatch(failure.general ?? "", /borrowers:/);
});
