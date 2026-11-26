import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { memberLoanNumber } from "./member-loan-number";

test("a loan reads by the server's display number first (round 8)", () => {
  assert.equal(
    memberLoanNumber({ display_number: "OLD-2023-0041", loan_account_number: null, application_number: "LA-000006" }),
    "OLD-2023-0041",
  );
  assert.equal(memberLoanNumber({ display_number: "LN-000012", application_number: "LA-000012" }), "LN-000012");
});

test("a payload without display_number falls back to the LN- number, the file's Loan No., then the application number", () => {
  assert.equal(memberLoanNumber({ loan_account_number: "LN-000004", application_number: "LA-000004" }), "LN-000004");
  assert.equal(memberLoanNumber({ external_loan_no: "BC-07", application_number: "LA-000007" }), "BC-07");
  assert.equal(memberLoanNumber({ application_number: "LA-000009" }), "LA-000009");
});

test("a loan with no number reads a dash, never a made-up \"LN-<id>\"", () => {
  assert.equal(memberLoanNumber({}), "—");
  assert.equal(memberLoanNumber({ display_number: "  ", loan_account_number: null }), "—");
});

test("the member page's Loans tab shows each loan's number first", () => {
  const tab = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/loans-tab.tsx"), "utf8");

  assert.match(tab, /<TableHead className="w-8" \/>\s*<TableHead>Loan No\.<\/TableHead>/);
  assert.match(tab, /memberLoanNumber\(loan\)/);
});
