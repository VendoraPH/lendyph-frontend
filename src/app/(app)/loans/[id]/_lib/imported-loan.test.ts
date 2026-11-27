import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IMPORTED_APPROVAL_TITLE,
  IMPORTED_LOAN_NO_LABEL,
  importedApprovalNote,
  importedLoanNo,
  isImportedLoan,
} from "./imported-loan";

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

test("an imported loan's approval card says it came from the cooperative's records", () => {
  assert.equal(isImportedLoan({ is_imported: true }), true);
  assert.equal(isImportedLoan({ is_imported: false, external_loan_no: null }), false);
  // An older payload without the flag: the file's Loan No. still says so.
  assert.equal(isImportedLoan({ external_loan_no: "L-2019-0042" }), true);
  assert.equal(isImportedLoan({}), false);
  assert.equal(isImportedLoan(null), false);

  assert.equal(IMPORTED_APPROVAL_TITLE, "Imported from the cooperative's records");
  assert.equal(
    importedApprovalNote({ external_loan_no: "L-2019-0042" }),
    "This loan was imported from the cooperative's records (Loan No. L-2019-0042), so it has no approval chain in Lendy. It was approved before it was imported.",
  );
  assert.equal(
    importedApprovalNote({ external_loan_no: null }),
    "This loan was imported from the cooperative's records, so it has no approval chain in Lendy. It was approved before it was imported.",
  );
});

test("the loan page shows the imported note instead of \"Approval chain unavailable\" and names the loan by its display number", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

  assert.match(page, /\{IMPORTED_APPROVAL_TITLE\}/);
  assert.match(page, /importedApprovalNote\(loan\)/);
  // Both "unavailable" notes stand aside for an imported loan.
  assert.equal(page.match(/!loanIsImported && approvalUnavailable/g)?.length, 1);
  assert.equal(page.match(/!loanIsImported && !approvalUnavailable && approvalSteps\.length === 0\s*&& loanShouldHaveAChain/g)?.length, 1);
  // The header and the dialogs read one rule, never the LN- number alone.
  assert.match(page, /const loanNumber = loanNumberLabel\(loan\)/);
  assert.doesNotMatch(page, /loan\.loan_account_number \|\| loan\.application_number/);
  assert.doesNotMatch(page, /\{loan\.loan_account_number\}/);
});
