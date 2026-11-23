/**
 * The GCash Transactions tab's filtered rows as a report document, for the
 * reports module's PDF and Excel exporters and its print sheet.
 *
 * Every figure is the server's: each row's amounts as sent, and the summary and
 * table totals from `meta.totals`. A total the server didn't send reads "—",
 * never a sum of the rows. The caller hands in the whole set (a drain that was
 * cut short is refused before this runs). Dependency free, so it runs under
 * `tsx --test`.
 */
import { countOrDash, currencyOrDash, formatDateRange, formatGeneratedAt, toNumber } from "@/lib/report-format";
import type { DrainResult } from "@/lib/paginate";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";
import type {
  GCashTransaction,
  GCashTransactionStatus,
  GCashTransactionTotals,
  GCashTransactionType,
} from "@/types";

export const GCASH_TRANSACTIONS_TITLE = "GCash Transactions Report";

/** The refusal when the list moved under the export (see `transactionsExportRefusal`). */
export const TRANSACTIONS_CHANGED = "The transactions changed while the report was being made. Please try again.";

const TYPE_LABEL: Record<GCashTransactionType, string> = { cash_in: "Cash In", cash_out: "Cash Out" };
const STATUS_LABEL: Record<GCashTransactionStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  completed: "Completed",
};

export interface GCashTransactionsReportInput {
  /** Every transaction the filters match, newest first as the API sends them. */
  rows: GCashTransaction[];
  /** `meta.total`: how many transactions match. Null when the server didn't say. */
  total: number | null;
  /** `meta.totals` over every matching transaction. Null when the server sent none. */
  totals: GCashTransactionTotals | null;
  /** Inclusive `YYYY-MM-DD` ends; "" is an open end. */
  from: string;
  to: string;
  type: GCashTransactionType | "all";
  status: GCashTransactionStatus | "all";
  /** The branch column's text for a row, as the tab shows it. */
  branchOf: (row: GCashTransaction) => string;
  generatedAt?: Date;
}

/** The Charges tile's qualifier: a pending Cash In's charge isn't income until it's paid. */
function pendingChargesHint(totals: GCashTransactionTotals | null): string | undefined {
  const pending = totals?.pending;
  if (!pending || !(Number(pending.count) > 0)) return undefined;
  return `${currencyOrDash(pending.charges)} pending, not yet income`;
}

/** What `gcashService.listAllTransactions` hands back for the export. */
export type DrainedTransactions = Pick<DrainResult<GCashTransaction>, "rows" | "total" | "truncated"> & {
  totals: GCashTransactionTotals | null;
};

/**
 * Why the drained transactions can't be made into one report, or null when
 * they can. A list cut short is refused. So is one that moved while its pages
 * were read: the totals come from page 1, and a transaction recorded or marked
 * paid before a later page shifts the pages, so a row repeats or goes missing
 * and the rows no longer match the totals. Without totals only the repeat can
 * be seen.
 */
export function transactionsExportRefusal(drain: DrainedTransactions): string | null {
  if (drain.truncated) {
    return `Only ${drain.rows.length}${drain.total ? ` of ${drain.total}` : ""} transactions could be loaded. Narrow the date range and try again.`;
  }
  const repeated = new Set(drain.rows.map((row) => row.id)).size !== drain.rows.length;
  const count = toNumber(drain.totals?.count);
  const countOff = count !== null && count !== drain.rows.length;
  return repeated || countOff ? TRANSACTIONS_CHANGED : null;
}

function customer(row: GCashTransaction): string {
  if (row.non_member) return `${row.non_member.full_name} (Walk-in)`;
  return row.borrower?.full_name ?? "—";
}

export function gcashTransactionsReport(input: GCashTransactionsReportInput): ReportDocument {
  const period = formatDateRange(input.from, input.to);
  const totals = input.totals;

  return {
    reportId: "gcash_transactions",
    meta: {
      title: GCASH_TRANSACTIONS_TITLE,
      period,
      generatedAt: formatGeneratedAt(input.generatedAt),
      org: "",
    },
    sections: [
      {
        kind: "fields",
        items: [
          { label: "Date Range", value: period },
          { label: "Type", value: input.type === "all" ? "All" : TYPE_LABEL[input.type] },
          { label: "Status", value: input.status === "all" ? "All" : STATUS_LABEL[input.status] },
        ],
      },
      {
        kind: "kpi_grid",
        items: [
          { label: "Transactions", value: countOrDash(totals?.count ?? input.total) },
          { label: "Cash In", value: currencyOrDash(totals?.cash_in) },
          { label: "Cash Out", value: currencyOrDash(totals?.cash_out) },
          {
            label: "Charges",
            value: currencyOrDash(totals?.charges),
            hint: pendingChargesHint(totals),
            tone: "positive",
          },
        ],
      },
      {
        kind: "table",
        title: "Transactions",
        compact: true,
        columns: [
          { key: "date", header: "Date", format: "date" },
          { key: "reference", header: "Reference No." },
          { key: "customer", header: "Customer" },
          { key: "branch", header: "Branch" },
          { key: "type", header: "Type" },
          { key: "amount", header: "Amount", format: "currency", align: "right" },
          { key: "charge", header: "Charge", format: "currency", align: "right" },
          { key: "total", header: "Total", format: "currency", align: "right" },
          { key: "status", header: "Status" },
          { key: "transactor", header: "Transactor" },
        ],
        rows: input.rows.map((row) => ({
          date: row.transaction_date,
          reference: row.reference_no,
          customer: customer(row),
          branch: input.branchOf(row),
          type: TYPE_LABEL[row.type] ?? row.type,
          amount: row.amount,
          charge: row.charge_amount,
          total: row.total_amount,
          status: STATUS_LABEL[row.status] ?? row.status,
          transactor: row.transactor_user?.full_name ?? "—",
        })),
        totals: [
          { column: "amount", value: currencyOrDash(totals?.amount) },
          { column: "charge", value: currencyOrDash(totals?.charges) },
          { column: "total", value: currencyOrDash(totals?.total) },
        ],
        emptyText: "No GCash transactions match these filters.",
      },
    ],
  };
}
