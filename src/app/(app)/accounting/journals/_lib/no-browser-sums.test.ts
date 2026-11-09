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

const FORBIDDEN: { name: string; pattern: RegExp; fires: string }[] = [
  { name: "sumCentavos", pattern: /\bsumCentavos\b/, fires: "sumCentavos(lines)" },
  { name: "isBalanced", pattern: /\bisBalanced\b/, fires: "isBalanced(a, b)" },
  { name: ".reduce(", pattern: /\.reduce\s*\(/, fires: "lines.reduce((t, l) => t, 0)" },
  { name: ".forEach(", pattern: /\.forEach\s*\(/, fires: "lines.forEach((l) => {})" },
  { name: "+= / -=", pattern: /[-+]=/, fires: "total += line.debit" },
  {
    name: "total_debit/total_credit in arithmetic",
    pattern: /total_(debit|credit)\s*[-+]/,
    fires: "entry.total_debit - entry.total_credit",
  },
  {
    name: "a debit or credit added or subtracted",
    pattern: /[-+]\s*\w+\.(debit|credit)\b/,
    fires: "a.debit + b.credit",
  },
  { name: "Math.abs(", pattern: /Math\.abs\s*\(/, fires: "Math.abs(debit - credit)" },
];

/**
 * Lines that match a pattern for a reason that isn't money arithmetic.
 * `journal-edit.ts` takes the digits of a stored amount to format it.
 */
const ALLOWED: { file: string; text: string; name: string }[] = [
  {
    file: "src/app/(app)/accounting/journals/_lib/journal-edit.ts",
    text: "String(Math.trunc(Math.abs(centavos)))",
    name: "Math.abs(",
  },
];

function allowed(file: string, line: string, name: string): boolean {
  return ALLOWED.some((a) => a.file === file && a.name === name && line.includes(a.text));
}

test("each forbidden pattern fires on the code it is meant to catch", () => {
  for (const { name, pattern, fires } of FORBIDDEN) {
    assert.ok(pattern.test(fires), `${name} must match ${fires}`);
  }
});

test("the patterns leave comparisons and plain reads alone", () => {
  const clean = [
    "entry.total_debit === entry.total_credit",
    "formatCentavos(entry.total_debit)",
    "sideText(line.debit, line.credit)",
    "index <= 2",
    "const x = a => a",
  ];
  for (const line of clean) {
    for (const { name, pattern } of FORBIDDEN) {
      assert.equal(pattern.test(line), false, `${name} must not match ${line}`);
    }
  }
});

test("every allow-listed line still exists, so the list can't go stale", () => {
  for (const a of ALLOWED) {
    const text = readFileSync(join(ROOT, a.file), "utf8");
    assert.ok(text.includes(a.text), `${a.file} no longer holds ${a.text}`);
  }
});

test("the journal screens and journal.ts never sum money in the browser", () => {
  assert.ok(FILES.length >= 6, "the journal screens were found");
  const found: string[] = [];
  for (const file of FILES) {
    const rel = relative(ROOT, file);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const { name, pattern } of FORBIDDEN) {
          if (pattern.test(line) && !allowed(rel, line, name)) {
            found.push(`${rel}:${i + 1}: ${name}`);
          }
        }
      });
  }
  assert.deepEqual(found, []);
});

test("the register no longer drains every journal", () => {
  const register = readFileSync(join(JOURNALS, "page.tsx"), "utf8");
  assert.equal(/journalsListAll/.test(register), false);
  assert.match(register, /journalsPage/);
});
