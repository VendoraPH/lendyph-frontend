import { test } from "node:test";
import assert from "node:assert/strict";
import { dateHiredError } from "./date-hired";

const TODAY = "2026-11-25";
const BIRTHDATE = "1990-01-02";

const FORMAT = "The date hired must be a date written as year-month-day, such as 2020-06-01.";
const TOO_EARLY = "The date hired field must be a date after 1900-01-01.";
const FUTURE = "The date hired cannot be in the future.";
const BEFORE_BIRTHDATE = "The date hired cannot be before the birthdate.";

test("Date Hired is optional", () => {
  assert.equal(dateHiredError("", BIRTHDATE, TODAY), null);
  assert.equal(dateHiredError("   ", BIRTHDATE, TODAY), null);
  assert.equal(dateHiredError("2015-06-01", BIRTHDATE, TODAY), null);
});

test("a date hired is written year-month-day and names a real day", () => {
  for (const value of ["06/01/2015", "2015-6-1", "2015-02-30", "June 1, 2015"]) {
    assert.equal(dateHiredError(value, BIRTHDATE, TODAY), FORMAT, value);
  }
});

test("a date hired falls after January 1, 1900, as the server's `after:1900-01-01` says", () => {
  assert.equal(dateHiredError("1900-01-01", "", TODAY), TOO_EARLY);
  assert.equal(dateHiredError("1850-06-30", "", TODAY), TOO_EARLY);
  assert.equal(dateHiredError("1900-01-02", "", TODAY), null);
});

test("a date hired is not after today", () => {
  assert.equal(dateHiredError(TODAY, BIRTHDATE, TODAY), null);
  assert.equal(dateHiredError("2026-11-26", BIRTHDATE, TODAY), FUTURE);
});

test("a date hired is not before the birthdate; the birthdate itself is fine", () => {
  assert.equal(dateHiredError("1990-01-01", BIRTHDATE, TODAY), BEFORE_BIRTHDATE);
  assert.equal(dateHiredError(BIRTHDATE, BIRTHDATE, TODAY), null);
  // Without a birthdate written year-month-day there is nothing to compare with.
  assert.equal(dateHiredError("1950-01-01", "", TODAY), null);
  assert.equal(dateHiredError("1950-01-01", "01/02/1990", TODAY), null);
});

test("a date that breaks two rules reads the server's first refusal", () => {
  // The server checks the year 1900 before the birthdate.
  assert.equal(dateHiredError("1899-12-31", BIRTHDATE, TODAY), TOO_EARLY);
});
