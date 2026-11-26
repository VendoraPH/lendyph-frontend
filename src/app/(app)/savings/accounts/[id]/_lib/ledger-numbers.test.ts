import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ledgerNumbers } from "./ledger-numbers";

test("Number is the SVT- number; Reference is the typed reference (round 8)", () => {
  assert.deepEqual(ledgerNumbers({ reference: "SVT-000123", external_reference: "GC-778899" }), {
    number: "SVT-000123",
    reference: "GC-778899",
  });
});

test("a line with no typed reference reads a dash under Reference, never its SVT- number", () => {
  for (const blank of [null, undefined, "", "   "]) {
    assert.deepEqual(ledgerNumbers({ reference: "SVT-000124", external_reference: blank }), {
      number: "SVT-000124",
      reference: "—",
    });
  }
});

test("the account page's ledger heads Number before Reference, as the Savings Transactions list does", () => {
  const table = readFileSync(
    join(process.cwd(), "src/app/(app)/savings/accounts/[id]/_components/transactions-table.tsx"),
    "utf8",
  );

  assert.match(table, /<TableHead>Number<\/TableHead>\s*<TableHead>Reference<\/TableHead>/);
  assert.match(table, /ledgerNumbers\(t\)/);
  // The SVT- number is never printed under Reference.
  assert.doesNotMatch(table, /<TableCell className="font-mono text-xs">\{t\.reference\}<\/TableCell>/);
});

test("the ledger fits its box at 1440 px: icon-sized actions and a narrower Remarks column (BC18)", () => {
  const table = readFileSync(
    join(process.cwd(), "src/app/(app)/savings/accounts/[id]/_components/transactions-table.tsx"),
    "utf8",
  );

  // Print receipt, print slip and Reverse: each icon-sized, so the row's last
  // icon isn't cut off at the box's edge.
  assert.equal(table.match(/size="icon-sm"/g)?.length, 3);
  assert.doesNotMatch(table, /size="sm"/);
  assert.match(table, /className="max-w-48 truncate"/);
});
