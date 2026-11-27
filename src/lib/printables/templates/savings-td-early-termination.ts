/**
 * Early Termination Form, printed from a time deposit.
 *
 * An active placement prints the server's pre-termination quote for today
 * (`GET …/pretermination-quote`, `savings:close`): days held, the regular
 * savings rate fixed at placement, interest, tax, penalty and the payout. A
 * placement already pre-terminated prints what was paid. Without a quote the
 * figures are left blank: the server works them out when the termination is
 * posted. A form that asks, so a record that couldn't be read prints blank.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  currencyOrDash,
  dateField,
  dateOrBlank,
  escapeHtml,
  field,
  fill,
  generatedAt,
  pick,
  type PrintableBuildOptions,
} from "./shared";
import { part, productName, ratePerAnnum, str } from "./savings-shared";

export function buildTimeDepositEarlyTerminationDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const td = part(raw, "deposit");
  const quote = part(raw, "quote");
  const status = str(td, "status");
  const done = status === "preterminated";
  const depositor = str(td, "borrower_name");
  const certificate = str(td, "certificate_number");
  const term = pick(td, ["term_days"]);
  const preRate = ratePerAnnum(pick(td, ["pretermination_rate"]));

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Early Termination Form",
      subtitle: done ? "PRE-TERMINATED" : certificate ? `Certificate No. ${certificate}` : undefined,
    },
    {
      kind: "fields",
      title: "Time Deposit",
      columns: 2,
      items: [
        field("Certificate No.", certificate),
        field("Depositor", depositor),
        field("Member No.", str(td, "borrower_code")),
        field("Product", productName(td)),
        field("Principal", td ? currencyOrDash(str(td, "principal")) : null),
        field("Time deposit rate", ratePerAnnum(pick(td, ["annual_rate"]))),
        field("Term", typeof term === "number" ? `${term} days` : null),
        dateField("Placement date", str(td, "placement_date")),
        dateField("Maturity date", str(td, "maturity_date")),
      ],
    },
  ];

  if (done) {
    blocks.push({
      kind: "charges",
      title: `Paid on ${dateOrBlank(str(td, "settled_on"))}`,
      lines: [
        { label: "Principal", amount: currencyOrDash(str(td, "principal")) },
        { label: "Add: Interest for the days held", amount: currencyOrDash(str(td, "settled_interest")), indent: true },
        { label: "Less: Withholding tax", amount: `(${currencyOrDash(str(td, "settled_tax"))})`, indent: true },
        { label: "AMOUNT PAID", amount: currencyOrDash(str(td, "settled_amount")), rule: "grand" },
      ],
    });
  } else {
    blocks.push({
      kind: "charges",
      title: quote ? `If Terminated on ${dateOrBlank(str(quote, "date"))}` : "Termination Figures",
      lines: quote
        ? [
            { label: "Principal", amount: currencyOrDash(str(td, "principal")) },
            {
              label: `Add: Interest for ${pick(quote, ["days_held"]) ?? BLANK_LINE} days at ${ratePerAnnum(pick(quote, ["rate"])) ?? BLANK_LINE}`,
              amount: currencyOrDash(str(quote, "gross_interest")),
              indent: true,
            },
            { label: "Less: Withholding tax", amount: `(${currencyOrDash(str(quote, "withholding_tax"))})`, indent: true },
            { label: "Less: Penalty", amount: `(${currencyOrDash(str(quote, "penalty"))})`, indent: true },
            { label: "AMOUNT TO BE PAID", amount: currencyOrDash(str(quote, "payout")), rule: "grand" },
          ]
        : [
            { label: "Interest for the days held", amount: BLANK_LINE },
            { label: "Less: Withholding tax", amount: BLANK_LINE, indent: true },
            { label: "AMOUNT TO BE PAID", amount: BLANK_LINE, rule: "grand" },
          ],
    });
    blocks.push(
      {
        kind: "fields",
        title: "Request",
        columns: 2,
        items: [
          { label: "Reason", underline: true },
          { label: "Payout method", underline: true },
        ],
      },
      {
        kind: "paragraph",
        html:
          `I, ${fill(depositor)}, ask that the time deposit above be terminated before its maturity date. ` +
          "I understand that interest for the days held is then paid at the regular savings rate fixed at placement" +
          (preRate ? ` (${escapeHtml(preRate)})` : "") +
          ", not the time deposit rate, less withholding tax.",
      },
      {
        kind: "note",
        text: quote
          ? "The figures are the server's for the date shown. The amount paid is worked out again when the termination is posted."
          : "The amount paid is worked out by the system when the termination is posted.",
      },
    );
  }

  blocks.push({
    kind: "signatures",
    columns: 3,
    blocks: [
      { label: "Depositor", name: depositor, detail: "Signature over printed name" },
      { label: "Processed by", detail: "Teller" },
      { label: "Approved by", detail: "Treasurer / General Manager" },
    ],
  });

  return {
    id: "time_deposit_early_termination",
    org: options.org ?? BLANK_ORG,
    title: "Early Termination Form",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: certificate ? `Early Termination Form • ${certificate}` : undefined,
  };
}
