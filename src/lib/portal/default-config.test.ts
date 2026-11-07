import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PORTAL_CONFIG, withConfigDefaults } from "./default-config";

test("no payload gives the defaults", () => {
  assert.equal(withConfigDefaults(null), DEFAULT_PORTAL_CONFIG);
});

test("a partial payload keeps what it sent and fills the rest", () => {
  const c = withConfigDefaults({ portal_name: "Coop", features: { savings: false } as never, login_identifiers: [] });
  assert.equal(c.portal_name, "Coop");
  assert.equal(c.features.savings, false);
  assert.equal(c.features.loans, true);
  assert.deepEqual(c.login_identifiers, DEFAULT_PORTAL_CONFIG.login_identifiers);
  assert.equal(c.password_rules.min_length, 8);
});
