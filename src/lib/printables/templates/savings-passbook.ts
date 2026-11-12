/**
 * Savings passbook: one account's ledger, oldest first, as the member's
 * printed record.
 *
 * Built from a loaded `SavingsAccount` and its transactions
 * (`GET /savings/accounts/{id}/transactions`), not through the `/printables`
 * catalog. The running balance on every line, and the balances in the header,
 * are the server's, printed as sent and never summed here. A ledger can be
 * longer than the pages fetched, so a truncated passbook says so instead of
 * passing for the whole history.
 */

import type { SavingsAccount, SavingsTransaction, SavingsTransactionType } from "@/types";
import { isNilAmount } from "@/lib/savings/amount-text";
import type { PrintableDocument, PrintBlock } from "../types";
import {
  BLANK_ORG,
  currencyOrDash,
  dateOrBlank,
  field,
  generatedAt,
  presentFields,
  type PrintableBuildOptions,
} from "./shared";

const TYPE_CODES: Record<SavingsTransactionType, string> = {
  deposit: "DEP",
  withdrawal: "WDL",
  interest: "INT",
  withholding_tax: "TAX",
  transfer_in: "TRI",
  transfer_out: "TRO",
  closing: "CLS",
  reversal: "REV",
  fee: "FEE",
  share_capital_transfer: "SCT",
};

export interface SavingsPassbookOptions extends PrintableBuildOptions {
  /** True when the ledger had more lines than were fetched. */
  truncated?: boolean;
}

/** A debit or credit cell: blank, not a dash, on the side a line doesn't touch. */
function amountCell(value: string): string {
  return isNilAmount(value) ? " " : value;
}

export function buildSavingsPassbookDoc(
  account: SavingsAccount,
  transactions: SavingsTransaction[],
  options: SavingsPassbookOptions = {},
): PrintableDocument {
  // A passbook reads top to bottom in posting order (date, then id), whatever
  // order the pages came in.
  const ordered = [...transactions].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
  );
  const rows = ordered.map((t) => ({
    date: t.date,
    code: TYPE_CODES[t.type] ?? "OTH",
    reference: t.reference,
    withdrawal: amountCell(t.debit),
    deposit: amountCell(t.credit),
    balance: t.balance_after,
    teller: t.created_by?.name ?? "System",
  }));

  const blocks: PrintBlock[] = [
    { kind: "title", text: "Savings Passbook", subtitle: `Account No. ${account.account_number}` },
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Account No.", account.account_number),
        field("Depositor", account.borrower_name),
        field("Member No.", account.borrower_code),
        field("Product", account.product.name),
        field("Branch", account.branch_name),
        field("Opened", dateOrBlank(account.opened_on)),
        field("Balance", currencyOrDash(account.balance)),
        field("Available to withdraw", currencyOrDash(account.available_balance)),
        field("On hold", currencyOrDash(account.hold_amount)),
      ]),
    },
    {
      kind: "table",
      title: "Transactions",
      columns: [
        { key: "date", header: "Date", format: "date", width: "13%" },
        { key: "code", header: "Code", width: "7%" },
        { key: "reference", header: "Reference", width: "18%" },
        { key: "withdrawal", header: "Withdrawal", format: "currency", align: "right", width: "15%" },
        { key: "deposit", header: "Deposit", format: "currency", align: "right", width: "15%" },
        { key: "balance", header: "Balance", format: "currency", align: "right", width: "16%" },
        { key: "teller", header: "Teller", width: "16%" },
      ],
      rows,
      emptyText: "No transactions on this account yet.",
      compact: true,
    },
  ];

  if (options.truncated) {
    blocks.push({
      kind: "note",
      text:
        `Only the ${rows.length} most recent transactions could be printed. ` +
        "Ask the branch for a full statement of this account.",
    });
  }

  blocks.push(
    {
      kind: "note",
      text:
        "Codes: DEP deposit, WDL withdrawal, TRI transfer in, TRO transfer out, INT interest, " +
        "TAX withholding tax, CLS closing payout, REV reversal, FEE excess withdrawal fee, " +
        "SCT transfer to share capital. Report any entry you don't recognise to the branch.",
    },
    {
      kind: "signatures",
      columns: 2,
      blocks: [
        { label: "Depositor", name: account.borrower_name ?? null },
        { label: "Verified by", detail: "Teller" },
      ],
    },
  );

  return {
    id: "savings_passbook",
    subjectId: account.id,
    org: options.org ?? BLANK_ORG,
    title: "Savings Passbook",
    reference: account.account_number,
    generatedAt: generatedAt(options.now),
    blocks,
    footerNote: `Savings Passbook • ${account.account_number}`,
  };
}
