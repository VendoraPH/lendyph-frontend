import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSparklineData, sparklinePoints } from "./sparkline";

// Decision 2d: the overdue sparkline's past points come from daily snapshots,
// and a day with no snapshot is sent as `v: null`. That is a gap in the line,
// never a zero: a zero would claim no loan was overdue that day.
test("a day with no snapshot stays a gap, not a zero", () => {
  const points = sparklinePoints([
    { v: null },
    { v: null },
    { v: 4 },
    { v: null },
    { v: 0 },
    { v: 6 },
    { v: 7 },
  ]);
  assert.deepEqual(
    points.map((p) => p.v),
    [null, null, 4, null, 0, 6, 7],
  );
});

test("a real zero stays zero and numeric strings read as numbers", () => {
  assert.deepEqual(sparklinePoints([{ v: 0 }, { v: "3" }]), [{ v: 0 }, { v: 3 }]);
});

test("a missing or unreadable value is a gap", () => {
  assert.deepEqual(
    sparklinePoints([{}, { v: "" }, { v: "n/a" }, null, { v: undefined }]),
    [{ v: null }, { v: null }, { v: null }, { v: null }, { v: null }],
  );
});

test("a series that is not a list draws nothing", () => {
  assert.deepEqual(sparklinePoints(undefined), []);
  assert.deepEqual(sparklinePoints(null), []);
  assert.deepEqual(sparklinePoints({ v: 3 }), []);
});

test("a line is drawn only when at least one point is a real figure", () => {
  assert.equal(hasSparklineData([]), false);
  assert.equal(hasSparklineData([{ v: null }, { v: null }]), false);
  assert.equal(hasSparklineData([{ v: null }, { v: 0 }]), true);
});
