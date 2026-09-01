import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compatibilityNotes,
  initialSelection,
  rowsAwaitingAProduct,
  rowsUnreadable,
  RETRY_AFTER_FALLBACK_SECONDS,
  retryAfterSeconds,
  stillOutstanding,
  unmappedFromError,
} from "./product-mapping-table";
import type { CsvProductCompatibility, CsvProductMapping } from "@/types/data-import";

/**
 * Every fixture below is TRANSCRIBED FROM A LIVE RESPONSE, not shaped from the
 * type.
 *
 * That distinction is the reason this file exists. The first version of this
 * screen was verified against a stub built from the same (wrong) types the
 * component read, so the stub and the component agreed with each other and both
 * disagreed with the server — `csv_name` for `csv_value`, `suggested_product_id`
 * for `suggested_loan_product_id`, a top-level `compatibility` block that does
 * not exist. It compiled, it rendered, and every row was blank against the real
 * API. A fixture derived from a contract cannot test the contract.
 *
 * These come from `GET`/`PUT /api/imports/2/product-mapping` on staging, run 2,
 * captured 2026-09-02.
 */

/** Live: the `Salary Loan` cohort, BEFORE anything was confirmed. Compatibility
 *  is already populated — the server measures against the suggestion when there
 *  is no confirmed mapping, so an exact match is checked while the admin can
 *  still change their mind. */
const SALARY_LOAN: CsvProductMapping = {
  csv_value: "Salary Loan",
  is_blank: false,
  loan_count: 2,
  valid_loan_count: 2,
  invalid_loan_count: 0,
  blocking: true,
  suggested_loan_product_id: 1,
  suggestion_reason: "exact_name_match",
  suggestion_candidate_ids: [1],
  mapped_loan_product_id: null,
  compatibility: {
    checked_against_loan_product_id: 1,
    checked_against_loan_product_name: "Salary Loan",
    rows: 2,
    rows_evaluated: 2,
    rows_unevaluated: 0,
    rows_not_importable: 0,
    interest_method: {
      product_interest_method: "straight",
      disagreeing_rows: 1,
      csv_interest_types: { straight: 1, diminishing: 1 },
    },
    out_of_bounds: {
      rows: 1,
      amount_below_min: 0,
      amount_above_max: 1,
      term_below_min: 0,
      term_above_max: 1,
      rate_below_min: 0,
      rate_above_max: 1,
    },
  },
};

/** Live: the blank-product cohort. `suggestion_reason` is `blank_csv_value` —
 *  not `blank` — and it still blocks. */
const BLANK_COHORT: CsvProductMapping = {
  csv_value: "",
  is_blank: true,
  loan_count: 1,
  valid_loan_count: 1,
  invalid_loan_count: 0,
  blocking: true,
  suggested_loan_product_id: null,
  suggestion_reason: "blank_csv_value",
  suggestion_candidate_ids: [],
  mapped_loan_product_id: null,
  compatibility: null,
};

/** Live: `Regular Loan`, the default case on this coop — neither of staging's
 *  two products is named that, so there is no suggestion and nothing to compare
 *  against. */
const REGULAR_LOAN: CsvProductMapping = {
  csv_value: "Regular Loan",
  is_blank: false,
  loan_count: 1,
  valid_loan_count: 1,
  invalid_loan_count: 0,
  blocking: true,
  suggested_loan_product_id: null,
  suggestion_reason: "no_match",
  suggestion_candidate_ids: [],
  mapped_loan_product_id: null,
  compatibility: null,
};

/** Live: the blank cohort AFTER being confirmed against Emergency Loan. This is
 *  the one that trips `rate_below_min` — the bound an earlier draft of the type
 *  did not have a field for. */
const BLANK_CONFIRMED: CsvProductMapping = {
  ...BLANK_COHORT,
  mapped_loan_product_id: 2,
  compatibility: {
    checked_against_loan_product_id: 2,
    checked_against_loan_product_name: "Emergency Loan",
    rows: 1,
    rows_evaluated: 1,
    rows_unevaluated: 0,
    rows_not_importable: 0,
    interest_method: {
      product_interest_method: "straight",
      disagreeing_rows: 0,
      csv_interest_types: { straight: 1 },
    },
    out_of_bounds: {
      rows: 1,
      amount_below_min: 0,
      amount_above_max: 0,
      term_below_min: 0,
      term_above_max: 1,
      rate_below_min: 1,
      rate_above_max: 0,
    },
  },
};

/** The live `unmapped` list from run 2 at `awaiting_mapping`. Note the empty
 *  string: the blank cohort is on it like any other. */
const LIVE_UNMAPPED = ["Salary Loan", "", "Regular Loan"];

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

test("the blank cohort is on the server's unmapped list and must be answered", () => {
  assert.ok(LIVE_UNMAPPED.includes(""));
  assert.deepEqual(stillOutstanding(LIVE_UNMAPPED, { "Salary Loan": 1, "Regular Loan": 1 }), [""]);
});

test("answering every entry on the server's list clears the gate", () => {
  assert.deepEqual(
    stillOutstanding(LIVE_UNMAPPED, { "Salary Loan": 1, "": 2, "Regular Loan": 1 }),
    [],
  );
});

test("a non-blocking entry is not demanded, because the server never listed it", () => {
  // The server puts BLOCKING entries on `unmapped` only. A client that counted
  // "rows with a selection vs all rows" would hold the button shut on a cohort
  // whose loans all failed staging — one the admin cannot rescue by mapping.
  const deadCohort: CsvProductMapping = {
    ...REGULAR_LOAN,
    csv_value: "Retired Loan",
    valid_loan_count: 0,
    invalid_loan_count: 1,
    blocking: false,
  };
  const rows = [SALARY_LOAN, deadCohort];
  const serverUnmapped = ["Salary Loan"];
  assert.equal(stillOutstanding(serverUnmapped, { "Salary Loan": 1 }).length, 0);
  // ...even though a naive count still sees an unanswered row.
  assert.equal(rows.filter((row) => row.csv_value === "Retired Loan").length, 1);
});

// ---------------------------------------------------------------------------
// Pre-selection
// ---------------------------------------------------------------------------

test("an exact name match is pre-selected, a no_match and a blank are not", () => {
  assert.deepEqual(initialSelection([SALARY_LOAN, BLANK_COHORT, REGULAR_LOAN]), {
    "Salary Loan": 1,
  });
});

test("a confirmed mapping wins over a suggestion, so a resumed run shows its own answers", () => {
  const remapped: CsvProductMapping = { ...SALARY_LOAN, mapped_loan_product_id: 2 };
  assert.deepEqual(initialSelection([remapped]), { "Salary Loan": 2 });
});

test("an ambiguous name is never pre-selected, even if a suggestion appears", () => {
  // The contract returns null for `ambiguous_name` today. Reading the id alone
  // would start silently pre-selecting guesses the day that changes.
  const ambiguous: CsvProductMapping = {
    ...REGULAR_LOAN,
    suggestion_reason: "ambiguous_name",
    suggested_loan_product_id: 1,
    suggestion_candidate_ids: [1, 2],
  };
  assert.deepEqual(initialSelection([ambiguous]), {});
});

// ---------------------------------------------------------------------------
// Compatibility wording
// ---------------------------------------------------------------------------

test("the disagreeing interest method is named, not just counted", () => {
  const notes = compatibilityNotes(SALARY_LOAN.compatibility as CsvProductCompatibility);
  const method = notes.find((note) => note.includes("interest method"));
  assert.ok(method);
  assert.match(method, /1 on a different interest method to straight/);
  // `csv_interest_types` lists the agreeing method too; only the offender is
  // worth printing.
  assert.match(method, /diminishing/);
  assert.doesNotMatch(method, /1 straight/);
});

test("a bound breached BELOW the minimum is described, not silently dropped", () => {
  // The live blank cohort trips `rate_below_min`. The earlier type carried only
  // `above_max` fields, so this row read "1 loan outside its limits" with no
  // reason attached.
  const notes = compatibilityNotes(BLANK_CONFIRMED.compatibility as CsvProductCompatibility);
  const bounds = notes.find((note) => note.includes("outside the product's limits"));
  assert.ok(bounds);
  assert.match(bounds, /rate 1 under/);
  assert.match(bounds, /term 1 over/);
  assert.doesNotMatch(bounds, /amount/);
});

test("a cohort that agrees on every count produces no notes at all", () => {
  const clean: CsvProductCompatibility = {
    ...(SALARY_LOAN.compatibility as CsvProductCompatibility),
    interest_method: {
      product_interest_method: "straight",
      disagreeing_rows: 0,
      csv_interest_types: { straight: 2 },
    },
    out_of_bounds: {
      rows: 0,
      amount_below_min: 0,
      amount_above_max: 0,
      term_below_min: 0,
      term_above_max: 0,
      rate_below_min: 0,
      rate_above_max: 0,
    },
  };
  assert.deepEqual(compatibilityNotes(clean), []);
});

// ---------------------------------------------------------------------------
// "Not compared" is two different things
// ---------------------------------------------------------------------------

test("rows under an unmapped name are awaiting a product, not unreadable", () => {
  const rows = [SALARY_LOAN, BLANK_COHORT, REGULAR_LOAN];
  // Live `totals.rows_not_compared` was 2 here — and both were simply not
  // mapped yet. Rendering that as "2 loans could not be compared" accuses the
  // file of a problem it does not have.
  assert.equal(rowsAwaitingAProduct(rows), 2);
  assert.equal(rowsUnreadable(rows), 0);
});

test("rows the server tried and failed to read are counted separately", () => {
  const unreadable: CsvProductMapping = {
    ...SALARY_LOAN,
    compatibility: {
      ...(SALARY_LOAN.compatibility as CsvProductCompatibility),
      rows_evaluated: 1,
      rows_unevaluated: 1,
    },
  };
  assert.equal(rowsUnreadable([unreadable, BLANK_COHORT]), 1);
  assert.equal(rowsAwaitingAProduct([unreadable, BLANK_COHORT]), 1);
});

test("once everything is confirmed nothing is awaiting a product", () => {
  const confirmed = [
    { ...SALARY_LOAN, mapped_loan_product_id: 1 },
    BLANK_CONFIRMED,
    {
      ...REGULAR_LOAN,
      mapped_loan_product_id: 1,
      compatibility: {
        ...(SALARY_LOAN.compatibility as CsvProductCompatibility),
        rows: 1,
        rows_evaluated: 1,
        interest_method: {
          product_interest_method: "straight",
          disagreeing_rows: 0,
          csv_interest_types: { straight: 1 },
        },
        out_of_bounds: {
          rows: 0,
          amount_below_min: 0,
          amount_above_max: 0,
          term_below_min: 0,
          term_above_max: 0,
          rate_below_min: 0,
          rate_above_max: 0,
        },
      },
    },
  ];
  assert.equal(rowsAwaitingAProduct(confirmed), 0);
  assert.equal(rowsUnreadable(confirmed), 0);
});

// ---------------------------------------------------------------------------
// The 422
// ---------------------------------------------------------------------------

test("a 422 yields the server's own list of what is still unmapped", () => {
  // Verbatim from a live partial PUT against run 2.
  const error = {
    response: {
      data: {
        message: "Every loan product name in the file must be mapped…",
        errors: {
          product_mapping: ["Every loan product name in the file must be mapped…"],
          unmapped: ["", "Regular Loan"],
        },
      },
    },
  };
  assert.deepEqual(unmappedFromError(error), ["", "Regular Loan"]);
});

test("a network error carries no list and falls back rather than throwing", () => {
  assert.equal(unmappedFromError(new Error("Network Error")), null);
  assert.equal(unmappedFromError(undefined), null);
  assert.equal(unmappedFromError({ response: { data: { errors: {} } } }), null);
  assert.equal(unmappedFromError({ response: { data: { errors: { unmapped: [] } } } }), null);
});

// ---------------------------------------------------------------------------
// The 429
// ---------------------------------------------------------------------------

test("a throttle response yields the server's own wait, in seconds", () => {
  // Verbatim from a live burst: the imports endpoints allow five requests, then
  // answer 429 with this header. The value is read rather than guessed, so the
  // countdown on screen matches when the server will actually relent.
  const error = {
    response: {
      status: 429,
      headers: { "retry-after": "46", "x-ratelimit-limit": "5", "x-ratelimit-remaining": "0" },
      data: { message: "Too Many Attempts." },
    },
  };
  assert.equal(retryAfterSeconds(error), 46);
});

test("a 429 without a usable header still reports as throttled", () => {
  // Being throttled is the actionable part; the exact wait is the detail. A
  // null here would fall through to "please try again", which is the one piece
  // of advice guaranteed not to work.
  for (const headers of [{}, { "retry-after": "" }, { "retry-after": "soon" }, { "retry-after": "0" }]) {
    assert.equal(retryAfterSeconds({ response: { status: 429, headers } }), RETRY_AFTER_FALLBACK_SECONDS);
  }
});

test("a fractional wait rounds up, so the countdown never says 0 too early", () => {
  assert.equal(retryAfterSeconds({ response: { status: 429, headers: { "retry-after": "1.2" } } }), 2);
});

test("anything that is not a 429 is not a throttle", () => {
  assert.equal(retryAfterSeconds({ response: { status: 422, headers: { "retry-after": "46" } } }), null);
  assert.equal(retryAfterSeconds({ response: { status: 500, headers: {} } }), null);
  assert.equal(retryAfterSeconds(new Error("Network Error")), null);
  assert.equal(retryAfterSeconds(undefined), null);
});
