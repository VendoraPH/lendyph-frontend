import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOf, memberSources } from "./sources";

// Every member portal figure is the server's (portal design §0, product
// decision "the browser never calculates balances"): the member screens never
// add, net, round or derive money, never parse a money figure to do maths with
// it, and never show $. Modelled on the savings guard; it scans every member
// source, so a page that lands later is checked too.

/** A name that holds money on the member screens (an id, such as `account_id`, doesn't). */
const MONEY = String.raw`\w*(?:amount|balance|principal|interest|penalty|premium|insurance|tax|payout|deposit|withdrawal|withdrawable|debit|credit|total|gross|net|held|hold|pending|available|outstanding|overdue|paid_up|pledge|contribution|repaid|paid|build_up)\w*(?<!Id|_id|_at|_on|_date|_months|_number)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "a browser money helper from #512", pattern: /\b(?:paidPercent|toAmount|gcashAmountProblem)\b/ },
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running total", pattern: /[+\-*/]=/ },
  { name: "rounding", pattern: /\.toFixed\s*\(|\bMath\.(?:round|floor|ceil|max|min|trunc|abs)\b/ },
  {
    name: "parsing a money figure",
    pattern: new RegExp(String.raw`\b(?:parseFloat|parseInt|Number|toNumber)\s*\(\s*[\w.?]*?${MONEY}\s*\)`, "i"),
  },
  { name: "parseFloat at all", pattern: /\bparseFloat\s*\(/ },
  { name: "arithmetic on a money figure", pattern: new RegExp(String.raw`\b${MONEY}\s+[-+*/]\s+[\w(]`, "i") },
  { name: "arithmetic with a money figure", pattern: new RegExp(String.raw`[\w)]\s+[-+*/]\s+[\w.?]*\.${MONEY}\b`, "i") },
  { name: "the withdrawable fallback", pattern: /available_balance\s*-|maintaining_balance\s*\)/ },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
];

export function moneyFindings(source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    const code = codeOf(line);
    for (const { name, pattern } of FORBIDDEN) if (pattern.test(code)) found.push(`line ${index + 1}: ${name}`);
  });
  return found;
}

const FILES = memberSources();

test("the member portal sources exist to be checked", () => {
  assert.ok(FILES.length >= 60, `checked ${FILES.length} files`);
});

for (const { file, text } of FILES) {
  test(`${file} works out no money`, () => {
    assert.deepEqual(moneyFindings(text), []);
  });
}

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["a browser money helper from #512", "const pct = paidPercent(loan);"],
  ["a browser money helper from #512", "const n = toAmount(account.balance);"],
  ["reduce", "const total = rows.reduce((t, r) => t + r.amount, 0);"],
  ["a running total", "total += row.amount_paid;"],
  ["rounding", "const shown = amount.toFixed(2);"],
  ["rounding", "const left = Math.max(0, balance);"],
  ["parsing a money figure", "const n = Number(account.withdrawable);"],
  ["parseFloat at all", "const n = parseFloat(value);"],
  ["arithmetic on a money figure", "const after = ledger_balance - pending_withdrawal;"],
  ["arithmetic with a money figure", "const left = 100 - loan.paid_up;"],
  ["the withdrawable fallback", "const w = account.available_balance - account.maintaining_balance;"],
  ["a dollar sign", "<span>$1,500.00</span>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(moneyFindings(line).some((f) => f.endsWith(name)), line);
  });
}

const CLEAN: readonly string[] = [
  "<Money value={loan.total_outstanding} />",
  "account_id: Number(form.account_id),",
  "<span>{loan.paid_percent}%</span>",
  'const label = `${count} ${count === 1 ? "month" : "months"}`;',
  "style={{ width: `${loan.paid_percent}%` }}",
  "if (bytes < 1024 * 1024) return x;",
];

for (const line of CLEAN) {
  test(`the scan lets a clean line through: ${line}`, () => {
    assert.deepEqual(moneyFindings(line), []);
  });
}
