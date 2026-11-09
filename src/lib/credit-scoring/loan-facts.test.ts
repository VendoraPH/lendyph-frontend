import { test } from "node:test";
import assert from "node:assert/strict";
import { borrowerScoreFilters, yesNoOrDash } from "./loan-facts";

test("a loan fact the server sends as null (no loans:view) reads a dash", () => {
  assert.equal(yesNoOrDash(null), "—");
  assert.equal(yesNoOrDash(undefined), "—");
  assert.equal(yesNoOrDash(true), "Yes");
  assert.equal(yesNoOrDash(false), "No");
});

test("the past-due and active-loan filters are never sent without loans:view", () => {
  const filters = { branch_id: 3, risk_level: "high" as const, past_due: true, has_active_loan: false };
  assert.deepEqual(borrowerScoreFilters(filters, false), { branch_id: 3, risk_level: "high" });
  assert.deepEqual(borrowerScoreFilters(filters, true), filters);
});
