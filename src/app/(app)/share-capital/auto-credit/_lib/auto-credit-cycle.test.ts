/**
 * The cycle a share capital auto-credit run is for (finish run round 8): a
 * month's 15th or its 30th, as the savings auto-credit picks its cycle.
 *
 * WHAT THIS PROVES: "Run for" lists the server's allowed cycles (the current
 * one first, marked, then the missed ones it allows), in the server's words,
 * never a future one it didn't send; the preview's own cycle is what the page
 * shows and the run sends; the result names the cycle the server ran; and a
 * preview for a cycle no longer picked is dropped.
 * WHAT IT DOES NOT PROVE: which cycles are allowed, or which pledges a cycle
 * credits (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cycleOptions, previewCycle, runCompletedMessage } from "./auto-credit-cycle";

const STATUS = {
  cycle_date: "2026-11-15",
  cycle_label: "November 15",
  cycle_options: [
    { date: "2026-11-30", label: "November 30" },
    { date: "2026-11-15", label: "November 15" },
    { date: "2026-10-31", label: "October 31" },
  ],
};

test("the choices are the server's cycles, the current one first and marked", () => {
  assert.deepEqual(cycleOptions(STATUS), [
    { value: "2026-11-30", label: "November 30 (current)" },
    { value: "2026-11-15", label: "November 15" },
    { value: "2026-10-31", label: "October 31" },
  ]);
});

test("unreadable choices are left out, and none sent means none offered", () => {
  assert.deepEqual(cycleOptions({ cycle_options: [{ date: "2026-11-30" }, { label: "x" }, null, "2026-11-15"] }), []);
  assert.deepEqual(cycleOptions({}), []);
});

test("the preview's own cycle is read back, with its label", () => {
  assert.deepEqual(previewCycle(STATUS), { date: "2026-11-15", label: "November 15" });
  assert.equal(previewCycle({ cycle_date: "2026-11-15" }), null);
  assert.equal(previewCycle({}), null);
});

test("the result names the cycle the server ran, else the one sent", () => {
  assert.equal(
    runCompletedMessage({ cycle_label: "November 30", skipped_count: 2 }, "November 15", "₱700.00", 3),
    "Auto-credit for November 30 completed: ₱700.00 credited to 3 members; 2 skipped (see the reasons on the page).",
  );
  assert.equal(
    runCompletedMessage({ skipped_count: 0 }, "November 15", "₱500.00", 1),
    "Auto-credit for November 15 completed: ₱500.00 credited to 1 member.",
  );
});

const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/auto-credit/page.tsx"), "utf8");

test("the page offers the server's cycles beside its label; the default is the server's current one", () => {
  assert.match(page, /Run for\s*<NativeSelect/);
  assert.ok(page.includes("options.map((option)"));
  assert.ok(page.includes("shareCapitalService.autoCreditStatus(picked ?? undefined)"));
  assert.ok(!page.includes("todayISO"), "the browser never works out the cycle");
});

test("the run sends the preview's own cycle", () => {
  assert.match(page, /autoCreditProcess\(\{\s*cycle_date: shown\.date,/);
});

test("a preview for a cycle no longer picked is dropped", () => {
  assert.ok(page.includes("if (requested !== latestRequest.current) return;"));
});
