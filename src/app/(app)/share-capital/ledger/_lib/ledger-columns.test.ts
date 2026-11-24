import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Subsidiary Ledger shows each entry's two numbers in their own columns
 * (finish run round 3): Entry No., the ledger's SC- number, and Reference No.,
 * the entry's CSH, GCash, bank or imported reference, or a dash. The screen
 * reads both from the helper the export uses, and its full-width rows span
 * the seven columns.
 */
test("the Subsidiary Ledger's entries table has Entry No. and Reference No., and its rows span seven columns", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/ledger/page.tsx"), "utf8");

  assert.match(
    page,
    /<TableHead className="text-xs">Entry No\.<\/TableHead>\s*<TableHead className="text-xs">Reference No\.<\/TableHead>\s*<TableHead className="text-xs">Description<\/TableHead>/,
  );
  assert.match(page, /\.\.\.ledgerEntryNumbers\(raw\)/);
  assert.match(page, /\{entry\.entryNo\}/);
  assert.match(page, /\{entry\.referenceNo\}/);

  // The opening balance and Period Total rows label four columns, then Debit,
  // Credit and Balance; the empty state spans all seven.
  assert.equal(page.match(/colSpan=\{4\}/g)?.length, 2);
  assert.match(page, /<TableCell colSpan=\{7\}/);
  assert.doesNotMatch(page, /colSpan=\{6\}/);
});
