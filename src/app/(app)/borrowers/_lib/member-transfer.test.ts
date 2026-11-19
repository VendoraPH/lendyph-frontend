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

test("Transfer member shows for holders of the member transfer permission, for a member with a branch", () => {
  assert.equal(canTransferMember(true, { branch_id: 1 }), true);
  assert.equal(canTransferMember(false, { branch_id: 1 }), false);
});

test("a member with no branch gets a branch by editing, so Transfer member isn't offered", () => {
  assert.equal(canTransferMember(true, { branch: null, branch_id: null }), false);
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

test("the server's refusal listing what's still open is shown in its words", () => {
  const words =
    "This member can't be transferred while they have 1 loan still being paid and 2 open savings accounts. " +
    "Loans, savings, time deposits, portal requests and GCash Cash Ins stay in the branch where they were opened, so close or settle them first.";
  assert.deepEqual(transferFailure(refusal(422, { branch_id: [words] }, words)), { reason: null, general: words });
});

test("a refusal of the reason shows under the reason", () => {
  const failure = transferFailure(refusal(422, { reason: ["Give a reason for the transfer."] }));
  assert.deepEqual(failure, { reason: "Give a reason for the transfer.", general: null });
});

test("any other failure reads in words, never a key or a status code alone", () => {
  const failure = transferFailure(
    refusal(403, undefined, "Transferring a member to another branch needs the member transfer permission."),
  );
  assert.equal(failure.reason, null);
  assert.match(failure.general ?? "", /member transfer permission/);
  assert.doesNotMatch(failure.general ?? "", /borrowers:transfer/);
});
