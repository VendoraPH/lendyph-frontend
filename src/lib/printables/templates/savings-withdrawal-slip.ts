/**
 * Withdrawal Slip, printed from a posted withdrawal
 * (`GET /savings/transactions/{id}`) and its account.
 *
 * The amount is the withdrawal's own debit, in figures and words. An
 * excess-withdrawal fee is its own ledger line and is shown beside the
 * withdrawal, never added to it. A reversed withdrawal is stamped REVERSED,
 * as the receipt is.
 *
 * A row that isn't a withdrawal, or couldn't be read, prints a blank slip and
 * says so (`incomplete`).
 */

import { METHOD_LABELS } from "@/lib/savings/method-labels";
import { labelOf } from "@/app/(app)/savings/_lib/savings-rules";
import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_LINE,
  BLANK_ORG,
  asRecord,
  currencyOrDash,
  dateField,
  dateOrBlank,
  field,
  generatedAt,
  pick,
  presentFields,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";
import { part, productName, str } from "./savings-shared";

const COPIES = ["Depositor's Copy", "File Copy"];

export function buildSavingsWithdrawalSlipDoc(raw: unknown, options: PrintableBuildOptions = {}): PrintableDocument {
  const read = part(raw, "transaction");
  const txn = str(read, "type") === "withdrawal" ? read : null;
  const account = txn ? part(raw, "account") : null;
  const reversed = txn !== null && pick(txn, ["reversed_by_transaction_id"]) != null;
  const amount = str(txn, "debit");
  const figure = toNumber(amount);
  const method = str(txn, "method");
  const fee = str(txn, "fee_amount");
  const depositor = str(account, "borrower_name") ?? str(txn, "borrower_name");
  const reference = str(txn, "reference");
  const teller = str(asRecord(pick(txn, ["created_by"])), "name");

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: "Withdrawal Slip",
      subtitle: reversed ? "REVERSED — NO LONGER IN EFFECT" : reference ? `Reference ${reference}` : undefined,
    },
  ];
  if (reversed) {
    blocks.push({
      kind: "paragraph",
      align: "center",
      html: "<strong>*** R E V E R S E D ***</strong><br>This withdrawal was reversed and no longer affects the account balance.",
    });
  }
  blocks.push(
    {
      kind: "fields",
      title: "Withdrawal",
      columns: 2,
      items: presentFields([
        dateField("Date", str(txn, "date")),
        field("Reference", reference),
        field("Account No.", str(account, "account_number") ?? str(txn, "account_number")),
        field("Depositor", depositor),
        field("Member No.", str(account, "borrower_code")),
        field("Product", productName(account)),
        field("Branch", str(account, "branch_name")),
        field("Payment method", method ? labelOf(METHOD_LABELS, method) : null),
        str(txn, "external_reference") ? field("Reference No.", str(txn, "external_reference")) : null,
      ]),
    },
    {
      kind: "charges",
      lines: [{ label: "AMOUNT WITHDRAWN", amount: txn ? currencyOrDash(amount) : BLANK_LINE, rule: "grand" }],
    },
    {
      kind: "fields",
      items: [
        figure === null
          ? { label: "Amount in words", underline: true }
          : { label: "Amount in words", value: amountInWords(figure) },
        ...(fee ? [field("Excess-withdrawal fee (its own entry)", currencyOrDash(fee))] : []),
        field("Balance after this withdrawal", txn ? currencyOrDash(str(txn, "balance_after")) : null),
      ],
    },
    {
      kind: "signatures",
      columns: 3,
      blocks: [
        { label: "Depositor", name: depositor, detail: "Signature over printed name" },
        { label: "Released by", name: teller, detail: `Date: ${dateOrBlank(str(txn, "date"))}` },
        { label: "Approved by", detail: pick(txn, ["approval_id"]) != null ? "Approving officer" : "If required" },
      ],
    },
    {
      kind: "note",
      text: reversed
        ? "REVERSED — retained for audit purposes only."
        : "Please count your cash before leaving the counter. Keep this slip for your records.",
    },
  );

  return {
    id: "savings_withdrawal_slip",
    org: options.org ?? BLANK_ORG,
    title: reversed ? "Withdrawal Slip (REVERSED)" : "Withdrawal Slip",
    // The ledger reference is the slip's number, so a reprint never mints a second one.
    reference,
    generatedAt: generatedAt(options.now),
    copies: reversed ? COPIES.map((label) => `REVERSED — ${label}`) : COPIES,
    blocks,
    footerNote: reference ? `Withdrawal Slip • ${reference}` : undefined,
    ...(txn ? {} : { incomplete: true }),
  };
}
