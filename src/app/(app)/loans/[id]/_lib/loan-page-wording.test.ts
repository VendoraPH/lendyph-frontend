import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = read("src/app/(app)/loans/[id]/page.tsx");

test("Total Paid is all money received (total_repaid) in both places, never total_paid", () => {
  assert.equal(page.match(/currencyOrDash\(loanSummary\.total_repaid\)/g)?.length, 2);
  assert.doesNotMatch(page, /loanSummary\.total_paid\b/);
});

test("the Auto-Pay toggle needs auto_pay:toggle and says why when it is missing", () => {
  const start = page.indexOf('title="Auto-Pay"');
  const card = page.slice(start, page.indexOf("Card 4: Workflow History", start));
  assert.ok(start > -1 && card.length > 0);
  assert.match(card, /<PermissionButton\s+permission="auto_pay:toggle"\s+tooltip="[^"]+"/);
  assert.doesNotMatch(card, /<Button\b/);
});

test("the release doesn't open the Auto-Pay dialog for a user who can't toggle it", () => {
  assert.match(page, /if \(canToggleAutoPay\) \{\s*setAutoPayIsPostRelease\(true\);/);
});

test("the Ledger marks a voided payment Voided", () => {
  const table = read("src/app/(app)/loans/[id]/_components/ledger-table.tsx");
  assert.doesNotMatch(table, />voided</);
  assert.match(table, />Voided</);
});
