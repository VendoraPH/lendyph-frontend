import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_PRODUCT_MAX,
  OTHER_FEE_DETAIL_MAX,
  PURPOSE_MAX,
  TERM_MONTHS_MAX,
  loanFieldProblems,
} from "./import-loan-fields";

/**
 * The server's rules, written out from lendyph-backend
 * (app/Services/CsvImport), so the client's copy is checked against them:
 *
 * ValueNormalizer::centavos(), every money cell (Loan Amount, Loan Balance,
 * Interest Amount, Interest Balance, Processing Fee, Service Fee, Other Fee
 * Amount), after a trim:
 *  1. starts with "(" or ends with ")": refused, accounting notation;
 *  2. with "₱", ",", spaces and "php" (any case) removed and leading "+"
 *     dropped, starts or ends with "-": refused, negative;
 *  3. matches /^\d*\.\d{3,}$/: refused, more than 2 decimal places;
 *  4. doesn't match /^(\d+(\.\d{1,2})?|\.\d{1,2})$/: refused, not an amount;
 *  5. above 999,999,999,999 centavos: refused, too large.
 * ValueNormalizer::rate(), Interest Rate: "%", spaces and "," removed, then
 * /^\d+(\.\d{1,4})?$/ or refused, and above 9999.9999 refused.
 * ValueNormalizer::integer(), Term in Months: "," and spaces removed, digits
 * only, from 1 to LoanRowNormalizer::MAX_TERM_MONTHS (120).
 * LoanRowNormalizer::checkRelationships(), on the values that read:
 *  - maturity on or before the date released: refused;
 *  - Loan Balance above Loan Amount: refused;
 *  - Loan Amount of 0 or less: refused;
 *  - Interest Balance above Interest Amount: refused;
 *  - Other Fee Amount above 0 with no Other Fee Detail: a warning.
 * CsvImportProcessor::deductionsFor(): the fees above 0 adding up to more than
 * the Loan Amount refuse the row.
 * Purpose past 500 and Loan Product and Other Fee Detail past 255 characters
 * are cut, with a warning (ValueNormalizer::boundedText(), LoanRowNormalizer).
 */

/** A loans row as the pre-check reads it, every cell the server takes. */
const ROW: Record<string, string> = {
  loan_amount: "50,000.00",
  loan_balance: "20,000.00",
  interest_rate: "2.0000",
  interest_amount: "12,000.00",
  interest_balance: "4,800.00",
  purpose: "Business capital",
  loan_product: "Regular Loan",
  term_months: "12",
  processing_fee: "1,000.00",
  service_fee: "500.00",
  other_fee_detail: "",
  other_fee_amount: "",
};

const DATES = { date_released: "2025-01-15", maturity_date: "2026-01-15" };

const MONEY_COLUMNS: Array<[string, string]> = [
  ["loan_amount", "Loan Amount"],
  ["loan_balance", "Loan Balance"],
  ["interest_amount", "Interest Amount"],
  ["interest_balance", "Interest Balance"],
  ["processing_fee", "Processing Fee"],
  ["service_fee", "Service Fee"],
  ["other_fee_amount", "Other Fee Amount"],
];

function problems(cells: Record<string, string>, dates: Record<string, string> = DATES) {
  return loanFieldProblems({ ...ROW, ...cells }, { dates }).map((problem) => [problem.label, problem.severity, problem.message]);
}

test("a complete row raises nothing", () => {
  assert.deepEqual(problems({}), []);
});

test("the limits are the server's", () => {
  assert.deepEqual([TERM_MONTHS_MAX, PURPOSE_MAX, LOAN_PRODUCT_MAX, OTHER_FEE_DETAIL_MAX], [120, 500, 255, 255]);
});

test("an amount the server reads raises nothing, in any money cell", () => {
  for (const [key] of MONEY_COLUMNS) {
    // The cell alone, so no balance or fee is compared with it (an other fee
    // has its description).
    for (const amount of ["₱1,000.00", "PHP 1,000", "php1000", "1 000.5", "+500", ".5", "1000", "0.50"]) {
      assert.deepEqual(loanFieldProblems({ other_fee_detail: "Notarial", [key]: amount }, { dates: {} }), [], `${key} "${amount}"`);
    }
  }
});

test("a negative amount is refused in every money cell, in the server's words", () => {
  for (const [key, label] of MONEY_COLUMNS) {
    for (const amount of ["(1,234.00)", "1,234.00)", "(500"]) {
      assert.deepEqual(problems({ [key]: amount }), [
        [label, "error", `"${amount}" is written in accounting notation for a negative amount. Negative amounts cannot be imported.`],
      ], `${key} "${amount}"`);
    }
    for (const amount of ["-500", "500-", "₱-1,000", "PHP -50", "+-5"]) {
      assert.deepEqual(problems({ [key]: amount }), [
        [label, "error", `"${amount}" is a negative amount, which cannot be imported.`],
      ], `${key} "${amount}"`);
    }
  }
});

test("an amount the server can't read is refused in its words: precision, form and size", () => {
  const cases: Array<[string, string]> = [
    ["1234.567", "has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you."],
    ["1234.500", "has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you."],
    ["$500", "is not a valid amount."],
    ["P500", "is not a valid amount."],
    ["N/A", "is not a valid amount."],
    ["1.2.3", "is not a valid amount."],
    ["12.", "is not a valid amount."],
    ["₱", "is not a valid amount."],
    ["10000000000", "is larger than the maximum this system stores (9,999,999,999.99)."],
    ["99999999999999999999", "is larger than the maximum this system stores (9,999,999,999.99)."],
  ];
  for (const [amount, words] of cases) {
    assert.deepEqual(problems({ processing_fee: amount }), [["Processing Fee", "error", `"${amount}" ${words}`]], amount);
  }
  // The column's full width reads.
  assert.deepEqual(problems({ loan_amount: "9,999,999,999.99", loan_balance: "9,999,999,999.99" }), []);
});

test("an interest rate is read as the server reads it", () => {
  for (const rate of ["3", "3%", "3.1416", "9,999.9999", "12 %"]) {
    assert.deepEqual(problems({ interest_rate: rate }), [], rate);
  }
  for (const rate of ["-3", "3.14159", "N/A", "3.5.1"]) {
    assert.deepEqual(problems({ interest_rate: rate }), [["Interest Rate", "error", `"${rate}" is not a valid interest rate.`]], rate);
  }
  assert.deepEqual(problems({ interest_rate: "10000" }), [
    ["Interest Rate", "error", '"10000" is larger than the maximum interest rate this system stores.'],
  ]);
});

test("a term is a whole number of months from 1 to 120, in the server's words", () => {
  for (const term of ["1", "120", "006", "1 2", "1,2", "1\u00A02"]) {
    assert.deepEqual(problems({ term_months: term }), [], JSON.stringify(term));
  }
  for (const term of ["0", "121", "000", "99999999999999999999"]) {
    assert.deepEqual(problems({ term_months: term }), [["Term in Months", "error", `"${term}" is outside the accepted range 1–120.`]], term);
  }
  for (const term of ["12.5", "12.0", "-6", "+6", "₱12", "12 months", "1e2", "twelve", "1\t2"]) {
    assert.deepEqual(problems({ term_months: term }), [["Term in Months", "error", `"${term}" is not a whole number.`]], JSON.stringify(term));
  }
});

test("a maturity date on or before the date released is refused, on the dates as read", () => {
  for (const maturity of ["2025-01-15", "2024-12-31"]) {
    assert.deepEqual(problems({}, { date_released: "2025-01-15", maturity_date: maturity }), [
      ["Maturity Date", "error", `The maturity date (${maturity}) is not after the date released (2025-01-15), so no payment schedule can be built.`],
    ]);
  }
  assert.deepEqual(problems({}, { date_released: "2025-01-15", maturity_date: "2025-01-16" }), []);
  // A date that didn't read is the date check's; nothing is compared.
  assert.deepEqual(problems({}, { date_released: "2025-01-15" }), []);
});

test("a balance above its amount, and a loan amount of zero, are refused in the server's words", () => {
  assert.deepEqual(problems({ loan_balance: "50,000.01" }), [
    ["Loan Balance", "error", "The loan balance is larger than the loan amount. A balance cannot exceed the principal that was released."],
  ]);
  assert.deepEqual(problems({ loan_balance: "50,000.00" }), [], "a balance equal to the amount reads");
  assert.deepEqual(problems({ interest_balance: "12,000.01" }), [
    ["Interest Balance", "error", "The interest balance is larger than the total interest. A balance cannot exceed what was charged."],
  ]);
  assert.deepEqual(problems({ loan_amount: "0.00", loan_balance: "0", processing_fee: "", service_fee: "" }), [
    ["Loan Amount", "error", "The loan amount must be greater than zero."],
  ]);
  // A cell that didn't read is compared with nothing, as on the server.
  assert.deepEqual(problems({ loan_amount: "N/A" }).map(([label]) => label), ["Loan Amount"]);
});

test("fees above the principal refuse the whole row, as the import pass does", () => {
  const row = { loan_amount: "1,000.00", loan_balance: "500.00", processing_fee: "600.00", service_fee: "300.00", other_fee_detail: "Notarial", other_fee_amount: "100.01" };
  assert.deepEqual(problems(row), [
    [null, "error", "The fees on this loan add up to more than the principal, which would make its net proceeds negative. Check the Processing Fee, Service Fee and Other Fee Amount cells."],
  ]);
  assert.deepEqual(problems({ ...row, other_fee_amount: "100.00" }), [], "fees equal to the principal import");
});

test("an other-fee amount with no description warns, in the server's words", () => {
  assert.deepEqual(problems({ other_fee_amount: "150.00" }), [
    ["Other Fee Detail", "warning", "An other-fee amount was given with no description. The disclosure statement has to itemise every deduction, so a description will need to be added."],
  ]);
  assert.deepEqual(problems({ other_fee_amount: "0.00" }), []);
  assert.deepEqual(problems({ other_fee_amount: "150.00", other_fee_detail: "Notarial fee" }), []);
});

test("Purpose past 500, and Loan Product and Other Fee Detail past 255, warn that they are cut", () => {
  assert.deepEqual(problems({ purpose: "x".repeat(500), loan_product: "p".repeat(255), other_fee_detail: "d".repeat(255) }), []);
  assert.deepEqual(problems({ purpose: "x".repeat(501), loan_product: "p".repeat(256), other_fee_detail: "d".repeat(300), other_fee_amount: "1.00" }), [
    ["Purpose", "warning", "Purpose is 501 characters. The import keeps the first 500."],
    ["Loan Product", "warning", "Loan Product is 256 characters. The import keeps the first 255."],
    ["Other Fee Detail", "warning", "Other Fee Detail is 300 characters. The import keeps the first 255."],
  ]);
});

test("characters are counted as the server counts them, not UTF-16 units", () => {
  // `mb_strlen` counts a character outside the basic plane once; `.length`, twice.
  const fits = "🌾".repeat(500);
  assert.equal(fits.length, 1000);
  assert.deepEqual(problems({ purpose: fits }), []);
  assert.deepEqual(problems({ purpose: `${fits}🌾` }), [["Purpose", "warning", "Purpose is 501 characters. The import keeps the first 500."]]);
});
