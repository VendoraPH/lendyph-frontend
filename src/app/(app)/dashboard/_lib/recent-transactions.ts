import { toNumber } from "@/lib/report-format";

/** One row of GET /dashboard/recent-transactions, as the server may send it. */
interface RecentTransactionItem {
  id?: number;
  type?: string;
  name?: string;
  borrower_name?: string;
  description?: string;
  desc?: string;
  amount?: number | string | null;
  date?: string;
  created_at?: string;
}

/** What the dashboard's Recent Transactions table renders for one row. */
export interface RecentTransactionRow {
  /** Unique within the list: payments and releases can share an id. */
  key: string;
  name: string;
  desc: string;
  /** The server's amount; null when it sent none (a dash on screen). */
  amount: number | null;
  /** As the server formatted it ("Nov 10, 3:15 PM"). */
  date: string;
  color: string;
}

const SHOWN = 10;
const PALETTE = ["bg-purple-500", "bg-orange-500", "bg-green-500", "bg-blue-500"];

function items(res: unknown): RecentTransactionItem[] {
  if (Array.isArray(res)) return res as RecentTransactionItem[];
  const data = res && typeof res === "object" ? (res as { data?: unknown }).data : undefined;
  return Array.isArray(data) ? (data as RecentTransactionItem[]) : [];
}

/**
 * The server's rows, in the server's order (newest first across payments,
 * releases and restructures): never re-sorted or grouped here. The first 10
 * are shown.
 */
export function recentTransactionRows(res: unknown): RecentTransactionRow[] {
  return items(res)
    .slice(0, SHOWN)
    .map((tx, i) => ({
      key: `${i}-${tx.type ?? "row"}-${tx.id ?? ""}`,
      name: tx.name ?? tx.borrower_name ?? "—",
      desc: tx.description ?? tx.desc ?? (tx.type === "release" ? "Loan released" : "Payment received"),
      amount: toNumber(tx.amount),
      date: tx.date ?? tx.created_at ?? "",
      color: PALETTE[i % PALETTE.length]!,
    }));
}
