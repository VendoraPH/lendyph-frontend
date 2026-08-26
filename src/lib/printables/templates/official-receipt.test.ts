import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatValue } from "@/app/(app)/reports/_lib/formatters";
import { amountInWords } from "../amount-in-words";
import { buildOfficialReceiptDoc } from "./official-receipt";
import { BLANK_LINE } from "./shared";
import {
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  isBlankField,
  notes,
  prose,
  signatureLabels,
  signatures,
  titleBlock,
} from "./doc-assertions";

/** `RepaymentResource` as returned by `GET /repayments/{id}`. */
const PAYMENT = {
  id: 901,
  receipt_number: "OR-20260826-0142",
  loan_id: 42,
  borrower_id: 7,
  loan_account_number: "LN-2026-0042",
  borrower_name: "Juana Dela Cruz",
  loan_product_name: "Regular Loan",
  payment_date: "2026-08-26",
  paid_at: "2026-08-26",
  method: "bank_transfer",
  reference_number: "BDO-99881",
  amount_paid: 18666.67,
  amount: 18666.67,
  principal_applied: 16666.67,
  interest_applied: 1800,
  penalty_applied: 200,
  overpayment: 0,
  balance_before: 100000,
  balance_after: 83333.33,
  previous_balance: 100000,
  new_balance: 83333.33,
  next_due_date: "2026-10-01",
  status: "completed",
  collected_by: "Carlo Uy",
  received_by_user: { id: 13, name: "Carlo Uy" },
  remarks: "Over the counter",
};

const VOIDED = {
  ...PAYMENT,
  status: "voided",
  void_reason: "Duplicate posting",
  voided_at: "2026-08-27 10:02:00",
  voided_by_user: { id: 12, name: "Ana Bautista" },
};

test("official receipt: prints two copies and reuses the receipt number", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);
  assertPrintableShape(doc, "official_receipt");

  assert.deepEqual(doc.copies, ["Borrower's Copy", "File Copy"]);
  // Reprinting must quote the number the receipt was issued under, not mint a
  // second one for the same payment.
  assert.equal(doc.reference, "OR-20260826-0142");
  assert.equal(titleBlock(doc).subtitle, "Acknowledgment Receipt of Payment");
});

test("official receipt: payment particulars come off the wire intact", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  assert.equal(fieldValue(doc, "Receipt No."), "OR-20260826-0142");
  assert.equal(fieldValue(doc, "Received from"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Payment Method"), "Bank transfer");
  assert.equal(fieldValue(doc, "Reference No."), "BDO-99881");
  assert.equal(fieldValue(doc, "Loan Product"), "Regular Loan");
});

test("official receipt: the application of payment sums to the amount paid", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  assert.equal(chargeAmount(doc, "Applied to Principal"), formatCurrency(16666.67));
  assert.equal(chargeAmount(doc, "Applied to Interest"), formatCurrency(1800));
  assert.equal(chargeAmount(doc, "Applied to Penalty"), formatCurrency(200));
  assert.equal(
    chargeAmount(doc, "TOTAL AMOUNT PAID"),
    formatCurrency(16666.67 + 1800 + 200)
  );
  assert.equal(fieldValue(doc, "Amount in words"), amountInWords(18666.67));
});

test("official receipt: overpayment is only shown when there is one", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);
  assert.throws(() => chargeAmount(doc, "Advance / Overpayment"));

  const withExcess = buildOfficialReceiptDoc({
    ...PAYMENT,
    overpayment: 500,
    amount_paid: 19166.67,
  });
  assert.equal(
    chargeAmount(withExcess, "Advance / Overpayment"),
    formatCurrency(500)
  );
  assert.equal(
    chargeAmount(withExcess, "TOTAL AMOUNT PAID"),
    formatCurrency(16666.67 + 1800 + 200 + 500)
  );
});

test("official receipt: the balance before and after the payment are both stated", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  assert.equal(fieldValue(doc, "Balance before payment"), formatCurrency(100000));
  assert.equal(fieldValue(doc, "Balance after payment"), formatCurrency(83333.33));
  // Principal applied is what moves the balance.
  assert.equal(100000 - 16666.67, 83333.33);
});

test("official receipt: it is signed by both sides of the counter", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  assert.deepEqual(signatureLabels(doc), ["Paid by", "Received by"]);
  assert.equal(signatures(doc)[0]?.name, "Juana Dela Cruz");
  assert.equal(signatures(doc)[1]?.name, "Carlo Uy");
});

test("official receipt: a voided payment prints conspicuously as VOID", () => {
  const doc = buildOfficialReceiptDoc(VOIDED);
  assertPrintableShape(doc, "official_receipt");

  // Every page is marked: the title, the subtitle, the copy label in the
  // corner, a banner above the figures, and the footer.
  assert.equal(doc.title, "Official Receipt (VOID)");
  assert.equal(
    titleBlock(doc).subtitle,
    "VOID — CANCELLED, NOT VALID PROOF OF PAYMENT"
  );
  assert.deepEqual(doc.copies, ["VOID — Borrower's Copy", "VOID — File Copy"]);
  assert.match(prose(doc), /\*\*\* V O I D \*\*\*/);
  assert.match(prose(doc), /not<\/strong> valid proof of payment/);
  assert.equal(doc.footerNote, "VOIDED PAYMENT — NOT A VALID OFFICIAL RECEIPT");
  assert.match(notes(doc), /Do not issue to the member as a receipt\./);

  // And the void itself is documented rather than merely stamped.
  assert.equal(fieldValue(doc, "Reason"), "Duplicate posting");
  assert.equal(fieldValue(doc, "Voided by"), "Ana Bautista");
});

test("official receipt: a valid receipt carries no VOID marking anywhere", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  assert.equal(doc.title, "Official Receipt");
  assert.ok(!doc.copies?.some((c) => c.includes("VOID")));
  assert.ok(!prose(doc).includes("VOID"));
  assert.ok(!notes(doc).includes("VOID"));
  assert.throws(() => fieldValue(doc, "Reason"));
});

test("official receipt: a void is inferred from voided_at when status is stale", () => {
  const doc = buildOfficialReceiptDoc({
    ...PAYMENT,
    status: "completed",
    voided_at: "2026-08-27 10:02:00",
  });
  assert.equal(doc.title, "Official Receipt (VOID)");
});

test("official receipt: dates are formatted, never the raw API string", () => {
  const doc = buildOfficialReceiptDoc(PAYMENT);

  // The same date, in a fields block and in a signature detail, has to read the
  // same way. This one used to print "2026-08-26" above "Aug 26, 2026".
  assert.equal(fieldValue(doc, "Date"), formatValue(new Date(2026, 7, 26), "date"));
  assert.equal(
    signatures(doc)[1]?.detail,
    `Date: ${formatValue(new Date(2026, 7, 26), "date")}`
  );
  assert.equal(
    fieldValue(doc, "Next due date"),
    formatValue(new Date(2026, 9, 1), "date")
  );

  // And a void timestamp keeps its minute rather than printing "10:02:00".
  const voided = buildOfficialReceiptDoc(VOIDED);
  assert.equal(
    fieldValue(voided, "Voided on"),
    formatValue("2026-08-27 10:02:00", "datetime")
  );
});

test("official receipt: an unreadable payment states no amount at all", () => {
  // A receipt ASSERTS. Failing soft to zero handed the member
  // "TOTAL AMOUNT PAID P0.00 / Zero Pesos" over a Received-by rule — a receipt
  // for a payment that was never made.
  const doc = buildOfficialReceiptDoc(null);
  assertPrintableShape(doc, "official_receipt");

  assert.equal(doc.incomplete, true);
  assert.equal(chargeAmount(doc, "TOTAL AMOUNT PAID"), BLANK_LINE);
  assert.ok(isBlankField(doc, "Amount in words"));
  assert.notEqual(chargeAmount(doc, "TOTAL AMOUNT PAID"), formatCurrency(0));

  // And it says so on its face, in three places, so it cannot be mistaken for
  // one that failed to load quietly.
  assert.equal(titleBlock(doc).subtitle, "BLANK FORM — PAYMENT RECORD UNAVAILABLE");
  assert.match(notes(doc), /NOT proof of payment/);
  assert.match(doc.footerNote ?? "", /NOT A VALID OFFICIAL RECEIPT/);
});

test("official receipt: a null payload still prints a blank two-copy form", () => {
  const doc = buildOfficialReceiptDoc(null);

  assert.deepEqual(doc.copies, ["Borrower's Copy", "File Copy"]);
  assert.equal(doc.reference, undefined);
  assert.ok(isBlankField(doc, "Receipt No."));
  assert.ok(isBlankField(doc, "Received from"));
  assert.deepEqual(signatureLabels(doc), ["Paid by", "Received by"]);
});

test("official receipt: a payment that did load is never flagged incomplete", () => {
  assert.equal(buildOfficialReceiptDoc(PAYMENT).incomplete, undefined);
  assert.equal(buildOfficialReceiptDoc(VOIDED).incomplete, undefined);
  // A genuine zero-peso record is a fact and still prints as one.
  const zero = buildOfficialReceiptDoc({ ...PAYMENT, amount_paid: 0, amount: 0 });
  assert.equal(zero.incomplete, undefined);
  assert.equal(chargeAmount(zero, "TOTAL AMOUNT PAID"), formatCurrency(0));
});
