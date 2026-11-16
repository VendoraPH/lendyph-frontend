/**
 * The class lists behind PageFill, FillSection, ScrollBox and PageLoader.
 *
 * WHAT THIS PROVES: every height rule sits behind the `fit:` variant, so below
 * it (phones, short windows) a page scrolls exactly as before; the ScrollBox
 * un-clips the table's own wrapper and pins headings and totals; the dialog
 * form scrolls at every size; and the loader fills its page instead of
 * guessing the header's height.
 * WHAT IT DOES NOT PROVE: the rendered layout (browser check at each size).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIT_CLASSES, scrollBoxClass } from "./page-fill";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);
const has = (classes: string, token: string) => tokens(classes).includes(token);

// Height and overflow rules that must never apply outside `fit:` (or the dialog).
const UNPREFIXED_HEIGHT = /^(h-|min-h-|max-h-|flex-1$|overflow-auto$|overflow-y-auto$|overflow-hidden$)/;

test("the page root is a gap-6 column that takes the main area's height only at fit", () => {
  const c = FIT_CLASSES.page;
  for (const t of ["flex", "flex-col", "gap-6", "fit:h-full", "fit:min-h-0"]) assert.ok(has(c, t), t);
  assert.ok(!tokens(c).some((t) => UNPREFIXED_HEIGHT.test(t)), c);
});

test("a fill section is a column that takes the remaining height only at fit", () => {
  const c = FIT_CLASSES.section;
  for (const t of ["flex", "flex-col", "fit:flex-1", "fit:min-h-0"]) assert.ok(has(c, t), t);
  assert.ok(!tokens(c).some((t) => UNPREFIXED_HEIGHT.test(t)), c);
});

test("a scroll box scrolls both ways at fit and only sideways below it", () => {
  const c = scrollBoxClass();
  for (const t of ["fit:flex-1", "fit:min-h-0", "fit:overflow-auto", "overflow-x-auto", "min-w-0"]) {
    assert.ok(has(c, t), t);
  }
  assert.ok(!tokens(c).some((t) => UNPREFIXED_HEIGHT.test(t)), c);
});

test("inside a scroll box the table wrapper stops clipping and the headings and totals stick", () => {
  const c = scrollBoxClass();
  for (const t of [
    "[&_[data-slot=table-container]]:overflow-visible",
    "[&_thead_th]:sticky",
    "[&_thead_th]:top-0",
    "[&_thead_th]:z-10",
    "[&_thead_th]:bg-card",
    "[&_tfoot_td]:sticky",
    "[&_tfoot_td]:bottom-0",
    "[&_tfoot_td]:bg-card",
    "[&_tr[data-total]>*]:sticky",
    "[&_tr[data-total]>*]:bottom-0",
  ]) {
    assert.ok(has(c, t), t);
  }
});

test("the dialog's scroll box scrolls at every size and lets inner scroll boxes hand it the scrolling", () => {
  const c = scrollBoxClass({ always: true });
  for (const t of ["flex", "flex-col", "flex-1", "min-h-0", "overflow-auto", "[&_[data-slot=scroll-box]]:overflow-visible"]) {
    assert.ok(has(c, t), t);
  }
  assert.ok(!has(c, "fit:overflow-auto"), "no fit-only scrolling in the dialog");
  assert.ok(has(c, "[&_thead_th]:sticky"), "headings stay pinned in the dialog");
});

test("the page loader fills its page at fit and keeps a sensible height below it", () => {
  const c = FIT_CLASSES.loader;
  for (const t of ["flex", "items-center", "justify-center", "fit:flex-1", "fit:min-h-0"]) assert.ok(has(c, t), t);
  assert.ok(!c.includes("100vh"), "no viewport arithmetic");
});
