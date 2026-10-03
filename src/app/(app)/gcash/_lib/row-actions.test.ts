import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import { gcashRowActions } from "./row-actions";

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
