/**
 * The executive dashboard displays the server's figures. These calculations
 * were moved to the server (EB-D1; addendum §5 items 1–3, 5 and 6) and must
 * not come back: the card's change, the period presets and comparison, the
 * product shares and the branch table, and (EB-D2, addendum items 4 and 7)
 * cash and the Requires Attention thresholds. Every dashboard file is checked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/(app)/dashboard");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const sources = files(ROOT).map((path) => ({ path, text: readFileSync(path, "utf8") }));

for (const banned of [
  "percentChange",
  "pointChange",
  "branchRows",
  "sumKnown",
  "presetPeriod",
  "previousPeriod",
  "prevCashFlow",
  "prevEfficiency",
  // EB-D2: the alerts' thresholds and the cash total are the server's.
  "ATTENTION_THRESHOLDS",
  "cashBalance",
  "cash_on_hand",
  "cash_in_bank",
  "e_wallets",
]) {
  test(`the dashboard never works out ${banned} in the browser`, () => {
    const found = sources.filter((s) => new RegExp(`\\b${banned}\\b`).test(s.text)).map((s) => s.path);
    assert.deepEqual(found, []);
  });
}

test("no dashboard file adds figures up with reduce", () => {
  const found = sources.filter((s) => /\.reduce\(/.test(s.text)).map((s) => s.path);
  assert.deepEqual(found, []);
});

test("the guard reads EB-D2's files too", () => {
  const names = sources.map((s) => s.path.split("/").at(-1));
  for (const name of ["attention.ts", "attention-panel.tsx", "financial-section.tsx"]) assert.ok(names.includes(name), name);
});

test("Outstanding by component never reads the deprecated outstanding.principal or outstanding.balance", () => {
  const found = sources.filter((s) => /outstanding\??\.(principal|balance)\b/.test(s.text) || (s.path.endsWith("portfolio-section.tsx") && /\?\.principal\b/.test(s.text))).map((s) => s.path);
  assert.deepEqual(found, []);
});

test("Required Allowance is the overview card's, never the Provisioning report's total", () => {
  // Every dashboard file, EB-D2's included: one figure, from one place.
  const everywhere = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return everywhere(path);
      return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
    });
  const found = everywhere(ROOT).filter((path) =>
    /totals\??\.required_allowance|reportService\.provisioning/.test(readFileSync(path, "utf8")),
  );
  assert.deepEqual(found, []);
});
