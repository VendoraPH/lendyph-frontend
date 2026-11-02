import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareOutstanding,
  mergeOutstanding,
  readRowOutstanding,
} from "./past-due-outstanding";

// Decision 1(a): "Outstanding" is everything owed, `total_outstanding`. The old
// read fell back through `outstanding_balance` and `remaining_balance`, and
// GET /reports/due-past-due sends neither, so every row printed ₱0.00.
test("reads total_outstanding from the row or its loan", () => {
  assert.equal(readRowOutstanding({ total_outstanding: 70_800 }), 70_800);
  assert.equal(readRowOutstanding({ loan: { total_outstanding: "1500.50" } }), 1500.5);
  assert.equal(readRowOutstanding({ total_outstanding: 0 }), 0);
});

test("never reads the deprecated principal + premium figure or a period balance", () => {
  assert.equal(
    readRowOutstanding({ outstanding_balance: 60_400, remaining_balance: 5_000, balance: 11_800 }),
    null,
  );
  assert.equal(readRowOutstanding({ loan: { outstanding_balance: 60_400 } }), null);
  assert.equal(readRowOutstanding({ loan: null }), null);
});

test("merging a loan's period rows keeps the figure, never adds them", () => {
  assert.equal(mergeOutstanding(70_800, 70_800), 70_800);
  assert.equal(mergeOutstanding(null, 70_800), 70_800);
  assert.equal(mergeOutstanding(70_800, null), 70_800);
  assert.equal(mergeOutstanding(null, null), null);
});

test("sorting puts rows with no figure below every real figure, zero included", () => {
  const values = [500, null, 0, 70_800, null];
  assert.deepEqual([...values].sort(compareOutstanding), [null, null, 0, 500, 70_800]);
});
