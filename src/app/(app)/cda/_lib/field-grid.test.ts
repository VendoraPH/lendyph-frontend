/**
 * The 2xl two-column layout of a report section's field rows.
 *
 * WHAT THIS PROVES: a text area takes both columns; every row but the first
 * gets its divider (the card's header already sits above the first row, and a
 * text area starts a row of its own); below 2xl nothing is added.
 * WHAT IT DOES NOT PROVE: the rendered layout (browser check at 2xl).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldGridCells } from "./field-grid";

const SPAN = "2xl:col-span-2";
const LINE = "2xl:border-t";
const has = (classes: string, token: string) => classes.split(/\s+/).includes(token);

test("short fields pair up, and only the first pair has no divider", () => {
  const cells = fieldGridCells(["text", "money", "date", "number", "text"]);
  assert.deepEqual(
    cells.map((c) => has(c, LINE)),
    [false, false, true, true, true],
  );
  assert.ok(cells.every((c) => !has(c, SPAN)));
});

test("a text area spans both columns", () => {
  const cells = fieldGridCells(["text", "text", "textarea", "text"]);
  assert.deepEqual(
    cells.map((c) => has(c, SPAN)),
    [false, false, true, false],
  );
  assert.deepEqual(
    cells.map((c) => has(c, LINE)),
    [false, false, true, true],
  );
});

test("a first text area is the whole first row", () => {
  const cells = fieldGridCells(["textarea", "text", "text"]);
  assert.deepEqual(
    cells.map((c) => has(c, LINE)),
    [false, true, true],
  );
});

test("a short field before a text area is the first row on its own", () => {
  const cells = fieldGridCells(["text", "textarea", "text"]);
  assert.deepEqual(
    cells.map((c) => has(c, LINE)),
    [false, true, true],
  );
});

test("every class is a 2xl one, so smaller screens keep the single column", () => {
  for (const c of fieldGridCells(["text", "textarea", "text", "text"])) {
    for (const t of c.split(/\s+/).filter(Boolean)) assert.ok(t.startsWith("2xl:"), t);
  }
  assert.deepEqual(fieldGridCells([]), []);
});
