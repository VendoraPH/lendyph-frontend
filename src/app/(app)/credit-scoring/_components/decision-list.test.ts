/**
 * Decision and history rows, read from source: for a summary caller a
 * decision has no reason or remarks, so nothing shows in their place.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "src/app/(app)/credit-scoring/_components");
const list = readFileSync(join(dir, "decision-list.tsx"), "utf8");
const history = readFileSync(join(dir, "score-history-table.tsx"), "utf8");

test("a decision without a reason or remarks shows neither", () => {
  assert.match(list, /\{d\.reason && <p>\{d\.reason\}<\/p>\}/);
  assert.match(list, /\{d\.remarks && <p className="text-muted-foreground">\{d\.remarks\}<\/p>\}/);
  assert.doesNotMatch(list, /^\s*<p>\{d\.reason\}<\/p>$/m);
});

test("a history row without a reason shows an empty cell", () => {
  assert.match(history, /<TableCell>\{row\.reason \?\? ""\}<\/TableCell>/);
});
