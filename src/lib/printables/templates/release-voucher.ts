/**
 * Loan Release / Disbursement Voucher.
 *
 * The document a cashier hands over with the money: what was approved, what was
 * withheld, what was actually paid out, and four signatures proving the cash
 * left the drawer with someone's name on it. New — there was no printable for
 * this before, which is why release deductions were only ever visible on screen.
 *
 * Source: `loanService.detail(id)` (`LoanResource`): `deductions`,
 * `total_deductions`, `unitemised_deductions`, `net_proceeds`,
 * `released_by_user`, `approved_by_user`, `account_officer`, `borrower` and
 * `branch`. Every figure is the server's; one it did not send prints as a dash.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock, PrintChargeLine } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  DASH,
  asArray,
  asRecord,
  dateField,
  dateOrBlank,
  field,
  formatCurrency,
  generatedAt,
  personName,
  pick,
  pickNumber,
  presentFields,
  termLabelFrom,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

export function buildReleaseVoucherDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const loan = asRecord(raw);
  const borrower = asRecord(pick(loan, ["borrower"]));
  const branch = asRecord(pick(loan, ["branch"]));
  const product = asRecord(pick(loan, ["loan_product"]));

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ?? pick(loan, ["borrower_name"]);
  const accountNumber =
    pick(loan, ["loan_account_number", "application_number"]) ?? null;

  const principal = pickNumber(loan, ["principal_amount", "principal"]);

  // `deductions` is an array of { name, amount, type, original_value } —
  // despite `Loan.deductions` in src/types/loan.ts declaring a
  // Record<string, number>, which no response has ever matched.
  const deductions = asArray(pick(loan, ["deductions"])).map((item) => ({
    name: String(pick(item, ["name", "label", "description"]) ?? "Deduction"),
    amount: toNumber(pick(item, ["amount", "value"])),
  }));

  // Never derived: the server is the authority on what was handed over, and a
  // voucher that disagrees with the cash is worthless.
  const totalDeductions = pickNumber(loan, ["total_deductions"]);
  const netProceeds = pickNumber(loan, ["net_proceeds"]);

  // A voucher IS a form, so an unreadable loan still prints one to complete by
  // hand — but a form carries blanks, not figures. Falling through to
  // formatCurrency(0) printed "NET PROCEEDS P0.00 / Zero Pesos" directly above
  // "Received from the cooperative the sum stated above", which states a sum
  // that was never released.
  const incomplete = loan === null;
  const money = (value: number | null) =>
    incomplete ? BLANK_LINE : value === null ? DASH : formatCurrency(value);
  const withheld = (value: number | null) =>
    incomplete ? BLANK_LINE : value === null ? DASH : `(${formatCurrency(value)})`;

  const deductionLines: PrintChargeLine[] = deductions.map((item) => ({
    label: item.name,
    amount: withheld(item.amount),
    indent: true,
  }));

  // Whatever `total_deductions` covers that the itemised array does not, as a
  // line of its own: the server's `unitemised_deductions`. `deductions: []`
  // with `total_deductions: 5000` used to print "No deductions applied  P0.00"
  // immediately above "Total Deductions  (P5,000.00)" — the total is the one
  // the cashier paid against, so the itemisation is what has to be made whole.
  const unitemised = pickNumber(loan, ["unitemised_deductions"]);
  if (unitemised !== null && unitemised !== 0) {
    deductionLines.push({
      // Negative when the items sum past the server's total; the total governs.
      label: unitemised > 0 ? "Other deductions" : "Adjustment",
      amount:
        unitemised > 0
          ? `(${formatCurrency(unitemised)})`
          : formatCurrency(-unitemised),
      indent: true,
    });
  }

  // Only when the server says nothing was withheld; a voucher never states a
  // zero the server did not send.
  if (deductionLines.length === 0 && totalDeductions === 0) {
    deductionLines.push({
      label: "No deductions applied",
      amount: formatCurrency(0),
      indent: true,
    });
  }

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Loan Release Voucher",
      subtitle: "Disbursement of Loan Proceeds",
    },
    {
      kind: "fields",
      title: "Loan Details",
      columns: 2,
      items: presentFields([
        field("Payee / Borrower", borrowerName),
        field("Loan Account No.", accountNumber),
        field(
          "Member No.",
          pick(borrower, ["borrower_code", "member_no", "code"])
        ),
        field("Application No.", pick(loan, ["application_number"])),
        field(
          "Loan Product",
          pick(product, ["name"]) ?? pick(loan, ["loan_product_name"])
        ),
        field(
          "Branch",
          pick(branch, ["name"]) ?? pick(loan, ["branch_name"])
        ),
        dateField(
          "Release Date",
          pick(loan, ["release_date", "released_at", "start_date"])
        ),
        dateField("Maturity Date", pick(loan, ["maturity_date"])),
        field(
          // A bare "6" here read as months on a voucher whose loan may be a
          // days term. `term` is a length in the loan's own `term_unit`.
          "Term",
          termLabelFrom(loan)
        ),
        field("Purpose", pick(loan, ["purpose"])),
      ]),
    },
    {
      kind: "charges",
      title: "Computation of Net Proceeds",
      lines: [
        { label: "Principal Loan Amount", amount: money(principal) },
        { label: "Less: Deductions", amount: "" },
        ...deductionLines,
        {
          label: "Total Deductions",
          amount: withheld(totalDeductions),
          rule: "total",
        },
        {
          label: "NET PROCEEDS (Amount Released to Borrower)",
          amount: money(netProceeds),
          rule: "grand",
        },
      ],
    },
    {
      kind: "fields",
      items: [
        {
          label: "Net proceeds in words",
          value: incomplete ? BLANK_LINE : netProceeds === null ? DASH : amountInWords(netProceeds),
        },
      ],
    },
    {
      kind: "note",
      text:
        "Received from the cooperative the sum stated above, in full settlement of the " +
        "proceeds of the loan described in this voucher.",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        {
          name: personName(loan, "account_officer", ["account_officer_name"]),
          label: "Prepared by",
          detail: "Account Officer",
        },
        {
          name: personName(loan, "approved_by_user", ["approved_by"]),
          label: "Approved by",
          detail: `Date approved: ${dateOrBlank(pick(loan, ["approved_at"]))}`,
        },
        {
          name: personName(loan, "released_by_user", ["released_by"]),
          label: "Released by",
          detail: "Cashier / Disbursing Officer",
        },
        {
          name: borrowerName ? String(borrowerName) : null,
          label: "Received by",
          detail: "Borrower — Signature Over Printed Name",
        },
      ],
    },
  ];

  return {
    id: "release_voucher",
    org: options.org ?? BLANK_ORG,
    title: "Loan Release Voucher",
    generatedAt: generatedAt(options.now),
    // Still a printable form, but the hook must warn rather than report
    // success — the figures on it are blanks, not the loan's.
    incomplete: incomplete || undefined,
    blocks,
    footerNote: accountNumber
      ? `Loan Release Voucher • Loan ${accountNumber}`
      : undefined,
  };
}
