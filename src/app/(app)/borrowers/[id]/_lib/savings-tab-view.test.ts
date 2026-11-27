import { test } from "node:test";
import assert from "node:assert/strict";
import { savingsTabCards } from "./savings-tab-view";

test("the Savings tab's cards are the server's totals and counts", () => {
  const cards = savingsTabCards(
    { totals: { account_count: 2, total_balance: "12500.75" }, stats: { active: 1, dormant: 1 } },
    { totals: { count: 3, total_principal: "90000.00", maturing_30_days: 1 }, stats: { active: 2 } },
  );
  assert.deepEqual(cards, [
    { label: "Savings balance", value: "₱12,500.75" },
    { label: "Savings accounts", value: "2" },
    { label: "Active time deposits", value: "2" },
    { label: "Maturing in 30 days", value: "1" },
  ]);
});

test("a figure the server didn't send reads a dash; a zero stays ₱0.00 and 0", () => {
  assert.deepEqual(
    savingsTabCards(undefined, undefined).map((c) => c.value),
    ["—", "—", "—", "—"],
  );
  assert.deepEqual(
    savingsTabCards(
      { totals: { account_count: 0, total_balance: "0.00" }, stats: {} },
      { totals: { count: 0, total_principal: "0.00", maturing_30_days: 0 }, stats: {} },
    ).map((c) => c.value),
    ["₱0.00", "0", "0", "0"],
  );
});
