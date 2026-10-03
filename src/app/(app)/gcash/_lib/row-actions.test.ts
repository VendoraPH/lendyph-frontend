import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import { gcashCanMarkPaid, gcashRowActions } from "./row-actions";

const holding = (...granted: Permission[]) => (p: Permission) => granted.includes(p);

describe("gcashRowActions", () => {
  test("gcash:view alone offers no Cash In or Cash Out on a row", () => {
    assert.deepEqual(gcashRowActions(holding("gcash:view")), []);
  });

  test("gcash:transact offers both", () => {
    assert.deepEqual(gcashRowActions(holding("gcash:view", "gcash:transact")), ["cash_in", "cash_out"]);
  });

  test("other permissions do not stand in for gcash:transact", () => {
    assert.deepEqual(gcashRowActions(holding("gcash:view", "gcash:settings", "borrowers:view")), []);
  });
});

describe("gcashCanMarkPaid", () => {
  const pendingCashIn = { type: "cash_in", status: "pending" } as const;

  test("gcash:view alone offers no Paid on a pending Cash In", () => {
    assert.equal(gcashCanMarkPaid(holding("gcash:view"), pendingCashIn), false);
  });

  test("gcash:transact offers Paid on a pending Cash In", () => {
    assert.equal(gcashCanMarkPaid(holding("gcash:view", "gcash:transact"), pendingCashIn), true);
  });

  test("other permissions do not stand in for gcash:transact", () => {
    assert.equal(
      gcashCanMarkPaid(holding("gcash:view", "gcash:settings", "borrowers:view"), pendingCashIn),
      false,
    );
  });

  test("only a pending Cash In can be marked paid", () => {
    const can = holding("gcash:view", "gcash:transact");
    assert.equal(gcashCanMarkPaid(can, { type: "cash_in", status: "paid" }), false);
    assert.equal(gcashCanMarkPaid(can, { type: "cash_in", status: "completed" }), false);
    assert.equal(gcashCanMarkPaid(can, { type: "cash_out", status: "completed" }), false);
  });
});
