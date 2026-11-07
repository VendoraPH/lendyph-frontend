import { formatCurrency } from "@/lib/format";
import { currencyOrDash, toNumber } from "@/lib/report-format";
import type {
  BorrowerLedgerClosing,
  BorrowerLedgerEntry,
  BorrowerLedgerResponse,
} from "@/types/borrower";

export interface LedgerRowCells {
  loan: string;
  reference: string;
  debit: string;
  credit: string;
  /** What the member handed over, only when it differs from the credit. */
  amountPaid: string | null;
  balance: string;
}

export type LedgerClosingCells = Record<keyof BorrowerLedgerClosing, string>;

/** Whole centavos, only to tell two server figures apart. Never shown. */
function centavos(amount: number): number {
  return Math.round(amount * 100);
}

function differingAmountPaid(entry: BorrowerLedgerEntry): string | null {
  const amountPaid = toNumber(entry.amount_paid);
  if (amountPaid === null) return null;
  return centavos(amountPaid) === centavos(toNumber(entry.credit) ?? 0)
    ? null
    : formatCurrency(amountPaid);
}

/**
 * One member ledger row as the Ledger tab prints it, from the figures
 * GET /borrowers/{id}/ledger sends. The side of a row it doesn't use is 0, which
 * reads "—". The balance is the server's: 0 reads ₱0.00, and only a balance it
 * didn't send reads "—". Nothing here adds or subtracts.
 */
export function ledgerRowCells(entry: BorrowerLedgerEntry): LedgerRowCells {
  return {
    loan: entry.loan_account_number || "—",
    reference: entry.reference || "—",
    debit: entry.debit ? formatCurrency(entry.debit) : "—",
    credit: entry.credit ? formatCurrency(entry.credit) : "—",
    amountPaid: differingAmountPaid(entry),
    balance: currencyOrDash(entry.balance),
  };
}

/** The rows and closing balances of a GET /borrowers/{id}/ledger answer. */
export function readMemberLedger(response: BorrowerLedgerResponse): {
  entries: BorrowerLedgerEntry[];
  closing: BorrowerLedgerClosing | null;
} {
  return {
    entries: response.data ?? [],
    closing: response.meta?.closing ?? null,
  };
}

/** The Ledger tab's footer: the server's closing, a dash where it sent none. */
export function ledgerClosingCells(closing: BorrowerLedgerClosing | null): LedgerClosingCells {
  return {
    principal: currencyOrDash(closing?.principal),
    interest: currencyOrDash(closing?.interest),
    penalty: currencyOrDash(closing?.penalty),
    balance: currencyOrDash(closing?.balance),
  };
}

/** The Subsidiary Ledger report, opened with this member selected. */
export function memberLedgerReportHref(borrowerId: number): string {
  return `/reports/subsidiary_ledger?member=${borrowerId}`;
}
