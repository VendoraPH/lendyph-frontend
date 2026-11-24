import { asArray, asRecord, pick } from "@/lib/api-payload";
import {
  countOrDash,
  currencyOrDash,
  formatDateRange,
  formatGeneratedAt,
  formatValue,
  toNumber,
} from "@/lib/report-format";
import { kpi } from "./report-builders";
import type { DateRange, KpiItem, ReportColumn, ReportDocument, ReportSection } from "./types";

/**
 * The Profit Sharing report (GET /reports/profit-sharing; finish run round 2,
 * decision 17): how the year's distributable profit is reached, and each
 * member's share of it by their share capital on the cutoff date.
 *
 * Every figure, line and total is the server's, read as sent; one it didn't
 * send is "—". Nothing is added up, subtracted or shared out here.
 */

const STATEMENT_COLUMNS: ReportColumn[] = [
  { key: "item", header: "Item", format: "text", width: 380 },
  { key: "amount", header: "Amount", format: "currency", align: "right", width: 180 },
];

const MEMBER_COLUMNS: ReportColumn[] = [
  { key: "member_code", header: "Member ID", format: "text", width: 120 },
  { key: "member_name", header: "Member Name", format: "text", width: 210 },
  { key: "share_capital", header: "Share Capital", format: "currency", align: "right", width: 150 },
  // `rate` keeps the four places the server rounds a share to (16.6667%).
  { key: "share_percent", header: "Share %", format: "rate", align: "right", width: 100 },
  { key: "earnings", header: "Earnings", format: "currency", align: "right", width: 140 },
  {
    key: "capital_plus_earnings",
    header: "Capital + Earnings",
    format: "currency",
    align: "right",
    width: 160,
  },
];

/** The profit statement's lines, in order: label and the server's key. */
const PROFIT_LINES: [string, string][] = [
  ["Interest received", "interest_income"],
  ["Penalty received", "penalty_income"],
  ["Loan fees (processing, service and other)", "lending_fees"],
  ["Total lending income", "lending_income"],
  ["Less: expenses", "expenses"],
  ["Less: credit losses", "losses"],
];

const LOSS_LINES: [string, string][] = [
  ["Allowance for credit losses, provided less released", "allowance_for_credit_losses"],
  ["Principal written off by restructures", "principal_written_off"],
  ["Less: written off against the allowance or interest never received", "written_off_covered"],
];

/** Said in the member table's place when the request failed: never "no member holds share capital". */
const LOAD_ERROR = "The profit sharing figures couldn't be loaded. Please generate the report again.";

/** The server's figure for one key, or null when it sent none. */
function figure(block: Record<string, unknown> | null, key: string): number | null {
  return toNumber(pick(block, [key]));
}

function tone(value: number | null): KpiItem["tone"] {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

/** A two-column statement: its lines, and the server's total as its last, bold line. */
function statementSection(
  title: string,
  lines: [string, string][],
  block: Record<string, unknown> | null,
  total: [string, string],
): ReportSection {
  return {
    kind: "table",
    title,
    columns: STATEMENT_COLUMNS,
    rows: lines.map(([item, key]) => ({ item, amount: figure(block, key) })),
    totals: [
      { column: "item", value: total[0] },
      { column: "amount", value: currencyOrDash(figure(block, total[1])) },
    ],
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** What the server says about the sharing beyond the figures, in words. */
function sharingNotes(obj: Record<string, unknown> | null, profit: number | null): ReportSection[] {
  const totals = asRecord(pick(obj, ["totals"]));
  const texts: string[] = [];

  const distribution = pick(obj, ["distribution"]);
  if (distribution === "no_profit") {
    texts.push(
      `There is no profit to share: the distributable profit is ${currencyOrDash(profit)}, so every member's earnings are ₱0.00.`,
    );
  } else if (distribution === "no_share_capital") {
    texts.push("No member holds share capital on the cutoff date, so the profit is not shared.");
  }

  const remainder = figure(totals, "rounding_remainder");
  if (remainder !== null && remainder !== 0) {
    texts.push(
      `Rounding remainder: ${currencyOrDash(remainder)}. It is the distributable profit less the earnings shared, ` +
        "left by rounding each member's share to the centavo, and it is not spread among the members.",
    );
  }

  const leftOut = figure(totals, "members_with_negative_balance");
  if (leftOut !== null && leftOut > 0) {
    texts.push(
      `${countOrDash(leftOut)} ${plural(leftOut, "member", "members")} with a negative share capital balance on the ` +
        `cutoff date ${plural(leftOut, "is", "are")} left out.`,
    );
  }

  return texts.map((text) => ({ kind: "note", text }));
}

export function buildProfitSharingDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const profitBlock = asRecord(pick(obj, ["profit"]));
  const totals = asRecord(pick(obj, ["totals"]));

  const cutoff = String(pick(obj, ["cutoff_date"]) ?? range.to);
  const from = String(pick(obj, ["period_from"]) ?? range.from);
  const asOf = formatValue(cutoff, "date");
  const profit = figure(profitBlock, "distributable_profit");

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Distributable Profit", currencyOrDash(profit), {
          tone: tone(profit),
          hint: formatDateRange(from, cutoff),
        }),
        kpi("Total Share Capital", currencyOrDash(figure(totals, "share_capital")), { hint: `On ${asOf}` }),
        kpi("Members Sharing", countOrDash(figure(totals, "member_count"))),
        kpi("Earnings Shared", currencyOrDash(figure(totals, "earnings"))),
      ],
    },
    statementSection(
      `How the Profit Was Reached, ${formatDateRange(from, cutoff)}`,
      PROFIT_LINES,
      profitBlock,
      ["Distributable profit", "distributable_profit"],
    ),
    statementSection("Credit Losses", LOSS_LINES, profitBlock, ["Credit losses", "losses"]),
  ];

  // A failed request says so, and nothing about the members: an empty table
  // would read as if nobody held share capital.
  if (obj === null) {
    sections.push({ kind: "note", text: LOAD_ERROR });
    return document(sections, asOf);
  }

  // Withheld, not absent: the server's reason stands in the table's place, as
  // the Share Capital report's roster does.
  const omitted = asRecord(pick(obj, ["rows_omitted"]));
  if (omitted) {
    sections.push({ kind: "note", text: String(pick(omitted, ["message"]) ?? "") });
  } else {
    const rows = asArray(pick(obj, ["rows"])).map((row) => ({
      member_code: pick(row, ["member_code"]),
      member_name: pick(row, ["member_name"]),
      share_capital: figure(row, "share_capital"),
      share_percent: figure(row, "share_percent"),
      earnings: figure(row, "earnings"),
      capital_plus_earnings: figure(row, "capital_plus_earnings"),
    }));
    sections.push({
      kind: "table",
      title: "Members' Shares",
      columns: MEMBER_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "share_capital", value: currencyOrDash(figure(totals, "share_capital")) },
              { column: "share_percent", value: formatValue(figure(totals, "share_percent"), "rate") },
              { column: "earnings", value: currencyOrDash(figure(totals, "earnings")) },
              {
                column: "capital_plus_earnings",
                value: currencyOrDash(figure(totals, "capital_plus_earnings")),
              },
            ]
          : undefined,
      emptyText: "No member holds share capital on the cutoff date.",
    });
  }

  sections.push(...sharingNotes(obj, profit));

  // The definition is the owner's to confirm; the server words it.
  const basis = pick(obj, ["basis_note"]);
  if (typeof basis === "string" && basis.trim() !== "") {
    sections.push({ kind: "note", text: basis });
  }

  return document(sections, asOf);
}

function document(sections: ReportSection[], asOf: string): ReportDocument {
  return {
    reportId: "profit_sharing",
    meta: {
      title: "Profit Sharing",
      subtitle: "Each member's share of the whole cooperative's distributable profit, by share capital on the cutoff date",
      asOf,
      generatedAt: formatGeneratedAt(),
      org: "",
    },
    sections,
  };
}
