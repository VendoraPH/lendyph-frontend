import { asArray, asRecord, pick } from "@/lib/api-payload";
import { formatRate } from "@/lib/format";
import { countOrDash, currencyOrDash, formatGeneratedAt, formatValue } from "@/lib/report-format";
import {
  ACCOUNT_STATUS_LABELS,
  INTEREST_RUN_STATUS_LABELS,
  METHOD_LABELS,
  TRANSACTION_TYPE_LABELS,
  labelOf,
} from "../../savings/_lib/savings-rules";
import {
  MATURITY_INSTRUCTION_LABELS,
  TD_STATUS_LABELS,
} from "../../savings/_lib/time-deposit-rules";
import { kpi, meta, readListEnvelope, serverTotalsTruncationNote } from "./report-builders";
import type {
  DateRange,
  FieldItem,
  ReportColumn,
  ReportDocument,
  ReportSection,
} from "./types";

/**
 * Savings reports (behind NEXT_PUBLIC_ENABLE_SAVINGS; savings design §2).
 * Same contract as the loan list reports in `report-builders.ts`: rows come
 * one page at a time, and every total is the server's figure for the whole
 * filter, or "—" when it sent none, never the listed rows added up. Statuses,
 * types and methods read in words; a key the screen has no words for reads
 * "Other", never the raw key.
 */

/** A row with `field` put into words through `map`. */
function inWords(
  row: Record<string, unknown>,
  fields: Record<string, Record<string, string>>,
): Record<string, unknown> {
  const out = { ...row };
  for (const [field, map] of Object.entries(fields)) {
    const value = row[field];
    out[field] = labelOf(map, typeof value === "string" ? value : null);
  }
  return out;
}

/** The `as_of` the server reports, else the day the report is generated. */
function asOfText(raw: unknown): string {
  return formatValue(pick(asRecord(raw), ["as_of"]) ?? new Date(), "date");
}

function pointInTimeMeta(title: string, subtitle: string, raw: unknown): ReportDocument["meta"] {
  return { title, subtitle, asOf: asOfText(raw), generatedAt: formatGeneratedAt(), org: "" };
}

// ── Savings Balances ──

const BALANCE_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 180 },
  { key: "product_name", header: "Product", format: "text", width: 130 },
  { key: "status", header: "Status", format: "text", width: 80 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 120 },
  { key: "hold_amount", header: "On Hold", format: "currency", align: "right", width: 110 },
  { key: "pending_amount", header: "Pending Approval", format: "currency", align: "right", width: 110 },
  { key: "available_balance", header: "Available", format: "currency", align: "right", width: 120 },
  { key: "accrued_interest", header: "Accrued Interest", format: "currency", align: "right", width: 110 },
  { key: "last_member_activity_on", header: "Last Activity", format: "date", width: 100 },
];

/**
 * Every savings account and its balances as of today
 * (`GET /reports/savings/balances`). Point in time: the range is not read.
 */
export function buildSavingsBalancesDoc(raw: unknown): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => inWords(r, { status: ACCOUNT_STATUS_LABELS }));
  const balance = pick(totals, ["total_balance"]);
  const hold = pick(totals, ["total_hold"]);
  const pending = pick(totals, ["total_pending"]);
  const available = pick(totals, ["total_available"]);
  const accrued = pick(totals, ["total_accrued_interest"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows)),
        kpi("Total Deposits", currencyOrDash(balance), { tone: "positive" }),
        kpi("On Hold", currencyOrDash(hold), { hint: "Legal and staff holds" }),
        kpi("Pending Approval", currencyOrDash(pending), { hint: "Withdrawals and closings waiting for approval" }),
        kpi("Available to Withdraw", currencyOrDash(available)),
        kpi("Accrued Interest", currencyOrDash(accrued), { hint: "Earned, not yet credited" }),
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
            { column: "pending_amount", value: currencyOrDash(pending) },
            { column: "available_balance", value: currencyOrDash(available) },
            { column: "accrued_interest", value: currencyOrDash(accrued) },
          ]
        : undefined,
    emptyText: "No savings accounts.",
    compact: true,
  });

  return {
    reportId: "savings_balances",
    meta: pointInTimeMeta("Savings Balances", "Every savings account and its balances", raw),
    sections,
  };
}

// ── Savings Transactions ──

const TRANSACTION_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 90 },
  { key: "reference", header: "Reference", format: "text", width: 140 },
  { key: "account_number", header: "Account #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 170 },
  { key: "type", header: "Type", format: "text", width: 100 },
  { key: "method", header: "Method", format: "text", width: 100 },
  { key: "credit", header: "In", format: "currency", align: "right", width: 110 },
  { key: "debit", header: "Out", format: "currency", align: "right", width: 110 },
  { key: "balance_after", header: "Balance", format: "currency", align: "right", width: 120 },
];

/**
 * Every savings transaction posted in the period
 * (`GET /reports/savings/transactions`), oldest first.
 */
export function buildSavingsTransactionsDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => inWords(r, { type: TRANSACTION_TYPE_LABELS, method: METHOD_LABELS }));
  const credit = pick(totals, ["total_credit"]);
  const debit = pick(totals, ["total_debit"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Transactions", countOrDash(pick(totals, ["count"]) ?? totalRows)),
        kpi("Money In", currencyOrDash(credit), { tone: "positive", hint: "Deposits, transfers in and interest" }),
        kpi("Money Out", currencyOrDash(debit), { hint: "Withdrawals, transfers out, tax and payouts" }),
      ],
    },
  ];
  const note = serverTotalsTruncationNote(rows.length, totalRows, "transactions", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Transactions",
    columns: TRANSACTION_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "credit", label: "Total", value: currencyOrDash(credit) },
            { column: "debit", value: currencyOrDash(debit) },
          ]
        : undefined,
    emptyText: "No savings transactions in the selected period.",
    compact: true,
  });

  return {
    reportId: "savings_transactions",
    meta: meta("Savings Transactions", range, "Every savings transaction posted in the period"),
    sections,
  };
}

// ── Time Deposit Maturities ──

const MATURITY_COLUMNS: ReportColumn[] = [
  { key: "maturity_date", header: "Maturity", format: "date", width: 100 },
  { key: "certificate_number", header: "Certificate #", format: "text", width: 130 },
  { key: "borrower_name", header: "Member", format: "text", width: 180 },
  { key: "product_name", header: "Product", format: "text", width: 130 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 120 },
  // Text, read the way every savings screen reads a rate (`formatRate`): "4%".
  { key: "annual_rate", header: "Rate", format: "text", align: "right", width: 70 },
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
/** A rate as every savings screen shows it ("4%", "2.5%"), or a dash when absent. */
function rateText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? `${formatRate(value)}%` : "—";
}

export function buildTimeDepositMaturitiesDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => ({
    ...inWords(r, { maturity_instruction: MATURITY_INSTRUCTION_LABELS, status: TD_STATUS_LABELS }),
    annual_rate: rateText(r.annual_rate),
  }));
  const principal = pick(totals, ["total_principal"]);
  const interest = pick(totals, ["total_net_interest"]);
  const due = pick(totals, ["total_maturity_amount"]);
  const payout = pick(totals, ["payout_amount"]);

  const items = [
    kpi("Maturing", countOrDash(pick(totals, ["count"]) ?? totalRows)),
    kpi("Principal", currencyOrDash(principal)),
    kpi("Net Interest", currencyOrDash(interest), { hint: "After withholding tax" }),
    kpi("Due at Maturity", currencyOrDash(due), { tone: "positive" }),
  ];
  // Only when the server splits out what leaves the cooperative as cash.
  if (payout !== null && payout !== undefined) {
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

// ── Savings Interest Postings ──

const INTEREST_COLUMNS: ReportColumn[] = [
  { key: "period_start", header: "From", format: "date", width: 90 },
  { key: "period_end", header: "To", format: "date", width: 90 },
  { key: "product_name", header: "Product", format: "text", width: 140 },
  { key: "branch_name", header: "Branch", format: "text", width: 120 },
  { key: "status", header: "Status", format: "text", width: 80 },
  { key: "account_count", header: "Accounts", format: "number", align: "right", width: 70 },
  { key: "total_gross", header: "Gross Interest", format: "currency", align: "right", width: 120 },
  { key: "total_tax", header: "Tax Withheld", format: "currency", align: "right", width: 110 },
  { key: "total_net", header: "Net Credited", format: "currency", align: "right", width: 120 },
  { key: "posted_at", header: "Posted", format: "date", width: 90 },
];

/**
 * The interest runs posted in the period, one row per product and branch
 * (`GET /reports/savings/interest-postings`).
 */
export function buildSavingsInterestPostingsDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map((r) => inWords(r, { status: INTEREST_RUN_STATUS_LABELS }));
  const gross = pick(totals, ["total_gross"]);
  const tax = pick(totals, ["total_tax"]);
  const net = pick(totals, ["total_net"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Interest Runs", countOrDash(pick(totals, ["count"]) ?? totalRows)),
        kpi("Gross Interest", currencyOrDash(gross), { hint: "Interest expense on deposits" }),
        kpi("Tax Withheld", currencyOrDash(tax)),
        kpi("Net Credited", currencyOrDash(net), { tone: "positive", hint: "Credited to members' accounts" }),
      ],
    },
  ];
  const note = serverTotalsTruncationNote(rows.length, totalRows, "interest runs", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Interest Runs",
    columns: INTEREST_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "total_gross", label: "Total", value: currencyOrDash(gross) },
            { column: "total_tax", value: currencyOrDash(tax) },
            { column: "total_net", value: currencyOrDash(net) },
          ]
        : undefined,
    emptyText: "No interest was posted in the selected period.",
    compact: true,
  });

  return {
    reportId: "savings_interest_postings",
    meta: meta("Savings Interest Postings", range, "Interest credited to savings accounts in the period"),
    sections,
  };
}

// ── Dormant Savings Accounts ──

const DORMANT_COLUMNS: ReportColumn[] = [
  { key: "account_number", header: "Account #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 190 },
  { key: "product_name", header: "Product", format: "text", width: 140 },
  { key: "branch_name", header: "Branch", format: "text", width: 120 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 120 },
  { key: "last_member_activity_on", header: "Last Activity", format: "date", width: 100 },
  { key: "dormant_since", header: "Dormant Since", format: "date", width: 100 },
];

/**
 * Accounts dormant today (`GET /reports/savings/dormant`). Point in time:
 * the range is not read.
 */
export function buildSavingsDormantDoc(raw: unknown): ReportDocument {
  const { rows, totals, totalRows } = readListEnvelope(raw);
  const balance = pick(totals, ["total_balance"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Dormant Accounts", countOrDash(pick(totals, ["account_count"]) ?? totalRows)),
        kpi("Balance Held", currencyOrDash(balance), { hint: "Still owed to the members" }),
      ],
    },
  ];
  const note = serverTotalsTruncationNote(rows.length, totalRows, "accounts", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Dormant Accounts",
    columns: DORMANT_COLUMNS,
    rows,
    totals: rows.length > 0 ? [{ column: "balance", label: "Total", value: currencyOrDash(balance) }] : undefined,
    emptyText: "No dormant savings accounts.",
    compact: true,
  });

  return {
    reportId: "savings_dormant",
    meta: pointInTimeMeta("Dormant Savings Accounts", "Accounts with no member activity for the dormancy period", raw),
    sections,
  };
}

// ── Savings Statement (one account) ──

const STATEMENT_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 90 },
  { key: "reference", header: "Reference", format: "text", width: 150 },
  { key: "type", header: "Type", format: "text", width: 120 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "credit", header: "In", format: "currency", align: "right", width: 120 },
  { key: "debit", header: "Out", format: "currency", align: "right", width: 120 },
  { key: "balance_after", header: "Balance", format: "currency", align: "right", width: 130 },
];

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "—";
}

/**
 * One savings account's statement for the period
 * (`GET /reports/savings/statement/{account}`): the opening balance, each line
 * with the server's running balance, and the closing balance.
 */
export function buildSavingsStatementDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const account = asRecord(pick(obj, ["account"]));
  const totals = asRecord(pick(obj, ["totals"]));
  const rows = asArray(pick(obj, ["rows"])).map((r) =>
    inWords(r, { type: TRANSACTION_TYPE_LABELS, method: METHOD_LABELS }),
  );
  const status = pick(account, ["status"]);

  const particulars: FieldItem[] = [
    { label: "Account #", value: text(pick(account, ["account_number"])) },
    { label: "Member", value: text(pick(account, ["borrower_name"])) },
    { label: "Member Code", value: text(pick(account, ["borrower_code"])) },
    { label: "Product", value: text(pick(account, ["product_name"])) },
    { label: "Branch", value: text(pick(account, ["branch_name"])) },
    { label: "Status", value: labelOf(ACCOUNT_STATUS_LABELS, typeof status === "string" ? status : null) },
  ];

  const sections: ReportSection[] = [
    { kind: "fields", title: "Account", items: particulars },
    {
      kind: "kpi_grid",
      items: [
        kpi("Opening Balance", currencyOrDash(pick(obj, ["opening_balance"]))),
        kpi("Money In", currencyOrDash(pick(totals, ["credit"])), { tone: "positive" }),
        kpi("Money Out", currencyOrDash(pick(totals, ["debit"]))),
        kpi("Closing Balance", currencyOrDash(pick(obj, ["closing_balance"]))),
      ],
    },
    {
      kind: "table",
      title: "Transactions",
      columns: STATEMENT_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "credit", label: "Total", value: currencyOrDash(pick(totals, ["credit"])) },
              { column: "debit", value: currencyOrDash(pick(totals, ["debit"])) },
              { column: "balance_after", value: currencyOrDash(pick(obj, ["closing_balance"])) },
            ]
          : undefined,
      emptyText: "No transactions in the selected period.",
    },
  ];

  const accountNumber = pick(account, ["account_number"]);
  return {
    reportId: "savings_statement",
    meta: {
      ...meta("Savings Statement", range, "One savings account's transactions and balances"),
      ...(typeof accountNumber === "string" && accountNumber ? { referenceKey: accountNumber } : {}),
    },
    sections,
  };
}

// ── Savings GL Control ──

const GL_COLUMNS: ReportColumn[] = [
  { key: "branch_name", header: "Branch", format: "text", width: 150 },
  { key: "account_code", header: "Account", format: "text", width: 70 },
  { key: "account_name", header: "Account Name", format: "text", width: 160 },
  { key: "subledger_balance", header: "Savings Subledger", format: "currency", align: "right", width: 140 },
  { key: "gl_balance", header: "General Ledger", format: "currency", align: "right", width: 140 },
  { key: "difference", header: "Difference", format: "currency", align: "right", width: 130 },
];

/**
 * The savings subledger against GL 2050 Savings Deposits and 2060 Time
 * Deposits, per branch (`GET /reports/savings/gl-control`). Each difference is
 * the server's; anything but ₱0.00 needs the accountant.
 */
export function buildSavingsGlControlDoc(raw: unknown): ReportDocument {
  const obj = asRecord(raw);
  const rows = asArray(pick(obj, ["rows"]));
  const totals = asRecord(pick(obj, ["totals"]));

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Savings Subledger", currencyOrDash(pick(totals, ["subledger_balance"]))),
        kpi("General Ledger", currencyOrDash(pick(totals, ["gl_balance"]))),
        kpi("Difference", currencyOrDash(pick(totals, ["difference"])), {
          hint: "Anything but ₱0.00 needs the accountant",
        }),
      ],
    },
    {
      kind: "table",
      title: "By Branch",
      columns: GL_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "subledger_balance", label: "Total", value: currencyOrDash(pick(totals, ["subledger_balance"])) },
              { column: "gl_balance", value: currencyOrDash(pick(totals, ["gl_balance"])) },
              { column: "difference", value: currencyOrDash(pick(totals, ["difference"])) },
            ]
          : undefined,
      emptyText: "No savings or time deposit balances to compare.",
    },
  ];

  return {
    reportId: "savings_gl_control",
    meta: pointInTimeMeta("Savings GL Control", "Savings subledger against the general ledger, by branch", raw),
    sections,
  };
}
