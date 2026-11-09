import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The Loan Accounting screen shows the server's figures only: nothing on it
 * sums, divides or derives money. These are source checks over the page, its
 * components and its `_lib` code (tests excluded), with self-tests below that
 * each pattern fires.
 */
const ROOT = join(process.cwd(), "src/app/(app)/accounting/loans");

function listed(dir: string, ext: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((name) => name.endsWith(ext) && !name.endsWith(`.test${ext}`))
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
  String.raw`(?:\.(?:gross|net|allowance|amount|total)\b|\b(?:outstanding_\w+|total_outstanding|past_due_amount|past_due_total|books_principal|records_principal|unearned_income|adjustments_clearing|difference)\b|\btotals\.\w+)`;
const OPERATOR = String.raw`(?:\+=|-=|\*=|\/=|[-+*/](?![=>]))`;
const MONEY_ARITHMETIC = new RegExp(
  `${MONEY_FIELD}\\s*[)\\]]*\\s*${OPERATOR}|${OPERATOR}\\s*\\(*\\s*[\\w.?!\\[\\]]*${MONEY_FIELD}`,
);

/** What a source does with money that it shouldn't, by pattern. Empty when clean. */
function findings(source: string): string[] {
  const code = codeOnly(source);
  const found: string[] = [];
  if (/\.reduce\(/.test(code)) found.push("reduce");
  if (/sumCentavos/.test(code)) found.push("sumCentavos");
  if (/buildAging|receivableAging/.test(code)) found.push("browser aging");
  if (/\//.test(code.replace(TAILWIND_FRACTION, ""))) found.push("division");
  if (MONEY_ARITHMETIC.test(code)) found.push("money arithmetic");
  return found;
}

function screenSources(): Array<{ file: string; source: string }> {
  return ["page.tsx", ...listed("_components", ".tsx"), ...listed("_lib", ".ts")].map(
    (file) => ({ file, source: readFileSync(join(ROOT, file), "utf8") }),
  );
}

// ── The screen ──

test("the scan covers the page, its components and its _lib code, tests excluded", () => {
  const files = screenSources().map((s) => s.file);
  assert.ok(files.includes("page.tsx"));
  assert.ok(files.some((f) => f.startsWith("_components")));
  assert.ok(files.includes(join("_lib", "loan-accounting-view.ts")));
  assert.ok(files.includes(join("_lib", "posting-rules.ts")));
  assert.equal(files.some((f) => f.includes(".test.")), false);
});

test("nothing on the screen sums, divides or does arithmetic on money", () => {
  for (const { file, source } of screenSources()) {
    assert.deepEqual(findings(source), [], file);
  }
});

// ── Each pattern fires ──

test("a reduce is caught", () => {
  assert.deepEqual(findings("const n = rows.reduce((a, r) => a, 0);"), ["reduce"]);
});

test("sumCentavos and the browser aging are caught", () => {
  assert.ok(findings("sumCentavos(rows)").includes("sumCentavos"));
  assert.ok(findings("buildAging(items, asOf)").includes("browser aging"));
  assert.ok(findings("accountingService.receivableAging(asOf)").includes("browser aging"));
});

test("a division is caught with or without spaces", () => {
  assert.deepEqual(findings("const share = count / rows;"), ["division"]);
  assert.deepEqual(findings("const share = count/rows;"), ["division"]);
  assert.deepEqual(findings("const half = (count)/2;"), ["division"]);
  assert.deepEqual(findings("const v = `${count/2}`;"), ["division"]);
});

test("a Tailwind fraction, a path in a string, a regex, a comment and JSX are not division", () => {
  assert.deepEqual(findings('<span className="top-1/2 w-1/3" />'), []);
  assert.deepEqual(findings("const c = cn(`top-1/2`, x);"), []);
  assert.deepEqual(findings('const href = "/loans/1"; const e = "GET /accounting/loans";'), []);
  assert.deepEqual(findings("const href = `/loans/${id}`;"), []);
  assert.deepEqual(findings("const ok = /^\\d+(?:\\.\\d+)?$/.test(s); s.replace(/_/g, \" \");"), []);
  assert.deepEqual(findings("// a / b\n/* c / d */ const x = 1;"), []);
  assert.deepEqual(findings("<p>Text</p>"), []);
});

test("money fields used with + - * / or += are caught", () => {
  for (const snippet of [
    "const n = books.gross - books.allowance;",
    "const x = row.amount * 100;",
    "const x = 100 * row.amount;",
    "const x = r.outstanding_principal + 1;",
    "total += row.past_due_amount;",
    "const x = summary.past_due_total - 1;",
    "const x = meta.totals.total_outstanding + 1;",
    "const x = aging.total * 2;",
    "const x = -books.net;",
  ]) {
    assert.ok(findings(snippet).includes("money arithmetic"), snippet);
  }
});

test("reading a money field is not arithmetic", () => {
  assert.deepEqual(findings("centavosOrDash(books.gross)"), []);
  assert.deepEqual(findings("centavosOrDash(totals?.outstanding_principal)"), []);
  assert.deepEqual(findings("const ok = count === 1 ? a : b;"), []);
  assert.deepEqual(findings("const f = (x) => x.amount;"), []);
});
