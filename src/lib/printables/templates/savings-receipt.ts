/**
 * Savings transaction receipt: one deposit or withdrawal, two copies
 * (Member's and File), worded like the official receipt.
 *
 * Built from a loaded `SavingsAccount` and one of its ledger lines, not
 * through the `/printables` catalog. Every figure is the server's, printed as
 * sent: the amount is the line's credit (deposit) or debit (withdrawal), the
 * balance is its `balance_after` (a withdrawal's fee row's, when it carries
 * an excess-withdrawal fee). Nothing is worked out here.
 *
 * Like the official receipt, a reversed line must not pass for proof of a
 * deposit: it is stamped REVERSED on every copy and says so in words.
 */

import type { SavingsAccount, SavingsTransaction } from "@/types";
import { METHOD_LABELS } from "@/lib/savings/method-labels";
import { feeOf } from "@/lib/savings/withdrawal-fee";
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

/**
 * A counter deposit or withdrawal. A line linked to a time deposit is not one,
 * though it carries the same type: a placement funded from savings posts a
 * `withdrawal`, and a payout into savings posts a `deposit` (by the scheduler,
 * with no user, at maturity). The certificate is that money's document.
 */
export function isReceiptTransaction(
  txn: Pick<SavingsTransaction, "type"> & { time_deposit_id?: number | null },
): txn is SavingsTransaction & { type: ReceiptTransactionType } {
  return (txn.type === "deposit" || txn.type === "withdrawal") && txn.time_deposit_id == null;
}

/** The server's figure for what a receipt line moved: a deposit's credit, a withdrawal's debit. */
export function receiptAmount(txn: Pick<SavingsTransaction, "credit" | "debit"> & { type: ReceiptTransactionType }): string {
  return txn.type === "deposit" ? txn.credit : txn.debit;
}

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

const COPIES = ["Member's Copy", "File Copy"];

export interface SavingsReceiptOptions extends PrintableBuildOptions {
  /**
   * The withdrawal's linked excess-withdrawal `fee` row, read from the
   * server (gap round S1), or null when it couldn't be read. The fee posts
   * after the withdrawal, so the balance after the whole transaction is the
   * fee row's `balance_after`, never the withdrawal row's.
   */
  fee?: SavingsTransaction | null;
}

export function buildSavingsReceiptDoc(
  account: SavingsAccount,
  txn: SavingsTransaction & { type: ReceiptTransactionType },
  options: SavingsReceiptOptions = {},
): PrintableDocument {
  const copy = COPY[txn.type];
  const reversed = txn.reversed_by_transaction_id != null;
  const amountText = receiptAmount(txn);
  const figure = toNumber(amountText);
  const method = txn.method ? METHOD_LABELS[txn.method] : null;
  // A withdrawal beyond the month's free count carries a fee row: print its
  // amount and the balance once it posted. Without the row the balance after
  // isn't known here, so it reads a dash rather than the pre-fee figure.
  const feeAmount = txn.type === "withdrawal" ? feeOf(txn) : null;
  const feeRow = feeAmount ? (options.fee ?? null) : null;
  const balanceAfter = feeAmount ? (feeRow?.balance_after ?? null) : txn.balance_after;

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
        field("Member", account.borrower_name),
        field("Member No.", account.borrower_code),
        field("Product", account.product.name),
        field("Branch", account.branch_name),
        method ? field("Payment Method", method) : null,
        txn.external_reference ? field("Reference No.", txn.external_reference) : null,
        txn.remarks ? field("Remarks", txn.remarks) : null,
        feeRow ? field("Fee reference", feeRow.reference) : null,
      ]),
    },
    {
      kind: "charges",
      lines: [
        { label: copy.amountLabel, amount: currencyOrDash(amountText), rule: "grand" },
        ...(feeAmount
          ? [{ label: "Excess withdrawal fee", amount: currencyOrDash(feeRow?.debit ?? feeAmount) }]
          : []),
      ],
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
      items: presentFields([field("Balance after this transaction", currencyOrDash(balanceAfter))]),
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: copy.member, name: account.borrower_name ?? null, detail: "Member — Signature Over Printed Name" },
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
      ? "REVERSED — retained for audit purposes only. Do not issue to the member as a receipt."
      : "This receipt is valid only for the transaction described above. Please keep it for your records.",
  });

  return {
    id: "savings_receipt",
    subjectId: txn.id,
    org: options.org ?? BLANK_ORG,
    title: reversed ? `${copy.title} (REVERSED)` : copy.title,
    // The ledger reference IS the receipt number; a minted one would give the
    // member a second, differently numbered copy of the same transaction.
    reference: txn.reference,
    generatedAt: generatedAt(options.now),
    copies: reversed ? COPIES.map((label) => `REVERSED — ${label}`) : COPIES,
    blocks,
    footerNote: `${copy.title} • ${txn.reference}`,
  };
}
