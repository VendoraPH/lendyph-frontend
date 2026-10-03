import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingApprovalsBadgeEnabled } from "./use-pending-loan-approvals";

function canOnly(...granted: string[]) {
  return (permission: string) => granted.includes(permission);
}

test("an approver who reads loans but has no loans:approve still gets the badge", () => {
  // manager and bod1–bod7 own the default approval steps with loans:view only;
  // `awaiting_me` already limits the count to the user's own steps.
  assert.equal(pendingApprovalsBadgeEnabled(canOnly("loans:view")), true);
});

test("no badge read without loans:view, which GET /loans needs", () => {
  assert.equal(pendingApprovalsBadgeEnabled(canOnly("loans:approve")), false);
  assert.equal(pendingApprovalsBadgeEnabled(canOnly()), false);
});
