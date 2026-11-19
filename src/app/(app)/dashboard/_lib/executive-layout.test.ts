import { test } from "node:test";
import assert from "node:assert/strict";
import { EXECUTIVE_LAYOUT as L } from "./executive-layout";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

test("only the header and filter bar are pinned; the cards and sections share the one scroll box", () => {
  // At 1024x640 the wrapped filter bar (158px) plus 12 pinned cards (381px)
  // left the sections box 0px tall, and the whole page scrolled.
  assert.ok(tokens(L.pinned).includes("shrink-0"), L.pinned);
  assert.deepEqual(tokens(L.scrollBody), ["flex", "min-w-0", "flex-col", "gap-4"]);
});

test("every grid is one shrinkable column at phone width, so charts and tables never push past their card", () => {
  // An implicit grid column is sized to its content: at 390px the charts ran 51-87px past the card.
  for (const grid of [L.columns, L.twoUp, L.kpiGrid]) {
    const t = tokens(grid);
    assert.ok(t.includes("grid"), grid);
    assert.ok(t.some((c) => /^grid-cols-\d$/.test(c)), grid);
  }
  assert.ok(tokens(L.cell).includes("min-w-0"), L.cell);
});

test("figure tiles are never narrower than a full two-decimal peso figure", () => {
  // At 1366x768 four tiles were 74px wide and ₱113,583.34 needs 103px.
  assert.ok(tokens(L.tiles).includes("grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"), L.tiles);
});
