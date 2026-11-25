import { test } from "node:test";
import assert from "node:assert/strict";
import { PURPOSE_MAX, TERM_MONTHS_MAX, loanFieldProblems } from "./import-loan-fields";

/** A loans row as the pre-check reads it, with only the cells these rules read. */
function row(cells: Record<string, string>) {
  return { term_months: "12", purpose: "Business capital", ...cells };
}

function problems(cells: Record<string, string>) {
  return loanFieldProblems(row(cells)).map((problem) => [problem.key, problem.severity, problem.category, problem.message, problem.raw]);
}

test("the limits are the server's: LoanRowNormalizer's MAX_TERM_MONTHS and loans.purpose's width", () => {
  assert.equal(TERM_MONTHS_MAX, 120);
  assert.equal(PURPOSE_MAX, 500);
});

test("a term the server reads raises nothing", () => {
  // ValueNormalizer::integer(): commas and spaces dropped, then digits only.
  for (const term of ["1", "12", "120", "006", "1 2", "1,2", "1 2"]) {
    assert.deepEqual(problems({ term_months: term }), [], JSON.stringify(term));
  }
});

test("a term outside 1 to 120 is refused", () => {
  for (const term of ["0", "121", "000", "99999999999999999999"]) {
    assert.deepEqual(problems({ term_months: term }), [
      ["term_months", "error", "value", `Term in Months "${term}" is outside 1 to 120 months, the terms the import takes.`, term],
    ], term);
  }
});

test("a term that isn't a whole number is refused, however a spreadsheet wrote it", () => {
  for (const term of ["12.5", "12.0", "12.", "-6", "+6", "₱12", "P12", "12 months", "1e2", "twelve", "1\t2"]) {
    assert.deepEqual(problems({ term_months: term }), [
      ["term_months", "error", "value", `Term in Months "${term}" isn't a whole number of months.`, term],
    ], JSON.stringify(term));
  }
});

test("a blank term is the required-field check's question, not this one", () => {
  assert.deepEqual(problems({ term_months: "" }), []);
});

test("a Purpose past 500 characters warns that the first 500 are kept; 500 raises nothing", () => {
  assert.deepEqual(problems({ purpose: "x".repeat(500) }), []);
  assert.deepEqual(problems({ purpose: "" }), []);
  const long = "Rice trading. ".repeat(40);
  assert.deepEqual(problems({ purpose: long }), [
    ["purpose", "warning", "size", `Purpose is ${long.trim().length} characters. The import keeps the first 500.`, long.trim()],
  ]);
});

test("a Purpose is measured in characters as the server counts them, not UTF-16 units", () => {
  // `mb_strlen` counts a character outside the basic plane once; `.length`, twice.
  const fits = "🌾".repeat(500);
  assert.equal(fits.length, 1000);
  assert.deepEqual(problems({ purpose: fits }), []);
  assert.equal(loanFieldProblems(row({ purpose: `${fits}🌾` }))[0]?.message, "Purpose is 501 characters. The import keeps the first 500.");
});
