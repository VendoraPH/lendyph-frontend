import { test } from "node:test";
import assert from "node:assert/strict";
import { isTabbable, nextTabIndex } from "./focus-wrap";

const shown = { tabIndex: 0, disabled: false, hidden: false };

test("a focusable, enabled, rendered element is tabbable", () => {
  assert.equal(isTabbable(shown), true);
});

test("disabled, aria-disabled, hidden and tabindex=-1 elements are not", () => {
  // A disabled Base UI button keeps tabindex="0"; disabled must still win.
  assert.equal(isTabbable({ ...shown, disabled: true }), false);
  assert.equal(isTabbable({ ...shown, hidden: true }), false);
  assert.equal(isTabbable({ ...shown, tabIndex: -1 }), false);
});

test("Tab moves forward and wraps from the last to the first", () => {
  assert.equal(nextTabIndex(3, 0, false), 1);
  assert.equal(nextTabIndex(3, 2, false), 0);
});

test("Shift+Tab moves back and wraps from the first to the last", () => {
  assert.equal(nextTabIndex(3, 2, true), 1);
  assert.equal(nextTabIndex(3, 0, true), 2);
});

test("from outside the list (the panel itself) Tab enters at either end", () => {
  assert.equal(nextTabIndex(3, -1, false), 0);
  assert.equal(nextTabIndex(3, -1, true), 2);
});

test("a single tabbable keeps focus, and none means nowhere to go", () => {
  assert.equal(nextTabIndex(1, 0, false), 0);
  assert.equal(nextTabIndex(1, 0, true), 0);
  assert.equal(nextTabIndex(0, -1, false), -1);
});
