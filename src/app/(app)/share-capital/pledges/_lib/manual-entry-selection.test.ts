/**
 * Pledge Entry's bulk "Manual Entry" (finish run round 7): a pledge set to
 * auto-credit takes no entry by hand, as the server refuses, so its row can't
 * be ticked, and one ticked before it was switched on is listed as excluded,
 * with the reason, and never sent.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_CREDIT_ENTRY_LOCK_REASON,
  canTickForManualEntry,
  manualEntrySelection,
  pageSelectionState,
} from "./manual-entry-selection";

const ana = { id: 1, borrower: "Ana Santos", autoCredit: true };
const ben = { id: 2, borrower: "Ben Cruz", autoCredit: false };
const carla = { id: 3, borrower: "Carla Reyes", autoCredit: false };

describe("canTickForManualEntry", () => {
  test("refuses a pledge set to auto-credit, which the server refuses too", () => {
    assert.equal(canTickForManualEntry(ana), false);
    assert.equal(canTickForManualEntry(ben), true);
  });

  test("explains the lock in words", () => {
    assert.equal(
      AUTO_CREDIT_ENTRY_LOCK_REASON,
      "This pledge is set to auto-credit, so the auto-credit run credits it. Turn auto-credit off to record an entry by hand.",
    );
  });
});

describe("manualEntrySelection", () => {
  test("keeps the ticked pledges that take an entry, in list order", () => {
    const result = manualEntrySelection([carla, ben, ana], new Set([2, 3]));
    assert.deepEqual(result.included.map((p) => p.id), [3, 2]);
    assert.deepEqual(result.excluded, []);
  });

  test("lists a ticked pledge that was switched to auto-credit as excluded, with the reason", () => {
    const result = manualEntrySelection([ana, ben], new Set([1, 2]));
    assert.deepEqual(result.included.map((p) => p.id), [2]);
    assert.deepEqual(result.excluded, [{ pledge: ana, reason: AUTO_CREDIT_ENTRY_LOCK_REASON }]);
  });

  test("ignores pledges that aren't ticked", () => {
    assert.deepEqual(manualEntrySelection([ana, ben, carla], new Set()).included, []);
    assert.deepEqual(manualEntrySelection([ana, ben, carla], new Set()).excluded, []);
  });
});

describe("pageSelectionState", () => {
  test("counts only the rows that can be ticked", () => {
    assert.deepEqual(pageSelectionState([ana, ben, carla], new Set([2, 3])), { all: true, some: true, tickable: [ben, carla] });
    assert.deepEqual(pageSelectionState([ana, ben, carla], new Set([2])), { all: false, some: true, tickable: [ben, carla] });
    assert.deepEqual(pageSelectionState([ana, ben, carla], new Set()), { all: false, some: false, tickable: [ben, carla] });
  });

  test("is never all-ticked when no row on the page can be ticked", () => {
    assert.deepEqual(pageSelectionState([ana], new Set([1])), { all: false, some: false, tickable: [] });
  });
});
