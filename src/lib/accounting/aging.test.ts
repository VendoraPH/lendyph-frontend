import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketForDaysPastDue,
  daysPastDue,
  buildAging,
  AGING_BUCKETS,
  agingBucketLabel,
} from "./aging";

// ── Bucket boundaries ──

test("nothing overdue is current", () => {
  assert.equal(bucketForDaysPastDue(0), "current");
  assert.equal(bucketForDaysPastDue(-5), "current");
});

test("the first day overdue leaves current immediately", () => {
  assert.equal(bucketForDaysPastDue(1), "1_30");
});

test("each bucket owns both of its edges", () => {
  assert.equal(bucketForDaysPastDue(30), "1_30");
  assert.equal(bucketForDaysPastDue(31), "31_60");
  assert.equal(bucketForDaysPastDue(60), "31_60");
  assert.equal(bucketForDaysPastDue(61), "61_90");
  assert.equal(bucketForDaysPastDue(90), "61_90");
  assert.equal(bucketForDaysPastDue(91), "91_120");
  assert.equal(bucketForDaysPastDue(120), "91_120");
  assert.equal(bucketForDaysPastDue(121), "over_120");
  assert.equal(bucketForDaysPastDue(3650), "over_120");
});

// ── Days past due ──

test("counts whole days between the due date and the reporting date", () => {
  assert.equal(daysPastDue("2026-09-01", "2026-09-30"), 29);
  assert.equal(daysPastDue("2026-09-30", "2026-09-30"), 0);
});

test("a future due date is not past due", () => {
  assert.equal(daysPastDue("2026-10-15", "2026-09-30"), 0);
});

test("counting is unaffected by the clock crossing a DST-style boundary", () => {
  // Parsed as UTC midnights, so a local timezone shift cannot turn 31 days
  // into 30.96 and round the wrong way.
  assert.equal(daysPastDue("2026-03-01", "2026-04-01"), 31);
});

test("an unparseable date is treated as not past due rather than NaN", () => {
  assert.equal(daysPastDue("", "2026-09-30"), 0);
  assert.equal(daysPastDue("not-a-date", "2026-09-30"), 0);
});

// ── Aggregation ──

test("sorts receivables into buckets and totals each", () => {
  const aging = buildAging(
    [
      { amount: 10000000, due_date: "2026-10-15" }, // future → current
      { amount: 5000000, due_date: "2026-09-20" }, // 10 days
      { amount: 2500000, due_date: "2026-09-10" }, // 20 days
      { amount: 3000000, due_date: "2026-08-15" }, // 46 days
      { amount: 1000000, due_date: "2026-04-01" }, // 182 days
    ],
    "2026-09-30"
  );

  const byBucket = Object.fromEntries(aging.rows.map((r) => [r.bucket, r]));
  assert.equal(byBucket.current.amount, 10000000);
  assert.equal(byBucket.current.count, 1);
  assert.equal(byBucket["1_30"].amount, 7500000);
  assert.equal(byBucket["1_30"].count, 2);
  assert.equal(byBucket["31_60"].amount, 3000000);
  assert.equal(byBucket.over_120.amount, 1000000);
});

test("every bucket is present even when empty, so the table never shifts", () => {
  const aging = buildAging([{ amount: 100, due_date: "2026-10-01" }], "2026-09-30");
  assert.equal(aging.rows.length, AGING_BUCKETS.length);
  assert.deepEqual(
    aging.rows.map((r) => r.bucket),
    [...AGING_BUCKETS]
  );
  assert.equal(aging.rows.find((r) => r.bucket === "over_120")!.amount, 0);
});

test("the total equals the sum of every bucket", () => {
  const aging = buildAging(
    [
      { amount: 111, due_date: "2026-09-29" },
      { amount: 222, due_date: "2026-08-01" },
      { amount: 333, due_date: "2026-01-01" },
    ],
    "2026-09-30"
  );
  assert.equal(aging.total, 666);
  assert.equal(
    aging.rows.reduce((sum, r) => sum + r.amount, 0),
    aging.total
  );
});

test("past-due total excludes what is merely current", () => {
  const aging = buildAging(
    [
      { amount: 10000, due_date: "2026-10-30" },
      { amount: 4000, due_date: "2026-09-01" },
    ],
    "2026-09-30"
  );
  assert.equal(aging.total, 14000);
  assert.equal(aging.past_due_total, 4000);
});

test("an empty portfolio ages to all zeroes", () => {
  const aging = buildAging([], "2026-09-30");
  assert.equal(aging.total, 0);
  assert.equal(aging.past_due_total, 0);
  assert.equal(aging.rows.length, AGING_BUCKETS.length);
});

test("a fully settled receivable contributes nothing and is not counted", () => {
  // Zero-balance rows would inflate the count column with loans that are done.
  const aging = buildAging(
    [
      { amount: 0, due_date: "2026-08-01" },
      { amount: 5000, due_date: "2026-08-01" },
    ],
    "2026-09-30"
  );
  assert.equal(aging.rows.find((r) => r.bucket === "31_60")!.count, 1);
});

test("buckets have human labels", () => {
  assert.equal(agingBucketLabel("current"), "Current");
  assert.equal(agingBucketLabel("1_30"), "1–30 days");
  assert.equal(agingBucketLabel("over_120"), "Over 120 days");
});
