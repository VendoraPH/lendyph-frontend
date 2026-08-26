/**
 * Amortization Schedule — standalone printable.
 *
 * Source: `loanService.detail(id)`, reading the `amortization_schedules`
 * relation (`AmortizationScheduleResource`).
 *
 * The disclosure statement already prints a schedule, but only as its section
 * VI and only with what the statute requires. Branches hand members a schedule
 * on its own far more often than they hand over a disclosure, and they need the
 * paid columns on it — which the disclosure deliberately omits, since a
 * disclosure describes the loan as granted, not as it stands today.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  asArray,
  asRecord,
  currencyOrDash,
  dateField,
  field,
  formatCurrency,
  generatedAt,
  humanize,
  pick,
  pickNumber,
  presentFields,
  rateLabel,
  sum,
  termLabelFrom,
  type PrintableBuildOptions,
} from "./shared";

function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const principal = pick(raw, ["principal_due", "principal"]);
  const interest = pick(raw, ["interest_due", "interest"]);
  return {
    period: pick(raw, ["period_number", "period", "no"]),
    due_date: pick(raw, ["due_date", "date"]),
    beginning_balance: pick(raw, ["beginning_balance", "opening_balance"]),
    principal,
    interest,
    penalty: pick(raw, ["penalty_amount", "penalty"]),
    total_due: pick(raw, ["total_due", "amount_due"]),
    amount_paid: pick(raw, ["amount_paid", "paid_amount"]),
    balance: pick(raw, ["remaining_balance", "balance"]),
    status: humanize(pick(raw, ["status"])),
  };
}

export function buildAmortizationScheduleDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const loan = asRecord(raw);
  const borrower = asRecord(pick(loan, ["borrower"]));
  const product = asRecord(pick(loan, ["loan_product"]));

  const rows = asArray(
    pick(loan, ["amortization_schedules", "amortization_schedule", "schedules"])
  ).map(normalizeRow);

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ?? pick(loan, ["borrower_name"]);
  const accountNumber =
    pick(loan, ["loan_account_number", "application_number"]) ?? null;
  const rate = pickNumber(loan, ["interest_rate", "rate"]);
  // This document used to print "% per month" beside a term counted in
  // "period(s)" — two different units for one loan, on one page. Both now come
  // from the loan's own frequency.
  const rawFrequency = pick(loan, ["frequency", "payment_frequency"]);

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Amortization Schedule",
      subtitle: "Repayment Plan",
    },
    {
      kind: "fields",
      title: "Loan Details",
      columns: 2,
      items: presentFields([
        field("Borrower", borrowerName),
        field("Loan Account No.", accountNumber),
        field(
          "Member No.",
          pick(borrower, ["borrower_code", "member_no", "code"])
        ),
        field(
          "Loan Product",
          pick(product, ["name"]) ?? pick(loan, ["loan_product_name"])
        ),
        field(
          "Principal Amount",
          currencyOrDash(pick(loan, ["principal_amount", "principal"]))
        ),
        field("Interest Rate", rateLabel(rate, rawFrequency)),
        field("Term", termLabelFrom(loan, rawFrequency)),
        field("Payment Frequency", humanize(rawFrequency)),
        dateField("Start Date", pick(loan, ["start_date", "release_date"])),
        dateField("Maturity Date", pick(loan, ["maturity_date"])),
      ]),
    },
    {
      kind: "table",
      columns: [
        { key: "period", header: "No.", align: "center", width: "5%" },
        { key: "due_date", header: "Due Date", format: "date", width: "13%" },
        { key: "beginning_balance", header: "Beginning Balance", format: "currency", align: "right", width: "13%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "12%" },
        { key: "interest", header: "Interest", format: "currency", align: "right", width: "11%" },
        { key: "penalty", header: "Penalty", format: "currency", align: "right", width: "11%" },
        { key: "total_due", header: "Total Due", format: "currency", align: "right", width: "12%" },
        { key: "amount_paid", header: "Paid", format: "currency", align: "right", width: "11%" },
        { key: "balance", header: "Balance", format: "currency", align: "right", width: "12%" },
      ],
      rows,
      // A column of figures with no total is the fastest way to have a member
      // and a bookkeeper disagree, so every money column carries one.
      totals:
        rows.length > 0
          ? {
              due_date: "TOTAL",
              principal: formatCurrency(sum(rows, "principal")),
              interest: formatCurrency(sum(rows, "interest")),
              penalty: formatCurrency(sum(rows, "penalty")),
              total_due: formatCurrency(sum(rows, "total_due")),
              amount_paid: formatCurrency(sum(rows, "amount_paid")),
            }
          : undefined,
      emptyText:
        "No amortization schedule has been generated for this loan yet. A schedule is created when the loan is released.",
    },
    {
      kind: "note",
      text:
        "Penalty amounts accrue on installments that fall past due and may change after the " +
        "date this schedule was printed. Please refer to your Statement of Account for the " +
        "amount required to settle the loan today.",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: "Prepared by", detail: "Account Officer" },
        {
          name: borrowerName ? String(borrowerName) : null,
          label: "Conforme / Received by",
          detail: "Borrower — Signature Over Printed Name",
        },
      ],
    },
  ];

  return {
    id: "amortization_schedule",
    org: options.org ?? BLANK_ORG,
    title: "Amortization Schedule",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: accountNumber
      ? `Amortization Schedule • Loan ${accountNumber}`
      : undefined,
  };
}
