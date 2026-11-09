import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODULE_ACTIONS } from "./permission-matrix";

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

// The API seeds one branch permission (backend #211). Any other `branches:*`
// would be refused whole on save (422), breaking every later save of the role.
test("the matrix offers branches:view_all and nothing else for branches", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("branches:")), ["branches:view_all"]);
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
