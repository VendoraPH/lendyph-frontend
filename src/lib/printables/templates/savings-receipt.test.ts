import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAccount, SavingsTransaction } from "@/types";
import { amountInWords } from "../amount-in-words";
import { buildSavingsReceiptDoc, isReceiptTransaction } from "./savings-receipt";
import {
  allFields,
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  notes,
  prose,
  signatures,
  titleBlock,
} from "./doc-assertions";
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
  hold_amount: "0.00",
  pending_amount: "0.00",
  available_balance: "4600.00",
  accrued_interest: "0.00",
  interest_credited_through: null,
  opened_on: "2026-09-01",
  last_member_activity_on: "2026-10-31",
  dormant_since: null,
  closed_on: null,
  close_reason: null,
  remarks: null,
};

function txn(overrides: Partial<SavingsTransaction> = {}): SavingsTransaction & { type: "deposit" | "withdrawal" } {
  const line: SavingsTransaction = {
    id: 31,
    account_id: 9,
    reference: "SDP-2026-000031",
    type: "deposit",
    date: "2026-11-10",
    value_date: "2026-11-10",
    debit: "0.00",
    credit: "1500.00",
    balance_after: "4600.00",
    method: "cash",
    external_reference: null,
    remarks: null,
    counterpart_transaction_id: null,
    reverses_transaction_id: null,
    time_deposit_id: null,
    interest_run_id: null,
    approval_id: null,
    created_by: { id: 1, name: "Teller One" },
    created_at: null,
    ...overrides,
  };
  if (!isReceiptTransaction(line)) throw new Error("fixture is not a receipt line");
  return line;
}

const NOW = new Date(2026, 10, 10, 9, 0);

test("a deposit receipt states the server's credit, in figures and words", () => {
  const doc = buildSavingsReceiptDoc(ACCOUNT, txn(), { now: NOW });
  assertPrintableShape(doc, "savings_receipt");
  assert.equal(titleBlock(doc).text, "Deposit Receipt");
  assert.equal(chargeAmount(doc, "AMOUNT DEPOSITED"), formatCurrency(1500));
  assert.equal(fieldValue(doc, "Amount in words"), amountInWords(1500));
  assert.equal(fieldValue(doc, "Balance after this transaction"), formatCurrency(4600));
  assert.equal(fieldValue(doc, "Receipt No."), "SDP-2026-000031");
  assert.equal(fieldValue(doc, "Depositor"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Payment Method"), "Cash");
  assert.equal(doc.reference, "SDP-2026-000031");
  assert.deepEqual(doc.copies, ["Depositor's Copy", "File Copy"]);
  assert.deepEqual(
    signatures(doc).map((s) => [s.label, s.name]),
    [
      ["Deposited by", "Juana Dela Cruz"],
      ["Received by", "Teller One"],
    ],
  );
});

test("a withdrawal receipt states the debit and who released it", () => {
  const doc = buildSavingsReceiptDoc(
    ACCOUNT,
    txn({ type: "withdrawal", debit: "800.00", credit: "0.00", balance_after: "3800.00" }),
    { now: NOW },
  );
  assert.equal(titleBlock(doc).text, "Withdrawal Receipt");
  assert.equal(chargeAmount(doc, "AMOUNT WITHDRAWN"), formatCurrency(800));
  assert.equal(fieldValue(doc, "Amount in words"), amountInWords(800));
  assert.deepEqual(
    signatures(doc).map((s) => s.label),
    ["Received by", "Released by"],
  );
});

test("absent optional details are left off, present ones are printed", () => {
  const bare = buildSavingsReceiptDoc(ACCOUNT, txn({ method: null }), { now: NOW });
  const labels = allFields(bare).map((f) => f.label);
  for (const label of ["Payment Method", "Reference No.", "Remarks", "Value date"]) {
    assert.ok(!labels.includes(label), `${label} should be omitted`);
  }

  const full = buildSavingsReceiptDoc(
    ACCOUNT,
    txn({ method: "gcash", external_reference: "GC-778", remarks: "Payroll", value_date: "2026-11-09" }),
    { now: NOW },
  );
  assert.equal(fieldValue(full, "Payment Method"), "GCash");
  assert.equal(fieldValue(full, "Reference No."), "GC-778");
  assert.equal(fieldValue(full, "Remarks"), "Payroll");
  assert.ok(allFields(full).some((f) => f.label === "Value date"));
});

test("a reversed line is stamped on every copy and is not valid as a receipt", () => {
  const doc = buildSavingsReceiptDoc(ACCOUNT, txn({ reversed_by_transaction_id: 40 }), { now: NOW });
  assert.match(doc.title, /REVERSED/);
  assert.ok(doc.copies?.every((c) => c.startsWith("REVERSED")));
  assert.match(prose(doc), /R E V E R S E D/);
  assert.match(notes(doc), /Do not issue/);
});

test("a pending reversal is flagged on the receipt", () => {
  const doc = buildSavingsReceiptDoc(ACCOUNT, txn({ pending_reversal_approval_id: 5 }), { now: NOW });
  assert.match(notes(doc), /reversal of this transaction is waiting for approval/);
});

test("only deposits and withdrawals get a receipt", () => {
  assert.ok(isReceiptTransaction({ type: "deposit" }));
  assert.ok(isReceiptTransaction({ type: "withdrawal" }));
  assert.ok(!isReceiptTransaction({ type: "transfer_in" }));
  assert.ok(!isReceiptTransaction({ type: "interest" }));
});
