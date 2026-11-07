import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canClose,
  canDeposit,
  canWithdraw,
  openingDepositProblem,
  parseAmountInput,
  productProblems,
  statusTabs,
  toAmount,
  withdrawalProblem,
} from "./savings-rules";
import type { SavingsProductInput } from "@/types";

test("toAmount reads numbers, decimal strings and garbage", () => {
  assert.equal(toAmount(12.5), 12.5);
  assert.equal(toAmount("1500.00"), 1500);
  assert.equal(toAmount(null), 0);
  assert.equal(toAmount("abc"), 0);
});

test("parseAmountInput accepts positive amounts with at most 2 decimals", () => {
  assert.equal(parseAmountInput("1,000.50"), 1000.5);
  assert.equal(parseAmountInput(" 200 "), 200);
  assert.equal(parseAmountInput("0"), null);
  assert.equal(parseAmountInput("10.555"), null);
  assert.equal(parseAmountInput("-5"), null);
  assert.equal(parseAmountInput(""), null);
});

test("deposit, withdraw and close follow the account status", () => {
  assert.equal(canDeposit({ status: "dormant" }), true);
  assert.equal(canDeposit({ status: "frozen" }), false);
  assert.equal(canWithdraw({ status: "dormant" }), false);
  assert.equal(canWithdraw({ status: "active" }), true);
  assert.equal(canClose({ status: "active", hold_amount: "0.00" }), true);
  assert.equal(canClose({ status: "active", hold_amount: "50.00" }), false);
  assert.equal(canClose({ status: "closed", hold_amount: 0 }), false);
});

test("openingDepositProblem enforces the product minimum", () => {
  assert.equal(openingDepositProblem(null, null), "Enter the opening deposit.");
  assert.match(openingDepositProblem(100, { minimum_opening_balance: "500.00" }) ?? "", /at least 500\.00/);
  assert.equal(openingDepositProblem(500, { minimum_opening_balance: "500.00" }), null);
});

test("withdrawalProblem stops at the available balance", () => {
  assert.match(withdrawalProblem(1001, { available_balance: "1000.00" }) ?? "", /Only 1000\.00/);
  assert.equal(withdrawalProblem(1000, { available_balance: "1000.00" }), null);
  assert.equal(withdrawalProblem(null, { available_balance: 5 }), "Enter an amount.");
});

const product: SavingsProductInput = {
  code: "RS",
  name: "Regular Savings",
  kind: "regular",
  annual_interest_rate: 2,
  interest_posting: "quarterly",
  minimum_opening_balance: 500,
  maintaining_balance: 500,
  minimum_balance_for_interest: 1000,
  dormant_after_days: 730,
  withholding_tax_rate: 20,
  term_options_days: null,
  pretermination_rate: null,
  is_active: true,
};

test("productProblems lists every invalid field", () => {
  assert.deepEqual(productProblems(product), []);
  assert.deepEqual(
    productProblems({ ...product, code: " ", annual_interest_rate: 120, dormant_after_days: 0 }),
    ["Code", "Interest rate (0–100%)", "Dormant after (days)"],
  );
  assert.deepEqual(productProblems({ ...product, dormant_after_days: null }), []);
  assert.deepEqual(productProblems({ ...product, withholding_tax_rate: 101 }), ["Withholding tax (0–100%)"]);
});

test("productProblems checks a time deposit's terms and pre-termination rate", () => {
  const td: SavingsProductInput = {
    ...product,
    kind: "time_deposit",
    annual_interest_rate: 4,
    dormant_after_days: 0, // ignored for time deposits
    term_options_days: [90, 180],
    pretermination_rate: 1,
  };
  assert.deepEqual(productProblems(td), []);
  assert.deepEqual(productProblems({ ...td, term_options_days: [] }), ["Terms offered (days)"]);
  assert.deepEqual(productProblems({ ...td, pretermination_rate: 5 }), [
    "Pre-termination rate (0 up to the regular rate)",
  ]);
});

test("statusTabs totals the server's per-status counts", () => {
  const tabs = statusTabs({ active: 10, dormant: 2, closed: 1 });
  assert.deepEqual(tabs.map((t) => [t.value, t.count]), [
    ["all", 13],
    ["active", 10],
    ["dormant", 2],
    ["frozen", 0],
    ["closed", 1],
  ]);
  assert.equal(statusTabs(undefined)[0].count, 0);
});
