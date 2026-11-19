import { formatCurrency } from "@/lib/format";

/** One item of GET /dashboard/daily-dues `data`, read defensively. */
export interface DailyDueItem {
  id?: number;
  borrower?: string;
  borrower_name?: string;
  loan_id?: number | string;
  loan_account_number?: string;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
  status?: "paid" | "partial" | "overdue" | "pending" | "collected";
}

/** A daily-dues row, after mapping the API response. An amount the server left out is null. */
export type DueItemView = {
  id: number;
  borrower: string;
  loanId: string;
  amountDue: number | null;
  amountPaid: number | null;
  status: "collected" | "partial" | "pending";
};

const STATUS: Record<NonNullable<DailyDueItem["status"]>, DueItemView["status"]> = {
  paid: "collected",
  collected: "collected",
  partial: "partial",
  overdue: "pending",
  pending: "pending",
};

const amount = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The table's rows, each amount as the server sent it. */
export function dueItemViews(items: DailyDueItem[]): DueItemView[] {
  return items.map((item, i) => ({
    id: Number(item.id ?? i + 1),
    borrower: item.borrower ?? item.borrower_name ?? "—",
    loanId: String(item.loan_account_number ?? item.loan_id ?? "—"),
    amountDue: amount(item.amount_due),
    amountPaid: amount(item.amount_paid),
    status: STATUS[item.status ?? "pending"] ?? "pending",
  }));
}

/** ₱ to the centavo; a zero is ₱0.00, and only a missing figure reads "—". */
export function dueAmountLabel(value: number | null): string {
  return value === null ? "—" : formatCurrency(value);
}
