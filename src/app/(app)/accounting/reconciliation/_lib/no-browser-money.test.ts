import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The Reconciliation screens show the server's figures only: nothing on them
 * sums, divides or derives money, counts matches, or decides "reconciled" from
 * the difference. These are source checks over the list page, the worksheet
 * page, their components and `_lib` code (tests excluded), with self-tests
 * below that each pattern fires. Same approach as the Loan Accounting scan.
 */
const ROOT = join(process.cwd(), "src/app/(app)/accounting/reconciliation");

function listed(dir: string, extensions: string[]): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .filter((name) => extensions.some((ext) => name.endsWith(ext) && !name.endsWith(`.test${ext}`)))
    .map((name) => join(dir, name));
}

/**
 * The code left once comments, string contents, regex literals and JSX slashes
 * (`</x>`, `/>`) are removed, so only operators can hold a `/`. A template
 * literal keeps its `${…}` expressions, where arithmetic could hide.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/`(?:\\.|\$\{([^}]*)\}|[^`\\$])*`/g, (literal) => {
      const expressions = [...literal.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
      return `\`${expressions.map((e) => `\${${e}}`).join("")}\``;
    })
    .replace(/(^|[=(,:!&|?{}]\s*|\breturn\s+)\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\n\\[])+\/[dgimsuy]*/gm, "$1RE")
    .replace(/<\//g, "<")
    .replace(/\/>/g, ">");
}

/** A Tailwind fraction such as `top-1/2` or `w-1/3`, allowed explicitly. */
const TAILWIND_FRACTION = /\b[a-z-]*\d+\/\d+\b/g;

const MONEY_FIELD =
  String.raw`(?:\.(?:amount|total)\b|\b(?:book_balance|statement_balance|difference|matched_count|possible_count|unmatched_count|outstanding_count)\b|\btotals\.\w+)`;
const OPERATOR = String.raw`(?:\+=|-=|\*=|\/=|[-+*/](?![=>]))`;
const MONEY_ARITHMETIC = new RegExp(
  `${MONEY_FIELD}\\s*[)\\]]*\\s*${OPERATOR}|${OPERATOR}\\s*\\(*\\s*[\\w.?!\\[\\]]*${MONEY_FIELD}`,
);

/** Counting rows (`rows.filter(…).length`) instead of reading the server's counts. */
const BROWSER_COUNT = /\.filter\([^;]*\)\s*\.length\b/;

/** Deciding "reconciled" from the difference instead of reading `is_reconciled`. */
const BROWSER_RECONCILED = /\bdifference\s*[!=]==?\s*0\b|\b0\s*[!=]==?\s*[\w.?]*difference\b/;

/** What a source does with money that it shouldn't, by pattern. Empty when clean. */
function findings(source: string): string[] {
  const code = codeOnly(source);
  const found: string[] = [];
  if (/\.reduce\(/.test(code)) found.push("reduce");
  if (/sumCentavos/.test(code)) found.push("sumCentavos");
  if (/\//.test(code.replace(TAILWIND_FRACTION, ""))) found.push("division");
  if (MONEY_ARITHMETIC.test(code)) found.push("money arithmetic");
  if (BROWSER_COUNT.test(code)) found.push("browser count");
  if (BROWSER_RECONCILED.test(code)) found.push("browser reconciled");
  return found;
}

function screenSources(): Array<{ file: string; source: string }> {
  return [
    "page.tsx",
    join("[id]", "page.tsx"),
    ...listed("_components", [".tsx", ".ts"]),
    ...listed("_lib", [".ts"]),
  ].map((file) => ({ file, source: readFileSync(join(ROOT, file), "utf8") }));
}

// ── The screens ──

test("the scan covers both pages, the components and the _lib code, tests excluded", () => {
  const files = screenSources().map((s) => s.file);
  assert.ok(files.includes("page.tsx"));
  assert.ok(files.includes(join("[id]", "page.tsx")));
  assert.ok(files.some((f) => f.startsWith("_components")));
  assert.ok(files.includes(join("_lib", "reconciliation-view.ts")));
  assert.ok(files.includes(join("_lib", "statement-form.ts")));
  assert.equal(files.some((f) => f.includes(".test.")), false);
});

test("nothing on the screens sums, divides, counts or derives money", () => {
  for (const { file, source } of screenSources()) {
    assert.deepEqual(findings(source), [], file);
  }
});

// ── Each pattern fires ──

test("a reduce and sumCentavos are caught", () => {
  assert.deepEqual(findings("const n = rows.reduce((a, r) => a, 0);"), ["reduce"]);
  assert.ok(findings("sumCentavos(rows)").includes("sumCentavos"));
});

test("a division is caught with or without spaces", () => {
  assert.deepEqual(findings("const share = count / rows;"), ["division"]);
  assert.deepEqual(findings("const share = count/rows;"), ["division"]);
  assert.deepEqual(findings("const v = `${count/2}`;"), ["division"]);
});

test("a Tailwind fraction, a path in a string, a regex, a comment and JSX are not division", () => {
  assert.deepEqual(findings('<span className="top-1/2 w-1/3" />'), []);
  assert.deepEqual(findings('const href = "/accounting/reconciliation";'), []);
  assert.deepEqual(findings("const href = `/accounting/reconciliation/${id}`;"), []);
  assert.deepEqual(findings("const ok = /^\\d{4}-\\d{2}-\\d{2}$/.test(s);"), []);
  assert.deepEqual(findings("// a / b\n/* c / d */ const x = 1;"), []);
  assert.deepEqual(findings("<p>Text</p>"), []);
});

test("reconciliation figures used with + - * / or += are caught", () => {
  for (const snippet of [
    "const d = r.book_balance - r.statement_balance;",
    "const x = row.amount * 100;",
    "const x = -row.amount;",
    "const n = r.matched_count + r.possible_count;",
    "total += line.amount;",
    "const x = r.difference / 2;",
    "const x = r.unmatched_count - 1;",
  ]) {
    assert.ok(findings(snippet).length > 0, snippet);
  }
});

test("counting rows and deciding reconciled from the difference are caught", () => {
  assert.deepEqual(findings('const n = lines.filter((l) => l.match === "matched").length;'), ["browser count"]);
  assert.deepEqual(findings("const clean = r.difference === 0;"), ["browser reconciled"]);
  assert.deepEqual(findings("const off = 0 !== r.difference;"), ["browser reconciled"]);
});

test("reading a figure, a sign check and is_reconciled are fine", () => {
  assert.deepEqual(findings("formatCentavos(r.difference)"), []);
  assert.deepEqual(findings("const out = row.amount < 0;"), []);
  assert.deepEqual(findings("const clean = r.is_reconciled;"), []);
  assert.deepEqual(findings("String(r.matched_count)"), []);
  assert.deepEqual(findings("const ok = r.possible_count > 0;"), []);
});
