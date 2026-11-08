import { test } from "node:test";
import assert from "node:assert/strict";
import { viewableModuleNames } from "./permission-module-names";

test("the Access Restricted page names the modules a user can view as the menu does", () => {
  assert.deepEqual(
    viewableModuleNames(["borrowers:view", "gcash:view", "auto_pay:view", "audit_logs:view", "loans:create"]),
    ["Members", "GCash", "Auto Pay", "Audit Logs"],
  );
});
