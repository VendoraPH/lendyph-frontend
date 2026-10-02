import { test } from "node:test";
import assert from "node:assert/strict";
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

// Same hazard as credit_scoring: the API seeds no reminders:* permission yet,
// so ticking one would make every later save of that role answer 422.
test("the matrix offers no reminders permission", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("reminders:")), []);
});
