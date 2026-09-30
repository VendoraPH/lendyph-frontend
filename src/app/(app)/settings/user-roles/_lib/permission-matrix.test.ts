import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_ACTIONS } from "./permission-matrix";

const offered = Object.entries(MODULE_ACTIONS).flatMap(([mod, actions]) =>
  actions.map((action) => `${mod}:${action}`)
);

// The API seeds no credit_scoring:* permission, so a role update naming one
// is refused whole with a 422. Offering it here is how PUT /roles/1 failed.
test("the matrix offers no credit_scoring permission", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("credit_scoring:")), []);
});

test("the matrix offers no collections permission", () => {
  assert.deepEqual(offered.filter((p) => p.startsWith("collections:")), []);
});

test("every offered permission is a well-formed module:action pair", () => {
  for (const p of offered) assert.match(p, /^[a-z_]+:[a-z_]+$/);
  assert.equal(new Set(offered).size, offered.length);
});
