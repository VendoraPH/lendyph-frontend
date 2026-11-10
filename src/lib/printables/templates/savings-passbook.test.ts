import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAccount, SavingsTransaction } from "@/types";
import { buildSavingsPassbookDoc } from "./savings-passbook";
import { assertPrintableShape, fieldValue, notes, tableBlock } from "./doc-assertions";
import { formatCurrency } from "./shared";

const ACCOUNT: SavingsAccount = {
  id: 9,
  account_number: "SA-2026-00009",
  borrower_id: 7,
  borrower_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  branch_id: 1,
  branch_name: "Main",
  product: { id: 1, code: "RS", name: "Regular Savings", kind: "regular" },
  status: "active",
  balance: "4600.00",
  hold_amount: "1000.00",
  available_balance: "3100.00",
  accrued_interest: "3.20",
  opened_at: "2026-09-01",
  closed_at: null,
  last_transaction_at: "2026-10-31",
};

function line(id: number, date: string, type: SavingsTransaction["type"], debit: number, credit: number, balance: number): SavingsTransaction {
  return {
    id,
    account_id: 9,
    date,
    type,
    reference: `REF-${id}`,
    description: null,
    debit,
    credit,
    running_balance: balance,
    payment_method: "cash",
    created_by_user: { id: 1, name: "Teller One" },
    created_at: null,
  };
}

// As the API sends them: newest first.
const LINES = [
  line(3, "2026-10-31", "interest", 0, 100, 4600),
  line(2, "2026-10-15", "withdrawal", 500, 0, 4500),
  line(1, "2026-09-01", "deposit", 0, 5000, 5000),
];

const NOW = new Date(2026, 10, 7);

test("prints the ledger oldest first with the server's running balance", () => {
  const doc = buildSavingsPassbookDoc(ACCOUNT, LINES, { now: NOW });
  assertPrintableShape(doc, "savings_passbook");
  assert.equal(doc.reference, "SA-2026-00009");
  const rows = tableBlock(doc, "Transactions").rows;
  assert.deepEqual(rows.map((r) => r.reference), ["REF-1", "REF-2", "REF-3"]);
  assert.deepEqual(rows.map((r) => r.code), ["DEP", "WDL", "INT"]);
  assert.deepEqual(rows.map((r) => r.balance), [5000, 4500, 4600]);
  // The side a line doesn't touch is blank, not 0.00.
  assert.equal(rows[0].withdrawal, " ");
  assert.equal(rows[1].withdrawal, 500);
  assert.equal(fieldValue(doc, "On hold"), formatCurrency(1000));
});

test("a truncated ledger says it is not the whole history", () => {
  assert.doesNotMatch(notes(buildSavingsPassbookDoc(ACCOUNT, LINES, { now: NOW })), /most recent/);
  assert.match(
    notes(buildSavingsPassbookDoc(ACCOUNT, LINES, { now: NOW, truncated: true })),
    /Only the 3 most recent transactions/,
  );
});

test("an account with no lines still prints, with the empty text", () => {
  const doc = buildSavingsPassbookDoc(ACCOUNT, [], { now: NOW });
  const table = tableBlock(doc, "Transactions");
  assert.equal(table.rows.length, 0);
  assert.ok(table.emptyText);
});
