import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/lib/report-format";
import { amountInWords } from "../amount-in-words";
import { buildSavingsReceiptDoc } from "./savings-receipt";
import {
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  isBlankField,
  notes,
  prose,
  signatures,
  titleBlock,
} from "./doc-assertions";

/** A posted deposit as `POST /savings/deposits` returns it. */
const DEPOSIT = {
  id: 55,
  reference_number: "SV-DEP-000123",
  transaction_date: "2026-11-02",
  created_at: "2026-11-02T03:15:00Z",
  type: "deposit",
  account_id: 9,
  account_number: "SA-01-000009",
  member_name: "Juana Dela Cruz",
  branch: { id: 1, name: "Main" },
  debit: "0.00",
  credit: "2500.00",
  previous_balance: "10000.00",
  running_balance: "12500.00",
  payment_method: "cash",
  remarks: "Counter deposit",
  status: "posted",
  processed_by: { id: 3, name: "Carlo Uy" },
};

test("savings receipt: a deposit states the server's balances and reuses its reference", () => {
  const doc = buildSavingsReceiptDoc(DEPOSIT);
  assertPrintableShape(doc, "savings_receipt");
  assert.equal(doc.reference, "SV-DEP-000123");
  assert.equal(titleBlock(doc).text, "Deposit Receipt");
  assert.deepEqual(doc.copies, ["Member's Copy", "File Copy"]);
  assert.equal(chargeAmount(doc, "Balance before"), formatCurrency(10000));
  assert.equal(chargeAmount(doc, "Add: amount received"), formatCurrency(2500));
  assert.equal(chargeAmount(doc, "BALANCE AFTER"), formatCurrency(12500));
  assert.equal(fieldValue(doc, "Amount in words"), amountInWords(2500));
  assert.equal(fieldValue(doc, "Account No."), "SA-01-000009");
  assert.equal(signatures(doc)[1]?.name, "Carlo Uy");
  assert.equal(doc.incomplete, undefined);
});

test("savings receipt: a withdrawal is money paid out to the member", () => {
  const doc = buildSavingsReceiptDoc({
    ...DEPOSIT,
    type: "withdrawal",
    debit: "1000.00",
    credit: "0.00",
    running_balance: "9000.00",
  });
  assert.equal(titleBlock(doc).text, "Withdrawal Receipt");
  assert.equal(chargeAmount(doc, "Less: amount paid out"), formatCurrency(1000));
  assert.equal(signatures(doc)[0]?.label, "Received by (member)");
});

test("savings receipt: a transfer leg names both accounts the right way round", () => {
  const out = buildSavingsReceiptDoc({
    ...DEPOSIT,
    type: "transfer_out",
    debit: "500.00",
    credit: "0.00",
    counterparty: { account_id: 10, account_number: "SA-01-000010", member_name: "Pedro Santos" },
  });
  assert.equal(titleBlock(out).text, "Fund Transfer Receipt");
  assert.equal(fieldValue(out, "From account"), "SA-01-000009");
  assert.equal(fieldValue(out, "To account"), "SA-01-000010");

  const inLeg = buildSavingsReceiptDoc({
    ...DEPOSIT,
    type: "transfer_in",
    counterparty: { account_id: 10, account_number: "SA-01-000010", member_name: "Pedro Santos" },
  });
  assert.equal(fieldValue(inLeg, "From account"), "SA-01-000010");
  assert.equal(fieldValue(inLeg, "To account"), "SA-01-000009");
});

test("savings receipt: a reversed transaction is stamped on every copy", () => {
  const doc = buildSavingsReceiptDoc({
    ...DEPOSIT,
    status: "reversed",
    reversed_by: { id: 60, reference_number: "SV-REV-000004" },
  });
  assert.match(titleBlock(doc).subtitle ?? "", /REVERSED/);
  assert.ok(doc.copies?.every((c) => c.startsWith("REVERSED")));
  assert.match(prose(doc), /R E V E R S E D/);
  assert.equal(fieldValue(doc, "Reversed by entry"), "SV-REV-000004");
  assert.match(notes(doc), /audit purposes only/);
});

test("savings receipt: pending approval is not a receipt yet", () => {
  const doc = buildSavingsReceiptDoc({ ...DEPOSIT, status: "pending_approval" });
  assert.match(titleBlock(doc).subtitle ?? "", /PENDING APPROVAL/);
  assert.match(notes(doc), /awaiting approval/);
});

test("savings receipt: an unreadable transaction prints a blank form, never zero", () => {
  const doc = buildSavingsReceiptDoc(null);
  assertPrintableShape(doc, "savings_receipt");
  assert.equal(doc.incomplete, true);
  assert.ok(isBlankField(doc, "Amount in words"));
  assert.ok(isBlankField(doc, "Reference No."));
  assert.doesNotMatch(chargeAmount(doc, "BALANCE AFTER"), /0\.00/);
  assert.match(notes(doc), /NOT proof/);
});
