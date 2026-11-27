import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_DOCUMENTS, WITHDRAWAL_SLIP, timeDepositDocuments } from "./documents";

// The ids are the printables catalog's (gap round F4c), so a document reads
// the same from the catalog and from the record.
test("the account page offers the four account documents, in words", () => {
  assert.deepEqual(
    ACCOUNT_DOCUMENTS.map((d) => d.id),
    ["savings_opening_form", "savings_agreement", "savings_closure_form", "savings_dormancy_notice"],
  );
  for (const d of ACCOUNT_DOCUMENTS) assert.doesNotMatch(d.label, /_/);
});

test("a withdrawal line prints its slip", () => {
  assert.deepEqual(WITHDRAWAL_SLIP, { id: "savings_withdrawal_slip", label: "Withdrawal slip" });
});

test("a running time deposit offers the early termination form; a settled one only the maturity notice", () => {
  assert.deepEqual(
    timeDepositDocuments("active").map((d) => d.id),
    ["time_deposit_maturity_notice", "time_deposit_early_termination"],
  );
  for (const status of ["matured", "withdrawn", "rolled_over", "preterminated"]) {
    assert.deepEqual(timeDepositDocuments(status).map((d) => d.id), ["time_deposit_maturity_notice"], status);
  }
});
