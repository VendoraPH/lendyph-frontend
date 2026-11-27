import test from "node:test";
import assert from "node:assert/strict";

import { dialogFinalFocus } from "./dialog-focus";

const heading = { isConnected: true } as unknown as HTMLElement;
const gone = { isConnected: false } as unknown as HTMLElement;

test("closing without a change returns focus to the opener (the dialog's default)", () => {
  assert.equal(dialogFinalFocus({ succeeded: false, fallback: heading }), true);
});

test("after a success that removes the opener, focus goes to the fallback", () => {
  assert.equal(dialogFinalFocus({ succeeded: true, fallback: heading }), heading);
});

test("with no fallback, or one no longer on the page, the dialog's default applies", () => {
  assert.equal(dialogFinalFocus({ succeeded: true, fallback: null }), true);
  assert.equal(dialogFinalFocus({ succeeded: true, fallback: gone }), true);
});
