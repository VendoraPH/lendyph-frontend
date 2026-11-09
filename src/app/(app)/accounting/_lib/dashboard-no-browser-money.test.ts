import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The dashboard and the general ledger show the server's figures only: no
// browser totals, and no draining every page to add them up.
const ROOT = "src/app/(app)/accounting";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

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
    const source = read(file);
    assert.doesNotMatch(source, /\.reduce\s*\(/);
    assert.doesNotMatch(source, /\bsumCentavos\b/);
    assert.doesNotMatch(source, /\bfetchAllPages\b/);
    assert.doesNotMatch(source, /ListAll\s*\(/);
  });
}

test("the general ledger pages on the server and shows the server's meta", () => {
  const page = read(`${ROOT}/general-ledger/page.tsx`);
  assert.match(page, /accountingService\.generalLedgerPage\(/);
  assert.match(page, /<TablePagination\b/);
  for (const field of ["opening_balance", "closing_balance", "total_debit", "total_credit"]) {
    assert.match(page, new RegExp(`meta\\.${field}\\b`), field);
  }
  assert.match(page, /row\.running_balance/);
});

test("the dashboard passes From to the server", () => {
  const page = read(`${ROOT}/page.tsx`);
  assert.match(page, /accountingService\.dashboard\(asOf, branchParam\(branch\), from\)/);
});
