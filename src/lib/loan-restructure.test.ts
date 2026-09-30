import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLoanDeductions,
  calcRestructureShortfall,
  restructureSuccessor,
} from "./loan-restructure";
import type { RestructuredIntoLoan } from "@/types/loan";

test("percentage fees carry their percent, not the peso amount", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 2,
      serviceFeePercent: 1.5,
      otherDeductions: [],
    }),
    [
      { name: "Processing Fee", amount: 2, type: "percentage" },
      { name: "Service Fee", amount: 1.5, type: "percentage" },
    ],
  );
});

test("zero-rate fees are omitted", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [],
    }),
    [],
  );
});

test("custom rows are sent as fixed peso amounts", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [{ name: " Notarial fee ", amount: "500" }],
    }),
    [{ name: "Notarial fee", amount: 500, type: "fixed" }],
  );
});

test("blank and zero custom rows are dropped, unnamed ones get a label", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [
        { name: "", amount: "" },
        { name: "Insurance", amount: "0" },
        { name: "", amount: "250" },
      ],
    }),
    [{ name: "Other Deduction", amount: 250, type: "fixed" }],
  );
});

test("no shortfall when principal covers the outstanding balance", () => {
  assert.equal(calcRestructureShortfall(50000, 50000), 0);
  assert.equal(calcRestructureShortfall(60000, 50000), 0);
});

test("shortfall is the uncovered remainder of the outstanding balance", () => {
  assert.equal(calcRestructureShortfall(40000, 50000), 10000);
});

test("shortfall is 0 while the amount is still blank or unknown", () => {
  assert.equal(calcRestructureShortfall(0, 50000), 0);
  assert.equal(calcRestructureShortfall(40000, null), 0);
});

// ── restructureSuccessor ────────────────────────────────────────────────────

const child = (
  id: number,
  status: RestructuredIntoLoan["status"],
  loanAccountNumber: string | null = null,
): RestructuredIntoLoan => ({
  id,
  application_number: `APP-${id}`,
  loan_account_number: loanAccountNumber,
  status,
  principal_amount: 10000,
  start_date: null,
});

test("the successor is the restructure that was released", () => {
  const released = child(12, "released", "LN-0012");
  assert.equal(
    restructureSuccessor([child(10, "rejected"), child(11, "void"), released]),
    released,
  );
});

test("a successor keeps being found after it moves on from released", () => {
  // The new loan does not stop being where the balance went once it is paid
  // off, defaulted or itself restructured.
  for (const status of ["ongoing", "completed", "defaulted", "restructured"] as const) {
    const moved = child(20, status, "LN-0020");
    assert.equal(restructureSuccessor([child(19, "rejected"), moved]), moved, status);
  }
});

test("rejected, voided and unreleased applications are never the successor", () => {
  assert.equal(
    restructureSuccessor([
      child(30, "rejected"),
      child(31, "void"),
      child(32, "draft"),
      child(33, "for_review"),
      child(34, "approved"),
    ]),
    null,
  );
});

test("no restructure applications, or none loaded, has no successor", () => {
  assert.equal(restructureSuccessor([]), null);
  assert.equal(restructureSuccessor(undefined), null);
  assert.equal(restructureSuccessor(null), null);
});

test("an untyped payload row is read the same way", () => {
  // The printable reads `restructured_into` off an untyped record.
  const rows: Record<string, unknown>[] = [
    { id: 40, status: "void" },
    { id: 41, status: "released", loan_account_number: "LN-0041" },
    { id: 42, status: 7 },
  ];
  assert.equal(restructureSuccessor(rows)?.id, 41);
});
