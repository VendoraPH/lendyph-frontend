import { test } from "node:test";
import assert from "node:assert/strict";
import { FINANCIALS_HIDDEN_NOTE, capacityRows, capacityView, pesoOrDash } from "./capacity";
import type { CreditCapacity } from "@/types/credit-scoring";

const full: CreditCapacity = {
  monthly_income: "30000.00",
  household_expenses: "12000.00",
  existing_debt_payments: "0.00",
  proposed_payment: "7500.00",
  proposed_payment_basis: "the monthly instalment",
  disposable_income: "18000.00",
  suggested_maximum_payment: "6000.00",
  debt_service_ratio: "25.00",
  assessment: "manageable",
  proposed_fits: false,
};

test("money shows the server's string with ₱ and two decimals, zero as ₱0.00", () => {
  assert.equal(pesoOrDash("30000.00"), "₱30,000.00");
  assert.equal(pesoOrDash("0.00"), "₱0.00");
});

test("a missing figure is a dash, never ₱0.00", () => {
  assert.equal(pesoOrDash(null), "—");
  assert.equal(pesoOrDash(undefined), "—");
  assert.equal(pesoOrDash(""), "—");
});

test("capacity rows read the server's figures in order, the ratio with %", () => {
  const rows = capacityRows(full);
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel["Monthly income"], "₱30,000.00");
  assert.equal(byLabel["Existing debt payments"], "₱0.00");
  assert.equal(byLabel["Suggested maximum payment"], "₱6,000.00");
  assert.equal(byLabel["Debt service ratio"], "25.00%");
  assert.equal(byLabel["Assessment"], "Manageable");
  assert.equal(byLabel["Proposed payment fits"], "No");
  const proposed = rows.find((r) => r.label === "Proposed payment");
  assert.equal(proposed?.value, "₱7,500.00");
  assert.equal(proposed?.note, "the monthly instalment");
});

test("a capacity block without income reads dashes, not zeros", () => {
  const rows = capacityRows({
    ...full,
    monthly_income: null,
    household_expenses: null,
    proposed_payment_basis: null,
    disposable_income: null,
    suggested_maximum_payment: null,
    debt_service_ratio: null,
    assessment: null,
    proposed_fits: null,
  });
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel["Monthly income"], "—");
  assert.equal(byLabel["Disposable income"], "—");
  assert.equal(byLabel["Debt service ratio"], "—");
  assert.equal(byLabel["Assessment"], "—");
  assert.equal(byLabel["Proposed payment fits"], "—");
  assert.equal(byLabel["Existing debt payments"], "₱0.00");
});

test("hidden financials read a neutral line, never dashes standing in for figures", () => {
  assert.deepEqual(capacityView(null, true), { kind: "hidden", note: FINANCIALS_HIDDEN_NOTE });
  assert.match(FINANCIALS_HIDDEN_NOTE, /shown to staff who can read the member's details and loans/);
});

test("no capacity block yet reads its own line; a block reads its rows", () => {
  assert.deepEqual(capacityView(null, false), { kind: "none", note: "No capacity figures yet." });
  const view = capacityView(full, false);
  assert.equal(view.kind, "rows");
  assert.equal(view.kind === "rows" && view.rows.length, 9);
});
