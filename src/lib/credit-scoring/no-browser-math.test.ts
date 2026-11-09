/**
 * The browser never works out a score, band, capacity or money figure: every
 * credit scoring screen shows the server's. This reads each screen's source
 * and fails on the tools a sum or a rounding would need.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = [
  ...sources(join(ROOT, "src/app/(app)/credit-scoring")),
  ...sources(join(ROOT, "src/lib/credit-scoring")),
  join(ROOT, "src/app/(app)/loans/[id]/_components/credit-assessment-card.tsx"),
  join(ROOT, "src/services/credit-scoring.service.ts"),
];

const BANNED: { pattern: RegExp; what: string }[] = [
  { pattern: /\.reduce\(/, what: "a sum (.reduce)" },
  { pattern: /Math\.(round|floor|ceil|trunc)\(/, what: "a rounding (Math.*)" },
  { pattern: /\.toFixed\(|\.toPrecision\(/, what: "a rounding (toFixed/toPrecision)" },
  { pattern: /maximumFractionDigits/, what: "a rounding formatter" },
  { pattern: /sumWeights|isValidWeightTotal|riskLevelFromScore/, what: "a browser weight or band rule" },
];

test("the scan covers the screens, the helpers, the card and the service", () => {
  assert.ok(FILES.length > 20, `only ${FILES.length} files found`);
});

test("no credit scoring screen sums or rounds a figure", () => {
  const found: string[] = [];
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, what } of BANNED) {
      if (pattern.test(text)) found.push(`${file.slice(ROOT.length + 1)}: ${what}`);
    }
  }
  assert.deepEqual(found, []);
});
