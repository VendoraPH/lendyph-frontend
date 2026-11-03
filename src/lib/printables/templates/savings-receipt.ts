/**
 * Savings Transaction Receipt — two copies, Member's and File.
 *
 * Source: the `SavingsTransaction` a deposit, withdrawal or transfer returned,
 * or `GET /savings/transactions/{id}` on a reprint. One template covers every
 * type: a transfer prints from either leg, naming the other account.
 *
 * Like the official receipt it asserts a figure over a signature, so:
 * - a transaction that could not be read prints as a blank form flagged
 *   `incomplete`, never as "₱0.00";
 * - a reversed one is stamped REVERSED on every copy and names the reversal;
 * - one awaiting approval says so and is not a receipt yet.
 *
 * The balances are the server's own (`previous_balance`, `running_balance`):
 * nothing here adds or subtracts.
 */

import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  asRecord,
  currencyOrDash,
  dateField,
  dateOrBlank,
  field,
  generatedAt,
  humanize,
  moneyOrBlank,
  personName,
  pick,
  pickNumber,
  presentFields,
  type PrintableBuildOptions,
} from "./shared";

const COPIES = ["Member's Copy", "File Copy"];

const TYPE_TITLE: Record<string, string> = {
  opening_deposit: "Opening Deposit",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_in: "Fund Transfer",
  transfer_out: "Fund Transfer",
  interest: "Interest Credit",
  closing_withdrawal: "Account Closing Payout",
  reversal: "Reversal",
};

/** Money that came out of the account: the member receives it. */
const OUTFLOW = new Set(["withdrawal", "transfer_out", "closing_withdrawal"]);

export function buildSavingsReceiptDoc(
  raw: unknown,
  options: PrintableBuildOptions = {},
): PrintableDocument {
  const tx = asRecord(raw);
  const incomplete = tx === null;

  const type = String(pick(tx, ["type"]) ?? "");
  const status = String(pick(tx, ["status"]) ?? "");
  const reversed = status === "reversed";
  const pending = status === "pending_approval";
  const isTransfer = type === "transfer_in" || type === "transfer_out";
  const outflow = OUTFLOW.has(type);

  const debit = pickNumber(tx, ["debit"]) ?? 0;
  const credit = pickNumber(tx, ["credit"]) ?? 0;
  // Null, not 0, when the transaction is unknown: nothing may state a figure
  // the API did not send.
  const amount = incomplete ? null : Math.max(debit, credit);

  const reference = pick<string>(tx, ["reference_number"]);
  const memberName = pick<string>(tx, ["member_name"]);
  const counterparty = asRecord(pick(tx, ["counterparty"]));
  const reversedBy = asRecord(pick(tx, ["reversed_by"]));
  const reversalOf = asRecord(pick(tx, ["reversal_of"]));
  const typeTitle = TYPE_TITLE[type] ?? "Savings Transaction";

  const accountRows = isTransfer
    ? (() => {
        const own = pick(tx, ["account_number"]);
        const other = pick(counterparty, ["account_number"]);
        const [from, to] = type === "transfer_out" ? [own, other] : [other, own];
        return [
          field("From account", from),
          field("To account", to),
          field("Counterparty", pick(counterparty, ["member_name"])),
        ];
      })()
    : [field("Account No.", pick(tx, ["account_number"]))];

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: `${typeTitle} Receipt`,
      subtitle: reversed
        ? "REVERSED — NOT VALID PROOF OF THIS TRANSACTION"
        : pending
          ? "PENDING APPROVAL — NOT YET POSTED"
          : incomplete
            ? "BLANK FORM — TRANSACTION RECORD UNAVAILABLE"
            : "Savings & Deposits",
    },
  ];

  if (reversed) {
    blocks.push({
      kind: "paragraph",
      align: "center",
      html:
        "<strong>*** R E V E R S E D ***</strong><br>" +
        "This transaction was reversed and no longer affects the account balance.",
    });
  }

  blocks.push(
    {
      kind: "fields",
      title: "Transaction Details",
      columns: 2,
      items: presentFields([
        field("Reference No.", reference),
        dateField("Date", pick(tx, ["transaction_date", "created_at"])),
        field("Member", memberName),
        ...accountRows,
        field("Branch", pick(asRecord(pick(tx, ["branch"])), ["name"])),
        field("Payment method", humanize(pick(tx, ["payment_method"]))),
        reversalOf ? field("Reverses", pick(reversalOf, ["reference_number"])) : null,
        reversedBy ? field("Reversed by entry", pick(reversedBy, ["reference_number"])) : null,
      ]),
    },
    {
      kind: "charges",
      title: "Amount",
      lines: [
        { label: "Balance before", amount: currencyOrDash(pickNumber(tx, ["previous_balance"])), indent: true },
        {
          label: outflow ? "Less: amount paid out" : "Add: amount received",
          amount: currencyOrDash(amount),
          indent: true,
        },
        { label: "BALANCE AFTER", amount: moneyOrBlank(pickNumber(tx, ["running_balance"])), rule: "grand" },
      ],
    },
    {
      kind: "fields",
      items: [
        amount === null
          ? { label: "Amount in words", underline: true }
          : { label: "Amount in words", value: amountInWords(amount) },
        field("Remarks", pick(tx, ["remarks"])),
      ],
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        {
          name: memberName ? String(memberName) : null,
          label: outflow ? "Received by (member)" : "Deposited by",
          detail: "Signature Over Printed Name",
        },
        {
          name: personName(tx, "processed_by"),
          label: "Processed by",
          detail: `Date: ${dateOrBlank(pick(tx, ["transaction_date", "created_at"]))}`,
        },
      ],
    },
    {
      kind: "note",
      text: reversed
        ? "REVERSED — retained for audit purposes only. Do not issue to the member as a receipt."
        : pending
          ? "This transaction is awaiting approval and has not been posted. Do not issue it as a receipt until it is approved."
          : incomplete
            ? "The transaction could not be retrieved when this form was printed, so no amount is stated on it. It is NOT proof of a transaction. Verify it against the account's ledger and complete the form by hand before it is signed."
            : "Please keep this receipt for your records.",
    },
  );

  const stamp = reversed ? "REVERSED" : pending ? "PENDING" : null;
  return {
    id: "savings_receipt",
    org: options.org ?? BLANK_ORG,
    title: stamp ? `${typeTitle} Receipt (${stamp})` : `${typeTitle} Receipt`,
    // The transaction's reference IS the document's: a reprint must carry it.
    reference: reference ?? undefined,
    generatedAt: generatedAt(options.now),
    copies: stamp ? COPIES.map((label) => `${stamp} — ${label}`) : COPIES,
    blocks,
    incomplete: incomplete || undefined,
    footerNote: reversed
      ? "REVERSED TRANSACTION — NOT A VALID RECEIPT"
      : incomplete
        ? "BLANK FORM — transaction record unavailable. NOT A VALID RECEIPT."
        : "This is a system-generated receipt.",
  };
}
