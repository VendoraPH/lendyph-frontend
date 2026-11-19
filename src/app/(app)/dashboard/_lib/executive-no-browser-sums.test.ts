/**
 * The executive dashboard displays the server's figures. These calculations
 * were moved to the server (EB-D1; addendum §5 items 1–3, 5 and 6) and must
 * not come back: the card's change, the period presets and comparison, the
 * product shares and the branch table. Cash and the alerts are EB-D2's and
 * are not checked here yet.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/(app)/dashboard");
const EB_D2_FILES = new Set(["attention.ts", "attention-panel.tsx", "financial-section.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !EB_D2_FILES.has(name) ? [path] : [];
  });
}

const sources = files(ROOT).map((path) => ({ path, text: readFileSync(path, "utf8") }));

for (const banned of ["percentChange", "pointChange", "branchRows", "sumKnown", "presetPeriod", "previousPeriod", "prevCashFlow", "prevEfficiency"]) {
  test(`the dashboard never works out ${banned} in the browser`, () => {
    const found = sources.filter((s) => new RegExp(`\\b${banned}\\b`).test(s.text)).map((s) => s.path);
    assert.deepEqual(found, []);
  });
}

test("no dashboard file adds figures up with reduce", () => {
  const found = sources.filter((s) => /\.reduce\(/.test(s.text)).map((s) => s.path);
  assert.deepEqual(found, []);
});
