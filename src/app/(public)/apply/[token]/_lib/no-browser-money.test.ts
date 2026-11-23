import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// The public application shows the server's money as sent (origination audit
// §3.5): the estimate, the declared totals and every limit come from the
// server. The browser never adds, nets, converts or parses a money figure to
// work with it, and never shows $. It scans every public application source,
// so a screen that lands later is checked too.
const SRC = join(process.cwd(), "src");
const ROOTS = ["app/(public)/apply", "services/public-application.service.ts"];

/** A name that holds money here (an id, a count or a percent doesn't). */
const MONEY = String.raw`\w*(?:amount|installment|interest|charge|repayment|proceeds|income|expense|debt|payment|monthly|remaining|total|balance|principal)\w*(?<!Id|_id|_at|_count|_number|_percent|_frequency|_frequencies)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "a money parser", pattern: /\b(?:parseAmount|parseFloat)\s*\(/ },
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running total", pattern: /[+\-*/]=/ },
  {
    name: "parsing a money figure",
    pattern: new RegExp(String.raw`\b(?:parseInt|Number|toNumber)\s*\(\s*[\w.?]*?${MONEY}\s*\)`, "i"),
  },
  { name: "arithmetic on a money figure", pattern: new RegExp(String.raw`\b${MONEY}\s+[-+*/]\s+[\w(]`, "i") },
  { name: "arithmetic with a money figure", pattern: new RegExp(String.raw`[\w)]\s+[-+*/]\s+[\w.?]*\.${MONEY}\b`, "i") },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
];

/** The comment-free code of a line; comments may describe what the server adds up. */
function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

function findings(source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    const code = codeOf(line);
    for (const { name, pattern } of FORBIDDEN) {
      if (pattern.test(code)) found.push(`line ${index + 1}: ${name}`);
    }
  });
  return found;
}

function sources(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sources(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const FILES = ROOTS.flatMap((root) => sources(join(SRC, root)));

test("the public application sources exist to be checked", () => {
  for (const root of ROOTS) assert.ok(existsSync(join(SRC, root)), root);
  assert.ok(FILES.length >= 15, `checked ${FILES.length} files`);
});

for (const file of FILES) {
  test(`${relative(SRC, file)} works out no money`, () => {
    assert.deepEqual(findings(readFileSync(file, "utf8")), []);
  });
}

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["a money parser", "const n = parseAmount(loan.amount);"],
  ["a money parser", "const n = parseFloat(value);"],
  ["reduce", "const total = lines.reduce((t, l) => t + l.monthly, 0);"],
  ["a running total", "total += line.monthly;"],
  ["parsing a money figure", "const n = Number(totals.monthly_income);"],
  ["arithmetic on a money figure", "const left = monthly_income - monthly_expenses;"],
  ["arithmetic with a money figure", "const left = 100 - totals.monthly_remaining;"],
  ["a dollar sign", "<span>$1,500.00</span>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(findings(line).some((f) => f.endsWith(name)), line);
  });
}

const CLEAN: readonly string[] = [
  "<dd>{pesoOrDash(totals.monthly_remaining)}</dd>",
  "const term = Number(loan.term.trim());",
  "<span>{estimate.installments_count} payments</span>",
  "style={{ width: `${state.completion_percent}%` }}",
  "if (file.size > rules.maxMb * 1024 * 1024) return x;",
  "branch_id: Number(value),",
];

for (const line of CLEAN) {
  test(`the scan leaves alone: ${line}`, () => {
    assert.deepEqual(findings(line), []);
  });
}
