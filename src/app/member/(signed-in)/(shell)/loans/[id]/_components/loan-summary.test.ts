import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A loan brought in from the cooperative's earlier books shows, under its Total
 * Paid, what was paid before the import: the server's `paid_before_import`,
 * worded by the shared note (finish run, round 5).
 */
test("the member's Total Paid says what it holds from before the import", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/member/(signed-in)/(shell)/loans/[id]/_components/loan-summary.tsx"),
    "utf8"
  );

  assert.match(source, /paidBeforeImportNote\(loan\.paid_before_import\)/);
  assert.match(source, /<Money value=\{loan\.total_repaid\} \/>\s*\{totalPaidNote && /);
});
