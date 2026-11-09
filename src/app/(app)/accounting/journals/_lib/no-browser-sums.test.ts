import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every journal total is the server's: the register's from `meta.totals`, a
 * journal's from `total_debit` and `total_credit`, and the form's from
 * `POST /accounting/journals/preview`. Typed amounts are parsed, never totalled.
 */
const ROOT = process.cwd();
const JOURNALS = join(ROOT, "src/app/(app)/accounting/journals");
const ALSO = [
  "src/lib/accounting/journal.ts",
  "src/app/(app)/accounting/_components/journal-line-rows.tsx",
  "src/app/(app)/accounting/_components/journal-source-document.tsx",
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = [...sources(JOURNALS), ...ALSO.map((p) => join(ROOT, p))];

const FORBIDDEN: [RegExp, string][] = [
  [/\bsumCentavos\b/, "sumCentavos"],
  [/\bisBalanced\b/, "isBalanced"],
  [/\.reduce\s*\(/, ".reduce("],
];

test("the journal screens and journal.ts never sum money in the browser", () => {
  assert.ok(FILES.length >= 6, "the journal screens were found");
  const found: string[] = [];
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, name] of FORBIDDEN) {
      if (pattern.test(text)) found.push(`${relative(ROOT, file)}: ${name}`);
    }
  }
  assert.deepEqual(found, []);
});

test("the register no longer drains every journal", () => {
  const register = readFileSync(join(JOURNALS, "page.tsx"), "utf8");
  assert.equal(/journalsListAll/.test(register), false);
  assert.match(register, /journalsPage/);
});
