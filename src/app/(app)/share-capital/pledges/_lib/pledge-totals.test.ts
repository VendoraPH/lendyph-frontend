import { test } from "node:test";
import assert from "node:assert/strict";
import type { PaginatedResponse, Pledge } from "@/types";
import type { DrainResult } from "@/lib/paginate";
import { createLatestGate, drainPledgesWithTotal, readPledgeTotalAmount } from "./pledge-totals";

const pledge = (id: number, amount: number) => ({ id, amount }) as unknown as Pledge;

function page(rows: Pledge[], pageNo: number, lastPage: number, totals?: unknown) {
  return {
    data: rows,
    meta: { current_page: pageNo, last_page: lastPage, per_page: 100, total: 3, ...(totals === undefined ? {} : { totals }) },
  } as unknown as PaginatedResponse<Pledge>;
}

test("the Total Amount is the server's meta.totals.amount, not the rows added up", () => {
  assert.equal(readPledgeTotalAmount(page([pledge(1, 500)], 1, 1, { amount: 12_345.5 })), 12_345.5);
});

test("a decimal-string total reads as a number, and zero is a real zero", () => {
  assert.equal(readPledgeTotalAmount(page([], 1, 1, { amount: "1500.25" })), 1500.25);
  assert.equal(readPledgeTotalAmount(page([], 1, 1, { amount: 0 })), 0);
});

test("no meta.totals.amount is null, never a sum of the rows", () => {
  assert.equal(readPledgeTotalAmount(page([pledge(1, 500), pledge(2, 700)], 1, 1)), null);
  assert.equal(readPledgeTotalAmount(page([pledge(1, 500)], 1, 1, { amount: null })), null);
  assert.equal(readPledgeTotalAmount([pledge(1, 500)]), null);
  assert.equal(readPledgeTotalAmount(null), null);
});

test("the drain keeps every row and the total from the first page that carried one", async () => {
  const pages = [
    page([pledge(1, 100), pledge(2, 200)], 1, 2, { amount: 9_000 }),
    page([pledge(3, 300)], 2, 2, { amount: 9_000 }),
  ];
  const seen: number[] = [];
  const result = await drainPledgesWithTotal(async ({ page: p }) => {
    seen.push(p);
    return pages[p - 1];
  });

  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(result.drain.rows.map((r) => r.id), [1, 2, 3]);
  assert.equal(result.totalAmount, 9_000);
});

test("the drain reports a null total when the server sent none", async () => {
  const result: { drain: DrainResult<Pledge>; totalAmount: number | null } =
    await drainPledgesWithTotal(async () => page([pledge(1, 100)], 1, 1));
  assert.equal(result.totalAmount, null);
});

// Two quick amount edits fire two total refreshes. If the first answers last,
// its older total must not overwrite the newer one.
test("only the latest refresh may set the total", () => {
  const gate = createLatestGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.isLatest(second), true);
  assert.equal(gate.isLatest(first), false);
});

test("a single refresh is the latest until another starts", () => {
  const gate = createLatestGate();
  const only = gate.begin();
  assert.equal(gate.isLatest(only), true);
  gate.begin();
  assert.equal(gate.isLatest(only), false);
});
