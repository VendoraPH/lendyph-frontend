import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The opening balances screen shows the server's totals, difference and
 * balance, and never works them out itself (round C, Lead's call 5). This
 * reads every source file under the screen's folder and fails on the ways a
 * browser would add or balance money.
 */
const ROOT = resolve(process.cwd(), "src/app/(app)/accounting/opening-balances");

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
  assert.ok(FILES.length >= 2);
});

test("no source adds, nets or balances money in the browser", () => {
  const forbidden: Array<[RegExp, string]> = [
    [/\bsumCentavos\b/, "sumCentavos"],
    [/\bisBalanced\b/, "isBalanced"],
    [/\bsummariseDraft\b/, "summariseDraft"],
    [/\.reduce\s*\(/, ".reduce("],
    [/\+=/, "+="],
    [/-=/, "-="],
    [/\b(debit|credit)\w*\s*[-+]\s*\w/i, "debit or credit arithmetic"],
    [/\btotal_(debit|credit)\s*[-+]/, "arithmetic on a server total"],
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
