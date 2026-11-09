import { test } from "node:test";
import assert from "node:assert/strict";
import * as aging from "./aging";
import { AGING_BUCKETS, agingBucketLabel } from "./aging";

test("buckets run youngest first", () => {
  assert.deepEqual(
    [...AGING_BUCKETS],
    ["current", "1_30", "31_60", "61_90", "91_120", "over_120"],
  );
});

test("buckets have human labels", () => {
  assert.equal(agingBucketLabel("current"), "Current");
  assert.equal(agingBucketLabel("1_30"), "1–30 days");
  assert.equal(agingBucketLabel("over_120"), "Over 120 days");
});

test("every bucket has a label", () => {
  for (const bucket of AGING_BUCKETS) {
    assert.ok(agingBucketLabel(bucket).length > 0, bucket);
  }
});

test("the browser no longer builds the aging: the server sends it", () => {
  assert.equal("buildAging" in aging, false);
  assert.equal("bucketForDaysPastDue" in aging, false);
  assert.equal("daysPastDue" in aging, false);
});
