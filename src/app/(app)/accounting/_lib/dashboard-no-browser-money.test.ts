import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The dashboard and the general ledger show the server's figures only: no
// browser totals, differences or sign flips, and no draining every page to add
// them up.
const ROOT = "src/app/(app)/accounting";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** A name that holds a server figure on these screens. */
const MONEY_HOLDER = String.raw`\b(?:data|meta|row|m|period|past_due)\??\.\w+`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "forEach", pattern: /\.forEach\s*\(/ },
  { name: "sumCentavos", pattern: /\bsumCentavos\b/ },
  { name: "fetchAllPages", pattern: /\bfetchAllPages\b/ },
  { name: "a ListAll drain", pattern: /ListAll\s*\(/ },
  { name: "+= or -=", pattern: /[+-]=/ },
  { name: "arithmetic after a figure", pattern: new RegExp(`${MONEY_HOLDER}\\s*[-+*/](?![/*])`) },
  { name: "arithmetic before a figure", pattern: new RegExp(`(?<![/*])[-+*/]\\s*${MONEY_HOLDER}`) },
  { name: "a sign flip", pattern: /-\s*\b(?:data|meta|row)\??\./ },
  { name: "centavos scaled to pesos", pattern: /[*/]\s*100\b/ },
];

/**
 * Lines allowed to match, each for a stated reason. Only the axis tick: it
 * scales centavos to pesos to abbreviate the label (₱130K), and never feeds a
 * figure shown in full.
 */
const ALLOWED: ReadonlyArray<{ file: string; line: string }> = [
  {
    file: `${ROOT}/_lib/dashboard-chart.ts`,
    line: "return `${sign}₱${COMPACT.format(Math.abs(centavos) / 100)}`;",
  },
];

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

const FILES = [
  `${ROOT}/page.tsx`,
  `${ROOT}/general-ledger/page.tsx`,
  ...readdirSync(join(process.cwd(), ROOT, "_components/dashboard")).map(
    (name) => `${ROOT}/_components/dashboard/${name}`,
  ),
  ...readdirSync(join(process.cwd(), ROOT, "_lib"))
    .filter((name) => name.startsWith("dashboard-") && !name.endsWith(".test.ts"))
    .map((name) => `${ROOT}/_lib/${name}`),
];

test("the dashboard and general ledger files exist to be checked", () => {
  assert.ok(FILES.length >= 6, `checked ${FILES.length} files`);
});

for (const file of FILES) {
  test(`${file} adds up no money and drains no list`, () => {
    assert.deepEqual(findings(file, read(file)), []);
  });
}

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["reduce", "const total = rows.reduce((t, r) => t, 0);"],
  ["forEach", "rows.forEach((r) => { total = total + r.debit; });"],
  ["sumCentavos", "const total = sumCentavos(rows.map((r) => r.debit));"],
  ["fetchAllPages", "fetchAllPages(load);"],
  ["a ListAll drain", "accountingService.generalLedgerListAll(query);"],
  ["+= or -=", "total += amount;"],
  ["+= or -=", "balance -= credit;"],
  ["arithmetic after a figure", "const net = data.income_mtd - expenses;"],
  ["arithmetic after a figure", "const share = row.debit / total;"],
  ["arithmetic after a figure", "const due = past_due.amount + 1;"],
  ["arithmetic after a figure", "const x = m.income * 2;"],
  ["arithmetic after a figure", "const y = data.period?.income + 1;"],
  ["arithmetic before a figure", "const net = income - data.expenses_mtd;"],
  ["arithmetic before a figure", "const move = closing - meta.opening_balance;"],
  ["arithmetic before a figure", "const z = 2 * period.income;"],
  ["a sign flip", "const shown = -row.running_balance;"],
  ["a sign flip", "value={-data.net_income_mtd}"],
  ["centavos scaled to pesos", "const pesos = amount / 100;"],
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

test("the scan passes ordinary display code", () => {
  const fine = [
    "{centavosOrDash(row.running_balance)}",
    "{row.debit ? formatCentavos(row.debit) : \"\"}",
    "key={`${row.journal_id}-${i}`}",
    "if (page !== 1) updateQuery({});",
    "return from > asOf ? \"From must be on or before As of.\" : null;",
    "const PHILIPPINE_OFFSET = \"h-4 w-4\";",
    "// the server adds income - expenses",
    "import { x } from \"../../_lib/dashboard-figures\";",
  ];
  for (const line of fine) assert.deepEqual(findings("seeded.ts", line), [], line);
});

test("the axis-tick scaling is allowed only where it is, and nowhere else", () => {
  const chart = `${ROOT}/_lib/dashboard-chart.ts`;
  const [allowed] = ALLOWED;
  assert.ok(read(chart).includes(allowed.line), "the allowed line is still in the file");
  assert.deepEqual(findings(chart, allowed.line), []);
  assert.deepEqual(findings(`${ROOT}/page.tsx`, allowed.line), ["line 1: centavos scaled to pesos"]);
});

test("a bad line seeded into the dashboard fails the scan", () => {
  const file = `${ROOT}/page.tsx`;
  const seeded = `${read(file)}\nconst net = data.income_mtd - data.expenses_mtd;\n`;
  const hits = findings(file, seeded);
  assert.ok(hits.length > 0, "the seeded line is caught");
  assert.ok(hits.every((hit) => hit.startsWith(`line ${seeded.split("\n").length - 1}:`)), String(hits));
});

test("the general ledger pages on the server and shows the server's meta", () => {
  const page = read(`${ROOT}/general-ledger/page.tsx`);
  assert.match(page, /accountingService\.generalLedgerPage\(/);
  assert.match(page, /<TablePagination\b/);
  for (const field of ["opening_balance", "closing_balance", "total_debit", "total_credit"]) {
    assert.match(page, new RegExp(`meta\\.${field}\\b`), field);
  }
  assert.match(page, /row\.running_balance/);
});

test("the general ledger holds a To before From and shows the server's To message", () => {
  const page = read(`${ROOT}/general-ledger/page.tsx`);
  assert.match(page, /const rangeError = ledgerRangeError\(from, to\)/);
  assert.match(page, /accountId !== null && rangeError === null/);
  assert.match(page, /ledgerToFieldError\(/);
  assert.match(page, /aria-invalid=\{toError !== null\}/);
});

test("the dashboard passes From to the server", () => {
  const page = read(`${ROOT}/page.tsx`);
  assert.match(page, /accountingService\.dashboard\(asOf, branchParam\(branch\), from\)/);
});
