import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The statement screens, the trial balance, and the helpers they use. */
const SOURCES = [
  "src/app/(app)/accounting/statements/page.tsx",
  "src/app/(app)/accounting/statements/_components/balance-sheet-report.tsx",
  "src/app/(app)/accounting/statements/_components/income-statement-report.tsx",
  "src/app/(app)/accounting/statements/_components/cash-flow-report.tsx",
  "src/app/(app)/accounting/statements/_components/equity-changes-report.tsx",
  "src/app/(app)/accounting/trial-balance/page.tsx",
  "src/app/(app)/accounting/_components/report-section.tsx",
  "src/app/(app)/accounting/statements/_lib/statement-lines.ts",
  "src/app/(app)/accounting/_lib/amount.ts",
  "src/app/(app)/accounting/_lib/trial-balance-side.ts",
];

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The code only. Comments are prose and may quote a formula; plain string
 * literals ("balance-sheet") hold no arithmetic; and the one allowed string
 * operation, stripping the sign for display, is removed first. Template
 * literals are kept, since `${a.total + b.total}` is arithmetic.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\.replace\("-", ""\)/g, "")
    .replace(/"[^"\n]*"/g, '""')
    .replace(/'[^'\n]*'/g, "''");
}

/** Names that hold money on the statements and the trial balance. */
const MONEY = String.raw`(?:amount|total|total_\w+|net_\w+|\w+_cash|\w+_earnings|difference|unexplained|beginning|additions|deductions|ending|debit|credit|balance)`;
/** `report.operating.total`, `l.amount`: a money field read off an object. */
const FIELD = String.raw`(?:[\w$]+\.)+${MONEY}\b`;

/** Each way the browser could work out money, as its own detector. */
const DETECTORS: Record<string, RegExp> = {
  // `x.total + …`, `x.amount - …`, `x.total -= …`
  "a money field followed by + or -": new RegExp(String.raw`\.${MONEY}\b\s*[-+](?![-+])`),
  // `… + l.amount`, `acc - x.total`, `sum += l.amount`, `-report.total`
  "+ or - (or +=, -=, unary minus) before a money field": new RegExp(String.raw`[-+]=?\s*${FIELD}`),
  // `total + x`, `amount - fee`, with the name on its own
  "a bare money name followed by + or -": new RegExp(
    String.raw`(?<![\w$.\-/])${MONEY}\s*[-+](?![-+])\s*[\w$(]`,
  ),
  // `+= amount`, `-total`, `(-balance)`
  "+=, -= or unary minus before a bare money name": new RegExp(
    String.raw`(?:[-+]=\s*|(?:^|[(\s,=:?!])-\s*)${MONEY}\b`,
    "m",
  ),
  "a list summed in the browser": /\.reduce\(/,
  "a figure derived with Math.abs": /Math\.abs\(/,
};

const moneyFinding = (source: string): string | null => {
  const body = code(source);
  for (const [name, pattern] of Object.entries(DETECTORS)) {
    if (pattern.test(body)) return name;
  }
  return null;
};

for (const path of SOURCES) {
  test(`${path} takes its figures from the server`, () => {
    const source = read(path);
    assert.doesNotMatch(source, /@\/lib\/accounting\/statements/);
    assert.doesNotMatch(source, /@\/lib\/accounting\/trial-balance/);
    assert.doesNotMatch(source, /signedBalance/);
    assert.equal(moneyFinding(source), null);
  });
}

const fires = [
  // The sums the screens used to do.
  ["amount: sheet.total_liabilities + sheet.total_equity,", "a money field followed by + or -"],
  ["Math.abs(tb.total_debit - tb.total_credit)", "a money field followed by + or -"],
  // A bare `total` and `balance`.
  ["report.operating.total + report.non_cash.total", "a money field followed by + or -"],
  ["const left = row.balance - 1;", "a money field followed by + or -"],
  // `+=` / `-=` with a money field on the right.
  ["sum += l.amount;", "+ or - (or +=, -=, unary minus) before a money field"],
  ["left -= row.balance;", "+ or - (or +=, -=, unary minus) before a money field"],
  // One side a field, the other not.
  ["lines.forEach((l) => acc + l.amount)", "+ or - (or +=, -=, unary minus) before a money field"],
  ["const net = gross - line.total;", "+ or - (or +=, -=, unary minus) before a money field"],
  // Unary minus before a money field.
  ["formatCentavos(-line.amount)", "+ or - (or +=, -=, unary minus) before a money field"],
  ["value={-report.total}", "+ or - (or +=, -=, unary minus) before a money field"],
  // Bare money names.
  ["const all = total + fees;", "a bare money name followed by + or -"],
  ["sum += amount;", "+=, -= or unary minus before a bare money name"],
  ["formatCentavos(-balance)", "+=, -= or unary minus before a bare money name"],
  ["lines.reduce((a, b) => a, 0)", "a list summed in the browser"],
  // Inside a template literal, which is still code.
  ["`${report.operating.total + report.investing.total}`", "a money field followed by + or -"],
] as const;

for (const [snippet, detector] of fires) {
  test(`the money check fires on: ${snippet}`, () => {
    assert.match(snippet, DETECTORS[detector], detector);
    assert.notEqual(moneyFinding(snippet), null);
  });
}

const quiet = [
  "amount: sheet.total_liabilities_and_equity,",
  'formatCentavos(value).replace("-", "")',
  "key: `${section}-account-${line.account_id}`,",
  'import { outOfBalanceMessage } from "../_lib/trial-balance-side";',
  'className="h-5 w-5 shrink-0 text-amber-600"',
  "if (value < 0) return null;",
  "// total_debit - total_credit, positive means debits",
  "lines.map((line, i) => ({ amount: line.amount }))",
  'const [tab, setTab] = useState("balance-sheet");',
];

for (const snippet of quiet) {
  test(`the money check stays quiet on: ${snippet}`, () => {
    assert.equal(moneyFinding(snippet), null);
  });
}

test("the balance sheet and income statement each make one server call", () => {
  const sheet = read("src/app/(app)/accounting/statements/_components/balance-sheet-report.tsx");
  assert.ok(sheet.includes("accountingService.balanceSheet("));
  assert.ok(!sheet.includes("trialBalance("));
  const income = read("src/app/(app)/accounting/statements/_components/income-statement-report.tsx");
  assert.ok(income.includes("accountingService.incomeStatement("));
  assert.ok(!income.includes("trialBalance("));
});

const cashFlow = () =>
  code(read("src/app/(app)/accounting/statements/_components/cash-flow-report.tsx"));

test("the cash flow sections show their own server totals, and the non-cash total only its own block", () => {
  const source = cashFlow();
  const totals = [...source.matchAll(/\btotal=\{([^}]*)\}/g)].map((m) => m[1]);
  assert.deepEqual(totals, [
    "report.operating.total",
    "report.investing.total",
    "report.financing.total",
    "report.non_cash.total",
  ]);
  assert.equal(source.split("non_cash.total").length - 1, 1);
});

test("the cash flow warns only when the server says it isn't reconciled", () => {
  const source = cashFlow();
  assert.equal(source.split("is_reconciled").length - 1, 1);
  const block = source.match(/\{report\.is_reconciled === false && \(([\s\S]*?)\n\s*\)\}/);
  assert.ok(block, "the warning sits behind is_reconciled === false");
  assert.ok(block[1].includes("report.unexplained"));
  assert.equal(
    source.split("report.unexplained").length - 1,
    1,
    "unexplained shows only in the warning",
  );
});
