import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLoanDeductions, calcRestructureShortfall } from "./loan-restructure";

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
