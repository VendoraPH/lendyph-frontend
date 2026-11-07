import { asRecord, pick } from "@/lib/api-payload";
import { countOrDash, currencyOrDash, formatGeneratedAt, formatValue } from "@/lib/report-format";
import type { SavingsAccountStatus } from "@/types";
import { ACCOUNT_STATUS_LABELS } from "../../savings/_lib/savings-rules";
import {
  MATURITY_INSTRUCTION_LABELS,
  TD_STATUS_LABELS,
} from "../../savings/_lib/time-deposit-rules";
import { kpi, meta, readListEnvelope, serverTotalsTruncationNote } from "./report-builders";
import type { DateRange, ReportColumn, ReportDocument, ReportSection } from "./types";

/**
 * Savings reports (behind NEXT_PUBLIC_ENABLE_SAVINGS). Same contract as the
 * loan list reports in `report-builders.ts`: rows come one page at a time, and
 * every total is the server's figure for the whole book or period, or "—"
 * when it sent none, never the listed rows added up.
 */

function label(map: Record<string, string>, value: unknown): unknown {
  return typeof value === "string" ? (map[value] ?? value) : value;
}

const BALANCE_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 130 },
  { key: "borrower_name", header: "Member", format: "text", width: 200 },
  { key: "product_name", header: "Product", format: "text", width: 140 },
  { key: "status", header: "Status", format: "text", width: 90 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 130 },
  { key: "hold_amount", header: "On Hold", format: "currency", align: "right", width: 120 },
  { key: "available_balance", header: "Available", format: "currency", align: "right", width: 130 },
  { key: "accrued_interest", header: "Accrued Interest", format: "currency", align: "right", width: 120 },
  { key: "last_transaction_at", header: "Last Activity", format: "date", width: 110 },
];

/**
 * Every savings account and its balances as of today
 * (`GET /reports/savings/balances`). Point in time: the range is not read.
 */
export function buildSavingsBalancesDoc(raw: unknown): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...r,
    status: label(ACCOUNT_STATUS_LABELS as Record<SavingsAccountStatus, string>, r.status),
  }));
  const balance = pick(totals, ["total_balance"]);
  const hold = pick(totals, ["total_hold", "total_hold_amount"]);
  const available = pick(totals, ["total_available", "total_available_balance"]);
  const accrued = pick(totals, ["total_accrued_interest"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows ?? rows.length)),
        kpi("Total Deposits", currencyOrDash(balance), { tone: "positive" }),
        kpi("On Hold", currencyOrDash(hold), { hint: "Loan holds and pending withdrawals" }),
        kpi("Available to Withdraw", currencyOrDash(available)),
        kpi("Accrued Interest", currencyOrDash(accrued), { hint: "Earned, not yet posted" }),
      ],
    },
  ];

  const note = serverTotalsTruncationNote(rows.length, totalRows, "accounts", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Accounts",
    columns: BALANCE_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "balance", label: "Total", value: currencyOrDash(balance) },
            { column: "hold_amount", value: currencyOrDash(hold) },
            { column: "available_balance", value: currencyOrDash(available) },
            { column: "accrued_interest", value: currencyOrDash(accrued) },
          ]
        : undefined,
    emptyText: "No savings accounts.",
    compact: true,
  });

  const obj = asRecord(raw);
  return {
    reportId: "savings_balances",
    meta: {
      title: "Savings Balances",
      subtitle: "Every savings account and its balances",
      asOf: formatValue(pick(obj, ["as_of"]) ?? new Date(), "date"),
      generatedAt: formatGeneratedAt(),
      org: "",
    },
    sections,
  };
}

const MATURITY_COLUMNS: ReportColumn[] = [
  { key: "maturity_date", header: "Maturity", format: "date", width: 100 },
  { key: "certificate_number", header: "Certificate #", format: "text", width: 130 },
  { key: "borrower_name", header: "Member", format: "text", width: 180 },
  { key: "product_name", header: "Product", format: "text", width: 130 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 120 },
  { key: "annual_interest_rate", header: "Rate", format: "rate", align: "right", width: 70 },
  { key: "term_days", header: "Days", format: "number", align: "right", width: 60 },
  { key: "net_interest", header: "Net Interest", format: "currency", align: "right", width: 110 },
  { key: "maturity_amount", header: "Due at Maturity", format: "currency", align: "right", width: 130 },
  { key: "maturity_instruction", header: "Instruction", format: "text", width: 150 },
  { key: "status", header: "Status", format: "text", width: 100 },
];

/**
 * Time deposits maturing in the period, soonest first
 * (`GET /reports/savings/time-deposit-maturities`): what the treasurer must
 * have ready to pay out or roll over.
 */
export function buildTimeDepositMaturitiesDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...r,
    maturity_instruction: label(MATURITY_INSTRUCTION_LABELS, r.maturity_instruction),
    status: label(TD_STATUS_LABELS, r.status),
  }));
  const principal = pick(totals, ["total_principal"]);
  const interest = pick(totals, ["total_net_interest"]);
  const due = pick(totals, ["total_maturity_amount"]);
  const payout = pick(totals, ["payout_amount"]);

  const items = [
    kpi("Maturing", countOrDash(pick(totals, ["count"]) ?? totalRows ?? rows.length)),
    kpi("Principal", currencyOrDash(principal)),
    kpi("Net Interest", currencyOrDash(interest), { hint: "After withholding tax" }),
    kpi("Due at Maturity", currencyOrDash(due), { tone: "positive" }),
  ];
  // Only when the server splits out what leaves the cooperative as cash.
  if (payout !== null) {
    items.push(kpi("To Pay Out", currencyOrDash(payout), { hint: "Placements not set to roll over" }));
  }

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];
  const note = serverTotalsTruncationNote(rows.length, totalRows, "time deposits", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Maturing Time Deposits",
    columns: MATURITY_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "principal", label: "Total", value: currencyOrDash(principal) },
            { column: "net_interest", value: currencyOrDash(interest) },
            { column: "maturity_amount", value: currencyOrDash(due) },
          ]
        : undefined,
    emptyText: "No time deposits mature in the selected period.",
    compact: true,
  });

  return {
    reportId: "time_deposit_maturities",
    meta: meta("Time Deposit Maturities", range, "Placements maturing in the selected period"),
    sections,
  };
}
