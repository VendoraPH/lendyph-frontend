// A passbook is the one printable that skips `assertPrintableShape`: it opens
// with the account line, not a title, and carries no signature block.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAccount, SavingsTransaction } from "@/types";
import { buildSavingsPassbookDoc, tellerInitials } from "./savings-passbook";
import { renderPrintable } from "../print-render";
import { fieldValue, notes } from "./doc-assertions";
import type { PrintBlock } from "../types";

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

function ledger(doc: ReturnType<typeof buildSavingsPassbookDoc>) {
  const table = doc.blocks.find((b): b is Extract<PrintBlock, { kind: "table" }> => b.kind === "table");
  assert.ok(table, "passbook has a ledger table");
  return table;
}

test("prints the ledger oldest first with the server's running balance", () => {
  const doc = buildSavingsPassbookDoc(ACCOUNT, LINES, { now: NOW });
  assert.equal(doc.id, "savings_passbook");
  assert.equal(doc.reference, "SA-2026-00009");
  const rows = ledger(doc).rows;
  assert.deepEqual(rows.map((r) => r.line), ["1", "2", "3"]);
  assert.deepEqual(rows.map((r) => r.code), ["DEP", "WDL", "INT"]);
  assert.deepEqual(rows.map((r) => r.balance), ["5,000.00", "4,500.00", "4,600.00"]);
  // The side a line doesn't touch is blank, not 0.00.
  assert.equal(rows[0].withdrawal, " ");
  assert.equal(rows[1].withdrawal, "500.00");
  assert.equal(rows[0].deposit, "5,000.00");
  assert.equal(fieldValue(doc, "Account No."), "SA-2026-00009");
  assert.equal(fieldValue(doc, "Account Name"), "Juana Dela Cruz");
  // Teller initials, and SYS for a line the system posted.
  assert.deepEqual(rows.map((r) => r.teller), ["TO", "TO", "SYS"]);
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
  const codes = ledger(doc).rows.map((r) => r.code);
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
  const table = ledger(doc);
  assert.equal(table.rows.length, 0);
  assert.ok(table.emptyText);
});

test("prints as a passbook page: no letterhead, title, account summary or signature lines", () => {
  const doc = buildSavingsPassbookDoc(ACCOUNT, LINES, {
    now: NOW,
    org: { name: "Lendy Cooperative", address: "Main St", contact: null, logoUrl: null },
  });
  assert.equal(doc.layout, "passbook");
  assert.ok(!doc.blocks.some((b) => b.kind === "signatures" || b.kind === "title"));
  const labels = doc.blocks.flatMap((b) => (b.kind === "fields" ? b.items.map((f) => f.label) : []));
  assert.deepEqual(labels, ["Account No.", "Account Name"]);
  const html = renderPrintable(doc);
  assert.match(html, /class="copy passbook"/);
  assert.doesNotMatch(html, /class="letterhead"|class="footer"|class="sig-|Verified by/);
  // The org still names the browser tab.
  assert.match(html, /<title>Savings Passbook — Lendy Cooperative<\/title>/);
});

test("teller initials", () => {
  assert.equal(tellerInitials("Teller One"), "TO");
  assert.equal(tellerInitials("  maria  de la cruz "), "MDL");
  assert.equal(tellerInitials(null), "SYS");
  assert.equal(tellerInitials(""), "SYS");
});
