/**
 * The GCash Transactions tab's filtered rows as a report document, for the
 * reports module's PDF and Excel exporters and its print sheet.
 *
 * GET /gcash/transactions sends no totals, so the totals here are the sum of
 * every row the filters match, added in centavos. The caller must hand in the
 * whole set (a drain that was cut short is refused before this runs), or the
 * totals would quietly cover only part of the range. Dependency free, so it
 * runs under `tsx --test`.
 */
import { formatCurrency } from "@/lib/format";
import { formatDateRange, formatGeneratedAt } from "@/lib/report-format";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";
import type { GCashTransaction, GCashTransactionStatus, GCashTransactionType } from "@/types";

export const GCASH_TRANSACTIONS_TITLE = "GCash Transactions Report";

const TYPE_LABEL: Record<GCashTransactionType, string> = { cash_in: "Cash In", cash_out: "Cash Out" };
const STATUS_LABEL: Record<GCashTransactionStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  completed: "Completed",
};

export interface GCashTransactionsReportInput {
  /** Every transaction the filters match, newest first as the API sends them. */
  rows: GCashTransaction[];
  /** Inclusive `YYYY-MM-DD` ends; "" is an open end. */
  from: string;
  to: string;
  type: GCashTransactionType | "all";
  status: GCashTransactionStatus | "all";
  /** The branch column's text for a row, as the tab shows it. */
  branchOf: (row: GCashTransaction) => string;
  generatedAt?: Date;
}

/** Centavos, so a column of ₱0.10s adds up to the peso. */
function cents(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function pesos(centavos: number): string {
  return formatCurrency(centavos / 100);
}

function customer(row: GCashTransaction): string {
  if (row.non_member) return `${row.non_member.full_name} (Walk-in)`;
  return row.borrower?.full_name ?? "—";
}

export function gcashTransactionsReport(input: GCashTransactionsReportInput): ReportDocument {
  const period = formatDateRange(input.from, input.to);
  let amount = 0;
  let charge = 0;
  let total = 0;
  let cashIn = 0;
  let cashOut = 0;
  for (const row of input.rows) {
    amount += cents(row.amount);
    charge += cents(row.charge_amount);
    total += cents(row.total_amount);
    if (row.type === "cash_in") cashIn += cents(row.amount);
    else cashOut += cents(row.amount);
  }

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
          { label: "Transactions", value: String(input.rows.length) },
          { label: "Cash In", value: pesos(cashIn) },
          { label: "Cash Out", value: pesos(cashOut) },
          { label: "Charges", value: pesos(charge), tone: "positive" },
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
          amount: cents(row.amount) / 100,
          charge: cents(row.charge_amount) / 100,
          total: cents(row.total_amount) / 100,
          status: STATUS_LABEL[row.status] ?? row.status,
          transactor: row.transactor_user?.full_name ?? "—",
        })),
        totals: [
          { column: "amount", value: pesos(amount) },
          { column: "charge", value: pesos(charge) },
          { column: "total", value: pesos(total) },
        ],
        emptyText: "No GCash transactions match these filters.",
      },
    ],
  };
}
