import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Every savings figure is the server's (savings design §0, product decision
// "the browser never calculates balances"): the browser never adds, nets,
// rounds or derives money, never parses a money figure to do maths with it,
// and never shows a raw key where words belong. This scans every savings
// source, so a screen that lands later is checked too.
const SRC = join(process.cwd(), "src");
const ROOTS = [
  "app/(app)/savings",
  "lib/savings",
  "services/savings.service.ts",
  "services/savings-time-deposit.service.ts",
  "services/savings-approval.service.ts",
  "services/savings-interest.service.ts",
  "services/savings-auto-credit.service.ts",
  "lib/printables/templates/savings-passbook.ts",
  "lib/printables/templates/savings-receipt.ts",
  "lib/printables/templates/time-deposit-certificate.ts",
  "app/(app)/reports/_lib/savings-report-builders.ts",
];

/** A name that holds money on the savings screens (an id, such as `payoutAccountId`, doesn't). */
const MONEY = String.raw`\w*(?:amount|balance|principal|interest|tax|payout|deposit|withdrawal|debit|credit|total|gross|net|hold|pending|available|limit)\w*(?<!Id|_id)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "a browser estimate", pattern: /\b(?:estimatePlacement|projectedBalance|ESTIMATE_DAY_BASIS|toAmount)\b/ },
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running total", pattern: /[+\-*/]=/ },
  { name: "rounding", pattern: /\.toFixed\s*\(|\bMath\.(?:round|floor|ceil|max|min|trunc)\b/ },
  {
    name: "parsing a money figure",
    pattern: new RegExp(String.raw`\b(?:parseFloat|parseInt|Number|toNumber)\s*\(\s*[\w.?]*?${MONEY}\s*\)`, "i"),
  },
  { name: "arithmetic on a money figure", pattern: new RegExp(String.raw`\b${MONEY}\s+[-+*/]\s+[\w(]`, "i") },
  { name: "arithmetic with a money figure", pattern: new RegExp(String.raw`[\w)]\s+[-+*/]\s+[\w.?]*\.${MONEY}\b`, "i") },
  { name: "a raw key as a label", pattern: /_LABELS\[[^\]]+\]\s*\?\?/ },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
];

/** Lines allowed to match, each for a stated reason. */
const ALLOWED: ReadonlyArray<{ file: string; line: string; reason: string }> = [
  {
    file: "app/(app)/savings/_lib/time-deposit-rules.ts",
    line: "return Math.round((ms(toISO) - ms(fromISO)) / 86_400_000);",
    reason: "whole days between two dates, not money",
  },
  {
    file: "lib/printables/templates/time-deposit-certificate.ts",
    line: "const principal = toNumber(td.principal);",
    reason: "the certificate prints the server's figure in words; nothing is worked out",
  },
  {
    file: "lib/printables/templates/time-deposit-certificate.ts",
    line: "const maturityAmount = toNumber(td.maturity_amount);",
    reason: "the certificate prints the server's figure in words; nothing is worked out",
  },
  {
    file: "lib/printables/templates/savings-receipt.ts",
    line: "const figure = toNumber(amountText);",
    reason: "the receipt prints the server's figure in words; nothing is worked out",
  },
];

/** The comment-free code of a line; comments may describe what the server adds up. */
function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

function findings(file: string, source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    if (ALLOWED.some((a) => a.file === file && line.trim() === a.line)) return;
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

test("the savings sources exist to be checked", () => {
  assert.ok(FILES.length >= 60, `checked ${FILES.length} files`);
  for (const root of ROOTS) assert.ok(existsSync(join(SRC, root)), root);
});

for (const path of FILES) {
  const file = relative(SRC, path);
  test(`${file} works out no money and shows no raw key`, () => {
    assert.deepEqual(findings(file, readFileSync(path, "utf8")), []);
  });
}

test("every allowed line still exists, so the list can't go stale", () => {
  for (const allowed of ALLOWED) {
    const text = readFileSync(join(SRC, allowed.file), "utf8");
    assert.ok(text.split("\n").some((l) => l.trim() === allowed.line), `${allowed.file}: ${allowed.line}`);
  }
});

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["a browser estimate", "const e = estimatePlacement(principal, rate, term, tax, date);"],
  ["a browser estimate", "const n = toAmount(account.balance);"],
  ["reduce", "const total = rows.reduce((t, r) => t + r.amount, 0);"],
  ["a running total", "total += row.amount;"],
  ["rounding", "const shown = amount.toFixed(2);"],
  ["rounding", "const holdable = Math.max(0, balance - hold);"],
  ["parsing a money figure", "const n = parseFloat(account.available_balance);"],
  ["parsing a money figure", "const n = Number(quote.payout);"],
  ["arithmetic on a money figure", "const holdable = balance - hold;"],
  ["arithmetic on a money figure", "const after = ledger_balance + amount;"],
  ["arithmetic with a money figure", "const left = 100 - account.hold_amount;"],
  ["a raw key as a label", "{TRANSACTION_TYPE_LABELS[t.type] ?? t.type}"],
  ["a dollar sign", "<span>$1,500.00</span>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(findings("seeded.ts", line).some((f) => f.endsWith(name)), line);
  });
}

const CLEAN: readonly string[] = [
  'import { TimeDepositDetail } from "./time-deposit-detail";',
  "<TableCell>{formatCurrency(t.balance_after)}</TableCell>",
  "const term = Number(d.termDays);",
  "const payoutAccount = Number(form.payoutAccountId);",
  'className="text-right tabular-nums"',
  "{labelOf(TRANSACTION_TYPE_LABELS, t.type)}",
];

for (const line of CLEAN) {
  test(`the scan lets a clean line through: ${line}`, () => {
    assert.deepEqual(findings("seeded.ts", line), []);
  });
}
