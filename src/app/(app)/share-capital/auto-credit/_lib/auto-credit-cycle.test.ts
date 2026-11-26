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
import { cycleOptions, cycleRunState, membersCount, previewCycle, runCompletedMessage } from "./auto-credit-cycle";

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

test("the status is the chosen cycle's own: not run yet, or completed on the day its run was made", () => {
  const day = (value: string) => `day(${value})`;
  assert.deepEqual(cycleRunState({ cycle_run: null }, "November 30", day), { done: false, text: "Not run yet for November 30" });
  assert.deepEqual(cycleRunState({}, "November 30", day), { done: false, text: "Not run yet for November 30" });
  assert.deepEqual(
    cycleRunState({ cycle_run: { id: 4, processed_at: "2026-11-27 09:15:00", status: "completed" } }, "November 15", day),
    { done: true, text: "Completed on day(2026-11-27 09:15:00)" },
  );
  // Another cycle's last run never reads as this cycle's.
  assert.deepEqual(
    cycleRunState({ cycle_run: null, last_run: { processed_at: "2026-11-27 09:15:00", status: "completed" } }, "November 30", day),
    { done: false, text: "Not run yet for November 30" },
  );
});

test("member counts read in the plural except for one", () => {
  assert.equal(membersCount(0), "0 members");
  assert.equal(membersCount(1), "1 member");
  assert.equal(membersCount(12), "12 members");
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

test("the status badge is the chosen cycle's, and the select fits its longest label", () => {
  assert.ok(page.includes("cycleRunState(raw,"));
  assert.ok(!page.includes('lastRun ? "Completed" : "Pending"'));
  assert.doesNotMatch(page, /aria-label="Run for"[^>]*className="w-/);
});

test("the confirmation counts members in words", () => {
  assert.ok(page.includes("membersCount(activeMembers.length)"));
  assert.doesNotMatch(page, /member\{activeMembers\.length > 1 \? "s" : ""\}/);
});

test("a preview for a cycle no longer picked is dropped", () => {
  assert.ok(page.includes("if (requested !== latestRequest.current) return;"));
});
