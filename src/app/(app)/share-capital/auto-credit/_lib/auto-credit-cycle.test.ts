/**
 * The half of the month a share capital auto-credit run is for (finish run
 * round 8): the 15th or the 30th, as the savings auto-credit picks its cycle.
 *
 * WHAT THIS PROVES: the choice defaults by today's date in Manila (the 1st to
 * the 15th suggests the 15th); the choice reads in words; the server's own
 * cycle is read back only when it is one of the two; the result names the
 * half the server says it ran; and the page sends the choice with the preview
 * and the run, and ignores a preview for a choice no longer picked.
 * WHAT IT DOES NOT PROVE: which pledges a half credits (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTO_CREDIT_CYCLE_OPTIONS,
  autoCreditCycleWords,
  defaultAutoCreditCycle,
  isAutoCreditCycle,
  runCompletedMessage,
} from "./auto-credit-cycle";

test("the choice defaults by today's date: the 1st to the 15th suggests the 15th", () => {
  assert.equal(defaultAutoCreditCycle("2026-11-01"), "15");
  assert.equal(defaultAutoCreditCycle("2026-11-15"), "15");
  assert.equal(defaultAutoCreditCycle("2026-11-16"), "30");
  assert.equal(defaultAutoCreditCycle("2026-02-28"), "30");
  assert.equal(defaultAutoCreditCycle("2026-12-31"), "30");
});

test("the two halves read in words", () => {
  assert.deepEqual(AUTO_CREDIT_CYCLE_OPTIONS, [
    { value: "15", label: "The 15th" },
    { value: "30", label: "The 30th" },
  ]);
  assert.equal(autoCreditCycleWords("15"), "the 15th");
  assert.equal(autoCreditCycleWords("30"), "the 30th");
});

test("only 15 and 30 are halves", () => {
  assert.ok(isAutoCreditCycle("15"));
  assert.ok(isAutoCreditCycle("30"));
  for (const other of [15, "31", "", null, undefined, ["15"]]) assert.ok(!isAutoCreditCycle(other));
});

test("the result names the half the server ran, else the one sent", () => {
  assert.equal(
    runCompletedMessage({ cycle: "30", skipped_count: 2 }, "15", "₱700.00", 3),
    "Auto-credit for the 30th completed: ₱700.00 credited to 3 members; 2 skipped (see the reasons on the page).",
  );
  assert.equal(
    runCompletedMessage({ skipped_count: 0 }, "15", "₱500.00", 1),
    "Auto-credit for the 15th completed: ₱500.00 credited to 1 member.",
  );
});

const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/auto-credit/page.tsx"), "utf8");

test("the page offers the choice beside its label, defaulting by today in Manila", () => {
  assert.ok(page.includes("defaultAutoCreditCycle(todayISO())"));
  assert.match(page, /Run for\s*<NativeSelect/);
  assert.ok(page.includes("AUTO_CREDIT_CYCLE_OPTIONS.map"));
});

test("the preview and the run send the choice", () => {
  assert.ok(page.includes("shareCapitalService.autoCreditStatus(cycle)"));
  assert.match(page, /autoCreditProcess\(\{\s*cycle,/);
});

test("a preview for a choice no longer picked is dropped", () => {
  assert.ok(page.includes("if (requested !== latestRequest.current) return;"));
});
