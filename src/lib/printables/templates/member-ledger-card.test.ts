import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/app/(app)/reports/_lib/formatters";
import { buildMemberLedgerCardDoc } from "./member-ledger-card";
import {
  allFields,
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  hasTable,
  isBlankField,
  notes,
  signatureLabels,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

/**
 * What `ReportService::subsidiaryLedger()` returns.
 *
 * Note what is NOT here: individual repayments. The endpoint sends `total_paid`
 * and `payments_count` per loan and no per-payment array, which is why the card
 * prints a payment summary rather than a dated receipt history.
 */
const PAYLOAD = {
  borrower: {
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
    contact_number: "0917-555-0101",
  },
  loans: [
    { loan_account_number: "LN-2025-0011", product_name: "Regular Loan", principal_amount: 40000, released_at: "2025-06-01", maturity_date: "2025-12-01", status: "completed", total_paid: 44000, outstanding_balance: 0, payments_count: 6 },
    { loan_account_number: "LN-2026-0042", product_name: "Regular Loan", principal_amount: 100000, released_at: "2026-08-01", maturity_date: "2027-02-01", status: "current", total_paid: 18666.67, outstanding_balance: 83333.33, payments_count: 1 },
  ],
  totals: { total_loans: 2, total_portfolio: 140000, total_outstanding: 83333.33 },
  generated_at: "2026-08-26 09:15:00",
};

test("member ledger card: member particulars head the card", () => {
  const doc = buildMemberLedgerCardDoc(PAYLOAD);
  assertPrintableShape(doc, "member_ledger_card");

  assert.equal(titleBlock(doc).text, "Member Ledger Card");
  assert.equal(titleBlock(doc).subtitle, "Subsidiary Ledger of Loan Accounts");
  assert.equal(fieldValue(doc, "Member"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(fieldValue(doc, "Address"), "12 Mabini St., Poblacion, Cebu City");
  assert.equal(fieldValue(doc, "Contact No."), "0917-555-0101");

  // No member "Status" row. `ReportService::subsidiaryLedger()` sends only
  // borrower_code / full_name / address / contact_number, so the label used to
  // print with a permanently empty rule beside it. The per-account status in
  // the table below is the one that exists.
  assert.throws(() => fieldValue(doc, "Status"));
  assert.ok(!allFields(doc).some((f) => f.label === "Status"));
});

test("member ledger card: every loan account is listed", () => {
  const table = tableBlock(buildMemberLedgerCardDoc(PAYLOAD), "Loan Accounts");

  assert.equal(table.rows.length, 2);
  assert.deepEqual(
    table.rows.map((r) => r.loan_account_number),
    ["LN-2025-0011", "LN-2026-0042"]
  );
  assert.equal(table.rows[0]?.status, "Completed");
  assert.equal(table.rows[1]?.balance, 83333.33);
  assert.equal(table.rows[1]?.payments_count, 1);
});

test("member ledger card: the summary agrees with the table it sits above", () => {
  const doc = buildMemberLedgerCardDoc(PAYLOAD);
  const table = tableBlock(doc, "Loan Accounts");

  assert.equal(chargeAmount(doc, "Loan accounts on record"), "2");
  assert.equal(chargeAmount(doc, "Total released"), formatCurrency(140000));
  assert.equal(chargeAmount(doc, "Total paid"), formatCurrency(44000 + 18666.67));
  assert.equal(
    chargeAmount(doc, "TOTAL OUTSTANDING BALANCE"),
    formatCurrency(83333.33)
  );

  // Server totals and row totals must be the same figure.
  assert.equal(table.totals?.principal, formatCurrency(40000 + 100000));
  assert.equal(table.totals?.principal, chargeAmount(doc, "Total released"));
  assert.equal(table.totals?.balance, chargeAmount(doc, "TOTAL OUTSTANDING BALANCE"));
  assert.equal(table.totals?.payments_count, "7");
});

test("member ledger card: totals are summed when the API sends none", () => {
  const doc = buildMemberLedgerCardDoc({ ...PAYLOAD, totals: undefined });

  assert.equal(chargeAmount(doc, "Loan accounts on record"), "2");
  assert.equal(chargeAmount(doc, "Total released"), formatCurrency(140000));
  assert.equal(
    chargeAmount(doc, "TOTAL OUTSTANDING BALANCE"),
    formatCurrency(83333.33)
  );
});

test("member ledger card: without per-payment data it says where to find it", () => {
  const doc = buildMemberLedgerCardDoc(PAYLOAD);

  // The subsidiary-ledger endpoint sends no repayment rows, so claiming an
  // empty payment history would be a claim the payload cannot support.
  assert.equal(hasTable(doc, "Payment History"), false);
  assert.match(notes(doc), /Payments are shown per account as a running total\./);
  assert.match(notes(doc), /print that loan's Statement of Account/);
});

test("member ledger card: a payment history is rendered if the API grows one", () => {
  const doc = buildMemberLedgerCardDoc({
    ...PAYLOAD,
    entries: [
      { date: "2026-08-26", receipt_number: "OR-0142", loan_account_number: "LN-2026-0042", principal_applied: 16666.67, interest_applied: 1800, penalty_applied: 200, amount_paid: 18666.67 },
      { date: "2026-09-26", receipt_number: "OR-0188", loan_account_number: "LN-2026-0042", principal_applied: 16666.67, interest_applied: 1500, penalty_applied: 0, amount_paid: 18166.67 },
    ],
  });

  const table = tableBlock(doc, "Payment History");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0]?.reference, "OR-0142");
  assert.equal(
    table.totals?.amount,
    formatCurrency(18666.67 + 18166.67)
  );
  // The note is replaced by the thing it was apologising for.
  assert.ok(!notes(doc).includes("Statement of Account"));
});

test("member ledger card: a member with no released loans is stated plainly", () => {
  const table = tableBlock(
    buildMemberLedgerCardDoc({ ...PAYLOAD, loans: [], totals: undefined }),
    "Loan Accounts"
  );
  assert.equal(table.rows.length, 0);
  assert.equal(table.totals, undefined);
  assert.match(table.emptyText ?? "", /no released loan accounts on record/);
});

test("member ledger card: a null payload still prints a blank card", () => {
  const doc = buildMemberLedgerCardDoc(null);
  assertPrintableShape(doc, "member_ledger_card");

  assert.ok(isBlankField(doc, "Member"));
  assert.ok(isBlankField(doc, "Member No."));
  assert.equal(chargeAmount(doc, "Loan accounts on record"), "0");
  assert.equal(
    chargeAmount(doc, "TOTAL OUTSTANDING BALANCE"),
    formatCurrency(0)
  );
  assert.equal(tableBlock(doc, "Loan Accounts").rows.length, 0);
  assert.deepEqual(signatureLabels(doc), ["Posted by", "Verified by"]);
});
