/**
 * Savings transaction receipt: one deposit or withdrawal, two copies
 * (Depositor's and File).
 *
 * Built from a loaded `SavingsAccount` and one of its ledger lines, not
 * through the `/printables` catalog. Every figure is the server's, printed as
 * sent: the amount is the line's credit (deposit) or debit (withdrawal), the
 * balance is its `balance_after`. Nothing is worked out here.
 *
 * Like the official receipt, a reversed line must not pass for proof of a
 * deposit: it is stamped REVERSED on every copy and says so in words.
 */

import type { SavingsAccount, SavingsMethod, SavingsTransaction } from "@/types";
import { amountInWords } from "../amount-in-words";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  currencyOrDash,
  dateField,
  dateOrBlank,
  field,
  generatedAt,
  presentFields,
  toNumber,
  type PrintableBuildOptions,
} from "./shared";

/** The ledger lines a receipt can be printed for. */
export type ReceiptTransactionType = "deposit" | "withdrawal";

export function isReceiptTransaction(
  txn: Pick<SavingsTransaction, "type">,
): txn is SavingsTransaction & { type: ReceiptTransactionType } {
  return txn.type === "deposit" || txn.type === "withdrawal";
}

const METHOD_NAMES: Record<SavingsMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  maya: "Maya",
  savings: "Savings account",
};

const COPY = {
  deposit: {
    title: "Deposit Receipt",
    amountLabel: "AMOUNT DEPOSITED",
    member: "Deposited by",
    staff: "Received by",
  },
  withdrawal: {
    title: "Withdrawal Receipt",
    amountLabel: "AMOUNT WITHDRAWN",
    member: "Received by",
    staff: "Released by",
  },
} as const;

const COPIES = ["Depositor's Copy", "File Copy"];

export function buildSavingsReceiptDoc(
  account: SavingsAccount,
  txn: SavingsTransaction & { type: ReceiptTransactionType },
  options: PrintableBuildOptions = {},
): PrintableDocument {
  const copy = COPY[txn.type];
  const reversed = txn.reversed_by_transaction_id != null;
  const amountText = txn.type === "deposit" ? txn.credit : txn.debit;
  const figure = toNumber(amountText);
  const method = txn.method ? METHOD_NAMES[txn.method] : null;

  const blocks: PrintBlock[] = [
    {
      kind: "title",
      text: copy.title,
      subtitle: reversed ? "REVERSED — NOT VALID AS A RECEIPT" : `Savings Account No. ${account.account_number}`,
    },
  ];

  if (reversed) {
    blocks.push({
      kind: "paragraph",
      align: "center",
      html:
        "<strong>*** R E V E R S E D ***</strong><br>" +
        "This transaction was reversed and no longer affects the account balance. " +
        "This copy is <strong>not</strong> valid proof of the transaction.",
    });
  }

  blocks.push(
    {
      kind: "fields",
      title: "Transaction Details",
      columns: 2,
      items: presentFields([
        field("Receipt No.", txn.reference),
        dateField("Date", txn.date),
        txn.value_date !== txn.date ? dateField("Value date", txn.value_date) : null,
        field("Account No.", account.account_number),
        field("Depositor", account.borrower_name),
        field("Member No.", account.borrower_code),
        field("Product", account.product.name),
        field("Branch", account.branch_name),
        method ? field("Payment Method", method) : null,
        txn.external_reference ? field("Reference No.", txn.external_reference) : null,
        txn.remarks ? field("Remarks", txn.remarks) : null,
      ]),
    },
    {
      kind: "charges",
      lines: [{ label: copy.amountLabel, amount: currencyOrDash(amountText), rule: "grand" }],
    },
    {
      kind: "fields",
      items: [
        figure === null
          ? { label: "Amount in words", underline: true }
          : { label: "Amount in words", value: amountInWords(figure) },
      ],
    },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([field("Balance after this transaction", currencyOrDash(txn.balance_after))]),
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: copy.member, name: account.borrower_name ?? null, detail: "Depositor — Signature Over Printed Name" },
        { label: copy.staff, name: txn.created_by?.name ?? null, detail: `Date: ${dateOrBlank(txn.date)}` },
      ],
    },
  );

  if (!reversed && txn.pending_reversal_approval_id != null) {
    blocks.push({
      kind: "note",
      text: "A reversal of this transaction is waiting for approval. If it is approved, this receipt is no longer valid.",
    });
  }
  blocks.push({
    kind: "note",
    text: reversed
      ? "REVERSED — retained for audit purposes only. Do not issue to the depositor as a receipt."
      : "This receipt is valid only for the transaction described above. Please keep it for your records.",
  });

  return {
    id: "savings_receipt",
    subjectId: txn.id,
    org: options.org ?? BLANK_ORG,
    title: reversed ? `${copy.title} (REVERSED)` : copy.title,
    // The ledger reference IS the receipt number; a minted one would give the
    // depositor a second, differently numbered copy of the same transaction.
    reference: txn.reference,
    generatedAt: generatedAt(options.now),
    copies: reversed ? COPIES.map((label) => `REVERSED — ${label}`) : COPIES,
    blocks,
    footerNote: `${copy.title} • ${txn.reference}`,
  };
}
