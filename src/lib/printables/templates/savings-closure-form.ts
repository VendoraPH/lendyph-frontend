/**
 * Account Closure Form, printed from a savings account.
 *
 * An open account prints the server's closing quote for today
 * (`GET …/closing-quote`, `savings:close`): balance, interest to date, tax and
 * the amount to be paid out, and anything that stops the closing, in the
 * server's words. A closed account prints its closing date, reason and the
 * closing payout row. Without a quote the figures are left blank: the server
 * works them out when the closing is posted.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  currencyOrDash,
  dateField,
  escapeHtml,
  field,
  generatedAt,
  pick,
  type PrintableBuildOptions,
} from "./shared";
import { accountFields, accountStatus, part, str } from "./savings-shared";

export function buildSavingsClosureFormDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const account = part(raw, "account");
  const quote = part(raw, "quote");
  const closing = part(raw, "closing");
  const closed = str(account, "status") === "closed";
  const depositor = str(account, "borrower_name");
  const number = str(account, "account_number");

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Account Closure Form",
      subtitle: closed ? "ACCOUNT CLOSED" : number ? `Account No. ${number}` : undefined,
    },
    {
      kind: "fields",
      title: "Account",
      columns: 2,
      items: [...accountFields(account), field("Status", account ? accountStatus(account) : null)],
    },
  ];

  if (closed) {
    blocks.push(
      {
        kind: "fields",
        title: "Closing",
        columns: 2,
        items: [
          dateField("Date closed", str(account, "closed_on")),
          field("Reason", str(account, "close_reason")),
          field("Payout reference", str(closing, "reference")),
        ],
      },
      {
        kind: "charges",
        lines: [{ label: "AMOUNT PAID OUT", amount: closing ? currencyOrDash(str(closing, "debit")) : BLANK_LINE, rule: "grand" }],
      },
    );
  } else {
    blocks.push({
      kind: "charges",
      title: quote ? "If Closed Today" : "Closing Figures",
      lines: quote
        ? [
            { label: "Balance", amount: currencyOrDash(str(quote, "balance")) },
            { label: "Add: Interest earned to date", amount: currencyOrDash(str(quote, "accrued_interest")), indent: true },
            { label: "Less: Withholding tax", amount: `(${currencyOrDash(str(quote, "withholding_tax"))})`, indent: true },
            { label: "AMOUNT TO BE PAID OUT", amount: currencyOrDash(str(quote, "payout_amount")), rule: "grand" },
          ]
        : [
            { label: "Balance", amount: BLANK_LINE },
            { label: "Add: Interest earned to date", amount: BLANK_LINE, indent: true },
            { label: "Less: Withholding tax", amount: BLANK_LINE, indent: true },
            { label: "AMOUNT TO BE PAID OUT", amount: BLANK_LINE, rule: "grand" },
          ],
    });
    const listed = pick(quote, ["blockers"]);
    const reasons = Array.isArray(listed)
      ? listed.filter((b): b is string => typeof b === "string" && b.trim() !== "")
      : [];
    if (pick(quote, ["can_close"]) === false && reasons.length > 0) {
      blocks.push({ kind: "note", text: `This account can't be closed yet: ${reasons.join(" ")}` });
    }
    blocks.push(
      {
        kind: "fields",
        title: "Request",
        columns: 2,
        items: [
          { label: "Reason for closing", underline: true },
          { label: "Payout method", underline: true },
        ],
      },
      {
        kind: "paragraph",
        html:
          `I, <strong>${escapeHtml(depositor ?? BLANK_LINE)}</strong>, ask that the savings account above be closed ` +
          "and its balance, with the interest earned to the closing date less tax, be paid to me by the method stated.",
      },
      {
        kind: "note",
        text: quote
          ? "The figures are the server's for today. The amount paid is worked out again when the closing is posted."
          : "The amount paid is worked out by the system when the closing is posted.",
      },
    );
  }

  blocks.push({
    kind: "signatures",
    columns: 3,
    blocks: [
      { label: "Depositor", name: depositor, detail: "Signature over printed name" },
      { label: "Processed by", detail: "Teller" },
      { label: "Approved by", detail: "Branch manager" },
    ],
  });

  return {
    id: "savings_closure_form",
    org: options.org ?? BLANK_ORG,
    title: "Account Closure Form",
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: number ? `Account Closure Form • ${number}` : undefined,
  };
}
