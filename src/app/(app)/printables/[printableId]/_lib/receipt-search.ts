import type { SearchPage } from "@/hooks/use-search-page";
import { formatCurrency, formatDate } from "@/lib/format";

/** Rows per search, and what shows before typing. The status line says when there are more. */
const RECEIPT_PAGE_SIZE = 25;

export interface ReceiptOption {
  id: number;
  label: string;
  hint: string;
}

/** The fields `RepaymentResource` sends that the `Repayment` type omits. */
export interface ReceiptRow {
  id: number;
  receipt_number?: string;
  borrower_name?: string;
  amount_paid?: number;
  payment_date?: string;
  status?: string;
}

export function receiptSearchParams(query: string): Record<string, unknown> {
  return { per_page: RECEIPT_PAGE_SIZE, ...(query ? { search: query } : {}) };
}

export function toReceiptOption(row: ReceiptRow): ReceiptOption {
  return {
    id: row.id,
    label: row.receipt_number ?? `Payment #${row.id}`,
    hint: [
      row.borrower_name,
      row.amount_paid !== undefined ? formatCurrency(row.amount_paid) : null,
      row.payment_date ? formatDate(row.payment_date) : null,
      // A voided payment is still printable, as a VOID receipt, so it stays in
      // the list, labelled before it is chosen.
      row.status === "voided" ? "VOID" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** One page for one query: `GET /repayments` searches the receipt, loan account and name. */
export async function fetchReceiptPage(
  list: (params: Record<string, unknown>) => Promise<{ data?: unknown[]; meta?: { total?: number } }>,
  query: string,
): Promise<SearchPage<ReceiptOption>> {
  const response = await list(receiptSearchParams(query));
  const rows = ((response.data ?? []) as ReceiptRow[]).map(toReceiptOption);
  return { query, rows, total: response.meta?.total ?? rows.length };
}
