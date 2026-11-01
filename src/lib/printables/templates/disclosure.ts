/**
 * Disclosure Statement — R.A. 3765 (Truth in Lending Act) and BSP Circular
 * No. 730, Series of 2011.
 *
 * Ported from `generateDisclosureHTML` in `src/lib/loan-document-templates.ts`,
 * removed in the reporting & printables release; see git history for the
 * original, which is what makes "the legal wording is unchanged" checkable.
 * The statutory wording — the legal reference line and the borrower's
 * acknowledgment — is carried over verbatim. The carrier changed (blocks
 * instead of a 200-line HTML string), and so did the sections: charges are
 * split the way R.A. 3765 and BSP Circular 730 classify them, by the server.
 *
 * Every figure is the server's (`DisclosureService`, worked out in centavos):
 * - III. Finance Charges: interest and the coop's own fees
 *   (`finance_charges`), totalled by `totals.total_finance_charges`.
 * - IV. Non-Finance Charges: notarial fee, insurance premium, taxes
 *   (`non_finance_charges`), with the insurance still owed on the loan noted.
 * - V. Net Proceeds: principal less what was deducted of each, less share
 *   capital (a deduction from proceeds, not a charge), from `proceeds`.
 * - VI. Rate Information: the contractual, nominal annual and effective
 *   interest rates from `rates`; none is annualised or solved here.
 * A figure the server did not send prints as a dash.
 *
 * Two things the port fixes rather than preserves:
 *
 * 1. **The payload.** `LoanDisclosure` in `src/types/loan-document.ts` is flat
 *    (`borrower_name`, `term_months`, `payment_frequency`); the API actually
 *    returns `DisclosureService::generateDisclosure()`, which is nested
 *    (`borrower.full_name`, `loan_terms.term`, `loan_terms.frequency`). Because
 *    the old template read `data.borrower_name`, its guard on the loan page
 *    never passed and the API branch was dead — every disclosure printed from
 *    an inline reconstruction of the loan object instead. Both shapes are read
 *    here, nested first.
 * 2. **The schedule table.** The old markup declared seven column headers but
 *    emitted six cells per row, so every figure sat one column to the left of
 *    its heading. A keyed column model cannot express that.
 *
 * `borrower.address` and `co_makers` are deliberately NOT read, though
 * `DisclosureService::generateDisclosure()` sends both. R.A. 3765 requires a
 * statement of the cost of credit to the person being extended it: the amount
 * financed, the finance charges, the net proceeds and the rate. A co-maker's
 * solidary undertaking is a security arrangement, not a finance charge, and it
 * is disclosed, signed and notarised on the Promissory Note — which does carry
 * every co-maker. Putting co-maker signature lines on this form would have them
 * acknowledge a disclosure about a credit transaction they are not the borrower
 * in. The address is likewise on the documents that are *served* on a person
 * (the note, the demand letter), not on the one that describes an account.
 * Changing that is a form-design decision, not a bug fix.
 */

import type { PrintableDocument, PrintBlock, PrintChargeLine } from "../types";
import {
  BLANK_ORG,
  DASH,
  asArray,
  asRecord,
  currencyOrDash,
  dateField,
  field,
  formatCurrency,
  generatedAt,
  humanize,
  percentLabel,
  pick,
  pickNumber,
  presentFields,
  rateFrequencyFrom,
  rateLabel,
  termLabelFrom,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

/** Long schedules get their own page so the terms above stay on page one. */
const SCHEDULE_PAGE_BREAK_AT = 12;

/** A charge as the server classified it, named on its own lettered line. */
interface ChargeItem {
  name: string;
  /** The server's pesos; null when it sent none, printed as a dash. */
  amount: number | null;
  /** Non-finance only: the part unpaid at release, owed on the loan. */
  owed: number | null;
}

/** `finance_charges.items` or `non_finance_charges.items`, as sent. */
function readChargeItems(block: Record<string, unknown> | null): ChargeItem[] {
  return asArray(pick(block, ["items"])).map((item) => ({
    name: String(pick(item, ["name", "label"]) ?? "Charge"),
    amount: toNumber(pick(item, ["amount"])),
    owed: toNumber(pick(item, ["owed"])),
  }));
}

/** a., b., c. … — the statute's lettered enumeration under a heading. */
function letter(index: number): string {
  return String.fromCharCode(97 + index);
}

/** A "Less:" line: the server's figure in brackets, or a dash. */
function lessLine(label: string, amount: number | null): PrintChargeLine {
  return { label, amount: amount === null ? DASH : `(${formatCurrency(amount)})` };
}

/** A server rate in its own words, or a dash when it sent none. */
function rateOrDash(percent: number | null, phrase: string): string {
  return percentLabel(percent, phrase) ?? DASH;
}

function normalizeScheduleRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    period: pick(raw, ["period_number", "period", "no"]),
    due_date: pick(raw, ["due_date", "date"]),
    principal: pick(raw, ["principal_due", "principal"]),
    interest: pick(raw, ["interest_due", "interest"]),
    amount_due: pick(raw, ["total_due", "amount_due", "amortization"]),
    balance: pick(raw, ["remaining_balance", "balance", "outstanding_balance"]),
  };
}

export function buildDisclosureDoc(
  raw: unknown,
  options: PrintableBuildOptions = {}
): PrintableDocument {
  const root = asRecord(raw);
  const terms = asRecord(pick(root, ["loan_terms", "terms"])) ?? root;
  const borrower = asRecord(pick(root, ["borrower"]));
  const totals = asRecord(pick(root, ["totals"]));

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ?? pick(root, ["borrower_name"]);
  const accountNumber =
    pick(terms, ["loan_account_number", "application_number"]) ??
    pick(root, ["reference_number", "application_number", "loan_id"]);

  const principal = pickNumber(terms, ["principal_amount", "principal"]);
  const interestMethod = humanize(
    pick(terms, ["interest_method", "interest_type"])
  );
  // The raw enum value drives the term unit; the humanized one is only ever
  // printed. `humanize` turns `bi_weekly` into "Bi weekly", which no longer
  // matches the enum, so the two cannot share.
  const rawFrequency = pick(terms, ["frequency", "payment_frequency"]);
  const frequency = humanize(rawFrequency);

  const financeBlock = asRecord(pick(root, ["finance_charges"]));
  const nonFinanceBlock = asRecord(pick(root, ["non_finance_charges"]));
  const proceeds = asRecord(pick(root, ["proceeds"]));
  const rates = asRecord(pick(root, ["rates"]));

  const totalPayable =
    pickNumber(totals, ["total_obligation", "total_payable"]) ??
    pickNumber(root, ["total_payable"]);

  // Interest is the statement's headline finance charge.
  const totalInterest =
    pickNumber(financeBlock, ["interest"]) ?? pickNumber(totals, ["total_interest"]);

  // Interest plus the coop's own fees, added by the server. Non-finance
  // charges and share capital are not in it.
  const totalFinanceCharges =
    pickNumber(totals, ["total_finance_charges"]) ?? pickNumber(financeBlock, ["total"]);
  const totalNonFinanceCharges =
    pickNumber(nonFinanceBlock, ["total"]) ?? pickNumber(totals, ["total_non_finance_charges"]);

  // The contractual rate as quoted; the loan terms stand in when `rates` is
  // absent. Only its wording is chosen here — no rate is derived from it.
  const contractualRate =
    pickNumber(rates, ["contractual_rate"]) ?? pickNumber(terms, ["interest_rate", "rate"]);
  const rateFrequency = pick(rates, ["rate_frequency"]) ?? rateFrequencyFrom(terms);

  const scheduleRows = asArray(
    pick(root, ["amortization_schedule", "amortization_schedules", "schedule"])
  ).map(normalizeScheduleRow);

  /**
   * III. Finance Charges: `a. Interest`, then the server's finance items
   * lettered on (its "Other Charges" / "Adjustment" for anything the
   * deductions list does not itemise), then the server's total.
   */
  const financeLines: PrintChargeLine[] = readChargeItems(financeBlock).map((item, index) => ({
    label: `${letter(index + 1)}. ${item.name}`,
    amount: currencyOrDash(item.amount),
    indent: true,
  }));

  /**
   * IV. Non-Finance Charges. The insurance premium is its full amount; when
   * part of it was not collected at release, a note under it says that part
   * is owed on the loan. The note carries no figure in the column, so the
   * column still adds up to the total.
   */
  const nonFinanceLines: PrintChargeLine[] = readChargeItems(nonFinanceBlock).flatMap((item, index) => {
    const line: PrintChargeLine = {
      label: `${letter(index)}. ${item.name}`,
      amount: currencyOrDash(item.amount),
      indent: true,
    };
    if (item.owed === null || item.owed <= 0) return [line];
    return [
      line,
      {
        label: `of which ${formatCurrency(item.owed)} unpaid at release is owed on the loan — interest-free`,
        amount: "",
        indent: true,
      },
    ];
  });

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Disclosure Statement",
      subtitle: "on Loan / Credit Transaction",
      legalRef:
        "Required under Republic Act No. 3765 (Truth in Lending Act) and BSP Circular No. 730, Series of 2011",
    },
    {
      kind: "fields",
      title: "I. Borrower & Loan Information",
      columns: 2,
      items: presentFields([
        field("Name of Borrower", borrowerName),
        field("Loan Account No.", accountNumber),
        dateField(
          "Date Granted",
          pick(terms, ["start_date", "release_date", "released_at"])
        ),
        field("Type of Loan", pick(terms, ["loan_product_name"]) ?? interestMethod),
        field("Term of Loan", termLabelFrom(terms)),
        field("Mode of Payment", frequency),
      ]),
    },
    {
      kind: "charges",
      title: "II. Amount of Credit / Loan",
      lines: [
        { label: "1. Principal Loan Amount", amount: currencyOrDash(principal) },
      ],
    },
    {
      kind: "charges",
      title: "III. Finance Charges",
      lines: [
        { label: "a. Interest", amount: currencyOrDash(totalInterest), indent: true },
        ...financeLines,
        {
          label: "2. Total Finance Charges",
          amount: currencyOrDash(totalFinanceCharges),
          rule: "total",
        },
      ],
    },
    {
      kind: "charges",
      title: "IV. Non-Finance Charges",
      lines: [
        ...nonFinanceLines,
        {
          label: "3. Total Non-Finance Charges",
          amount: currencyOrDash(totalNonFinanceCharges),
          rule: "total",
        },
      ],
    },
    {
      kind: "charges",
      title: "V. Net Proceeds",
      lines: [
        {
          label: "Principal Loan Amount",
          amount: currencyOrDash(pickNumber(proceeds, ["principal"])),
        },
        lessLine("Less: Finance Charges Deducted", pickNumber(proceeds, ["finance_charges_deducted"])),
        lessLine("Less: Non-Finance Charges Deducted", pickNumber(proceeds, ["non_finance_charges_deducted"])),
        lessLine(
          "Less: Share Capital (deducted from proceeds; not a charge)",
          pickNumber(proceeds, ["share_capital"])
        ),
        {
          label: "4. Net Proceeds of Loan (Amount Received by Borrower)",
          amount: currencyOrDash(pickNumber(proceeds, ["net_proceeds"])),
          rule: "grand",
        },
      ],
    },
    {
      kind: "fields",
      title: "VI. Rate Information",
      columns: 2,
      items: presentFields([
        field("Contractual Interest Rate", rateLabel(contractualRate, rateFrequency) ?? DASH),
        // BSP 730 asks for the rate restated per annum, and for the
        // effective interest rate. Both are the server's (`rates`): it knows
        // the period the rate is quoted per and solves the EIR from the
        // schedule. Null — an unknown period, an EIR that can't be solved —
        // prints a dash.
        field("Nominal Annual Rate", rateOrDash(pickNumber(rates, ["nominal_annual_rate"]), "per annum")),
        field(
          "Effective Interest Rate (Monthly)",
          rateOrDash(pickNumber(rates, ["effective_rate_monthly"]), "per month")
        ),
        field(
          "Effective Interest Rate (Per Annum)",
          rateOrDash(pickNumber(rates, ["effective_rate_annual"]), "per annum")
        ),
        field(
          "Interest Computation",
          `${interestMethod ?? "Diminishing"} Balance`
        ),
        field("Total Amount Payable", currencyOrDash(totalPayable)),
      ]),
    },
  ];

  if (scheduleRows.length > 0) {
    if (scheduleRows.length > SCHEDULE_PAGE_BREAK_AT) {
      blocks.push({ kind: "page_break" });
    }
    blocks.push({
      kind: "table",
      title: "VII. Amortization Schedule",
      columns: [
        { key: "period", header: "No.", align: "center", width: "6%" },
        { key: "due_date", header: "Due Date", format: "date", width: "18%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "19%" },
        { key: "interest", header: "Interest", format: "currency", align: "right", width: "19%" },
        { key: "amount_due", header: "Total Amortization", format: "currency", align: "right", width: "19%" },
        { key: "balance", header: "Outstanding Balance", format: "currency", align: "right", width: "19%" },
      ],
      rows: scheduleRows,
      // The server's column totals; never the rows added up here.
      totals: {
        due_date: "TOTAL",
        principal: currencyOrDash(pickNumber(totals, ["total_principal"])),
        interest: currencyOrDash(totalInterest),
        amount_due: currencyOrDash(pickNumber(totals, ["total_amortization"])),
      },
    });
  }

  blocks.push(
    {
      kind: "paragraph",
      align: "left",
      html:
        "<strong>ACKNOWLEDGMENT:</strong> I/We acknowledge receipt of this Disclosure Statement " +
        "<em>prior to the consummation</em> of the above credit/loan transaction. I/We have read and " +
        "fully understood all the terms and conditions stated herein, including the finance charges, " +
        "interest rate, penalties, and other charges.",
    },
    {
      kind: "paragraph",
      align: "left",
      html:
        "This Disclosure Statement is issued in compliance with <strong>Republic Act No. 3765</strong>, " +
        'otherwise known as the <em>"Truth in Lending Act,"</em> and its implementing rules and ' +
        "regulations, as amended by <strong>BSP Circular No. 730, Series of 2011</strong>.",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        {
          name: borrowerName ? String(borrowerName) : null,
          label: "Borrower — Signature Over Printed Name",
          detail: "Date: _______________",
        },
        {
          name: "Authorized Representative",
          label: "Creditor / Lending Company",
          detail: "Date: _______________",
        },
      ],
    }
  );

  return {
    id: "disclosure_statement",
    org: options.org ?? BLANK_ORG,
    title: "Disclosure Statement",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: accountNumber
      ? `This is a system-generated Disclosure Statement. • Loan ${accountNumber}`
      : "This is a system-generated Disclosure Statement.",
  };
}
