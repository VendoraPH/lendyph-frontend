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
  pending_amount: "0.00",
  available_balance: "3100.00",
  accrued_interest: "3.20",
  interest_credited_through: null,
  opened_on: "2026-09-01",
  last_member_activity_on: "2026-10-31",
  dormant_since: null,
  closed_on: null,
  close_reason: null,
  remarks: null,
};

function line(
  id: number,
  date: string,
  type: SavingsTransaction["type"],
  debit: string,
  credit: string,
  balance: string,
  createdBy: SavingsTransaction["created_by"] = { id: 1, name: "Teller One" },
): SavingsTransaction {
  return {
    id,
    account_id: 9,
    reference: `REF-${id}`,
    type,
    date,
    value_date: date,
    debit,
    credit,
    balance_after: balance,
    method: "cash",
    external_reference: null,
    remarks: null,
    counterpart_transaction_id: null,
    reverses_transaction_id: null,
    time_deposit_id: null,
    interest_run_id: null,
    approval_id: null,
    created_by: createdBy,
    created_at: null,
  };
}

// As the API sends them: newest first.
const LINES = [
  line(3, "2026-10-31", "interest", "0.00", "100.00", "4600.00", null),
  line(2, "2026-10-15", "withdrawal", "500.00", "0.00", "4500.00"),
  line(1, "2026-09-01", "deposit", "0.00", "5000.00", "5000.00"),
];

const NOW = new Date(2026, 10, 7);

test("prints the ledger oldest first with the server's running balance", () => {
  const doc = buildSavingsPassbookDoc(ACCOUNT, LINES, { now: NOW });
  assertPrintableShape(doc, "savings_passbook");
  assert.equal(doc.reference, "SA-2026-00009");
  const rows = tableBlock(doc, "Transactions").rows;
  assert.deepEqual(rows.map((r) => r.reference), ["REF-1", "REF-2", "REF-3"]);
  assert.deepEqual(rows.map((r) => r.code), ["DEP", "WDL", "INT"]);
  assert.deepEqual(rows.map((r) => r.balance), ["5000.00", "4500.00", "4600.00"]);
  // The side a line doesn't touch is blank, not 0.00.
  assert.equal(rows[0].withdrawal, " ");
  assert.equal(rows[1].withdrawal, "500.00");
  assert.equal(fieldValue(doc, "On hold"), formatCurrency(1000));
  // A line the system posted names the system as its teller.
  assert.deepEqual(rows.map((r) => r.teller), ["Teller One", "Teller One", "System"]);
});

test("every savings line type has its own code, and an unknown one reads OTH, never the raw key", () => {
  const types: SavingsTransaction["type"][] = [
    "deposit", "withdrawal", "transfer_in", "transfer_out", "interest", "withholding_tax", "closing", "reversal",
    "fee", "share_capital_transfer",
  ];
  const doc = buildSavingsPassbookDoc(
    ACCOUNT,
    [...types.map((t, i) => line(i + 1, "2026-10-01", t, "0.00", "1.00", "1.00")),
      line(99, "2026-10-02", "mystery" as SavingsTransaction["type"], "0.00", "1.00", "2.00")],
    { now: NOW },
  );
  const codes = tableBlock(doc, "Transactions").rows.map((r) => r.code);
  assert.deepEqual(codes, ["DEP", "WDL", "TRI", "TRO", "INT", "TAX", "CLS", "REV", "FEE", "SCT", "OTH"]);
  assert.match(notes(doc), /FEE excess withdrawal fee, SCT transfer to share capital/);
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
