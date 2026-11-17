/**
 * Clearance for Linda's floating button (globals.css).
 *
 * WHAT THIS PROVES: a scroll box gets the end spacer, and its own table the
 * right gutter, only when no pinned bar (pagination, a form footer) follows it,
 * since only then can its foot sit under the button. The gutter is on every
 * row's last cell, so a pinned totals row stays lined up with its column.
 * WHAT IT DOES NOT PROVE: the rendered layout (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const start = css.indexOf("Clearance for the floating Linda button");
const block = css.slice(start, css.indexOf("@media not all", start));

test("a scroll box keeps the end spacer only when no pinned bar follows it", () => {
  assert.ok(block.includes('[data-linda-fab] [data-slot="scroll-box"]:not(:has(~ [data-fab-clear]))::after'), block);
  assert.ok(!/\[data-slot="scroll-box"\]::after/.test(block), "no unconditional spacer");
});

test("a pinned totals row stays lined up: the gutter is on every row of the box's own table, never on the totals alone", () => {
  assert.ok(
    block.includes('[data-linda-fab] [data-slot="scroll-box"]:not(:has(~ [data-fab-clear])) > [data-slot="table-container"] tr > :last-child'),
    block,
  );
  assert.ok(!block.includes("tfoot tr > :last-child"), "no totals-only gutter");
  assert.ok(!block.includes("tr[data-total] > :last-child"), "no totals-only gutter");
});
