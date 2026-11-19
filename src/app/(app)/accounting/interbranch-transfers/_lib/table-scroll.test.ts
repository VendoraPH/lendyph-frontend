/**
 * WHAT THIS PROVES: on both tabs the element that scrolls sideways is the one
 * the keyboard can focus (a named region), and the scrollbar classes come from
 * the shared helper, not a copy.
 * WHAT IT DOES NOT PROVE: the rendered scrolling (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STICKY_ACTIONS_CELL, STICKY_ACTIONS_HEAD, TABLES_SCROLL_WITH_BOX } from "./table-scroll";

const DIR = "src/app/(app)/accounting/interbranch-transfers";
const read = (path: string) => readFileSync(resolve(process.cwd(), DIR, path), "utf8");

test("In transit: each table sits in its own focusable region that scrolls sideways, so headings and notes stay in view", () => {
  assert.equal(TABLES_SCROLL_WITH_BOX, "[&_[data-slot=table-container]]:overflow-visible");
  const report = read("_components/in-transit-report.tsx");
  // The outer box scrolls up and down only; the headings and notes sit in it, outside the sideways regions.
  assert.match(report, /<ScrollBox className=\{VISIBLE_SCROLLBAR\} tabIndex=\{0\} role="region" aria-label="[^"]+"/);
  assert.doesNotMatch(report, /cn\("space-y-6", TABLES_SCROLL_WITH_BOX\)/);
  assert.equal((report.match(/<SidewaysScroll label="[^"]+">/g) ?? []).length, 2);
  assert.match(report, /<h2 id="ibt-in-transit-heading"[\s\S]*?<SidewaysScroll label=/);
  const sideways = read("_components/sideways-scroll.tsx");
  assert.match(sideways, /tabIndex=\{0\}/);
  assert.match(sideways, /role="region"/);
  assert.match(sideways, /aria-label=\{label\}/);
  assert.match(sideways, /overflow-x-auto/);
  assert.match(sideways, /TABLES_SCROLL_WITH_BOX/);
  assert.match(sideways, /VISIBLE_SCROLLBAR/);
});

test("Transfers: the table sits right in the focusable region, which pins nothing sideways away from it", () => {
  const page = read("page.tsx");
  assert.match(page, /<ScrollBox className=\{VISIBLE_SCROLLBAR\} tabIndex=\{0\} role="region" aria-label="[^"]+">\s*<TransfersTable/);
});

test("the scrollbar classes come from the shared helper; only the pinned Actions classes stay here", () => {
  const helper = read("_lib/table-scroll.ts");
  assert.doesNotMatch(helper, /webkit-scrollbar/);
  for (const file of ["page.tsx", "_components/in-transit-report.tsx", "_components/sideways-scroll.tsx"]) {
    assert.match(read(file), /import \{ VISIBLE_SCROLLBAR \} from "@\/components\/amla\/visible-scrollbar"/, file);
  }
  assert.match(STICKY_ACTIONS_CELL, /sticky right-0/);
  assert.match(STICKY_ACTIONS_HEAD, /sticky right-0/);
});
