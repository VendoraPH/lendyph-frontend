import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPassword, DEFAULT_PASSWORD_RULES, passwordProblem } from "./password-rules";

test("lists only the rules the cooperative turned on", () => {
  const labels = checkPassword("x", { ...DEFAULT_PASSWORD_RULES, require_symbol: true }).map((c) => c.label);
  assert.deepEqual(labels, ["At least 8 characters", "An uppercase letter", "A number", "A symbol, such as ! or #"]);
  assert.equal(checkPassword("x", { min_length: 6, require_uppercase: false, require_number: false, require_symbol: false }).length, 1);
});

test("marks each rule met or not", () => {
  const checks = checkPassword("Abcdefg1", DEFAULT_PASSWORD_RULES);
  assert.ok(checks.every((c) => c.met));
  assert.equal(checkPassword("abcdefg1", DEFAULT_PASSWORD_RULES)[1].met, false);
});

test("passwordProblem names the unmet rules, then a mismatch", () => {
  assert.match(passwordProblem("abc", "abc", DEFAULT_PASSWORD_RULES) ?? "", /at least 8 characters/);
  assert.equal(passwordProblem("Abcdefg1", "Abcdefg2", DEFAULT_PASSWORD_RULES), "The two passwords do not match.");
  assert.equal(passwordProblem("Abcdefg1", "Abcdefg1", DEFAULT_PASSWORD_RULES), null);
});
