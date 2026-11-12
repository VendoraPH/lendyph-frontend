import { asArray, asRecord, pick } from "@/lib/api-payload";
import { countOrDash, currencyOrDash } from "@/lib/report-format";
import {
  ACCOUNT_STATUS_LABELS,
  METHOD_LABELS,
  SKIP_REASON_LABELS,
  TRANSACTION_TYPE_LABELS,
  labelOf,
} from "../../savings/_lib/savings-rules";
import {
  MATURITY_INSTRUCTION_LABELS,
  TD_STATUS_LABELS,
} from "../../savings/_lib/time-deposit-rules";
import { kpi, meta, readListEnvelope, serverTotalsTruncationNote } from "./report-builders";
import { inWords, pointInTimeMeta, rateText, text } from "./savings-report-builders";
import type { DateRange, FieldItem, ReportColumn, ReportDocument, ReportSection } from "./types";

/**
 * The rest of the Savings task's deposit reports (gap round S5), built like
 * the first seven in `savings-report-builders.ts`: rows one page at a time,
 * every total the server's figure for the whole filter (or "—" when it sent
 * none), and statuses, types and methods in words.
 */

type Totals = Record<string, unknown> | null;

/** The table's totals row, each figure read from the server's totals. */
function totalsRow(
  rowCount: number,
  totals: Totals,
  columns: readonly (readonly [column: string, field: string])[],
  label = "Total",
): { column: string; label?: string; value: string }[] | undefined {
  if (rowCount === 0) return undefined;
  return columns.map(([column, field], i) => ({
    column,
    ...(i === 0 ? { label } : {}),
    value: currencyOrDash(pick(totals, [field])),
  }));
}

/** A list report's table, with the truncation note when the page is short of the filter. */
function listSections(
  kpis: ReportSection,
  rows: Record<string, unknown>[],
  totalRows: number | null,
  totals: Totals,
  noun: string,
  table: Omit<Extract<ReportSection, { kind: "table" }>, "kind" | "rows">,
): ReportSection[] {
  const sections: ReportSection[] = [kpis];
  const note = serverTotalsTruncationNote(rows.length, totalRows, noun, totals);
  if (note) sections.push(note);
  sections.push({ kind: "table", rows, compact: true, ...table });
  return sections;
}

// ── Deposit Summary (by branch or product) ──

const SUMMARY_MOVEMENT: readonly [key: string, header: string][] = [
  ["opening_balance", "Opening"],
  ["deposits", "Deposits"],
  ["withdrawals", "Withdrawals"],
  ["interest_credited", "Interest"],
  ["tax_withheld", "Tax Withheld"],
  ["fees_charged", "Fees"],
  ["other_movements", "Other"],
  ["net_movement", "Net Movement"],
  ["closing_balance", "Closing"],
];

const SUMMARY_HOLDINGS_MONEY: readonly [key: string, header: string][] = [
  ["time_deposits", "Time Deposits"],
  ["time_deposits_placed", "Placed"],
  ["time_deposit_interest", "TD Interest Paid"],
  ["interest_expense", "Interest Expense"],
  ["total_deposits", "Total Deposits"],
];

function moneyColumns(list: readonly [string, string][]): ReportColumn[] {
  return list.map(([key, header]) => ({ key, header, format: "currency", align: "right", width: 105 }));
}

/**
 * The period by branch or by product (`GET /reports/savings/summary`), the
 * task's Deposit Summary, Product Performance and Branch Deposit reports. Two
 * tables: the savings movement, then accounts and time deposits.
 */
export function buildSavingsSummaryDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const totals = asRecord(pick(obj, ["totals"]));
  const rows = asArray(pick(obj, ["rows"]));
  const byProduct = pick(obj, ["group_by"]) === "product";
  const group: ReportColumn = { key: "group_name", header: byProduct ? "Product" : "Branch", format: "text", width: 140 };
  const money = (field: string) => currencyOrDash(pick(totals, [field]));

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Opening Balance", money("opening_balance")),
        kpi("Deposits", money("deposits"), { tone: "positive" }),
        kpi("Withdrawals", money("withdrawals"), { hint: "Withdrawals and closing payouts" }),
        kpi("Net Movement", money("net_movement"), { hint: "Closing less opening" }),
        kpi("Closing Balance", money("closing_balance")),
        kpi("Interest Credited", money("interest_credited")),
        kpi("Fees Charged", money("fees_charged"), { hint: "Excess-withdrawal fees, the cooperative's income" }),
        kpi("Total Deposits", money("total_deposits"), { hint: "Savings plus time deposits outstanding" }),
      ],
    },
    {
      kind: "table",
      title: "Savings Movement",
      columns: [group, ...moneyColumns(SUMMARY_MOVEMENT)],
      rows,
      totals: totalsRow(rows.length, totals, SUMMARY_MOVEMENT.map(([key]) => [key, key] as const)),
      emptyText: byProduct ? "No savings products." : "No branches.",
      compact: true,
    },
    {
      kind: "table",
      title: "Accounts and Time Deposits",
      columns: [
        group,
        { key: "new_accounts", header: "New Accounts", format: "number", align: "right", width: 80 },
        { key: "open_accounts", header: "Open Accounts", format: "number", align: "right", width: 80 },
        { key: "time_deposit_count", header: "Time Deposits (No.)", format: "number", align: "right", width: 80 },
        ...moneyColumns(SUMMARY_HOLDINGS_MONEY),
      ],
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "new_accounts", label: "Total", value: countOrDash(pick(totals, ["new_accounts"])) },
              { column: "open_accounts", value: countOrDash(pick(totals, ["open_accounts"])) },
              { column: "time_deposit_count", value: countOrDash(pick(totals, ["time_deposit_count"])) },
              ...SUMMARY_HOLDINGS_MONEY.map(([key]) => ({ column: key, value: money(key) })),
            ]
          : undefined,
      emptyText: byProduct ? "No savings products." : "No branches.",
      compact: true,
    },
    {
      kind: "note",
      text: "Totals are the server's figures for the whole filter. Fees are excess-withdrawal fees, never counted as withdrawals; money moved between a member's savings and their time deposits is neither a deposit nor a withdrawal. Reversed transactions count in no flow.",
    },
  ];

  return {
    reportId: "savings_summary",
    meta: meta("Deposit Summary", range, byProduct ? "Savings by product" : "Savings by branch"),
    sections,
  };
}

// ── Account Listing ──

const ACCOUNT_LIST_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 170 },
  { key: "product_name", header: "Product", format: "text", width: 120 },
  { key: "branch_name", header: "Branch", format: "text", width: 100 },
  { key: "status", header: "Status", format: "text", width: 70 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 110 },
  { key: "opened_on", header: "Opened", format: "date", width: 90 },
  { key: "closed_on", header: "Closed", format: "date", width: 90 },
  { key: "dormant_since", header: "Dormant Since", format: "date", width: 90 },
  { key: "last_member_activity_on", header: "Last Activity", format: "date", width: 90 },
  { key: "account_officer", header: "Account Officer", format: "text", width: 120 },
];

/** Every savings account, closed ones too (`GET /reports/savings/accounts`), as of today. */
export function buildSavingsAccountListDoc(raw: unknown): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...inWords(r, { status: ACCOUNT_STATUS_LABELS }),
    account_officer: text(pick(asRecord(r.account_officer), ["name"])),
  }));
  const count = (field: string) => countOrDash(pick(totals, [field]));

  return {
    reportId: "savings_accounts",
    meta: pointInTimeMeta("Savings Account Listing", "Every savings account, its status and balance", raw),
    sections: listSections(
      {
        kind: "kpi_grid",
        items: [
          kpi("Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows)),
          kpi("Active", count("active_count")),
          kpi("Dormant", count("dormant_count")),
          kpi("Frozen", count("frozen_count")),
          kpi("Closed", count("closed_count")),
          kpi("Total Balance", currencyOrDash(pick(totals, ["total_balance"])), { tone: "positive" }),
        ],
      },
      rows,
      totalRows,
      totals,
      "accounts",
      {
        title: "Accounts",
        columns: ACCOUNT_LIST_COLUMNS,
        totals: totalsRow(rows.length, totals, [["balance", "total_balance"]]),
        emptyText: "No savings accounts.",
      },
    ),
  };
}

// ── Deposits, withdrawals and large transactions ──

const FLOW_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 85 },
  { key: "reference", header: "Reference", format: "text", width: 120 },
  { key: "account_number", header: "Account #", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 160 },
  { key: "product_name", header: "Product", format: "text", width: 110 },
  { key: "branch_name", header: "Branch", format: "text", width: 90 },
  { key: "type", header: "Type", format: "text", width: 90 },
  { key: "method", header: "Method", format: "text", width: 90 },
  { key: "amount", header: "Amount", format: "currency", align: "right", width: 110 },
  { key: "balance_after", header: "Balance", format: "currency", align: "right", width: 110 },
  { key: "reversed", header: "Reversed", format: "text", width: 130 },
];

/** "Reversed by SVT-… on <date>", or a dash: a reversed row stays listed and counts in no total. */
function reversedText(row: Record<string, unknown>): string {
  if (row.reversed !== true) return "—";
  const ref = typeof row.reversed_by_reference === "string" ? ` by ${row.reversed_by_reference}` : "";
  const on = typeof row.reversed_on === "string" ? ` on ${row.reversed_on}` : "";
  return `Reversed${ref}${on}`;
}

function flowRows(raw: unknown) {
  const envelope = readListEnvelope(raw);
  const rows = envelope.rows.map((r) => ({
    ...inWords(r, { type: TRANSACTION_TYPE_LABELS, method: METHOD_LABELS }),
    method: r.method ? labelOf(METHOD_LABELS, String(r.method)) : "—",
    reversed: reversedText(r),
  }));
  return { ...envelope, rows };
}

const REVERSED_HINT = "Listed, but left out of every total";

function flowDoc(
  raw: unknown,
  range: DateRange,
  spec: {
    reportId: ReportDocument["reportId"];
    title: string;
    subtitle: string;
    noun: string;
    countLabel: string;
    amountLabel: string;
    /** The server's total the Amount column closes on. */
    amountTotal: "total_credit" | "total_debit" | "total_amount";
    empty: string;
    extraKpis?: (totals: Totals) => ReturnType<typeof kpi>[];
  },
): ReportDocument {
  const { rows, totals, totalRows } = flowRows(raw);
  return {
    reportId: spec.reportId,
    meta: meta(spec.title, range, spec.subtitle),
    sections: listSections(
      {
        kind: "kpi_grid",
        items: [
          kpi(spec.countLabel, countOrDash(pick(totals, ["count"]) ?? totalRows)),
          kpi("Reversed", countOrDash(pick(totals, ["reversed_count"])), { hint: REVERSED_HINT }),
          kpi(spec.amountLabel, currencyOrDash(pick(totals, [spec.amountTotal])), { hint: "Reversed transactions left out" }),
          ...(spec.extraKpis?.(totals) ?? []),
        ],
      },
      rows,
      totalRows,
      totals,
      spec.noun,
      {
        title: spec.title,
        columns: FLOW_COLUMNS,
        totals: totalsRow(rows.length, totals, [["amount", spec.amountTotal]]),
        emptyText: spec.empty,
      },
    ),
  };
}

/** Deposits dated in the period (`GET /reports/savings/deposits`); money from a time deposit is left out. */
export function buildSavingsDepositsDoc(raw: unknown, range: DateRange): ReportDocument {
  return flowDoc(raw, range, {
    reportId: "savings_deposits",
    title: "Savings Deposits",
    subtitle: "Deposits posted in the period",
    noun: "deposits",
    countLabel: "Deposits",
    amountLabel: "Amount Deposited",
    amountTotal: "total_credit",
    empty: "No deposits in the selected period.",
  });
}

/** Withdrawals and closing payouts (`GET /reports/savings/withdrawals`); money into a time deposit is left out. */
export function buildSavingsWithdrawalsDoc(raw: unknown, range: DateRange): ReportDocument {
  return flowDoc(raw, range, {
    reportId: "savings_withdrawals",
    title: "Savings Withdrawals",
    subtitle: "Withdrawals and closing payouts posted in the period",
    noun: "withdrawals",
    countLabel: "Withdrawals",
    amountLabel: "Amount Withdrawn",
    amountTotal: "total_debit",
    empty: "No withdrawals in the selected period.",
  });
}

/** Deposits, withdrawals and payouts at the alert amount or more (`GET /reports/savings/large-transactions`). */
export function buildSavingsLargeTransactionsDoc(raw: unknown, range: DateRange): ReportDocument {
  const threshold = pick(asRecord(raw), ["threshold"]) ?? pick(asRecord(pick(asRecord(raw), ["meta"])), ["threshold"]);
  return flowDoc(raw, range, {
    reportId: "savings_large_transactions",
    title: "Large Savings Transactions",
    subtitle: "Deposits, withdrawals and closing payouts at the large-transaction alert amount or more",
    noun: "transactions",
    countLabel: "Transactions",
    amountLabel: "Total Amount",
    amountTotal: "total_amount",
    empty: "No large transactions in the selected period.",
    extraKpis: (totals) => [
      kpi("Money In", currencyOrDash(pick(totals, ["total_credit"])), { tone: "positive" }),
      kpi("Money Out", currencyOrDash(pick(totals, ["total_debit"]))),
      kpi("Alert Amount", currencyOrDash(threshold), { hint: "From Savings Settings" }),
    ],
  });
}

// ── Time Deposits Outstanding ──

const TIME_DEPOSIT_COLUMNS: ReportColumn[] = [
  { key: "certificate_number", header: "Certificate #", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 160 },
  { key: "product_name", header: "Product", format: "text", width: 110 },
  { key: "placement_date", header: "Placed", format: "date", width: 85 },
  { key: "maturity_date", header: "Maturity", format: "date", width: 85 },
  { key: "days_to_maturity", header: "Days Left", format: "number", align: "right", width: 60 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 110 },
  { key: "annual_rate", header: "Rate", format: "text", align: "right", width: 60 },
  { key: "net_interest", header: "Net Interest", format: "currency", align: "right", width: 100 },
  { key: "maturity_amount", header: "Due at Maturity", format: "currency", align: "right", width: 115 },
  { key: "maturity_instruction", header: "Instruction", format: "text", width: 140 },
  { key: "status", header: "Status", format: "text", width: 70 },
];

/** Time deposits placed and not settled by the end of today (`GET /reports/savings/time-deposits`). */
export function buildSavingsTimeDepositsDoc(raw: unknown): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...inWords(r, { maturity_instruction: MATURITY_INSTRUCTION_LABELS, status: TD_STATUS_LABELS }),
    annual_rate: rateText(r.annual_rate),
  }));
  const money = (field: string) => currencyOrDash(pick(totals, [field]));

  return {
    reportId: "savings_time_deposits",
    meta: pointInTimeMeta("Time Deposits Outstanding", "Placed and not yet settled", raw),
    sections: listSections(
      {
        kind: "kpi_grid",
        items: [
          kpi("Time Deposits", countOrDash(pick(totals, ["count"]) ?? totalRows)),
          kpi("Principal", money("total_principal"), { tone: "positive", hint: "The GL control's 2060 subledger" }),
          kpi("Net Interest", money("total_net_interest"), { hint: "After withholding tax" }),
          kpi("Due at Maturity", money("total_maturity_amount")),
        ],
      },
      rows,
      totalRows,
      totals,
      "time deposits",
      {
        title: "Time Deposits",
        columns: TIME_DEPOSIT_COLUMNS,
        totals: totalsRow(rows.length, totals, [
          ["principal", "total_principal"],
          ["net_interest", "total_net_interest"],
          ["maturity_amount", "total_maturity_amount"],
        ]),
        emptyText: "No time deposits outstanding.",
      },
    ),
  };
}

// ── Interest Accrual ──

const ACCRUAL_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 160 },
  { key: "product_name", header: "Product", format: "text", width: 110 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 105 },
  { key: "accrual_from", header: "From", format: "date", width: 85 },
  { key: "accrual_to", header: "To", format: "date", width: 85 },
  { key: "days", header: "Days", format: "number", align: "right", width: 50 },
  { key: "average_daily_balance", header: "Avg Daily Balance", format: "currency", align: "right", width: 110 },
  { key: "gross_interest", header: "Gross", format: "currency", align: "right", width: 90 },
  { key: "tax", header: "Tax", format: "currency", align: "right", width: 80 },
  { key: "net_interest", header: "Net", format: "currency", align: "right", width: 90 },
  { key: "skip_reason", header: "Note", format: "text", width: 160 },
];

/** Interest earned and not yet credited, today (`GET /reports/savings/interest-accrual`). */
export function buildSavingsInterestAccrualDoc(raw: unknown): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...r,
    skip_reason: r.skip_reason ? labelOf(SKIP_REASON_LABELS, String(r.skip_reason)) : "",
  }));
  const money = (field: string) => currencyOrDash(pick(totals, [field]));

  const sections = listSections(
    {
      kind: "kpi_grid",
      items: [
        kpi("Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows)),
        kpi("Gross Interest", money("total_gross_interest")),
        kpi("Tax", money("total_tax")),
        kpi("Net Interest", money("total_net_interest"), { tone: "positive" }),
      ],
    },
    rows,
    totalRows,
    totals,
    "accounts",
    {
      title: "Accrued Interest",
      columns: ACCRUAL_COLUMNS,
      totals: totalsRow(rows.length, totals, [
        ["gross_interest", "total_gross_interest"],
        ["tax", "total_tax"],
        ["net_interest", "total_net_interest"],
      ]),
      emptyText: "No open savings accounts.",
    },
  );
  sections.push({
    kind: "note",
    text: "Shown only: nothing posts until an interest run credits it. What had accrued on a past day isn't kept, so this report is always as of today.",
  });

  return {
    reportId: "savings_interest_accrual",
    meta: pointInTimeMeta("Savings Interest Accrual", "Interest earned and not yet credited", raw),
    sections,
  };
}

// ── Account Activity ──

const ACTIVITY_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 170 },
  { key: "product_name", header: "Product", format: "text", width: 120 },
  { key: "status", header: "Status", format: "text", width: 70 },
  { key: "opening_balance", header: "Opening", format: "currency", align: "right", width: 110 },
  { key: "credits", header: "In", format: "currency", align: "right", width: 105 },
  { key: "debits", header: "Out", format: "currency", align: "right", width: 105 },
  { key: "transaction_count", header: "Transactions", format: "number", align: "right", width: 70 },
  { key: "closing_balance", header: "Closing", format: "currency", align: "right", width: 110 },
  { key: "last_transaction_on", header: "Last Transaction", format: "date", width: 95 },
];

/** Each account open at some point in the period, and its movement (`GET /reports/savings/account-activity`). */
export function buildSavingsAccountActivityDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => inWords(r, { status: ACCOUNT_STATUS_LABELS }));
  const money = (field: string) => currencyOrDash(pick(totals, [field]));

  return {
    reportId: "savings_account_activity",
    meta: meta("Savings Account Activity", range, "Each account's balance and movement in the period"),
    sections: listSections(
      {
        kind: "kpi_grid",
        items: [
          kpi("Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows)),
          kpi("Transactions", countOrDash(pick(totals, ["transaction_count"]))),
          kpi("Opening Balance", money("total_opening_balance")),
          kpi("Money In", money("total_credits"), { tone: "positive" }),
          kpi("Money Out", money("total_debits")),
          kpi("Closing Balance", money("total_closing_balance")),
        ],
      },
      rows,
      totalRows,
      totals,
      "accounts",
      {
        title: "Accounts",
        columns: ACTIVITY_COLUMNS,
        totals: totalsRow(rows.length, totals, [
          ["opening_balance", "total_opening_balance"],
          ["credits", "total_credits"],
          ["debits", "total_debits"],
          ["closing_balance", "total_closing_balance"],
        ]),
        emptyText: "No accounts were open in the selected period.",
      },
    ),
  };
}

// ── Member Deposit Statement ──

const MEMBER_LINE_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 90 },
  { key: "reference", header: "Reference", format: "text", width: 140 },
  { key: "type", header: "Type", format: "text", width: 130 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "credit", header: "In", format: "currency", align: "right", width: 115 },
  { key: "debit", header: "Out", format: "currency", align: "right", width: 115 },
  { key: "balance_after", header: "Balance", format: "currency", align: "right", width: 125 },
];

const MEMBER_TD_COLUMNS: ReportColumn[] = [
  { key: "certificate_number", header: "Certificate #", format: "text", width: 120 },
  { key: "product_name", header: "Product", format: "text", width: 130 },
  { key: "placement_date", header: "Placed", format: "date", width: 90 },
  { key: "maturity_date", header: "Maturity", format: "date", width: 90 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 120 },
  { key: "status", header: "Status", format: "text", width: 90 },
  { key: "outstanding", header: "Outstanding at End", format: "text", width: 90 },
];

/**
 * One member's savings accounts, each as its own statement for the period,
 * and their time deposits (`GET /reports/savings/member-statement/{borrower}`).
 * The member is shown by name, code and branch only: the server sends no
 * contact details or address.
 */
export function buildSavingsMemberStatementDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const member = asRecord(pick(obj, ["member"]));
  const totals = asRecord(pick(obj, ["totals"]));
  const money = (field: string) => currencyOrDash(pick(totals, [field]));

  const particulars: FieldItem[] = [
    { label: "Member", value: text(pick(member, ["name"])) },
    { label: "Member Code", value: text(pick(member, ["code"])) },
    { label: "Branch", value: text(pick(member, ["branch_name"])) },
  ];

  const sections: ReportSection[] = [
    { kind: "fields", title: "Member", items: particulars },
    {
      kind: "kpi_grid",
      items: [
        kpi("Accounts", countOrDash(pick(totals, ["account_count"]))),
        kpi("Opening Balance", money("opening_balance")),
        kpi("Money In", money("credit"), { tone: "positive" }),
        kpi("Money Out", money("debit")),
        kpi("Savings Balance", money("closing_balance")),
        kpi("Time Deposits", money("time_deposits"), { hint: "Outstanding at the end of the period" }),
        kpi("Total Deposits", money("total_deposits"), { tone: "positive" }),
      ],
    },
  ];

  for (const statement of asArray(pick(obj, ["accounts"]))) {
    const account = asRecord(statement.account);
    const lineTotals = asRecord(statement.totals);
    const rows = asArray(statement.rows).map((r) => ({
      ...inWords(r, { type: TRANSACTION_TYPE_LABELS }),
      method: r.method ? labelOf(METHOD_LABELS, String(r.method)) : "—",
    }));
    const status = pick(account, ["status"]);
    sections.push({
      kind: "table",
      title: `${text(pick(account, ["account_number"]))} · ${text(pick(account, ["product_name"]))} · ${labelOf(ACCOUNT_STATUS_LABELS, typeof status === "string" ? status : null)} · Opening ${currencyOrDash(statement.opening_balance)}`,
      columns: MEMBER_LINE_COLUMNS,
      rows,
      totals: [
        { column: "credit", label: "Closing", value: currencyOrDash(pick(lineTotals, ["credit"])) },
        { column: "debit", value: currencyOrDash(pick(lineTotals, ["debit"])) },
        { column: "balance_after", value: currencyOrDash(statement.closing_balance) },
      ],
      emptyText: "No transactions in the selected period.",
    });
  }

  const deposits = asArray(pick(obj, ["time_deposits"])).map((r) => ({
    ...inWords(r, { status: TD_STATUS_LABELS }),
    outstanding: r.outstanding === true ? "Yes" : "No",
  }));
  if (raw !== null && raw !== undefined) {
    sections.push({
      kind: "table",
      title: "Time Deposits",
      columns: MEMBER_TD_COLUMNS,
      rows: deposits,
      totals:
        deposits.length > 0
          ? [{ column: "principal", label: "Outstanding", value: money("time_deposits") }]
          : undefined,
      emptyText: "No time deposits in the selected period.",
    });
  }

  const code = pick(member, ["code"]);
  return {
    reportId: "savings_member_statement",
    meta: {
      ...meta("Member Deposit Statement", range, "A member's savings accounts and time deposits"),
      ...(typeof code === "string" && code ? { referenceKey: code } : {}),
    },
    sections,
  };
}
