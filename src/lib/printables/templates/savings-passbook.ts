/**
 * Savings passbook: one account's ledger, oldest first, as the member's
 * printed record.
 *
 * Laid out the way a Philippine bank or cooperative passbook page is: the
 * account number and name, then numbered lines of Date, Code, Withdrawal,
 * Deposit, Balance and the teller's initials. No letterhead, title, account
 * summary or signature lines (`layout: "passbook"`): the passbook is the
 * depositor's ledger, not a certified statement.
 *
 * Built from a loaded `SavingsAccount` and its transactions
 * (`GET /savings/accounts/{id}/transactions`), not through the `/printables`
 * catalog. The running balance on every line, and the balances in the header,
 * are the server's, printed as sent and never summed here. A ledger can be
 * longer than the pages fetched, so a truncated passbook says so instead of
 * passing for the whole history.
 */

import type { SavingsAccount, SavingsTransaction, SavingsTransactionType } from "@/types";
import { formatCurrency } from "@/lib/format";
import { isNilAmount } from "@/lib/savings/amount-text";
import type { PrintableDocument, PrintBlock } from "../types";
import { BLANK_ORG, field, generatedAt, presentFields, type PrintableBuildOptions } from "./shared";

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

/**
 * The teller column of a passbook carries initials, not names: "Teller One"
 * prints TO. A line the system posted (interest, tax, a batch) prints SYS.
 */
export function tellerInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "SYS";
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * A passbook figure: the server's amount with two decimals and no peso sign,
 * as a passbook printer writes it. Pre-formatted here as text, because the
 * table's `currency` format reads a blank cell as zero and printed "₱0.00".
 */
function passbookAmount(value: string): string {
  return formatCurrency(value).replace("₱", "");
}

/** A debit or credit cell: blank, not 0.00, on the side a line doesn't touch. */
function amountCell(value: string): string {
  return isNilAmount(value) ? " " : passbookAmount(value);
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
  const rows = ordered.map((t, i) => ({
    line: String(i + 1),
    date: t.date,
    code: TYPE_CODES[t.type] ?? "OTH",
    withdrawal: amountCell(t.debit),
    deposit: amountCell(t.credit),
    balance: passbookAmount(t.balance_after),
    teller: tellerInitials(t.created_by?.name),
  }));

  const blocks: PrintBlock[] = [
    {
      kind: "fields",
      columns: 2,
      items: presentFields([
        field("Account No.", account.account_number),
        field("Account Name", account.borrower_name),
      ]),
    },
    {
      kind: "table",
      columns: [
        { key: "line", header: "No.", align: "right", width: "6%" },
        { key: "date", header: "Date", format: "date", width: "16%" },
        { key: "code", header: "Code", align: "center", width: "8%" },
        { key: "withdrawal", header: "Withdrawal", align: "right", width: "20%" },
        { key: "deposit", header: "Deposit", align: "right", width: "20%" },
        { key: "balance", header: "Balance", align: "right", width: "20%" },
        { key: "teller", header: "Teller", align: "center", width: "10%" },
      ],
      rows,
      emptyText: "No transactions on this account yet.",
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

  blocks.push({
    kind: "note",
    text:
      "Codes: DEP deposit, WDL withdrawal, TRI transfer in, TRO transfer out, INT interest, " +
      "TAX withholding tax, CLS closing payout, REV reversal, FEE excess withdrawal fee, " +
      "SCT transfer to share capital, SYS posted by the system.",
  });

  return {
    id: "savings_passbook",
    subjectId: account.id,
    org: options.org ?? BLANK_ORG,
    title: "Savings Passbook",
    reference: account.account_number,
    generatedAt: generatedAt(options.now),
    layout: "passbook",
    blocks,
  };
}
