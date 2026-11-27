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
import { scrollBoxClass } from "@/lib/page-fill";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const start = css.indexOf("Clearance for the floating Linda button");
const block = css.slice(start, css.indexOf("@media not all", start));
const belowFit = css.slice(css.indexOf("@media not all", start), css.indexOf("@media print", start));
const print = css.slice(css.indexOf("@media print", start));

test("a scroll box keeps the end spacer only when no pinned bar follows it", () => {
  // A pinned bar after the box itself, or after one of its wrappers (a list
  // whose pagination follows the box's parent), means the box ends above it.
  assert.ok(block.includes('[data-linda-fab] [data-slot="scroll-box"]:not(:has(~ [data-fab-clear]), :has(~ [data-fab-clear]) *)::after'), block);
  assert.ok(!/\[data-slot="scroll-box"\]::after/.test(block), "no unconditional spacer");
});

test("a pinned totals row stays lined up: the gutter is on every row of the box's own table, never on the totals alone", () => {
  assert.ok(
    block.includes('[data-linda-fab] [data-slot="scroll-box"]:not(:has(~ [data-fab-clear]), :has(~ [data-fab-clear]) *) > [data-slot="table-container"] tr > :last-child'),
    block,
  );
  assert.ok(!block.includes("tfoot tr > :last-child"), "no totals-only gutter");
  assert.ok(!block.includes("tr[data-total] > :last-child"), "no totals-only gutter");
});

test("at fit a page with no PageFill keeps room at the foot of the main area", () => {
  assert.ok(block.includes("@media (min-width: 1024px) and (min-height: 640px)"), block);
  assert.ok(
    block.includes('[data-linda-fab] [data-app-main]:not(:has([data-slot="page-fill"])) {\n    padding-bottom: var(--linda-fab-clearance);'),
    block,
  );
});

const tallPage = (() => {
  const at = block.indexOf("@media screen and (min-width: 1024px) and (min-height: 640px)");
  return at === -1 ? "" : block.slice(at);
})();

test("a fitted page with no scroll region or pinned bar of its own keeps the room below its last card, however tall", () => {
  assert.ok(tallPage !== "", "a screen-only fit block for fitted pages");
  // The outermost PageFill only, and only where nothing of its own scrolls or is pinned.
  assert.ok(
    tallPage.includes(
      '[data-linda-fab] [data-slot="page-fill"]:not([data-slot="page-fill"] *):not(:has([data-slot="scroll-box"], [data-fab-clear], [class*="fit:overflow-auto"], [class*="fit:overflow-y-auto"]))',
    ),
    tallPage,
  );
  // A minimum height instead of a fixed one, so its content stays in flow and the end padding lies below it.
  assert.match(tallPage, /height: auto;\n\s+min-height: 100%;\n\s+padding-bottom: calc\(var\(--linda-fab-clearance\) - 1\.5rem\);/);
});

test("a scroll region built from scrollBoxClass is recognised as the page's own, so its page keeps its full height", () => {
  assert.ok(scrollBoxClass().split(" ").includes("fit:overflow-auto"));
});

test("below fit every page's main area keeps room at its foot", () => {
  assert.ok(belowFit.startsWith("@media not all and (min-width: 1024px), not all and (min-height: 640px)"), belowFit);
  assert.ok(belowFit.includes("[data-linda-fab] [data-app-main] {\n    padding-bottom: var(--linda-fab-clearance);"), belowFit);
});

test("the clearance applies only while the button shows", () => {
  const selectors = [...(block + belowFit).matchAll(/^\s*(\[[^{]+)\{/gm)].map((match) => match[1].trim());
  assert.ok(selectors.length >= 5, selectors.join("\n"));
  for (const selector of selectors) assert.ok(selector.startsWith("[data-linda-fab] "), selector);
});

test("print drops the main area's padding, the clearance included", () => {
  assert.ok(print.includes("[data-app-main] {\n    padding: 0 !important;"), print);
});
