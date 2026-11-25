import { test } from "node:test";
import assert from "node:assert/strict";
import { memberFieldProblems } from "./import-member-fields";

/**
 * A member's two amounts, Monthly Income and Pledge Amt, as the server reads
 * them (lendyph-backend, app/Services/CsvImport), written out:
 *
 * `CustomerRowNormalizer::cappedAmount()` reads each with
 * `ValueNormalizer::centavos()`, after a trim:
 *  1. starts with "(" or ends with ")": refused, accounting notation;
 *  2. with "₱", ",", spaces and "php" (any case) removed and leading "+"
 *     dropped, starts or ends with "-": refused, negative;
 *  3. matches /^\d*\.\d{3,}$/: refused, more than 2 decimal places;
 *  4. doesn't match /^(\d+(\.\d{1,2})?|\.\d{1,2})$/: refused, not an amount;
 *  5. above 999,999,999,999 centavos: refused, too large.
 * An amount that reads but is above what the member form allows (Monthly
 * Income 99,999,999.99, Pledge Amt 9,999,999.99) is imported blank, with a
 * warning. A refusal refuses the member's row.
 */

const CONTEXT = { dates: {}, today: "2026-11-25", membershipAllowed: true };

const AMOUNTS: Array<[string, string]> = [
  ["monthly_income", "Monthly Income"],
  ["pledge_amount", "Pledge Amt(If Applicable)"],
];

function problems(cells: Record<string, string>) {
  return memberFieldProblems(cells, CONTEXT).map((problem) => [problem.label, problem.severity, problem.message]);
}

test("an amount the server reads raises nothing", () => {
  for (const [key] of AMOUNTS) {
    for (const amount of ["25,000.50", "₱18,500.00", "PHP 1,000", "php1000", "+500", ".5", "0", "1 000"]) {
      assert.deepEqual(problems({ [key]: amount }), [], `${key} "${amount}"`);
    }
  }
});

test("an amount the server refuses is refused here, in its words", () => {
  const cases: Array<[string, string]> = [
    ["(1,000.00)", "is written in accounting notation for a negative amount. Negative amounts cannot be imported."],
    ["-500", "is a negative amount, which cannot be imported."],
    ["500-", "is a negative amount, which cannot be imported."],
    ["1234.500", "has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you."],
    ["1234.567", "has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you."],
    ["$500", "is not a valid amount."],
    ["P500", "is not a valid amount."],
    ["N/A", "is not a valid amount."],
    ["10000000000", "is larger than the maximum this system stores (9,999,999,999.99)."],
  ];
  for (const [key, label] of AMOUNTS) {
    for (const [amount, words] of cases) {
      assert.deepEqual(problems({ [key]: amount }), [[label, "error", `"${amount}" ${words}`]], `${key} "${amount}"`);
    }
  }
});

test("an amount above what the member form allows is imported blank, with the server's warning", () => {
  assert.deepEqual(problems({ monthly_income: "99,999,999.99" }), []);
  assert.deepEqual(problems({ monthly_income: "100,000,000.00" }), [
    ["Monthly Income", "warning", "This amount is above the 99,999,999.99 the member form allows, so it will be imported as blank rather than leaving a member who cannot be saved."],
  ]);
  assert.deepEqual(problems({ pledge_amount: "9,999,999.99" }), []);
  assert.deepEqual(problems({ pledge_amount: "10,000,000.00" }), [
    ["Pledge Amt(If Applicable)", "warning", "This amount is above the 9,999,999.99 the member form allows, so it will be imported as blank rather than leaving a member who cannot be saved."],
  ]);
  // The form's limits differ: fifty million is a monthly income, not a pledge.
  assert.deepEqual(problems({ monthly_income: "50000000", pledge_amount: "50000000" }), [
    ["Pledge Amt(If Applicable)", "warning", "This amount is above the 9,999,999.99 the member form allows, so it will be imported as blank rather than leaving a member who cannot be saved."],
  ]);
});

test("the amounts are checked whatever the person importing may edit", () => {
  assert.deepEqual(
    memberFieldProblems({ monthly_income: "-1" }, { ...CONTEXT, membershipAllowed: false }).map((problem) => problem.message),
    ['"-1" is a negative amount, which cannot be imported.'],
  );
});

/**
 * A birthdate as `CustomerRowNormalizer::birthdate()` holds it, once read:
 *  - after today: imported blank, with a warning;
 *  - before 1900-01-01: imported blank, with a warning;
 *  - later than today less 18 years: imported, with a warning (under 18).
 * A birthdate imported blank is not compared with Date Hired.
 */
test("a birthdate the server blanks or flags warns here, in its words", () => {
  const birthdate = (iso: string, extra: Record<string, string> = {}) =>
    memberFieldProblems({ birthdate: iso, ...extra }, { ...CONTEXT, dates: { birthdate: iso, ...(extra.date_hired ? { date_hired: extra.date_hired } : {}) } })
      .map((problem) => [problem.label, problem.severity, problem.message]);

  assert.deepEqual(birthdate("2026-12-01"), [["Birthdate", "warning", '"2026-12-01" is in the future, which cannot be a birthdate, so it will be imported as blank.']]);
  assert.deepEqual(birthdate("1850-04-03"), [["Birthdate", "warning", '"1850-04-03" is before 1900, so it will be imported as blank.']]);
  const under18 = '"2008-11-26" makes this member under 18. The record will be imported as-is because it is a fact on the coop\'s books, but the member form requires 18+, so this member can\'t be saved in the app until the birthdate is corrected.';
  assert.deepEqual(birthdate("2008-11-26"), [["Birthdate", "warning", under18]]);
  assert.deepEqual(birthdate("2008-11-25"), [], "eighteen today");
  assert.deepEqual(birthdate("1900-01-01"), []);
  // Imported blank, so a date hired is not held to it.
  assert.deepEqual(birthdate("2026-12-01", { date_hired: "2020-01-01" }).map(([label]) => label), ["Birthdate"]);
});
