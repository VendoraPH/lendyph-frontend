/**
 * Linda's panel layout (`lindaPanelClass`).
 *
 * WHAT THIS PROVES: on phones the open panel covers the screen; from `md` it is
 * a side pop-up fixed over the page's right edge that slides in and out, so it
 * never takes a width in the page's row and the page never moves (Arvin,
 * 2026-11-17: "a side pop up and not move elements to the left").
 * WHAT IT DOES NOT PROVE: the rendered layout (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lindaPanelClass } from "./linda-panel";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);
const has = (classes: string, token: string) => tokens(classes).includes(token);

test("from md the open panel floats over the page's right edge and takes no width in the page's row", () => {
  const c = lindaPanelClass(true);
  for (const t of ["md:fixed", "md:inset-y-0", "md:right-0", "md:left-auto", "md:z-50", "md:translate-x-0", "md:visible", "md:shadow-2xl"]) {
    assert.ok(has(c, t), t);
  }
  assert.ok(!has(c, "md:relative"), "never a column beside the page");
  assert.ok(!tokens(c).some((t) => /^(md|lg|xl):w-\[\d+%\]$/.test(t)), "no share of the page's width");
});

test("closed, the panel slides out and can't be seen or reached", () => {
  const c = lindaPanelClass(false);
  for (const t of ["hidden", "md:translate-x-full", "md:invisible"]) assert.ok(has(c, t), t);
});

test("on phones the open panel covers the screen", () => {
  const c = lindaPanelClass(true);
  for (const t of ["fixed", "inset-0", "z-50", "flex"]) assert.ok(has(c, t), t);
});

test("opening shows the panel at once, so focus can move into it; closing hides it only after it slides out", () => {
  // A visibility transition keeps the start value at its first frame, so
  // transitioning it on open left the panel hidden when the composer took
  // focus, and focus fell to the page (browser check R3).
  const opened = lindaPanelClass(true);
  assert.ok(has(opened, "md:transition-transform"), opened);
  assert.ok(!has(opened, "md:transition-[transform,visibility]"), opened);
  const closed = lindaPanelClass(false);
  assert.ok(has(closed, "md:transition-[transform,visibility]"), closed);
});

