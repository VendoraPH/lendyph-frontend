import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_BRANCH_REQUIRED,
  approvalBranch,
  approvalBranchError,
  approvalPayload,
} from "./approval-branch";

const MINE = [{ id: 3 }, { id: 7 }];

// The server approves a registration only into the branch it already names
// (another one answers 422), so the review shows that branch and can't change it.
test("a registration that names a branch is approved there, whatever is picked", () => {
  assert.deepEqual(approvalBranch(7, MINE, 3), { fixed: true, branchId: 7 });
  assert.deepEqual(approvalBranch(7, [], null), { fixed: true, branchId: 7 });
});

test("a registration with no branch takes the branch picked from the caller's own", () => {
  assert.deepEqual(approvalBranch(null, MINE, 3), { fixed: false, branchId: 3 });
  assert.deepEqual(approvalBranch(undefined, MINE, 7), { fixed: false, branchId: 7 });
});

test("nothing is picked until the reviewer chooses, unless only one branch is offered", () => {
  assert.deepEqual(approvalBranch(null, MINE, null), { fixed: false, branchId: null });
  assert.deepEqual(approvalBranch(null, [{ id: 3 }], null), { fixed: false, branchId: 3 });
  assert.deepEqual(approvalBranch(null, [], null), { fixed: false, branchId: null });
});

// A pick the picker no longer offers (the caller's branches changed) never
// reaches the server.
test("a pick outside the offered branches reads as no pick", () => {
  assert.deepEqual(approvalBranch(null, MINE, 99), { fixed: false, branchId: null });
});

test("the approval always sends the branch, or nothing when none is chosen", () => {
  assert.deepEqual(approvalPayload(5), { branch_id: 5 });
  assert.deepEqual(approvalPayload(null), {});
});

test("the server's branch refusal is shown in its own words", () => {
  const refusal = {
    response: {
      status: 422,
      data: { message: "x", errors: { branch_id: ["Choose the branch this member belongs to before approving the registration."] } },
    },
  };
  assert.equal(approvalBranchError(refusal), "Choose the branch this member belongs to before approving the registration.");
  assert.equal(approvalBranchError({ response: { status: 422, data: { errors: { valid_id: ["No ID"] } } } }), null);
  assert.equal(approvalBranchError(new Error("offline")), null);
  assert.match(APPROVAL_BRANCH_REQUIRED, /^Choose the branch this member belongs to/);
});
