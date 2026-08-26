/**
 * Member Ledger Card — every loan account a member holds, on one card.
 *
 * Source: `reportService.subsidiaryLedger(borrowerId, params)`
 * (`ReportService::subsidiaryLedger`).
 *
 * Caveat worth knowing before reading the output: that endpoint returns loan
 * summaries only. Per loan it sends `total_paid` and `payments_count`, but it
 * does **not** send the individual repayments — there is no per-payment array
 * in the response. So the card prints a payment *summary* per account, and the
 * transaction-level history block only appears if the API grows one (the read
 * below already accepts `entries` / `transactions` / `payments` / `repayments`).
 * Until then a note points staff at the Statement of Account, which does carry
 * the per-payment ledger for a single loan.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  asArray,
  asRecord,
  field,
  formatCurrency,
  generatedAt,
  humanize,
  pick,
  pickNumber,
  presentFields,
  sum,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

function normalizeLoanRow(raw: Record<string, unknown>): Record<string, unknown> {
  const principal = toNumber(pick(raw, ["principal_amount", "principal"])) ?? 0;
  const paid = toNumber(pick(raw, ["total_paid", "amount_paid"])) ?? 0;
  return {
    loan_account_number: pick(raw, [
      "loan_account_number",
      "account_number",
      "application_number",
    ]),
    product: pick(raw, ["product_name", "loan_product_name"]),
    released_at: pick(raw, ["released_at", "release_date", "start_date"]),
    maturity_date: pick(raw, ["maturity_date", "end_date"]),
    principal,
    total_paid: paid,
    payments_count: pick(raw, ["payments_count", "repayments_count"]),
    balance: pick(raw, [
      "outstanding_balance",
      "balance",
      "remaining_balance",
    ]),
    status: humanize(pick(raw, ["status"])),
  };
}

function normalizePaymentRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    date: pick(raw, ["date", "payment_date", "paid_at"]),
    reference: pick(raw, ["receipt_number", "reference", "reference_number"]),
    loan_account_number: pick(raw, ["loan_account_number", "account_number"]),
    principal: pick(raw, ["principal_applied", "principal_paid", "principal"]),
    interest: pick(raw, ["interest_applied", "interest_paid", "interest"]),
    penalty: pick(raw, ["penalty_applied", "penalty_paid", "penalty"]),
    amount: pick(raw, ["amount_paid", "amount", "credit"]),
    balance: pick(raw, ["running_balance", "balance_after", "balance"]),
  };
}

export function buildMemberLedgerCardDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const root = asRecord(raw);
  const borrower = asRecord(pick(root, ["borrower", "member"])) ?? root;
  const totals = asRecord(pick(root, ["totals", "summary"]));

  const loanRows = asArray(pick(root, ["loans", "accounts"])).map(normalizeLoanRow);
  const paymentRows = asArray(
    pick(root, ["entries", "transactions", "payments", "repayments"])
  ).map(normalizePaymentRow);

  const memberName = pick(borrower, ["full_name", "name", "borrower_name"]);
  const memberCode = pick(borrower, ["borrower_code", "member_no", "code"]);

  const totalReleased =
    pickNumber(totals, ["total_portfolio", "total_released", "total_principal"]) ??
    sum(loanRows, "principal");
  const totalPaid =
    pickNumber(totals, ["total_paid", "total_amount_paid"]) ??
    sum(loanRows, "total_paid");
  const totalOutstanding =
    pickNumber(totals, ["total_outstanding", "outstanding_balance"]) ??
    sum(loanRows, "balance");
  const loanCount =
    pickNumber(totals, ["total_loans", "loan_count"]) ?? loanRows.length;

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Member Ledger Card",
      subtitle: "Subsidiary Ledger of Loan Accounts",
    },
    {
      kind: "fields",
      title: "Member Particulars",
      columns: 2,
      items: presentFields([
        field("Member", memberName),
        field("Member No.", memberCode),
        field("Address", pick(borrower, ["address"])),
        field(
          "Contact No.",
          pick(borrower, ["contact_number", "phone", "mobile_number"])
        ),
        // No member "Status" row: `ReportService::subsidiaryLedger()` sends
        // only borrower_code / full_name / address / contact_number, so the
        // label printed with a permanently empty rule beside it. A label with
        // nothing behind it reads as missing data, not as a form to fill in —
        // the per-account status in the table below is the real one.
      ]),
    },
    {
      kind: "charges",
      title: "Summary",
      lines: [
        { label: "Loan accounts on record", amount: String(loanCount) },
        { label: "Total released", amount: formatCurrency(totalReleased) },
        { label: "Total paid", amount: formatCurrency(totalPaid), indent: true },
        {
          label: "TOTAL OUTSTANDING BALANCE",
          amount: formatCurrency(totalOutstanding),
          rule: "grand",
        },
      ],
    },
    {
      kind: "table",
      title: "Loan Accounts",
      columns: [
        { key: "loan_account_number", header: "Loan #", width: "14%" },
        { key: "product", header: "Product", width: "16%" },
        { key: "released_at", header: "Released", format: "date", width: "11%" },
        { key: "maturity_date", header: "Maturity", format: "date", width: "11%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "13%" },
        { key: "total_paid", header: "Total Paid", format: "currency", align: "right", width: "13%" },
        { key: "payments_count", header: "Payments", format: "number", align: "right", width: "9%" },
        { key: "balance", header: "Balance", format: "currency", align: "right", width: "13%" },
      ],
      rows: loanRows,
      totals:
        loanRows.length > 0
          ? {
              maturity_date: "TOTAL",
              principal: formatCurrency(sum(loanRows, "principal")),
              total_paid: formatCurrency(sum(loanRows, "total_paid")),
              payments_count: String(sum(loanRows, "payments_count")),
              balance: formatCurrency(sum(loanRows, "balance")),
            }
          : undefined,
      emptyText: "This member has no released loan accounts on record.",
    },
  ];

  if (paymentRows.length > 0) {
    blocks.push({
      kind: "table",
      title: "Payment History",
      columns: [
        { key: "date", header: "Date", format: "date", width: "13%" },
        { key: "reference", header: "O.R. No.", width: "15%" },
        { key: "loan_account_number", header: "Loan #", width: "14%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "14%" },
        { key: "interest", header: "Interest", format: "currency", align: "right", width: "13%" },
        { key: "penalty", header: "Penalty", format: "currency", align: "right", width: "13%" },
        { key: "amount", header: "Amount Paid", format: "currency", align: "right", width: "18%" },
      ],
      rows: paymentRows,
      totals: {
        loan_account_number: "TOTAL",
        principal: formatCurrency(sum(paymentRows, "principal")),
        interest: formatCurrency(sum(paymentRows, "interest")),
        penalty: formatCurrency(sum(paymentRows, "penalty")),
        amount: formatCurrency(sum(paymentRows, "amount")),
      },
    });
  } else {
    blocks.push({
      kind: "note",
      text:
        "Payments are shown per account as a running total. For a dated, receipt-by-receipt " +
        "history of a single loan, print that loan's Statement of Account.",
    });
  }

  blocks.push({
    kind: "signatures",
    columns: 2,
    blocks: [
      { label: "Posted by", detail: "Bookkeeper" },
      { label: "Verified by", detail: "Branch Manager" },
    ],
  });

  return {
    id: "member_ledger_card",
    org: options.org ?? BLANK_ORG,
    title: "Member Ledger Card",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: memberCode ? `Member Ledger Card • Member ${memberCode}` : undefined,
  };
}
