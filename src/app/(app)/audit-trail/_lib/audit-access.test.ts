import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUDIT_BRANCH_RESTRICTION, auditLoadRestriction, auditTrailRestriction } from "./audit-access";

// Audit logs need `branches:view_all` (round m6, wave 2): the API answers 403
// without it. The screen says so in words instead of "No audit logs found".
test("without access to every branch, the Audit Trail is restricted, in words", () => {
  assert.equal(auditTrailRestriction(false), AUDIT_BRANCH_RESTRICTION);
  assert.equal(AUDIT_BRANCH_RESTRICTION, "The Audit Trail needs access to every branch.");
  assert.equal(auditTrailRestriction(true), null);
});

test("a 403 from the audit log list reads as the same restriction; other failures don't", () => {
  assert.equal(auditLoadRestriction({ response: { status: 403 } }), AUDIT_BRANCH_RESTRICTION);
  assert.equal(auditLoadRestriction({ response: { status: 500 } }), null);
  assert.equal(auditLoadRestriction(new Error("Network Error")), null);
});

test("the page checks before requesting, and shows a 403 as the restriction", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/audit-trail/page.tsx"), "utf8");
  assert.match(page, /auditTrailRestriction\(usePermission\(\)\.can\("branches:view_all"\)\)/);
  assert.match(page, /restriction \? <AuditTrailRestricted message=\{restriction\} \/> : <AuditTrailContent \/>/);
  assert.match(page, /auditLoadRestriction\(err\)/);
  assert.match(page, /\{loadRestriction \?\?/);
});
