import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFeeFormula, describeFormulaInputs, roundPesos, SAMPLE_FORMULA_VALUES } from "./fee-expression";

const values = { ...SAMPLE_FORMULA_VALUES, principal_amount: 100_000 };

test("the task's example works out to ₱6.85", () => {
  const result = checkFeeFormula("(Principal Amount * 2.5%) / 365", values);
  assert.ok(result.ok);
  assert.ok(Math.abs(result.raw - 6.849315068) < 1e-6);
  assert.equal(result.amount, 6.85);
  assert.deepEqual(result.variables, ["principal_amount"]);
  assert.equal(result.expression, "(Principal Amount * 2.5%) / 365");
});

test("follows the usual order of operations", () => {
  const result = checkFeeFormula("100 + 2 * 3 - 4 / 2");
  assert.ok(result.ok);
  assert.equal(result.raw, 104);
});

test("variable names are case-insensitive and normalised", () => {
  const result = checkFeeFormula("principal_amount*interest rate%  *loan term", values);
  assert.ok(result.ok);
  assert.equal(result.expression, "Principal Amount * Interest Rate% * Loan Term");
  assert.equal(result.raw, 100_000 * 0.03 * 12);
});

test("reads × and ÷ and unary minus", () => {
  const result = checkFeeFormula("Loan Amount × 1% ÷ (2 - -2)", values);
  assert.ok(result.ok);
  assert.equal(result.raw, 250);
  assert.equal(result.expression, "Loan Amount * 1% / (2 - -2)");
});

test("rejects empty, unknown variables and bad characters", () => {
  assert.match(errorOf(""), /Enter a fee formula/);
  assert.match(errorOf("Salary * 2"), /"Salary" is not a variable/);
  assert.match(errorOf("Principal Amount ^ 2"), /"\^" is not allowed/);
  assert.match(errorOf("alert(1)"), /not a variable/);
  assert.match(errorOf("Principal Amount; 2"), /not allowed/);
});

test("rejects malformed expressions", () => {
  assert.match(errorOf("(Principal Amount * 2"), /never closed/);
  assert.match(errorOf("Principal Amount * 2)"), /closing bracket without/);
  assert.match(errorOf("Principal Amount *"), /ends too early/);
  assert.match(errorOf("* 2"), /needs a number or variable/);
  assert.match(errorOf("2 3"), /side by side/);
  assert.match(errorOf("()"), /closing bracket has nothing/);
});

test("rejects division by zero and negative results", () => {
  assert.match(errorOf("Principal Amount / (Loan Term - 12)"), /divides by zero/);
  assert.match(errorOf("Principal Amount / 0"), /divides by zero/);
  assert.match(errorOf("10 - Principal Amount"), /negative/);
});

test("rejects formulas over the length limit", () => {
  assert.match(errorOf("1 + ".repeat(80) + "1"), /255 characters/);
});

test("rounds half away from zero to centavos", () => {
  assert.equal(roundPesos(1.005), 1.01);
  assert.equal(roundPesos(6.849315), 6.85);
  assert.equal(roundPesos(2.344), 2.34);
});

function errorOf(text: string): string {
  const result = checkFeeFormula(text);
  assert.ok(!result.ok, `expected "${text}" to be rejected`);
  return result.error;
}

test("describes the loan figures a charged formula used", () => {
  const money = (n: number) => `P${n}`;
  assert.equal(
    describeFormulaInputs({ loan_term: 1, principal_amount: "5000", interest_rate: 3, bogus: 9 }, money),
    "Principal Amount P5000 · Interest Rate 3% · Loan Term 1 month",
  );
  assert.equal(describeFormulaInputs(undefined, money), "");
});
