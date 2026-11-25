import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IMPORTED_LOAN_NO_LABEL, importedLoanNo } from "./imported-loan";

test("an imported loan shows its Loan No. from the file, only when there is one", () => {
  assert.equal(IMPORTED_LOAN_NO_LABEL, "Loan No. in the imported file");
  assert.equal(importedLoanNo({ external_loan_no: "L-2019-0042" }), "L-2019-0042");

  for (const loan of [{ external_loan_no: null }, { external_loan_no: "" }, { external_loan_no: "  " }, {}, null, undefined]) {
    assert.equal(importedLoanNo(loan), null, JSON.stringify(loan));
  }
});

test("the loan page shows the file's Loan No. and what Total Paid holds from before the import", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

  assert.match(page, /importedLoanNo\(loan\)/);
  assert.match(page, /\{IMPORTED_LOAN_NO_LABEL\}/);
  // Both Total Paid figures (Loan Summary and the Amortization Balance tab).
  assert.equal(page.match(/paidBeforeImportNote\(loanSummary\?\.paid_before_import\)/g)?.length, 1);
  assert.equal(page.match(/\{totalPaidNote && /g)?.length, 2);
});
