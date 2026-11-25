import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  columnsFound,
  pagerSummary,
  piecesAccepted,
  piecesOnServer,
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
    // A row that was not imported is counted as skipped, in its own words.
    assert.equal(severityCount(1, "skipped"), "1 skipped");
    assert.equal(severityCount(6, "skipped"), "6 skipped");
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

describe("the shared pager reads in the right number", () => {
  test("one row: Showing 1 of 1 result", () => {
    assert.equal(pagerSummary(1, 1, 1), "Showing 1 of 1 result");
  });

  test("a range: Showing 1 to 10 of 25 results", () => {
    assert.equal(pagerSummary(1, 10, 25), "Showing 1 to 10 of 25 results");
    assert.equal(pagerSummary(1001, 1020, 1020), "Showing 1,001 to 1,020 of 1,020 results");
  });

  test("a last page holding one row: Showing 21 of 21 results", () => {
    assert.equal(pagerSummary(21, 21, 21), "Showing 21 of 21 results");
  });

  test("nothing to show: No results", () => {
    assert.equal(pagerSummary(1, 0, 0), "No results");
  });
});

describe("the upload's pieces read in the right number", () => {
  test("1 of 1 piece accepted, 2 of 5 pieces accepted", () => {
    assert.equal(piecesAccepted(1, 1), "1 of 1 piece accepted");
    assert.equal(piecesAccepted(2, 5), "2 of 5 pieces accepted");
  });

  test("pieces already on the server", () => {
    assert.equal(piecesOnServer(1, 1, "members.csv"), "1 of 1 piece of members.csv is already on the server.");
    assert.equal(piecesOnServer(1, 4, "members.csv"), "1 of 4 pieces of members.csv is already on the server.");
    assert.equal(piecesOnServer(3, 4, "members.csv"), "3 of 4 pieces of members.csv are already on the server.");
  });
});
