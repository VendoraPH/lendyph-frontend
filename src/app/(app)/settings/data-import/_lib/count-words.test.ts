import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  columnsFound,
  productMatches,
  rowsLeftUnchecked,
  rowsNotReached,
  rowsProgress,
  rowsWithoutOutcome,
  rowsOvercounted,
  severityCount,
} from "./count-words";

describe("the import's counts read in the right number", () => {
  test("the grouped report's header: 1 warning, 2 warnings, 1 error", () => {
    assert.equal(severityCount(1, "warning"), "1 warning");
    assert.equal(severityCount(2, "warning"), "2 warnings");
    assert.equal(severityCount(1, "error"), "1 error");
    assert.equal(severityCount(1500, "error"), "1,500 errors");
  });

  test("the processing bar: 1 of 1 row, 3 of 40 rows", () => {
    assert.equal(rowsProgress(1, 1), "1 of 1 row");
    assert.equal(rowsProgress(3, 40), "3 of 40 rows");
  });

  test("the header card: 1 column found", () => {
    assert.equal(columnsFound(1), "1 column");
    assert.equal(columnsFound(26), "26 columns");
  });

  test("rows not reached yet, and rows with no outcome", () => {
    assert.equal(rowsNotReached(1), "1 row has not been reached yet.");
    assert.equal(rowsNotReached(5), "5 rows have not been reached yet.");
    assert.equal(rowsWithoutOutcome(1, 1), "1 of the 1 row read has no recorded outcome");
    assert.equal(rowsWithoutOutcome(2, 10), "2 of the 10 rows read have no recorded outcome");
    assert.equal(rowsOvercounted(2, 1), "The outcomes total 2, which is more than the 1 row read.");
    assert.equal(rowsOvercounted(12, 10), "The outcomes total 12, which is more than the 10 rows read.");
  });

  test("rows left unchecked by the pre-check", () => {
    assert.equal(rowsLeftUnchecked(1), "The remaining 1 was not checked here");
    assert.equal(rowsLeftUnchecked(4), "The remaining 4 were not checked here");
  });

  test("a product name's matches", () => {
    assert.equal(productMatches(1), "Matches 1 product with this name:");
    assert.equal(productMatches(2), "Matches 2 products with this name:");
  });
});
