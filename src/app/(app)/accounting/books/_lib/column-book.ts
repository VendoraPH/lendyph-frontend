import { formatCentavos } from "@/lib/accounting/money";
import type { ColumnBook, ColumnBookKind, ColumnBookRow } from "@/types";

/**
 * Turns the server's column book into table cells.
 *
 * The server keys a row's money by account id and its columns by mapping
 * role, and leaves a key out when the row has no amount there. The table needs
 * one cell per heading in the server's order, so this lays each map out
 * against the headings. It formats figures and never works one out: the
 * footer is the server's `totals`, and a total it didn't send is a dash.
 */

export type BookView = "columns" | "lines";

/** The Cash Receipts and Cash Disbursements view switch, Columns first. */
export const BOOK_VIEW_ITEMS: ReadonlyArray<{ value: BookView; label: string }> = [
  { value: "columns", label: "Columns" },
  { value: "lines", label: "Lines" },
];

export function isBookView(value: unknown): value is BookView {
  return BOOK_VIEW_ITEMS.some((item) => item.value === value);
}

type Side = "Dr" | "Cr";

/** Receipts debit the money accounts and credit the columns; disbursements mirror it. */
export function sideLabels(kind: ColumnBookKind): { money: Side; columns: Side } {
  return kind === "cash_receipts"
    ? { money: "Dr", columns: "Cr" }
    : { money: "Cr", columns: "Dr" };
}

export interface ColumnHead {
  key: string;
  label: string;
}

export function columnBookHeads(book: ColumnBook): { money: ColumnHead[]; columns: ColumnHead[] } {
  return {
    money: book.money_columns.map((column) => ({
      key: String(column.account_id),
      label: `${column.account_code} ${column.account_name}`,
    })),
    columns: book.columns.map((column) => ({ key: column.key, label: column.label })),
  };
}

type Amount = number | string | null | undefined;

/** A cell with no amount is empty. */
export function cellText(value: Amount): string {
  return value === null || value === undefined || Number(value) === 0
    ? ""
    : formatCentavos(Number(value));
}

/** A zero total is ₱0.00; a total the server didn't send is a dash. */
export function totalText(value: Amount): string {
  return value === null || value === undefined ? "—" : formatCentavos(Number(value));
}

export interface SundryCell {
  key: string;
  account: string;
  debit: string;
  credit: string;
}

export interface ColumnBookRowCells {
  key: string;
  date: string;
  journalNo: string;
  reference: string;
  particulars: string;
  money: string[];
  columns: string[];
  sundry: SundryCell[];
}

function laidOut(heads: ColumnHead[], values: Partial<Record<string, Amount>>, text: (v: Amount) => string) {
  return heads.map((head) => text(values[head.key]));
}

export function columnBookRowCells(book: ColumnBook, row: ColumnBookRow): ColumnBookRowCells {
  const heads = columnBookHeads(book);
  return {
    key: String(row.journal_id),
    date: row.date,
    journalNo: row.journal_no,
    reference: row.reference || "—",
    particulars: row.particulars,
    money: laidOut(heads.money, row.money, cellText),
    columns: laidOut(heads.columns, row.columns, cellText),
    sundry: row.sundry.map((line, index) => ({
      key: String(index),
      account: `${line.account_code} ${line.account_name}`,
      debit: cellText(line.debit),
      credit: cellText(line.credit),
    })),
  };
}

export interface ColumnBookFooter {
  money: string[];
  columns: string[];
  sundryDebit: string;
  sundryCredit: string;
}

export function columnBookFooter(book: ColumnBook): ColumnBookFooter {
  const heads = columnBookHeads(book);
  return {
    money: laidOut(heads.money, book.totals.money, totalText),
    columns: laidOut(heads.columns, book.totals.columns, totalText),
    sundryDebit: totalText(book.totals.sundry_debit),
    sundryCredit: totalText(book.totals.sundry_credit),
  };
}

export function balanceBadge(book: ColumnBook): { label: string; balanced: boolean } {
  return book.is_balanced
    ? { label: "Balanced", balanced: true }
    : { label: "Doesn't balance", balanced: false };
}
