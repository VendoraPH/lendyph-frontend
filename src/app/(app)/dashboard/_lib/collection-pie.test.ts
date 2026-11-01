import { test } from "node:test";
import assert from "node:assert/strict";
import type { DailyDuesSummary } from "@/types";
import { collectionPieSlices, collectionRateTone, shownCollectionRate } from "./collection-pie";

const summary: DailyDuesSummary = {
  total_due: 2500,
  total_collected: 1800,
  collected_in_full: 1000,
  partially_collected: 800,
  uncollected: 700,
  collection_rate: 72,
  counts: { collected: 1, partial: 1, pending: 1 },
};

test("the slices are the server's figures, unchanged", () => {
  assert.deepEqual(
    collectionPieSlices(summary).map((s) => [s.name, s.value]),
    [["Collected", 1000], ["Partial", 800], ["Pending", 700]],
  );
});

test("without a summary every slice is zero rather than a browser estimate", () => {
  assert.deepEqual(collectionPieSlices(null).map((s) => s.value), [0, 0, 0]);
});

test("the rate badge bands follow the server's rate", () => {
  assert.equal(collectionRateTone(100), "good");
  assert.equal(collectionRateTone(80), "good");
  assert.equal(collectionRateTone(72), "fair");
  assert.equal(collectionRateTone(49.9), "poor");
  assert.equal(collectionRateTone(null), "unknown");
});

test("the shown rate is the server's rate on a day with dues", () => {
  assert.equal(shownCollectionRate(summary), 72);
});

test("a day with nothing due shows no rate, not a red 0%", () => {
  // The server answers collection_rate 0 when total_due is 0.
  const emptyDay: DailyDuesSummary = {
    ...summary,
    total_due: 0,
    total_collected: 0,
    collected_in_full: 0,
    partially_collected: 0,
    uncollected: 0,
    collection_rate: 0,
    counts: { collected: 0, partial: 0, pending: 0 },
  };
  assert.equal(shownCollectionRate(emptyDay), null);
});

test("no summary shows no rate", () => {
  assert.equal(shownCollectionRate(null), null);
});
