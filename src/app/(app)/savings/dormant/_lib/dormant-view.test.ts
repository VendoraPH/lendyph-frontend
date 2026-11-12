import { test } from "node:test";
import assert from "node:assert/strict";
import { DORMANCY_TABS, approachingNote, daysLeftText, dormancyCards } from "./dormant-view";

test("the cards show the server's totals for both lists and the month's reactivations", () => {
  assert.deepEqual(
    dormancyCards({
      account_count: 4,
      total_balance: "12500.00",
      approaching_count: 2,
      approaching_balance: "800.50",
      reactivated_this_month: 3,
    }),
    [
      { label: "Dormant accounts", value: "4 · ₱12,500.00" },
      { label: "Approaching dormancy", value: "2 · ₱800.50" },
      { label: "Reactivated this month", value: "3" },
    ],
  );
});

test("before the totals arrive each card reads a dash, never ₱0.00", () => {
  assert.deepEqual(dormancyCards(undefined).map((c) => c.value), ["—", "—", "—"]);
});

test("the two lists are the dormant accounts and those approaching dormancy", () => {
  assert.deepEqual(DORMANCY_TABS.map((t) => t.value), ["dormant", "approaching"]);
});

test("days left read in words", () => {
  assert.equal(daysLeftText(1), "Tomorrow");
  assert.equal(daysLeftText(12), "In 12 days");
});

test("the approaching note names the server's warning window", () => {
  assert.equal(
    approachingNote(60),
    "Active accounts that turn dormant within 60 days without member activity, soonest first.",
  );
  assert.match(approachingNote(undefined), /turn dormant soon/);
});
