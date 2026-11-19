import { test } from "node:test";
import assert from "node:assert/strict";
import { permissionModuleName, titleCaseKey, viewableModuleNames } from "./permission-module-names";

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

test("short words stay lower case inside a module name", () => {
  // The Access Restricted page listed "Chart Of Accounts".
  assert.equal(permissionModuleName("chart_of_accounts"), "Chart of Accounts");
  assert.deepEqual(viewableModuleNames(["chart_of_accounts:view"]), ["Chart of Accounts"]);
});

test("title case keeps of, and, the, to, for, in and on lower case except first", () => {
  assert.equal(titleCaseKey("statement_of_account"), "Statement of Account");
  assert.equal(titleCaseKey("terms_and_conditions"), "Terms and Conditions");
  assert.equal(titleCaseKey("cash_in_and_out"), "Cash in and Out");
  assert.equal(titleCaseKey("on_hold"), "On Hold");
  assert.equal(titleCaseKey("the_end_for_now"), "The End for Now");
  assert.equal(titleCaseKey("transfer_to_savings"), "Transfer to Savings");
  assert.equal(titleCaseKey("auto_pay"), "Auto Pay");
  assert.equal(titleCaseKey(""), "");
});
