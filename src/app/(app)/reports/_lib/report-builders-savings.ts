import { pick } from "@/lib/api-payload";
import { REPORT_TITLES } from "@/lib/page-titles";
import { countOrDash, currencyOrDash } from "@/lib/report-format";
import { kpi, meta, readListEnvelope, serverTotalsTruncationNote } from "./report-builders";
import type { DateRange, KpiItem, ReportColumn, ReportDocument, ReportSection, SavingsReportId } from "./types";

/**
 * Savings & Deposits reports, payload → document.
 *
 * All seven are one shape: a page of rows from `/reports/savings/*` (read with
 * `getRaw`, so `meta.total` and `totals` survive), KPI cards from the server's
 * totals, and a table whose footer is those same totals. A figure the server
 * did not send is "—", never a sum of the rows on the page.
 */

interface TotalFigure {
  label: string;
  /** Key in the server's `totals` block. */
  key: string;
  /** Table column the figure is footed under, when it is a money column. */
  column?: string;
  kind: "currency" | "count";
  tone?: KpiItem["tone"];
}

interface SavingsReportSpec {
  subtitle: string;
  tableTitle: string;
  /** What one row is, for the truncation note and the first KPI. */
  noun: string;
  countLabel: string;
  emptyText: string;
  columns: ReportColumn[];
  figures: TotalFigure[];
}

const ACCOUNT = { key: "account_number", header: "Account #", format: "text", width: 130 } as const;
const MEMBER = { key: "member_name", header: "Member", format: "text", width: 200 } as const;
const PRODUCT = { key: "product_name", header: "Product", format: "text", width: 150 } as const;
const STATUS = { key: "status", header: "Status", format: "text", width: 100 } as const;
const TX_DATE = { key: "transaction_date", header: "Date", format: "date", width: 110 } as const;
const REFERENCE = { key: "reference_number", header: "Reference", format: "text", width: 140 } as const;
const PROCESSED_BY = { key: "processed_by", header: "Processed By", format: "text", width: 150 } as const;
const money = (key: string, header: string): ReportColumn => ({
  key,
  header,
  format: "currency",
  align: "right",
  width: 130,
});

/** A deposit or withdrawal list; the two differ only in wording. */
function movementSpec(noun: "deposits" | "withdrawals"): SavingsReportSpec {
  const label = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  return {
    subtitle: `Every savings ${noun.slice(0, -1)} posted in the selected period`,
    tableTitle: label,
    noun,
    countLabel: `Total ${label}`,
    emptyText: `No ${noun} were posted in the selected period.`,
    columns: [
      TX_DATE,
      REFERENCE,
      ACCOUNT,
      MEMBER,
      money("amount", "Amount"),
      { key: "payment_method", header: "Method", format: "text", width: 110 },
      PROCESSED_BY,
      STATUS,
    ],
    figures: [{ label: "Total Amount", key: "total_amount", column: "amount", kind: "currency", tone: "positive" }],
  };
}

export const SAVINGS_REPORT_SPECS: Record<SavingsReportId, SavingsReportSpec> = {
  savings_register: {
    subtitle: "Savings accounts opened, with their current status and balance",
    tableTitle: "Accounts",
    noun: "accounts",
    countLabel: "Accounts",
    emptyText: "No savings accounts match the selected period.",
    columns: [
      ACCOUNT,
      MEMBER,
      PRODUCT,
      { key: "branch_name", header: "Branch", format: "text", width: 130 },
      { key: "opened_at", header: "Opened", format: "date", width: 110 },
      STATUS,
      money("balance", "Balance"),
    ],
    figures: [{ label: "Total Balance", key: "total_balance", column: "balance", kind: "currency", tone: "positive" }],
  },
  savings_balances: {
    subtitle: "Each account's balances as of the end of the selected period",
    tableTitle: "Balances",
    noun: "accounts",
    countLabel: "Accounts",
    emptyText: "No savings accounts had a balance as of the selected date.",
    columns: [
      ACCOUNT,
      MEMBER,
      PRODUCT,
      money("ledger_balance", "Ledger Balance"),
      money("available_balance", "Available"),
      money("accrued_interest", "Accrued Interest"),
    ],
    figures: [
      { label: "Ledger Balance", key: "total_ledger_balance", column: "ledger_balance", kind: "currency", tone: "positive" },
      { label: "Available Balance", key: "total_available_balance", column: "available_balance", kind: "currency" },
      { label: "Accrued Interest", key: "total_accrued_interest", column: "accrued_interest", kind: "currency" },
    ],
  },
  savings_deposits: movementSpec("deposits"),
  savings_withdrawals: movementSpec("withdrawals"),
  savings_transfers: {
    subtitle: "Transfers between savings accounts in the selected period",
    tableTitle: "Transfers",
    noun: "transfers",
    countLabel: "Total Transfers",
    emptyText: "No transfers were posted in the selected period.",
    columns: [
      TX_DATE,
      REFERENCE,
      { key: "from_account_number", header: "From Account", format: "text", width: 130 },
      { key: "from_member_name", header: "From Member", format: "text", width: 180 },
      { key: "to_account_number", header: "To Account", format: "text", width: 130 },
      { key: "to_member_name", header: "To Member", format: "text", width: 180 },
      money("amount", "Amount"),
      PROCESSED_BY,
    ],
    figures: [{ label: "Total Transferred", key: "total_amount", column: "amount", kind: "currency" }],
  },
  savings_interest_postings: {
    subtitle: "Interest credited by posted batches in the selected period",
    tableTitle: "Postings",
    noun: "postings",
    countLabel: "Accounts Credited",
    emptyText: "No interest was posted in the selected period.",
    columns: [
      { key: "posted_at", header: "Posted", format: "date", width: 110 },
      { key: "batch_reference", header: "Batch", format: "text", width: 130 },
      ACCOUNT,
      MEMBER,
      money("average_daily_balance", "Avg. Daily Balance"),
      { key: "rate", header: "Rate", format: "rate", align: "right", width: 80 },
      { key: "eligible_days", header: "Days", format: "number", align: "right", width: 70 },
      money("interest_amount", "Interest"),
    ],
    figures: [
      { label: "Total Interest", key: "total_interest", column: "interest_amount", kind: "currency", tone: "positive" },
      { label: "Batches", key: "batch_count", kind: "count" },
    ],
  },
  savings_closed_dormant: {
    subtitle: "Accounts closed or turned dormant in the selected period",
    tableTitle: "Accounts",
    noun: "accounts",
    countLabel: "Accounts",
    emptyText: "No accounts were closed or turned dormant in the selected period.",
    columns: [
      ACCOUNT,
      MEMBER,
      PRODUCT,
      STATUS,
      { key: "status_changed_at", header: "Since", format: "date", width: 110 },
      money("balance", "Balance"),
      { key: "reason", header: "Reason", format: "text", width: 200 },
    ],
    figures: [
      { label: "Closed", key: "closed_count", kind: "count" },
      { label: "Dormant", key: "dormant_count", kind: "count", tone: "negative" },
      { label: "Balance Held", key: "total_balance", column: "balance", kind: "currency" },
    ],
  },
};

/** `transfer_in` → `Transfer in`; the server sends raw codes. */
function codeLabel(value: unknown): unknown {
  if (typeof value !== "string" || value === "") return value;
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `processed_by` may arrive as `{id, name}`; the table wants the name. */
function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const processedBy = raw.processed_by;
  return {
    ...raw,
    status: codeLabel(raw.status),
    payment_method: codeLabel(raw.payment_method),
    processed_by:
      processedBy && typeof processedBy === "object" ? pick(processedBy as Record<string, unknown>, ["name"]) : processedBy,
  };
}

export function buildSavingsReportDoc(id: SavingsReportId, raw: unknown, range: DateRange): ReportDocument {
  const spec = SAVINGS_REPORT_SPECS[id];
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeRow);
  const figure = (f: TotalFigure) => {
    const value = pick(totals, [f.key]);
    return f.kind === "count" ? countOrDash(value) : currencyOrDash(value);
  };

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        // The server's count only: a page length is not a total.
        kpi(spec.countLabel, countOrDash(totalRows)),
        ...spec.figures.map((f) => kpi(f.label, figure(f), f.tone ? { tone: f.tone } : {})),
      ],
    },
  ];

  const note = serverTotalsTruncationNote(rows.length, totalRows, spec.noun, totals);
  if (note) sections.push(note);

  const footer = spec.figures
    .filter((f) => f.column)
    .map((f, i) => ({ column: f.column as string, ...(i === 0 ? { label: "Total" } : {}), value: figure(f) }));

  sections.push({
    kind: "table",
    title: spec.tableTitle,
    columns: spec.columns,
    rows,
    totals: rows.length > 0 && footer.length > 0 ? footer : undefined,
    emptyText: spec.emptyText,
  });

  return { reportId: id, meta: meta(REPORT_TITLES[id], range, spec.subtitle), sections };
}
