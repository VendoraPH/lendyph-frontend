import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DailyDuesSummary } from "@/types";
import {
  collectionBadge,
  collectionPieSlices,
  collectionRateTone,
  donutPaddingAngle,
  isNothingDue,
  shownCollectionRate,
  todaySummaryRows,
} from "./collection-pie";

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

const emptyDay: DailyDuesSummary = {
  total_due: 0,
  total_collected: 0,
  collected_in_full: 0,
  partially_collected: 0,
  uncollected: 0,
  collection_rate: 0,
  counts: { collected: 0, partial: 0, pending: 0 },
};

test("the Today list is the server's figures, each row as sent, with no arithmetic", () => {
  const rows = todaySummaryRows(summary);
  assert.deepEqual(
    rows.map((r) => [r.label, r.amount]),
    [
      ["Due today", 2500],
      ["Collected", 1800],
      ["Collected in full", 1000],
      ["Partly collected", 800],
      ["Not yet collected", 700],
    ],
  );
  // A figure the server didn't send as such (a sum of counts, a difference) never appears.
  assert.deepEqual(rows.map((r) => r.detail), [
    null,
    "Principal + interest",
    "1 loan",
    "1 loan",
    "1 unpaid loan + partial balances",
  ]);
});

test("each Today amount reads in pesos to the centavo: a zero is ₱0.00, a missing figure a dash", () => {
  assert.deepEqual(todaySummaryRows(summary).map((r) => r.amountLabel), [
    "₱2,500.00",
    "₱1,800.00",
    "₱1,000.00",
    "₱800.00",
    "₱700.00",
  ]);
  assert.deepEqual(todaySummaryRows(emptyDay).map((r) => r.amountLabel), Array(5).fill("₱0.00"));
  const none = todaySummaryRows(null);
  assert.deepEqual(none.map((r) => r.amountLabel), Array(5).fill("—"));
  assert.deepEqual(none.map((r) => r.detail), [null, "Principal + interest", null, null, null]);
});

test("loan counts read in words, and the unpaid row names partial balances only when there are some", () => {
  const rows = todaySummaryRows({ ...summary, counts: { collected: 3, partial: 0, pending: 2 } });
  assert.deepEqual(rows.map((r) => r.detail).slice(2), ["3 loans", "0 loans", "2 unpaid loans"]);
});

test("nothing is due when the server's total due is 0, or it sent no summary", () => {
  assert.equal(isNothingDue(emptyDay, "ready"), true);
  assert.equal(isNothingDue(null, "ready"), true);
  assert.equal(isNothingDue(summary, "ready"), false);
});

test("a request still loading or failed is never read as nothing due", () => {
  assert.equal(isNothingDue(null, "loading"), false);
  assert.equal(isNothingDue(null, "error"), false);
});

test("the badge reads 'Nothing due today' with no arrow on a day with nothing due", () => {
  assert.deepEqual(collectionBadge(null, true), { text: "Nothing due today", tone: "unknown", arrow: null });
});

test("the badge shows today's rate, its arrow chosen by the rate's tone, never up for a poor rate", () => {
  assert.deepEqual(collectionBadge(92, false), { text: "92% collected", tone: "good", arrow: "up" });
  assert.deepEqual(collectionBadge(72, false), { text: "72% collected", tone: "fair", arrow: null });
  assert.deepEqual(collectionBadge(10, false), { text: "10% collected", tone: "poor", arrow: "down" });
});

test("without a rate (loading or failed) the badge shows a dash and no arrow", () => {
  assert.deepEqual(collectionBadge(null, false), { text: "— collected", tone: "unknown", arrow: null });
});

test("a ring with one slice draws whole: no padding notch at 0% or 100% collected", () => {
  // Recharts pads every non-zero slice even when only one is left, which drew
  // a thin white notch at the top of an all-pending ring.
  assert.equal(donutPaddingAngle(collectionPieSlices({ ...summary, collected_in_full: 0, partially_collected: 0 })), 0);
  assert.equal(donutPaddingAngle(collectionPieSlices({ ...summary, partially_collected: 0, uncollected: 0 })), 0);
  assert.equal(donutPaddingAngle(collectionPieSlices(summary)), 3);
});

test("the badge's arrow takes the badge's own gap only, not a second margin", () => {
  const page = readFileSync(join(import.meta.dirname, "..", "page.tsx"), "utf8");
  assert.match(page, /<BadgeArrow data-icon="inline-start" aria-hidden="true" \/>/);
  assert.doesNotMatch(page, /<BadgeArrow[^>]*mr-1/);
});
