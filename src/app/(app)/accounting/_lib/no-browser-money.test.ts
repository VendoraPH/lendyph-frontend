import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Every accounting screen shows the server's figures: the browser never adds
// up, nets or balances money, and money is always ₱. This scans every source
// file under accounting/, so a slice that lands later is checked too.
const ROOT = join(process.cwd(), "src/app/(app)/accounting");

/** A name that holds money on these screens. */
const MONEY_NAME = String.raw`\w*(?:amount|total|balance|debit|credit|paid|due|centavos)\w*`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "sumCentavos", pattern: /\bsumCentavos\b/ },
  { name: "isBalanced", pattern: /\bisBalanced\b/ },
  { name: "buildAging", pattern: /\bbuildAging\b/ },
  { name: "buildBalanceSheet", pattern: /\bbuildBalanceSheet\b/ },
  { name: "summariseDraft", pattern: /\bsummariseDraft\b/ },
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running money total", pattern: new RegExp(`\\b${MONEY_NAME}\\s*[+-]=`, "i") },
  {
    name: "debit and credit netted",
    pattern: /\w*debit\w*\s*[-+]\s*[\w.?]*credit|\w*credit\w*\s*[-+]\s*[\w.?]*debit/i,
  },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
];

/**
 * Lines allowed to match, each for a stated reason. Empty: a `.reduce` over
 * something that isn't money goes here with its reason, never a disable.
 */
const ALLOWED: ReadonlyArray<{ file: string; line: string }> = [];

/** The comment-free code of a line; comments may describe what the server adds up. */
function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

/** Every forbidden pattern a file's source matches, as "line N: name". */
function findings(file: string, source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    if (ALLOWED.some((allowed) => allowed.file === file && line.trim() === allowed.line)) return;
    const code = codeOf(line);
    for (const { name, pattern } of FORBIDDEN) {
      if (pattern.test(code)) found.push(`line ${index + 1}: ${name}`);
    }
  });
  return found;
}

/** Every .ts and .tsx source under accounting/, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = sources(ROOT);

test("the accounting sources exist to be checked", () => {
  assert.ok(FILES.length >= 50, `checked ${FILES.length} files`);
});

for (const path of FILES) {
  const file = relative(ROOT, path);
  test(`${file} adds up no money, balances nothing and shows no $`, () => {
    assert.deepEqual(findings(file, readFileSync(path, "utf8")), []);
  });
}

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["sumCentavos", "const total = sumCentavos(rows.map((r) => r.amount));"],
  ["isBalanced", "const ok = isBalanced(debit, credit);"],
  ["buildAging", "const buckets = buildAging(loans, asOf);"],
  ["buildBalanceSheet", "const sheet = buildBalanceSheet(accounts);"],
  ["summariseDraft", "const totals = summariseDraft(draft);"],
  ["reduce", "const total = rows.reduce((t, r) => t + r.amount, 0);"],
  ["a running money total", "total += row.amount;"],
  ["a running money total", "outstandingBalance -= payment;"],
  ["debit and credit netted", "const diff = data.total_debit - data.total_credit;"],
  ["debit and credit netted", "const net = credit + debitSide;"],
  ["a dollar sign", "<span>$1,500.00</span>"],
  ["a dollar sign", 'const sign = "$";'],
  ["a dollar sign", "label: `Amount ($)`"],
  ["a dollar sign", 'currency: "USD"'],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    const hits = findings("seeded.ts", line);
    assert.ok(
      hits.some((hit) => hit.endsWith(`: ${name}`)),
      `expected "${name}", got ${JSON.stringify(hits)}`,
    );
  });
}

const CLEAN: readonly string[] = [
  "<span>{formatCentavos(data.total_debit)}</span>",
  "const label = `${count} entries`;",
  "const match = /^(\\d{4})-(\\d{2})$/.exec(month);",
  "depth += 1;",
  "// the server adds up total_debit - total_credit",
  "if (entry.total_debit === entry.total_credit) return formatCentavos(entry.total_debit);",
];

for (const line of CLEAN) {
  test(`the scan leaves server figures, templates and regexes alone: ${line}`, () => {
    assert.deepEqual(findings("seeded.ts", line), []);
  });
}
