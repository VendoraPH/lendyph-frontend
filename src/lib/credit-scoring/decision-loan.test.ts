import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decisionLoanLabel } from "./decision-loan";

test("a decision on a loan names the loan by its account number", () => {
  assert.equal(decisionLoanLabel({ loan_account_number: "LN-000004" }), "Loan LN-000004");
});

test("a member-level decision, or one from an API without the field, names no loan", () => {
  assert.equal(decisionLoanLabel({ loan_account_number: null }), null);
  assert.equal(decisionLoanLabel({}), null);
  assert.equal(decisionLoanLabel({ loan_account_number: "  " }), null);
});

test("the member profile's decisions list shows each decision's loan", () => {
  const dir = join(process.cwd(), "src/app/(app)/credit-scoring");
  const list = readFileSync(join(dir, "_components/decision-list.tsx"), "utf8");
  const member = readFileSync(join(dir, "borrowers/[id]/_components/member-decisions.tsx"), "utf8");
  assert.match(list, /decisionLoanLabel\(d\)/);
  assert.match(member, /<DecisionItems decisions=\{res\.data\} showLoan \/>/);
});
