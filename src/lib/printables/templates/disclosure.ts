/**
 * Disclosure Statement — R.A. 3765 (Truth in Lending Act) and BSP Circular
 * No. 730, Series of 2011.
 *
 * Ported from `generateDisclosureHTML` in `src/lib/loan-document-templates.ts`.
 * The statutory wording — the legal reference line, the six numbered sections
 * and the borrower's acknowledgment — is carried over verbatim. Only the
 * carrier changed: blocks instead of a 200-line HTML string.
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
  annualRateLabel,
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
  toNumber,
  unitemisedRemainder,
  type PrintableBuildOptions,
} from "./shared";

/** Long schedules get their own page so the terms above stay on page one. */
const SCHEDULE_PAGE_BREAK_AT = 12;

/** Deduction rows the statute wants named individually under finance charges. */
interface DeductionItem {
  name: string;
  amount: number;
}

function readDeductions(
  deductionsBlock: Record<string, unknown> | null,
  root: Record<string, unknown> | null
): DeductionItem[] {
  // Real payload: deductions.items[] = { name, amount, type, original_value }.
  const items = asArray(pick(deductionsBlock, ["items"]) ?? deductionsBlock);
  const named = items
    .map((item) => ({
      name: String(pick(item, ["name", "label", "description"]) ?? "Deduction"),
      amount: toNumber(pick(item, ["amount", "value"])) ?? 0,
    }))
    .filter((item) => item.amount !== 0 || item.name !== "Deduction");
  if (named.length > 0) return named;

  // Legacy flat shape — the fixed Processing / Service / Other rows the old
  // template hardcoded. Zeroes are dropped so a statement never claims a
  // charge that was not levied.
  return (
    [
      { name: "Processing / Service Fee", amount: pickNumber(root, ["processing_fee"]) },
      { name: "Service Fee", amount: pickNumber(root, ["service_fee"]) },
      { name: "Other Charges", amount: pickNumber(root, ["other_deductions"]) },
    ] as { name: string; amount: number | null }[]
  )
    .filter((item): item is DeductionItem => (item.amount ?? 0) > 0)
    .map((item) => ({ name: item.name, amount: item.amount }));
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
  const deductionsBlock = asRecord(pick(root, ["deductions"]));
  const totals = asRecord(pick(root, ["totals"]));

  const borrowerName =
    pick(borrower, ["full_name", "name"]) ?? pick(root, ["borrower_name"]);
  const accountNumber =
    pick(terms, ["loan_account_number", "application_number"]) ??
    pick(root, ["reference_number", "application_number", "loan_id"]);

  const principal = pickNumber(terms, ["principal_amount", "principal"]) ?? 0;
  const rate = pickNumber(terms, ["interest_rate", "rate"]) ?? 0;
  const interestMethod = humanize(
    pick(terms, ["interest_method", "interest_type"])
  );
  // The raw enum value drives the term unit and the annualisation; the
  // humanized one is only ever printed. `humanize` turns `bi_weekly` into
  // "Bi weekly", which no longer matches the enum, so the two cannot share.
  const rawFrequency = pick(terms, ["frequency", "payment_frequency"]);
  const frequency = humanize(rawFrequency);

  const deductions = readDeductions(deductionsBlock, root);
  const itemisedTotal = deductions.reduce((acc, d) => acc + d.amount, 0);
  const totalDeductions =
    pickNumber(deductionsBlock, ["total_deductions", "total"]) ??
    pickNumber(totals, ["total_deductions"]) ??
    pickNumber(root, ["total_deductions"]) ??
    itemisedTotal;

  const totalPayable =
    pickNumber(totals, ["total_obligation", "total_payable"]) ??
    pickNumber(root, ["total_payable"]);

  // Interest is the statement's headline finance charge. Prefer the figure the
  // API computed from the schedule; only derive it when the payload is the old
  // flat shape, and never let a rounding artefact print as a negative charge.
  const totalInterest =
    pickNumber(totals, ["total_interest"]) ??
    (totalPayable !== null ? Math.max(0, totalPayable - principal) : null);

  const netProceeds =
    pickNumber(deductionsBlock, ["net_proceeds"]) ??
    pickNumber(totals, ["net_proceeds"]) ??
    pickNumber(root, ["net_proceeds"]) ??
    principal - totalDeductions;

  const totalFinanceCharges = totalDeductions + (totalInterest ?? 0);

  const scheduleRows = asArray(
    pick(root, ["amortization_schedule", "amortization_schedules", "schedule"])
  ).map(normalizeScheduleRow);

  /**
   * The lettered finance-charge lines, continuing the statute's enumeration
   * after `a. Interest`.
   *
   * `totalDeductions` is the server's figure and outranks the sum of the items
   * it sent alongside — but then the letters below must still add up to
   * "2. Total Finance Charges", or a borrower reading down the column arrives
   * at a different number than the one the statement declares. Anything the
   * items do not account for is disclosed as a charge of its own rather than
   * left as a discrepancy for the reader to find.
   */
  const chargeItems: DeductionItem[] = [...deductions];
  const unitemised = unitemisedRemainder(totalDeductions, itemisedTotal);
  if (unitemised !== 0) {
    chargeItems.push({
      // Negative only when the items sum to more than the total the server
      // sent — one of the two is stale, and the total is the one that governs.
      name: unitemised > 0 ? "Other Charges" : "Adjustment",
      amount: unitemised,
    });
  }

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
        field("Term of Loan", termLabelFrom(terms, rawFrequency)),
        field("Mode of Payment", frequency),
      ]),
    },
    {
      kind: "charges",
      title: "II. Amount of Credit / Loan",
      lines: [
        { label: "1. Principal Loan Amount", amount: formatCurrency(principal) },
      ],
    },
    {
      kind: "charges",
      title: "III. Finance Charges",
      lines: [
        {
          label: "a. Interest",
          amount: currencyOrDash(totalInterest),
          indent: true,
        },
        ...chargeItems.map(
          (item, index): PrintChargeLine => ({
            // b., c., d. … continuing the statute's lettered enumeration after
            // interest, so each charge is disclosed on its own line.
            label: `${String.fromCharCode(98 + index)}. ${item.name}`,
            amount: formatCurrency(item.amount),
            indent: true,
          })
        ),
        {
          label: "2. Total Finance Charges",
          amount: formatCurrency(totalFinanceCharges),
          rule: "total",
        },
      ],
    },
    {
      kind: "charges",
      title: "IV. Net Proceeds",
      lines: [
        { label: "Principal Loan Amount", amount: formatCurrency(principal) },
        {
          label: "Less: Upfront Deductions",
          amount: `(${formatCurrency(totalDeductions)})`,
        },
        {
          label: "3. Net Proceeds of Loan (Amount Received by Borrower)",
          amount: formatCurrency(netProceeds),
          rule: "grand",
        },
      ],
    },
    {
      kind: "fields",
      title: "V. Rate Information",
      columns: 2,
      items: presentFields([
        field("Contractual Interest Rate", rateLabel(rate, rawFrequency)),
        // BSP 730 asks for the rate restated per annum. Annualised by the
        // loan's OWN frequency: `interest_rate` is charged once per period, so
        // a 1%-per-day loan is 365% nominal, not the 12% a fixed ×12 printed.
        // Null — a rule to be completed — when the frequency is unknown, since
        // there is no honest multiplier to reach for.
        field("Nominal Annual Rate", annualRateLabel(rate, rawFrequency)),
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
      title: "VI. Amortization Schedule",
      columns: [
        { key: "period", header: "No.", align: "center", width: "6%" },
        { key: "due_date", header: "Due Date", format: "date", width: "18%" },
        { key: "principal", header: "Principal", format: "currency", align: "right", width: "19%" },
        { key: "interest", header: "Interest", format: "currency", align: "right", width: "19%" },
        { key: "amount_due", header: "Total Amortization", format: "currency", align: "right", width: "19%" },
        { key: "balance", header: "Outstanding Balance", format: "currency", align: "right", width: "19%" },
      ],
      rows: scheduleRows,
      totals: {
        due_date: "TOTAL",
        principal: formatCurrency(sum(scheduleRows, "principal")),
        interest: formatCurrency(sum(scheduleRows, "interest")),
        amount_due: formatCurrency(sum(scheduleRows, "amount_due")),
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
