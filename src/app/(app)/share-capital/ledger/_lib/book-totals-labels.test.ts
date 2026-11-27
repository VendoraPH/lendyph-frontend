import { test } from "node:test";
import assert from "node:assert/strict";
import { bookTotalsLabels, BOOK_TOTALS_LABELS } from "./book-totals-labels";

const north = { id: 2, name: "North", code: "NTH" };
const south = { id: 3, name: "South", code: "STH" };

test("head office sees the whole book under the plain titles, with no note", () => {
  assert.deepEqual(bookTotalsLabels({ branches: [north] }, true), BOOK_TOTALS_LABELS);
  assert.equal(BOOK_TOTALS_LABELS.members, "Total Members");
  assert.equal(BOOK_TOTALS_LABELS.note, null);
});

test("before the signed-in user is known, or with no branch at all, nothing is claimed", () => {
  assert.deepEqual(bookTotalsLabels(null, false), BOOK_TOTALS_LABELS);
  assert.deepEqual(bookTotalsLabels({ branches: [] }, false), BOOK_TOTALS_LABELS);
});

test("a one-branch user reads totals for the members now in their branch", () => {
  const labels = bookTotalsLabels({ branches: [north] }, false);
  assert.equal(labels.members, "Members Now in Your Branch");
  assert.equal(labels.balance, "Their Total Share Capital");
  assert.equal(labels.credits, "Their Total Credits");
  assert.equal(labels.debits, "Their Total Debits");
  assert.match(labels.note ?? "", /members now in your branch,/);
  // Says how it differs from the Share Capital report's posted-branch figures.
  assert.match(labels.note ?? "", /Share Capital report counts each entry in the branch where it was posted/);
});

test("a several-branch user, and a legacy single branch, read alike in the plural or singular", () => {
  assert.equal(bookTotalsLabels({ branches: [north, south] }, false).members, "Members Now in Your Branches");
  assert.match(bookTotalsLabels({ branches: [north, south] }, false).note ?? "", /members now in your branches,/);
  assert.equal(bookTotalsLabels({ branch: north }, false).members, "Members Now in Your Branch");
});

test("the titles are words, never field keys", () => {
  const labels = bookTotalsLabels({ branches: [north] }, false);
  for (const text of Object.values(labels)) assert.doesNotMatch(String(text), /_|branch_id|borrower/);
});
