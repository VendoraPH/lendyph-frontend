/**
 * The staff loan origination screens show the server's figures: declared
 * totals, the assessment's ratios and amounts, the dashboard and the tab
 * counts. Nothing is added up, compared, rounded or worked out again in the
 * browser. This reads every file under loans/origination and fails on the
 * names that would.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src/app/(app)/loans/origination");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const sources = files(ROOT).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));

test("the guard has the screens to read", () => {
  const names = sources.map((s) => s.path);
  for (const name of ["page.tsx", join("applications", "[id]", "page.tsx"), join("_lib", "assessment-view.ts")]) {
    assert.ok(names.includes(name), name);
  }
});

for (const banned of [
  // Totals and changes: the server's declared_totals, meta.stats and dashboard.
  "reduce",
  "reduceRight",
  "percentChange",
  "pointChange",
  // Amounts typed by the applicant, as numbers: the server converts them.
  "parseAmount",
  "parseFloat",
  "declaredIncomeRows",
  "declaredExpenseRows",
  // Ratios and limits: shown as sent, coloured by the server's checks.
  "ratioTone",
  "toFixed",
  "Math.round",
  "Math.floor",
  "Math.ceil",
]) {
  test(`no loan origination screen works out figures with ${banned}`, () => {
    const pattern = new RegExp(`\\b${banned.replace(".", "\\.")}\\b`);
    assert.deepEqual(
      sources.filter((s) => pattern.test(s.text)).map((s) => s.path),
      [],
    );
  });
}
