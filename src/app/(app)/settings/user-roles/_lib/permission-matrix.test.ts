import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODULE_ACTIONS, moduleActionLabel, moduleToggleActions } from "./permission-matrix";

const offered = Object.entries(MODULE_ACTIONS).flatMap(([mod, actions]) =>
  actions.map((action) => `${mod}:${action}`)
);

// These are the exact strings the backend must seed. `settings`, not
// `configure`: a seeder written from the old spec would create a permission
// nothing reads, and a role update naming ours would 422.
test("the matrix offers exactly the three credit_scoring permissions", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("credit_scoring:")), [
    "credit_scoring:view",
    "credit_scoring:override",
    "credit_scoring:settings",
  ]);
});

test("the matrix offers no collections permission", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("collections:")), []);
});

test("every offered permission is a well-formed module:action pair", () => {
  for (const p of offered) assert.match(p, /^[a-z_]+:[a-z_]+$/);
  assert.equal(new Set(offered).size, offered.length);
});

// Phase 2: the API seeds exactly these four (admin and super_admin). Any
// other `reminders:*` would be refused whole on save (422).
test("the matrix offers exactly the four reminders permissions", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("reminders:")), [
    "reminders:view",
    "reminders:send",
    "reminders:pause",
    "reminders:settings",
  ]);
});

// The API seeds one loan products permission, held by admin and super_admin.
// Viewing products rides on `loans:view`, so there is nothing else to offer.
test("the matrix offers loan_products:manage and nothing else for loan products", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("loan_products:")), ["loan_products:manage"]);
});

// The API seeds `branches:view_all` (backend #211) and, since Phase 6 (X0),
// `branches:manage`. Any other `branches:*` would be refused whole on save
// (422), breaking every later save of the role.
test("the matrix offers branches:view_all and branches:manage, and nothing else for branches", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("branches:")), ["branches:view_all", "branches:manage"]);
});

// Round C: posting the allowance is its own permission (backend C1 seeds
// `accounting:allowance` for super_admin, admin and accountant), so a
// bookkeeper who can post journals still can't post it.
test("the matrix offers accounting:allowance beside the other accounting verbs", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("accounting:")), [
    "accounting:view",
    "accounting:reconcile",
    "accounting:close",
    "accounting:settings",
    "accounting:allowance",
  ]);
});

test("the roles screen labels the allowance permission in words", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  assert.match(page, /allowance: \{ label: "Post the allowance"/);
});

// Posting the allowance moves the books for every branch, so ticking
// "toggle all" on Accounting never grants it, as with `loans:write_off`.
test("the Accounting toggle-all leaves out the allowance, which has its own checkbox", () => {
  assert.deepEqual(moduleToggleActions("accounting"), ["view", "reconcile", "close", "settings"]);
  assert.ok(MODULE_ACTIONS.accounting.includes("allowance"));
  assert.deepEqual(moduleToggleActions("loans").includes("write_off"), false);
});

// `loans:edit_in_approval` is the Chairman/Chairwoman's alone (finish run
// round 2): offered with its own checkbox, in words, and never swept in by the
// Loans toggle-all.
test("the Chair's edit during approval has its own checkbox, in words, outside the Loans toggle-all", () => {
  assert.ok(offered.includes("loans:edit_in_approval"));
  assert.equal(moduleToggleActions("loans").includes("edit_in_approval"), false);
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  assert.match(page, /edit_in_approval: \{ label: "Edit loans at their approval step"/);
});

// `expenses:pay` (settling a payable) is seeded by the API; the editor offers it
// so a custom role can be given it, and its "toggle all" covers it like the rest.
test("the matrix offers the four expenses permissions, pay included", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("expenses:")), [
    "expenses:view",
    "expenses:create",
    "expenses:update",
    "expenses:pay",
  ]);
  assert.ok(moduleToggleActions("expenses").includes("pay"));
});

// Phase 3: the API seeds exactly these sixteen (`CdaAccess::PERMISSIONS`, for
// admin and super_admin). Any other `cda:*` would be refused whole on save.
test("the matrix offers exactly the sixteen CDA permissions, in the server's order", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("cda:")), [
    "cda:view",
    "cda:prepare",
    "cda:upload",
    "cda:review",
    "cda:approve",
    "cda:finalize",
    "cda:reopen",
    "cda:submit",
    "cda:export",
    "cda:settings",
    "cda:manage_officers",
    "cda:manage_social",
    "cda:manage_mediation",
    "cda:view_mediation",
    "cda:view_audit",
    "cda:view_tax",
  ]);
});

test("CDA's toggle-all leaves the three restricted views to their own checkboxes", () => {
  const swept = moduleToggleActions("cda");
  for (const view of ["view_mediation", "view_audit", "view_tax"] as const) assert.equal(swept.includes(view), false);
  assert.ok(swept.includes("view"));
  assert.equal(swept.length, 13);
});

test("every CDA permission reads in CDA's own words", () => {
  for (const action of MODULE_ACTIONS.cda) {
    const label = moduleActionLabel("cda", action);
    assert.ok(label && !label.includes("_"), action);
  }
});

// Phase 3: the API seeds exactly these six Member Portal staff permissions
// (migration 2026_11_11_700200, for admin and super_admin).
test("the matrix offers exactly the six Member Portal permissions, in the server's order", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("member_portal:")), [
    "member_portal:view",
    "member_portal:invite",
    "member_portal:manage",
    "member_portal:requests",
    "member_portal:announcements",
    "member_portal:settings",
  ]);
  assert.deepEqual(moduleToggleActions("member_portal"), MODULE_ACTIONS.member_portal);
});

test("every Member Portal permission reads in its own words", () => {
  for (const action of MODULE_ACTIONS.member_portal) {
    const label = moduleActionLabel("member_portal", action);
    assert.ok(label && !label.includes("_"), action);
  }
});

// Phase 4 (B2): the API seeds exactly these four for admin and super_admin.
test("the matrix offers exactly the four penalties permissions", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("penalties:")), [
    "penalties:view",
    "penalties:create",
    "penalties:update",
    "penalties:delete",
  ]);
  assert.deepEqual(moduleToggleActions("penalties"), ["view", "create", "update", "delete"]);
});

// The general `delete` label reads "Deactivate"; on penalties deactivating is
// `update`, and `delete` really deletes, so each action has its own words.
test("the penalties actions read in their own words", () => {
  assert.equal(moduleActionLabel("penalties", "view"), "View penalty configurations");
  assert.equal(moduleActionLabel("penalties", "create"), "Create configurations");
  assert.equal(moduleActionLabel("penalties", "update"), "Edit, activate and deactivate");
  assert.equal(moduleActionLabel("penalties", "delete"), "Delete unused configurations");
});

test("the roles screen describes the Penalties module", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  assert.match(page, /penalties: \{\n\s+label: "Penalties"/);
});

// Linda v1: the API seeds exactly these two for admin and super_admin. `use`
// asks Linda questions; `settings` chooses the AI model (Settings → Linda,
// with See all branches).
test("the matrix offers exactly the two Linda permissions", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("linda:")), ["linda:use", "linda:settings"]);
  assert.deepEqual(moduleToggleActions("linda"), ["use", "settings"]);
});

test("the roles screen describes the Linda module and labels its use action", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  assert.match(page, /linda: \{\n\s+label: "Linda \(AI assistant\)"/);
  assert.match(page, /\n  use: \{ label: "Use",/);
});

// Phase 6 (X0): the API seeds these for admin and super_admin only. Each
// module's checkboxes are exactly the server's keys, in its order.
const PHASE6_OFFERED: Record<string, string[]> = {
  amla: [
    "amla:view",
    "amla:alerts",
    "amla:cases",
    "amla:cdd",
    "amla:screening",
    "amla:sanctions",
    "amla:ctr",
    "amla:str",
    "amla:approve",
    "amla:export",
    "amla:submit",
    "amla:settings",
    "amla:audit",
  ],
  dashboard: ["dashboard:view", "dashboard:analytics", "dashboard:export", "dashboard:settings"],
  interbranch_transfers: [
    "interbranch_transfers:view",
    "interbranch_transfers:create",
    "interbranch_transfers:approve",
    "interbranch_transfers:receive",
  ],
  loan_origination: [
    "loan_origination:view",
    "loan_origination:update",
    "loan_origination:assess",
    "loan_origination:convert",
    "loan_origination:settings",
  ],
};

for (const [mod, keys] of Object.entries(PHASE6_OFFERED)) {
  test(`the matrix offers exactly the ${mod} permissions the server seeds`, () => {
    assert.deepEqual(offered.filter((p) => p.startsWith(`${mod}:`)), keys);
  });
}

test("the matrix offers borrowers:transfer beside the other member permissions", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("borrowers:")), [
    "borrowers:view",
    "borrowers:create",
    "borrowers:update",
    "borrowers:delete",
    "borrowers:approve",
    "borrowers:transfer",
  ]);
});

// No key ever reads raw: every Phase 6 checkbox has its module's own words.
test("every Phase 6 permission reads in its module's own words", () => {
  const phase6 = [...Object.values(PHASE6_OFFERED).flat(), "borrowers:transfer", "branches:manage"].filter(
    (p) => p !== "dashboard:view",
  );
  for (const permission of phase6) {
    const [mod, action] = permission.split(":");
    const label = moduleActionLabel(mod as keyof typeof MODULE_ACTIONS, action as never);
    assert.ok(label, `${permission} has no label of its own`);
    assert.doesNotMatch(label, /_|:/, permission);
  }
});

// The roles screen names every offered module and every offered action, so a
// checkbox can never fall back to its raw key.
test("the roles screen describes every module the matrix offers", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  for (const mod of Object.keys(MODULE_ACTIONS)) {
    assert.match(page, new RegExp(`\\n  ${mod}: \\{\\n\\s+label: "[^"_]+"`), mod);
  }
});

test("the roles screen labels every offered action in words", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/settings/user-roles/page.tsx"), "utf8");
  const actions = new Set(Object.values(MODULE_ACTIONS).flat());
  for (const action of actions) {
    assert.match(page, new RegExp(`\\n  ${action}: \\{ label: "[^"_]+"`), action);
  }
});

// Releasing an AMLA order's holds and reading the AMLA log are granted on
// their own, never swept in with the rest of the module.
test("AMLA's toggle-all leaves sanctions and the AMLA log to their own checkboxes", () => {
  const swept = moduleToggleActions("amla" as never);
  assert.equal(swept.includes("sanctions" as never), false);
  assert.equal(swept.includes("audit" as never), false);
  assert.equal(swept.length, 11);
});
