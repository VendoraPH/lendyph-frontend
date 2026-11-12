import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PenaltyConfig } from "@/types/penalty";
import * as penaltyForm from "./penalty-form";
import {
  DEACTIVATE_NOTE,
  PENALTY_FORM_NOTE,
  activeProductOwners,
  appendRow,
  buildPenaltyPayload,
  configProductNames,
  describeCondition,
  parseConditions,
  toRow,
  type ConditionRow,
} from "./penalty-form";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const DIR = "src/app/(app)/settings/penalties";
const row = (from: string, to: string, rate: string, noMax = false, key = 0): ConditionRow => ({ key, from, to, noMax, rate });

// The task's sample: 1–5 days 20%, 6–10 days 30%, 11 days or more 50%.
const SAMPLE = [row("1", "5", "20"), row("6", "10", "30"), row("11", "", "50", true)];

test("the form's payload: trimmed name, the picked products and the brackets as numbers", () => {
  assert.deepEqual(buildPenaltyPayload({ name: " Standard Loan Penalty ", productIds: [1, 3], rows: SAMPLE }), {
    payload: {
      name: "Standard Loan Penalty",
      applicable_product_ids: [1, 3],
      conditions: [
        { days_from: 1, days_to: 5, rate: 20 },
        { days_from: 6, days_to: 10, rate: 30 },
        { days_from: 11, days_to: null, rate: 50 },
      ],
    },
  });
});

test("rates are sent exactly as typed, never rounded", () => {
  const r = buildPenaltyPayload({ name: "P", productIds: [1], rows: [row("1", "", "1.1250", true)] });
  assert.ok("payload" in r);
  assert.equal(r.payload.conditions[0].rate, 1.125);
});

test("rows typed out of order are sent sorted by their first day", () => {
  const r = parseConditions([row("6", "10", "30"), row("1", "5", "20")]);
  assert.ok("conditions" in r);
  assert.deepEqual(r.conditions.map((c) => c.days_from), [1, 6]);
});

test("the browser checks only completeness: a name, a filled row, and to not below from", () => {
  assert.deepEqual(buildPenaltyPayload({ name: " ", productIds: [1], rows: SAMPLE }), { error: "Penalty name is required." });
  for (const rows of [[], [row("", "5", "20")], [row("1", "", "20")], [row("1", "5", "")], [row("5", "3", "20")]]) {
    assert.ok("error" in parseConditions(rows), JSON.stringify(rows));
  }
});

test("range rules are the server's: gaps, overlaps, day 0, a rate over 100 and no products pass to it", () => {
  for (const rows of [
    [row("3", "5", "20")],
    [row("1", "5", "20"), row("5", "10", "30")],
    [row("1", "", "20", true), row("6", "10", "30")],
    [row("0", "5", "20")],
    [row("1", "5", "101")],
    [row("1", "5", "1.23456")],
  ]) {
    assert.ok("conditions" in parseConditions(rows), JSON.stringify(rows));
  }
  assert.ok("payload" in buildPenaltyPayload({ name: "P", productIds: [], rows: SAMPLE }));
});

test("the browser never works out which bracket rate applies", () => {
  assert.equal("resolvePenaltyRate" in penaltyForm, false);
  assert.equal("productConflicts" in penaltyForm, false);
  for (const file of ["_lib/penalty-form.ts", "_components/penalty-form-dialog.tsx", "page.tsx"]) {
    assert.doesNotMatch(read(`${DIR}/${file}`), /resolvePenaltyRate|productConflicts/, file);
  }
});

test("a product never reads as its id: server names first, then the loaded list, else a placeholder", () => {
  const config = { applicable_product_ids: [1, 3, 7], products: [{ id: 1, name: "Salary Loan" }] };
  assert.deepEqual(configProductNames(config, null), ["Salary Loan", "Loading…", "Loading…"]);
  assert.deepEqual(configProductNames(config, new Map([[3, "Regular Loan"]])), ["Salary Loan", "Regular Loan", "—"]);
  for (const file of ["page.tsx", "_components/penalty-form-dialog.tsx", "_components/penalty-table.tsx", "_components/penalty-view-dialog.tsx"]) {
    assert.doesNotMatch(read(`${DIR}/${file}`), /Product #/, file);
  }
});

test("the notes say saves and deactivation change only loans created afterwards", () => {
  assert.equal(
    PENALTY_FORM_NOTE,
    "Changes apply to loans created after you save. Loans already created keep the penalty terms they were created with.",
  );
  assert.equal(DEACTIVATE_NOTE, "New loans on these products will use no configuration.");
  assert.match(read(`${DIR}/_components/penalty-form-dialog.tsx`), /\{PENALTY_FORM_NOTE\}/);
  assert.match(read(`${DIR}/_components/penalty-status-dialog.tsx`), /DEACTIVATE_NOTE/);
});

test("server errors are shown in the form as sent", () => {
  assert.match(read(`${DIR}/_components/penalty-form-dialog.tsx`), /setError\(getErrorMessage\(err,/);
});

test("brackets read in words", () => {
  assert.equal(describeCondition({ days_from: 1, days_to: 5, rate: 20 }), "1–5 days: 20%");
  assert.equal(describeCondition({ days_from: 11, days_to: null, rate: 50 }), "11 days or more: 50%");
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

test("the picker's hint names the other active configuration covering a product", () => {
  const owners = activeProductOwners([config(1, "active", [10, 11]), config(2, "inactive", [12]), config(3, "active", [13])], 3);
  assert.deepEqual([...owners], [[10, "Policy 1"], [11, "Policy 1"]]);
});
