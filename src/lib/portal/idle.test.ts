import { test } from "node:test";
import assert from "node:assert/strict";
import { idlePhase, warningLeadMs } from "./idle";

const MIN = 60_000;

test("the warning shows in the last minute of the idle window, then the session ends", () => {
  const last = 1_000_000;
  assert.equal(idlePhase(last, 15, last + 13 * MIN), "active");
  assert.equal(idlePhase(last, 15, last + 14 * MIN), "warning");
  assert.equal(idlePhase(last, 15, last + 15 * MIN - 1), "warning");
  assert.equal(idlePhase(last, 15, last + 15 * MIN), "expired");
});

test("no activity seen yet, or no window, never signs out", () => {
  assert.equal(idlePhase(0, 15, 99 * MIN), "active");
  assert.equal(idlePhase(1, 0, 99 * MIN), "active");
});

test("a short window warns for its last half", () => {
  assert.equal(warningLeadMs(2), MIN);
  assert.equal(warningLeadMs(60), MIN);
  assert.equal(warningLeadMs(1), MIN / 2);
});
