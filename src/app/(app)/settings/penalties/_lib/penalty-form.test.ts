import { test } from "node:test";
import assert from "node:assert/strict";
import type { PenaltyConfig } from "@/types/penalty";
import {
  activeProductOwners,
  appendRow,
  buildPenaltyPayload,
  describeRange,
  parseConditions,
  productConflicts,
  resolvePenaltyRate,
  toRow,
  uncoveredDays,
  type ConditionRow,
} from "./penalty-form";

const row = (from: string, to: string, rate: string, noMax = false, key = 0): ConditionRow => ({ key, from, to, noMax, rate });

// The ClickUp sample: 1–5 → 20%, 6–10 → 30%, 11+ → 50%.
const SAMPLE = [row("1", "5", "20"), row("6", "10", "30"), row("11", "", "50", true)];

function conditionsOf(rows: ConditionRow[]) {
  const r = parseConditions(rows);
  assert.ok("conditions" in r, "error" in r ? r.error : "");
  return r.conditions;
}

test("the sample configuration parses into three brackets", () => {
  assert.deepEqual(conditionsOf(SAMPLE), [
    { days_from: 1, days_to: 5, rate: 20 },
    { days_from: 6, days_to: 10, rate: 30 },
    { days_from: 11, days_to: null, rate: 50 },
  ]);
});

test("the ClickUp overdue table picks one bracket, not the sum", () => {
  const c = conditionsOf(SAMPLE);
  const expected: [number, number | null][] = [
    [0, null], [1, 20], [3, 20], [5, 20], [6, 30], [9, 30], [10, 30], [11, 50], [20, 50],
  ];
  for (const [days, rate] of expected) assert.equal(resolvePenaltyRate(c, days), rate, `day ${days}`);
});

test("rows typed out of order are sorted by first day", () => {
  const c = conditionsOf([row("6", "10", "30"), row("1", "5", "20")]);
  assert.deepEqual(c.map((x) => x.days_from), [1, 6]);
});

test("overlapping ranges are refused", () => {
  const r = parseConditions([row("1", "5", "20"), row("5", "10", "30")]);
  assert.ok("error" in r && /overlap/.test(r.error));
});

test("an open-ended row that is not the highest is refused as an overlap", () => {
  const r = parseConditions([row("11", "20", "50"), row("1", "", "20", true)]);
  assert.ok("error" in r);
});

test("only the last row may have no maximum", () => {
  const r = parseConditions([row("1", "", "20", true), row("6", "10", "30")]);
  assert.ok("error" in r && /only the last/.test(r.error));
});

test("field rules: day 0, to below from, bad rate, rate over 100, no rows", () => {
  for (const rows of [
    [row("0", "5", "20")],
    [row("1.5", "5", "20")],
    [row("5", "3", "20")],
    [row("1", "5", "-1")],
    [row("1", "5", "1.23456")],
    [row("1", "5", "101")],
    [row("1", "", "20")],
    [],
  ]) {
    assert.ok("error" in parseConditions(rows), JSON.stringify(rows));
  }
  assert.ok("conditions" in parseConditions([row("1", "1", "0")]), "a 0% single day is valid");
});

test("gaps are allowed and reported as uncovered days", () => {
  assert.deepEqual(uncoveredDays(conditionsOf([row("3", "5", "20"), row("8", "", "30", true)])), ["1–2 days", "6–7 days"]);
  assert.deepEqual(uncoveredDays(conditionsOf(SAMPLE)), []);
  assert.equal(resolvePenaltyRate(conditionsOf([row("3", "5", "20")]), 2), null);
});

test("describeRange reads naturally", () => {
  assert.equal(describeRange({ days_from: 1, days_to: 5 }), "1–5 days");
  assert.equal(describeRange({ days_from: 4, days_to: 4 }), "Day 4");
  assert.equal(describeRange({ days_from: 11, days_to: null }), "11 days and above");
  assert.equal(describeRange({ days_from: 1, days_to: null }), "1 day and above");
});

test("appendRow continues from the last bracket and clears its No maximum", () => {
  const next = appendRow([row("1", "5", "20")], 9);
  assert.equal(next[1].from, "6");
  const after = appendRow([row("11", "", "50", true)], 9);
  assert.equal(after[0].noMax, false);
  assert.equal(after[1].from, "");
});

test("toRow round-trips a saved bracket", () => {
  assert.deepEqual(toRow({ days_from: 11, days_to: null, rate: 50 }, 3), { key: 3, from: "11", to: "", noMax: true, rate: "50" });
});

const config = (id: number, status: "active" | "inactive", ids: number[]): PenaltyConfig => ({
  id, name: `Policy ${id}`, status, applicable_product_ids: ids, conditions: [], created_at: "", updated_at: "",
});

test("a product in another ACTIVE configuration conflicts; inactive and self do not", () => {
  const configs = [config(1, "active", [10, 11]), config(2, "inactive", [12]), config(3, "active", [13])];
  assert.deepEqual(productConflicts([10, 12, 13], activeProductOwners(configs, 3)), [{ productId: 10, configName: "Policy 1" }]);
});

test("buildPenaltyPayload needs a name and, unless inactive, a product", () => {
  assert.ok("error" in buildPenaltyPayload({ name: " ", productIds: [1], rows: SAMPLE }, { requireProducts: true }));
  assert.ok("error" in buildPenaltyPayload({ name: "Std", productIds: [], rows: SAMPLE }, { requireProducts: true }));
  const ok = buildPenaltyPayload({ name: " Std ", productIds: [], rows: SAMPLE }, { requireProducts: false });
  assert.ok("payload" in ok && ok.payload.name === "Std" && ok.payload.conditions.length === 3);
});
