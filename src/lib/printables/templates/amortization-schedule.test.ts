import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatValue } from "@/app/(app)/reports/_lib/formatters";
import { buildAmortizationScheduleDoc } from "./amortization-schedule";
import {
  assertPrintableShape,
  fieldValue,
  isBlankField,
  notes,
  signatureLabels,
  signatures,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

/** `LoanResource` with `amortizationSchedules` eager-loaded. */
const LOAN = {
  id: 42,
  application_number: "APP-2026-0042",
  loan_account_number: "LN-2026-0042",
  principal_amount: 50000,
  interest_rate: 2,
  interest_method: "diminishing",
  term: 3,
  frequency: "monthly",
  start_date: "2026-08-01",
  maturity_date: "2026-11-01",
  status: "current",
  borrower: { id: 7, borrower_code: "MBR-0001", full_name: "Juana Dela Cruz" },
  loan_product: { id: 3, name: "Regular Loan" },
  amortization_schedules: [
    { id: 1, loan_id: 42, period_number: 1, due_date: "2026-09-01", beginning_balance: 50000, principal_due: 16666.67, interest_due: 1000, penalty_amount: 0, total_due: 17666.67, remaining_balance: 33333.33, principal_paid: 16666.67, interest_paid: 1000, penalty_paid: 0, status: "paid", amount_paid: 17666.67 },
    { id: 2, loan_id: 42, period_number: 2, due_date: "2026-10-01", beginning_balance: 33333.33, principal_due: 16666.67, interest_due: 666.67, penalty_amount: 250, total_due: 17333.34, remaining_balance: 16666.66, principal_paid: 0, interest_paid: 0, penalty_paid: 0, status: "overdue", amount_paid: 0 },
    { id: 3, loan_id: 42, period_number: 3, due_date: "2026-11-01", beginning_balance: 16666.66, principal_due: 16666.66, interest_due: 333.33, penalty_amount: 0, total_due: 16999.99, remaining_balance: 0, principal_paid: 0, interest_paid: 0, penalty_paid: 0, status: "pending", amount_paid: 0 },
  ],
};

test("amortization schedule: the loan's terms head the document", () => {
  const doc = buildAmortizationScheduleDoc(LOAN);
  assertPrintableShape(doc, "amortization_schedule");

  assert.equal(titleBlock(doc).text, "Amortization Schedule");
  assert.equal(fieldValue(doc, "Borrower"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(fieldValue(doc, "Loan Product"), "Regular Loan");
  assert.equal(fieldValue(doc, "Principal Amount"), formatCurrency(50000));
  assert.equal(fieldValue(doc, "Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Term"), "3 month(s)");
  assert.equal(fieldValue(doc, "Payment Frequency"), "Monthly");
  // Dates are formatted, not passed through as the raw API string.
  assert.equal(fieldValue(doc, "Start Date"), formatValue(new Date(2026, 7, 1), "date"));
  assert.equal(fieldValue(doc, "Maturity Date"), formatValue(new Date(2026, 10, 1), "date"));
});

test("amortization schedule: rate and term take their unit from the frequency", () => {
  // The same numbers on a daily loan. This document used to print
  // "1% per month" beside "30 period(s)" — one wrong, the other unitless, and
  // the disclosure statement for the same loan said "30 month(s)".
  const doc = buildAmortizationScheduleDoc({
    ...LOAN,
    interest_rate: 1,
    term: 30,
    frequency: "daily",
  });

  assert.equal(fieldValue(doc, "Interest Rate"), "1% per day");
  assert.equal(fieldValue(doc, "Term"), "30 day(s)");
  assert.equal(fieldValue(doc, "Payment Frequency"), "Daily");
});

test("amortization schedule: every period is rendered with its paid columns", () => {
  const table = tableBlock(buildAmortizationScheduleDoc(LOAN));

  assert.equal(table.rows.length, 3);
  assert.deepEqual(
    table.rows.map((r) => r.period),
    [1, 2, 3]
  );
  // Raw numbers reach the table; the renderer formats them from `column.format`.
  assert.equal(table.rows[0]?.principal, 16666.67);
  assert.equal(table.rows[0]?.amount_paid, 17666.67);
  assert.equal(table.rows[1]?.penalty, 250);
  assert.equal(table.rows[1]?.status, "Overdue");
  assert.equal(table.rows[2]?.balance, 0);
});

test("amortization schedule: column totals reconcile with the rows", () => {
  const table = tableBlock(buildAmortizationScheduleDoc(LOAN));

  const principal = 16666.67 + 16666.67 + 16666.66;
  const interest = 1000 + 666.67 + 333.33;
  const penalty = 250;

  assert.equal(table.totals?.principal, formatCurrency(principal));
  assert.equal(table.totals?.interest, formatCurrency(interest));
  assert.equal(table.totals?.penalty, formatCurrency(penalty));
  assert.equal(
    table.totals?.total_due,
    formatCurrency(17666.67 + 17333.34 + 16999.99)
  );
  assert.equal(table.totals?.amount_paid, formatCurrency(17666.67));

  // The two checks a bookkeeper runs. Principal scheduled equals the principal
  // borrowed; and `total_due` is principal + interest only — penalty accrues
  // separately on top of the installment and is never folded into it, which is
  // why it has a column of its own.
  assert.equal(formatCurrency(principal), formatCurrency(50000));
  assert.equal(formatCurrency(principal + interest), table.totals?.total_due);
  assert.equal(table.totals?.penalty, formatCurrency(penalty));
});

test("amortization schedule: penalties are flagged as provisional", () => {
  const doc = buildAmortizationScheduleDoc(LOAN);
  assert.match(notes(doc), /Penalty amounts accrue on installments that fall past due/);
  assert.match(notes(doc), /Statement of Account/);
});

test("amortization schedule: the borrower signs their conforme", () => {
  const doc = buildAmortizationScheduleDoc(LOAN);
  assert.deepEqual(signatureLabels(doc), ["Prepared by", "Conforme / Received by"]);
  assert.equal(signatures(doc)[1]?.name, "Juana Dela Cruz");
});

test("amortization schedule: an unreleased loan says so instead of showing nothing", () => {
  const table = tableBlock(
    buildAmortizationScheduleDoc({ ...LOAN, amortization_schedules: [] })
  );
  assert.equal(table.rows.length, 0);
  assert.equal(table.totals, undefined);
  assert.match(table.emptyText ?? "", /A schedule is created when the loan is released\./);
});

test("amortization schedule: a null payload still prints a blank schedule form", () => {
  const doc = buildAmortizationScheduleDoc(null);
  assertPrintableShape(doc, "amortization_schedule");

  assert.ok(isBlankField(doc, "Borrower"));
  assert.ok(isBlankField(doc, "Loan Account No."));
  assert.ok(isBlankField(doc, "Interest Rate"));
  assert.equal(tableBlock(doc).rows.length, 0);
  assert.deepEqual(signatureLabels(doc), ["Prepared by", "Conforme / Received by"]);
});
