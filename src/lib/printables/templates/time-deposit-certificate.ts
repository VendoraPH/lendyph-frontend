/**
 * Certificate of Time Deposit.
 *
 * Built straight from a loaded `TimeDeposit` (`GET /savings/time-deposits/{id}`)
 * rather than through the `/printables` catalog, whose subjects are loans,
 * members and payments. Every figure is the server's: principal, interest,
 * withholding tax and maturity amount are printed as sent and never derived
 * here, so the paper agrees with the books.
 *
 * The reference is the certificate number, so a reprint carries the number the
 * member was first issued rather than a freshly minted one.
 */

import type { TimeDeposit } from "@/types";
import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  currencyOrDash,
  dateOrBlank,
  escapeHtml,
  field,
  generatedAt,
  presentFields,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

const INSTRUCTION_TEXT: Record<TimeDeposit["maturity_instruction"], string> = {
  payout: "Pay out principal and interest to the depositor at maturity.",
  rollover_principal: "Roll over the principal for the same term; pay out the interest.",
  rollover_all: "Roll over principal and interest for the same term.",
};

/** Settled placements print as a record, not as a live certificate. */
const SETTLED_STATUS: Partial<Record<TimeDeposit["status"], string>> = {
  withdrawn: "SETTLED — PAID OUT AT MATURITY",
  rolled_over: "SETTLED — ROLLED OVER",
  preterminated: "PRE-TERMINATED — NO LONGER IN FORCE",
};

export function buildTimeDepositCertificateDoc(
  td: TimeDeposit,
  options: PrintableBuildOptions = {},
): PrintableDocument {
  const member = td.borrower_name?.trim() || null;
  const principal = toNumber(td.principal);
  const maturityAmount = toNumber(td.maturity_amount);
  const rate = toNumber(td.annual_interest_rate);
  const preRate = toNumber(td.pretermination_rate);
  const settled = SETTLED_STATUS[td.status];

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Certificate of Time Deposit",
      subtitle: settled ?? `Certificate No. ${td.certificate_number}`,
    },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Certificate No.", td.certificate_number),
        field("Depositor", member),
        field("Member No.", td.borrower_code),
        field("Branch", td.branch_name),
        field("Product", td.product.name),
        field("Interest rate", rate === null ? null : `${rate}% per annum`),
        field("Term", `${td.term_days} days`),
        field("Placement date", dateOrBlank(td.placement_date)),
        field("Maturity date", dateOrBlank(td.maturity_date)),
      ]),
    },
    {
      kind: "paragraph",
      html:
        "This is to certify that " +
        `<strong>${escapeHtml(member ?? BLANK_LINE)}</strong> has placed with the cooperative ` +
        `a time deposit of <strong>${escapeHtml(currencyOrDash(principal))}</strong>` +
        (principal === null ? "" : ` (${escapeHtml(amountInWords(principal))})`) +
        ` for a term of <strong>${td.term_days} days</strong>, from ` +
        `<strong>${escapeHtml(dateOrBlank(td.placement_date))}</strong> to ` +
        `<strong>${escapeHtml(dateOrBlank(td.maturity_date))}</strong>, earning interest at ` +
        `<strong>${rate === null ? BLANK_LINE : `${rate}%`}</strong> per annum.`,
    },
    {
      kind: "charges",
      title: "At Maturity",
      lines: [
        { label: "Principal", amount: currencyOrDash(td.principal) },
        { label: "Add: Interest for the term", amount: currencyOrDash(td.gross_interest), indent: true },
        { label: "Less: Withholding tax", amount: `(${currencyOrDash(td.withholding_tax)})`, indent: true },
        { label: "AMOUNT DUE AT MATURITY", amount: currencyOrDash(td.maturity_amount), rule: "grand" },
      ],
    },
    {
      kind: "fields",
      items: [
        {
          label: "Amount in words",
          value: maturityAmount === null ? BLANK_LINE : amountInWords(maturityAmount),
        },
        { label: "Instruction at maturity", value: INSTRUCTION_TEXT[td.maturity_instruction] },
      ],
    },
    {
      kind: "note",
      text:
        "This certificate is not negotiable. Withdrawal before maturity is a pre-termination: " +
        `interest is then paid at ${preRate === null ? "the pre-termination rate" : `${preRate}% per annum`} ` +
        "for the days held, less withholding tax and any penalty under the cooperative's policy. " +
        "Present this certificate when the deposit is settled.",
    },
    {
      kind: "signatures",
      columns: 3,
      blocks: [
        { label: "Depositor", name: member },
        { label: "Prepared by", detail: "Teller" },
        { label: "Approved by", detail: "Treasurer / General Manager" },
      ],
    },
  ];

  return {
    id: "time_deposit_certificate",
    subjectId: td.id,
    org: options.org ?? BLANK_ORG,
    title: "Certificate of Time Deposit",
    reference: td.certificate_number,
    generatedAt: generatedAt(options.now),
    copies: settled ? undefined : ["Depositor's Copy", "File Copy"],
    blocks,
    footerNote: `Certificate of Time Deposit • ${td.certificate_number}`,
  };
}
