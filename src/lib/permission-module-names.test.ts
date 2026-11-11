import { test } from "node:test";
import assert from "node:assert/strict";
import { viewableModuleNames } from "./permission-module-names";

test("the Access Restricted page names the modules a user can view as the menu does", () => {
  assert.deepEqual(
    viewableModuleNames(["borrowers:view", "gcash:view", "auto_pay:view", "audit_logs:view", "loans:create"]),
    ["Members", "GCash", "Auto Pay", "Audit Logs"],
  );
});

test("CDA Compliance is listed only with every branch too, as its menu needs", () => {
  assert.deepEqual(viewableModuleNames(["cda:view", "loans:view"]), ["Loans"]);
  assert.deepEqual(viewableModuleNames(["cda:view", "branches:view_all"]), ["CDA Compliance"]);
});

test("the menu and this page read CDA's requirement from one place", async () => {
  const { CDA_NAV } = await import("@/constants/navigation");
  const { MODULE_ALSO_REQUIRES } = await import("./permission-module-names");
  assert.deepEqual(CDA_NAV.alsoRequires, MODULE_ALSO_REQUIRES.cda);
});
