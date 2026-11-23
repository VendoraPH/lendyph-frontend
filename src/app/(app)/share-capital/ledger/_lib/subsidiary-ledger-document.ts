/**
 * One member's share capital subsidiary ledger as a report document, so the
 * reports module's PDF exporter and print sheet render it: same letterhead,
 * repeated table headers and "Page X of Y" on every page.
 *
 * Every figure is the server's (GET /share-capital/ledger?borrower_id=): each
 * entry's running balance, and the period's opening balance, totals and
 * closing balance from `meta.summary`. Nothing is added up here. Dependency
 * free (no React), so it runs under `tsx --test`.
 */
import { formatCurrency } from "@/lib/format";
import { formatDateRange, formatGeneratedAt } from "@/lib/report-format";
import type { ReportDocument } from "@/app/(app)/reports/_lib/types";
import type { ShareCapitalLedgerEntry, ShareCapitalMemberPeriod } from "@/types";

export const SUBSIDIARY_LEDGER_TITLE = "Share Capital Subsidiary Ledger";

export interface SubsidiaryLedgerInput {
  member: { name: string; code: string };
  /** Inclusive `YYYY-MM-DD` ends; undefined is an open end. */
  range: { from?: string; to?: string };
  /** As the API lists them: newest first. */
  entries: ShareCapitalLedgerEntry[];
  period: ShareCapitalMemberPeriod;
  generatedAt?: Date;
}

/** A figure the server didn't send prints as a dash, never as ₱0.00. */
function money(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatCurrency(value);
}

/** A debit or credit column: blank where the entry has none. */
function side(value: number): string {
  return value > 0 ? formatCurrency(value) : "";
}

export function subsidiaryLedgerPeriod(range: SubsidiaryLedgerInput["range"]): string {
  return formatDateRange(range.from ?? "", range.to ?? "");
}

export function subsidiaryLedgerDocument(input: SubsidiaryLedgerInput): ReportDocument {
  const { member, range, period } = input;
  const scope = subsidiaryLedgerPeriod(range);
  const openingLabel = range.from ? "Opening Balance (before the period)" : "Opening Balance";
  // Oldest first, the order a ledger reads in; the balances are the server's.
  const rows = [...input.entries].reverse().map((entry) => ({
    date: entry.date,
    reference: entry.reference_number || entry.reference,
    description: entry.description,
    debit: side(entry.debit),
    credit: side(entry.credit),
    balance: money(entry.running_balance),
  }));

  return {
    reportId: "share_capital_ledger",
    meta: {
      title: SUBSIDIARY_LEDGER_TITLE,
      subtitle: `${member.name} (${member.code})`,
      period: scope,
      generatedAt: formatGeneratedAt(input.generatedAt),
      org: "",
      referenceKey: member.code,
    },
    sections: [
      {
        kind: "fields",
        items: [
          { label: "Member Name", value: member.name },
          { label: "Member ID", value: member.code },
          { label: "Date Range", value: scope },
        ],
      },
      {
        kind: "kpi_grid",
        items: [
          { label: openingLabel, value: money(period.opening_balance) },
          { label: "Total Debits", value: money(period.total_debits), tone: "negative" },
          { label: "Total Credits", value: money(period.total_credits), tone: "positive" },
          { label: "Closing Balance", value: money(period.ending_balance) },
        ],
      },
      {
        kind: "table",
        title: "Transactions",
        columns: [
          { key: "date", header: "Date", format: "date", width: 13 },
          { key: "reference", header: "Reference No.", width: 20 },
          { key: "description", header: "Description", width: 31 },
          { key: "debit", header: "Debit", align: "right", width: 12 },
          { key: "credit", header: "Credit", align: "right", width: 12 },
          { key: "balance", header: "Running Balance", align: "right", width: 12 },
        ],
        rows: [
          { date: range.from ?? "", reference: "", description: openingLabel, debit: "", credit: "", balance: money(period.opening_balance) },
          ...rows,
        ],
        // The exporters label the row "Total"; the balance cell is the closing balance.
        totals: [
          { column: "debit", value: money(period.total_debits) },
          { column: "credit", value: money(period.total_credits) },
          { column: "balance", value: money(period.ending_balance) },
        ],
        emptyText: "No transactions in this period.",
      },
    ],
  };
}
