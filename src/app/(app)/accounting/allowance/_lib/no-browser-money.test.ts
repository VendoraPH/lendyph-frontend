import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The allowance screen shows the server's required amounts, balances,
 * adjustments, totals and rates, and never works them out itself (round C,
 * Lead's call 7). This reads every source file under the screen's folder and
 * fails on the ways a browser would add, net or multiply money, or turn a rate
 * into a number.
 */
const ROOT = resolve(process.cwd(), "src/app/(app)/accounting/allowance");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const FILES = sources(ROOT);

test("the folder has the screen's sources", () => {
  assert.ok(FILES.some((file) => file.endsWith("page.tsx")), "page.tsx is scanned");
  assert.ok(FILES.length >= 3);
});

test("no source adds, nets or multiplies money in the browser", () => {
  const forbidden: Array<[RegExp, string]> = [
    [/\bsumCentavos\b/, "sumCentavos"],
    [/\.reduce\s*\(/, ".reduce("],
    [/\+=/, "+="],
    [/-=/, "-="],
    [/\b(required|principal|balance|adjustment|current_balance|previous_balance)\w*[ \t]*[-+*/][ \t]*\w/i, "arithmetic on a money figure"],
    [/\w[ \t]*[-+*/][ \t]*\w*\.(required|principal|current_balance|previous_balance|adjustment)\b/, "arithmetic with a money figure"],
    [/\b(parseFloat|parseInt)\s*\(/, "parsing a figure"],
    [/Number\s*\(\s*\w*\.?rate_percent/, "turning a rate into a number"],
    [/rate_percent[ \t]*[-+*/]/, "arithmetic on a rate"],
  ];
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, name] of forbidden) {
      assert.doesNotMatch(text, pattern, `${file} uses ${name}`);
    }
  }
});

test("money reads in pesos, never dollars", () => {
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\$\s?\d|\bUSD\b/, `${file} shows a dollar amount`);
  }
});
