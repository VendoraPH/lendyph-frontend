/**
 * Savings Account Opening Form, printed from a savings account.
 *
 * The account, its officer, source of funds and beneficiary come from
 * `GET /savings/accounts/{id}`; the product's opening rules from the product
 * list. The depositor's personal details come from the member record only
 * when the server gave it (see `savings-shared.ts`); otherwise the lines are
 * left to fill in. The beneficiary's contact number is null from the server
 * for a caller who may not see it, and prints as a blank line.
 *
 * A form that asks, so a record that couldn't be read prints blank.
 */

import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  asRecord,
  currencyOrDash,
  escapeHtml,
  field,
  generatedAt,
  pick,
  presentFields,
  type PrintableBuildOptions,
} from "./shared";
import { accountFields, depositorFields, part, str } from "./savings-shared";

export function buildSavingsOpeningFormDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const account = part(raw, "account");
  const member = part(raw, "member");
  const product = part(raw, "product");
  const beneficiary = asRecord(pick(account, ["beneficiary"]));
  const officer = asRecord(pick(account, ["account_officer"]));
  const number = str(account, "account_number");
  const depositor = str(member, "full_name") ?? str(account, "borrower_name");

  const blocks: PrintBlock[] = [
    { kind: "title", text: "Savings Account Opening Form", subtitle: number ? `Account No. ${number}` : undefined },
    {
      kind: "fields",
      title: "Account",
      columns: 2,
      items: [
        ...accountFields(account).filter((f) => f.label !== "Depositor" && f.label !== "Member No."),
        field("Account officer", str(officer, "name")),
        field("Source of funds", str(account, "source_of_funds_label")),
      ],
    },
    { kind: "fields", title: "Depositor", columns: 2, items: depositorFields(account, member) },
    {
      kind: "fields",
      title: "Beneficiary",
      columns: 2,
      items: [
        field("Name", str(beneficiary, "name")),
        field("Relationship", str(beneficiary, "relationship")),
        field("Contact number", str(beneficiary, "contact_number")),
      ],
    },
    {
      kind: "fields",
      title: "Opening Deposit",
      columns: 2,
      items: [
        { label: "Amount", underline: true },
        { label: "Payment method", underline: true },
      ],
    },
  ];

  const rules = presentFields([
    product && str(product, "minimum_opening_balance")
      ? field("Minimum opening balance", currencyOrDash(str(product, "minimum_opening_balance")))
      : null,
    product && str(product, "maintaining_balance")
      ? field("Maintaining balance", currencyOrDash(str(product, "maintaining_balance")))
      : null,
  ]);
  if (rules.length > 0) blocks.push({ kind: "fields", title: "Product Requirements", columns: 2, items: rules });

  blocks.push(
    {
      kind: "paragraph",
      html:
        `I, <strong>${escapeHtml(depositor ?? BLANK_LINE)}</strong>, apply to open the savings account above. ` +
        "I confirm that the information I have given is true, that the money I deposit comes from the source stated, " +
        "and I agree to the terms of the Savings Account Agreement.",
    },
    {
      kind: "signatures",
      columns: 3,
      blocks: [
        { label: "Depositor", name: depositor, detail: "Signature over printed name" },
        { label: "Account officer", name: str(officer, "name") },
        { label: "Approved by", detail: "Branch manager" },
      ],
    },
  );

  return {
    id: "savings_opening_form",
    org: options.org ?? BLANK_ORG,
    title: "Savings Account Opening Form",
    generatedAt: generatedAt(options.now),
    copies: ["Depositor's Copy", "File Copy"],
    blocks,
    footerNote: number ? `Savings Account Opening Form • ${number}` : undefined,
  };
}
