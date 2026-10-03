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
 *
 * Every total is the server's: the summary from `totals`, the loan table's
 * column totals from `loans_totals`. One it did not send prints as a dash.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  DASH,
  asArray,
  asRecord,
  currencyOrDash,
  field,
  generatedAt,
  humanize,
  pick,
  pickNumber,
  presentFields,
  type PrintableBuildOptions,
} from "./shared";

function normalizeLoanRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    loan_account_number: pick(raw, [
      "loan_account_number",
      "account_number",
      "application_number",
    ]),
    product: pick(raw, ["product_name", "loan_product_name"]),
    released_at: pick(raw, ["released_at", "release_date", "start_date"]),
    maturity_date: pick(raw, ["maturity_date", "end_date"]),
    principal: pick(raw, ["principal_amount", "principal"]),
    total_paid: pick(raw, ["total_paid", "amount_paid"]),
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
  const loansTotals = asRecord(pick(root, ["loans_totals"]));

  const loanRows = asArray(pick(root, ["loans", "accounts"])).map(normalizeLoanRow);
  const paymentRows = asArray(
    pick(root, ["entries", "transactions", "payments", "repayments"])
  ).map(normalizePaymentRow);

  const memberName = pick(borrower, ["full_name", "name", "borrower_name"]);
  const memberCode = pick(borrower, ["borrower_code", "member_no", "code"]);

  const totalReleased = pickNumber(totals, ["total_portfolio", "total_released", "total_principal"]);
  const totalPaid = pickNumber(totals, ["total_paid", "total_amount_paid"]);
  const totalOutstanding = pickNumber(totals, ["total_outstanding", "outstanding_balance"]);
  const loanCount =
    pickNumber(totals, ["total_loans", "loan_count"]) ?? loanRows.length;
  const paymentsCount = pickNumber(loansTotals, ["payments_count"]);

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
        { label: "Total released", amount: currencyOrDash(totalReleased) },
        { label: "Total paid", amount: currencyOrDash(totalPaid), indent: true },
        {
          label: "TOTAL OUTSTANDING BALANCE",
          amount: currencyOrDash(totalOutstanding),
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
              principal: currencyOrDash(pick(loansTotals, ["principal_amount"])),
              total_paid: currencyOrDash(pick(loansTotals, ["total_paid"])),
              payments_count: paymentsCount === null ? DASH : String(paymentsCount),
              balance: currencyOrDash(pick(loansTotals, ["outstanding_balance"])),
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
      // No TOTAL row: the server sends no totals for this table, and none is
      // added up here.
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
