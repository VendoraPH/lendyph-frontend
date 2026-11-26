import { test } from "node:test";
import assert from "node:assert/strict";
import { BALANCES_AS_OF_EARLIEST, balancesAsOfProblem, balancesAsOfRefusal } from "./balances-as-of";

/**
 * The run's "Balances as of" date, held to the server's own rule
 * (`StoreCsvImportRunRequest`: `date_format:Y-m-d`, `after:1999-12-31`,
 * `before_or_equal:today`). Imported loans refuse payments dated on or before
 * it (`imported_arrears_baseline`), so the usual cut-over is the day before
 * going live.
 */
const TODAY = "2026-11-26";

test("today, yesterday and 2000-01-01 are accepted", () => {
  for (const date of [TODAY, "2026-11-25", BALANCES_AS_OF_EARLIEST, "2024-02-29"]) {
    assert.equal(balancesAsOfProblem(date, TODAY), null, date);
  }
});

test("a blank date is required", () => {
  assert.equal(balancesAsOfProblem("", TODAY), "Enter the date the file's balances were taken.");
  assert.equal(balancesAsOfProblem("  ", TODAY), "Enter the date the file's balances were taken.");
});

test("a date after today is refused, as on the server", () => {
  assert.equal(
    balancesAsOfProblem("2026-11-27", TODAY),
    "Balances as of can't be after today: the file's balances were taken on or before today.",
  );
});

test("a date before 2000 is refused", () => {
  assert.equal(balancesAsOfProblem("1999-12-31", TODAY), "Balances as of can't be before Jan 1, 2000.");
});

test("anything but a real YYYY-MM-DD date is refused", () => {
  for (const date of ["2026-02-30", "2026-13-01", "26-11-2026", "2026/11/26", "2026-11-26T00:00"]) {
    assert.equal(balancesAsOfProblem(date, TODAY), "Enter a date such as 2026-11-25.", date);
  }
});

test("the server's refusal of the date is read off a 422 for the field", () => {
  const refused = {
    response: { status: 422, data: { errors: { as_of_date: ["The as-of date is the date the extract was taken; it cannot be in the future."] } } },
  };
  assert.equal(balancesAsOfRefusal(refused), "The as-of date is the date the extract was taken; it cannot be in the future.");
  assert.equal(balancesAsOfRefusal({ response: { status: 422, data: { errors: { branch_id: ["x"] } } } }), null);
  assert.equal(balancesAsOfRefusal({ response: { status: 409, data: {} } }), null);
  assert.equal(balancesAsOfRefusal(new Error("offline")), null);
});
