import { asArray, asRecord, pick } from "@/lib/api-payload";
import { LOAN_STATUS_LABELS } from "@/constants/loan-status";
import {
  DASH,
  countOrDash,
  currencyOrDash,
  formatCount,
  formatCurrency,
  formatDateRange,
  formatGeneratedAt,
  formatPercent,
  formatValue,
  percentOrDash,
  rateOrDash,
  toNumber,
} from "@/lib/report-format";
import type {
  DateRange,
  FieldItem,
  KpiItem,
  ReportColumn,
  ReportDocument,
  ReportSection,
} from "./types";
import type { LoanStatus } from "@/types/loan";

/**
 * Pure payload → ReportDocument builders.
 *
 * Everything here takes the value the API already returned, so the whole
 * frontend→backend contract is testable without a network call. Fetching and
 * the catalog wiring live in `report-catalog.ts`.
 */

/**
 * Rows requested per list report. The API paginates; this is one page.
 *
 * NOT the same number as `PRINT_PAGE_SIZE` (100) in
 * `lib/printables/templates/shared.ts`, and the two must not be merged. The
 * report endpoints this feeds serve the page size they are asked for; the
 * paginated indexes the printables read clamp it with
 * `min((int) request('per_page', 15), 100)`, so asking those for 200 returns
 * 100 and silently truncates the document. Same word, two different server
 * ceilings.
 */
export const LIST_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Raw payload helpers
//
// `pick` / `asRecord` / `asArray` live in `@/lib/api-payload`, shared with the
// printable templates so both read a response the same way. Money totals are
// read as the server sent them, never added up from the rows, and a total the
// server did not send is "—".
// ---------------------------------------------------------------------------

/**
 * `org` is deliberately empty here.
 *
 * Lendyph is single-tenant-per-deployment, and this module is pure: it has no
 * session and no branding to read, so hardcoding a name printed one
 * cooperative's letterhead on every other cooperative's reports. The name is
 * filled by `applyChrome()` from branding settings — exactly the way the logo
 * already is — with `siteConfig.name` as the fallback.
 */
export function meta(
  title: string,
  range: DateRange,
  subtitle?: string
): ReportDocument["meta"] {
  return {
    title,
    subtitle,
    period: formatDateRange(range.from, range.to),
    generatedAt: formatGeneratedAt(),
    org: "",
  };
}

export function kpi(label: string, value: string, opts: Partial<KpiItem> = {}): KpiItem {
  return { label, value, ...opts };
}

// ---------------------------------------------------------------------------
// Column schemas for list reports
// ---------------------------------------------------------------------------

const RELEASE_COLUMNS: ReportColumn[] = [
  { key: "release_date", header: "Release Date", format: "date", width: 120 },
  // Released loans are traced back to their application during audit; the API
  // sends the application number on every row and it was being dropped.
  { key: "application_number", header: "Application #", format: "text", width: 140 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 220 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 140 },
  { key: "term", header: "Term", format: "text", align: "right", width: 80 },
  { key: "interest_rate", header: "Rate", format: "rate", align: "right", width: 80 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

const REPAYMENT_COLUMNS: ReportColumn[] = [
  // The API sends a date-only `paid_at`; formatting it as a datetime printed
  // a phantom time-of-day on every row.
  { key: "paid_at", header: "Paid On", format: "date", width: 140 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 220 },
  { key: "amount", header: "Amount", format: "currency", align: "right", width: 140 },
  { key: "penalty_amount", header: "Penalty", format: "currency", align: "right", width: 120 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

// The schedule rows carry a full principal/interest/penalty split and the
// amounts already paid against them. Only the totals used to be rendered,
// which left staff unable to see *what* a delinquent installment is made of
// without opening the loan.
const DUE_COLUMNS: ReportColumn[] = [
  { key: "due_date", header: "Due Date", format: "date", width: 110 },
  { key: "period_number", header: "Period", format: "number", align: "center", width: 70 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Member", format: "text", width: 200 },
  { key: "principal_due", header: "Principal", format: "currency", align: "right", width: 120 },
  { key: "interest_due", header: "Interest", format: "currency", align: "right", width: 110 },
  { key: "penalty_amount", header: "Penalty", format: "currency", align: "right", width: 110 },
  { key: "amount_due", header: "Total Due", format: "currency", align: "right", width: 130 },
  { key: "amount_paid", header: "Paid", format: "currency", align: "right", width: 120 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 130 },
  { key: "days_overdue", header: "Days Late", format: "number", align: "right", width: 100 },
  { key: "status", header: "Status", format: "text", width: 100 },
];

// Normalizers — accept multiple backend key conventions and shape rows for
// display. This keeps the UI resilient to snake_case, camelCase, or nested
// borrower objects. The first key in each list is the one the API actually
// sends today; the rest are legacy/defensive aliases.

function normalizeReleaseRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  return {
    release_date:
      pick(raw, ["release_date", "released_at", "start_date"]) ??
      pick(borrower, ["release_date"]),
    application_number: pick(raw, ["application_number", "app_number"]),
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    principal: pick(raw, ["principal_amount", "principal", "amount"]),
    term: pick(raw, ["term", "term_months", "term_label"]),
    interest_rate: pick(raw, ["interest_rate", "rate"]),
    // The server's display_status reads Past Due for a loan past grace.
    status: loanStatusText(pick(raw, ["display_status", "status"])),
  };
}

/** How a payment was received, as the app's screens name it. */
const PAYMENT_METHOD_NAMES: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  online: "Online",
  auto_pay: "Auto Pay",
};

/** A stored payment method in words ("bank_transfer" → "Bank Transfer"); anything else as sent. */
function paymentMethodText(value: unknown): unknown {
  return typeof value === "string" ? (PAYMENT_METHOD_NAMES[value] ?? value) : value;
}

/** A stored payment status in words ("completed" → "Completed"). */
function paymentStatusText(value: unknown): unknown {
  return typeof value === "string" && value !== ""
    ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
    : value;
}

function normalizeRepaymentRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  const loan = asRecord(raw.loan);
  return {
    paid_at: pick(raw, ["paid_at", "payment_date", "created_at"]),
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number"]) ??
      pick(loan, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    amount: pick(raw, ["amount", "amount_paid", "total_amount"]),
    penalty_amount: pick(raw, ["penalty_amount", "penalty_applied", "penalty"]),
    method: paymentMethodText(pick(raw, ["method", "payment_method"])),
    status: paymentStatusText(pick(raw, ["status"])),
  };
}

function normalizeDueRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  const loan = asRecord(raw.loan);

  return {
    due_date: pick(raw, ["due_date", "scheduled_date", "date"]),
    period_number: pick(raw, ["period_number", "period", "installment_number"]),
    // The API sends days_overdue per schedule; it is never derived client-side.
    days_overdue: pick(raw, ["days_overdue", "days_past_due"]) ?? 0,
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number"]) ??
      pick(loan, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    principal_due: pick(raw, ["principal_due", "principal"]),
    interest_due: pick(raw, ["interest_due", "interest"]),
    penalty_amount: pick(raw, ["penalty_amount", "penalty", "penalty_due"]),
    amount_due: pick(raw, ["total_due", "amount_due", "scheduled_amount"]),
    // The server's per-row paid figure, the one `totals.total_paid` adds up.
    // A row without it is "—", never its components added here.
    amount_paid: pick(raw, ["amount_paid"]),
    // `amount_remaining` is the API's name for the unpaid balance of a schedule.
    balance: pick(raw, [
      "amount_remaining",
      "balance",
      "outstanding_balance",
      "remaining_balance",
    ]),
    status: periodStatusText(pick(raw, ["status"])),
  };
}

// ---------------------------------------------------------------------------
// Paginated list envelopes
// ---------------------------------------------------------------------------

export interface ListEnvelope {
  rows: Record<string, unknown>[];
  /** Server-computed totals for the whole period (not just this page). */
  totals: Record<string, unknown> | null;
  /** Server-reported row count for the whole period, when paginated. */
  totalRows: number | null;
}

/**
 * List reports are fetched with `api.getRaw`, so the paginator envelope
 * ({ data, meta, totals }) survives intact — the page of rows alone can never
 * be trusted for totals.
 */
export function readListEnvelope(raw: unknown): ListEnvelope {
  const obj = asRecord(raw);
  const metaBlock = asRecord(obj?.meta);
  const totals =
    asRecord(pick(obj, ["totals"])) ??
    asRecord(pick(metaBlock, ["totals"])) ??
    asRecord(pick(obj, ["summary"]));

  return {
    rows: asArray(raw),
    totals,
    totalRows: toNumber(
      pick(metaBlock, ["total"]) ??
        pick(obj, ["total"]) ??
        pick(totals, ["count", "row_count"])
    ),
  };
}

/** "Principal ₱1,200.00 · Interest ₱300.00" — skips figures the API omits. */
function breakdownHint(parts: [string, unknown][]): string | undefined {
  const segments = parts
    .map(([label, value]) => {
      const n = toNumber(value);
      return n === null ? null : `${label} ${formatCurrency(n)}`;
    })
    .filter((segment): segment is string => segment !== null);
  return segments.length > 0 ? segments.join(" · ") : undefined;
}

/** "Showing the first 200 of 450 members.", or null when every row is listed. */
function truncationScope(shown: number, totalRows: number | null, noun: string): string | null {
  const truncated =
    totalRows !== null ? totalRows > shown : shown >= LIST_PAGE_SIZE;
  if (!truncated || shown === 0) return null;

  return totalRows !== null
    ? `Showing the first ${formatCount(shown)} of ${formatCount(totalRows)} ${noun}.`
    : `Showing the first ${formatCount(shown)} ${noun} — the API did not report a count, so there may be more.`;
}

/**
 * Truncation note for a table whose totals row shows only the server's
 * figures: a total the server did not send is "—", never a sum of this page.
 * `noun` names what one row is ("repayments", "loans", "borrowers") because the
 * count comes from the server's `meta.total`, which counts those. There is no
 * "Export to CSV" pointer: these reports export the document, which holds only
 * the rows listed. `totals` is the block the server sent, if any: without one
 * the footers are dashes, so the note says so instead of calling them the
 * server's figures.
 */
export function serverTotalsTruncationNote(
  shown: number,
  totalRows: number | null,
  noun: string,
  totals: Record<string, unknown> | null
): ReportSection | null {
  const scope = truncationScope(shown, totalRows, noun);
  if (!scope) return null;

  const totalsScope = totals
    ? `The table totals are the server's figures for the whole period, not a sum of the ${noun} listed.`
    : `The server did not provide totals for the period, so the table totals show "—" rather than a sum of the ${noun} listed.`;

  return { kind: "note", text: `${scope} ${totalsScope}` };
}

// ---------------------------------------------------------------------------
// KPI-only reports
// ---------------------------------------------------------------------------

/**
 * The summary KPIs, plus the accounts behind them when the repayments for the
 * same window are supplied. `/reports/daily-collection` only returns totals, so
 * the account list comes from `/reports/repayments` over the same dates; it is
 * left out (not shown empty) when that read failed, so a failed read is never
 * mistaken for "nothing was collected".
 */
export function buildDailyCollectionDoc(
  raw: unknown,
  range: DateRange,
  repaymentsRaw?: unknown
): ReportDocument {
  const obj = asRecord(raw);

  // The three collected figures are the server's own and are never added up
  // here. They are counted on different bases, so they need not add up to
  // each other: `total_collected` counts by period (principal plus interest
  // paid on the periods falling due in the range), while `penalty_collected`
  // and `total_received` are cash-basis (the penalty, and the money, taken by
  // payments dated in the range; the premium is left out). A figure the server
  // did not send is "—".
  const items: KpiItem[] = [
    kpi("Total Due", currencyOrDash(pick(obj, ["total_due", "due", "total_scheduled"]))),
    kpi("Collected (Principal + Interest)", currencyOrDash(pick(obj, ["total_collected"])), {
      tone: "positive",
    }),
    kpi("Penalty Collected", currencyOrDash(pick(obj, ["penalty_collected"]))),
    kpi("Total Received", currencyOrDash(pick(obj, ["total_received"])), { tone: "positive" }),
    kpi("Collection Rate", percentOrDash(pick(obj, ["collection_rate", "rate"]))),
    kpi("Uncollected", currencyOrDash(pick(obj, ["uncollected", "outstanding"])), {
      tone: "negative",
    }),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  if (repaymentsRaw != null) {
    const { rows: rawRows, totals, totalRows } = readListEnvelope(repaymentsRaw);
    const rows = rawRows.map(normalizeRepaymentRow);

    const note = serverTotalsTruncationNote(rows.length, totalRows, "repayments", totals);
    if (note) sections.push(note);

    // Footer figures come only from the server's period-wide `totals`; a
    // missing one is "—", never the rows on this page added up.
    sections.push({
      kind: "table",
      title: "Payments Collected",
      columns: REPAYMENT_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              {
                column: "amount",
                label: "Total",
                value: currencyOrDash(pick(totals, ["total_amount_paid"])),
              },
              {
                column: "penalty_amount",
                value: currencyOrDash(pick(totals, ["total_penalty_applied"])),
              },
            ]
          : undefined,
      emptyText: "No collections were recorded in the selected period.",
    });
  }

  return {
    reportId: "daily_collection",
    meta: meta(
      "Daily Collection Report",
      range,
      "Amounts due vs collected, and the payments collected"
    ),
    sections,
  };
}

/** Default PAR window used only when the API omits par_threshold_days. */
const DEFAULT_PAR_THRESHOLD_DAYS = 30;

const BY_BRANCH_COLUMNS: ReportColumn[] = [
  { key: "branch_name", header: "Branch", format: "text", width: 200 },
  { key: "loan_count", header: "Loans", format: "number", align: "right", width: 90 },
  {
    key: "total_released",
    header: "Total Released",
    format: "currency",
    align: "right",
    width: 160,
  },
  {
    key: "principal_balance",
    header: "Principal Balance",
    format: "currency",
    align: "right",
    width: 170,
  },
  { key: "outstanding", header: "Outstanding", format: "currency", align: "right", width: 170 },
];

const COMPOSITION_COLUMNS: ReportColumn[] = [
  { key: "component", header: "Component", format: "text", width: 160 },
  { key: "outstanding", header: "Outstanding", format: "currency", align: "right", width: 160 },
  { key: "overdue", header: "Of Which Overdue", format: "currency", align: "right", width: 170 },
];

/**
 * Per-branch breakdown. The API returns `by_branch` on every loan-balance
 * summary; it was fetched and dropped, so a multi-branch cooperative could
 * only ever see the consolidated figure.
 */
function byBranchSection(
  rows: Record<string, unknown>[],
  totals: Record<string, unknown> | null
): ReportSection | null {
  if (rows.length === 0) return null;

  const normalized = rows.map((raw) => ({
    branch_name: pick(raw, ["branch_name", "name"]) ?? "Unassigned",
    loan_count: pick(raw, ["loan_count", "loans", "count"]),
    total_released: pick(raw, ["total_released", "released"]),
    // Never the deprecated `outstanding_balance`, which is principal plus premium.
    principal_balance: pick(raw, ["outstanding_principal"]),
    outstanding: pick(raw, ["total_outstanding"]),
  }));

  // The footer is the server's `by_branch_totals`; a figure it did not send is
  // "—", never the branch rows added up.
  return {
    kind: "table",
    title: "Breakdown by Branch",
    columns: BY_BRANCH_COLUMNS,
    rows: normalized,
    totals: [
      {
        column: "loan_count",
        label: "Total",
        value: countOrDash(pick(totals, ["loan_count"])),
      },
      { column: "total_released", value: currencyOrDash(pick(totals, ["total_released"])) },
      {
        column: "principal_balance",
        value: currencyOrDash(pick(totals, ["outstanding_principal"])),
      },
      { column: "outstanding", value: currencyOrDash(pick(totals, ["total_outstanding"])) },
    ],
    emptyText: "No branch breakdown was returned for this period.",
  };
}

/**
 * Principal / interest / penalty / premium, outstanding against overdue. Both
 * blocks come back on every response and neither was rendered — the headline
 * balance alone cannot tell a collections officer what the arrears are made of.
 *
 * Outstanding means everything owed, so the premium has its row and the column's
 * footer is the server's `total_outstanding`, the same figure as the card. The
 * Overdue footer is its block's `total`; the premium is never past due. A figure
 * the server did not send shows "—", never the rows added up.
 */
function compositionSection(
  outstanding: Record<string, unknown> | null,
  overdue: Record<string, unknown> | null,
  totalOutstanding: unknown
): ReportSection | null {
  if (!outstanding && !overdue) return null;

  const components: [string, string][] = [
    ["Principal", "principal"],
    ["Interest", "interest"],
    ["Penalty", "penalty"],
    ["Insurance Premium", "insurance"],
  ];
  const rows = components
    .map(([label, key]) => ({
      component: label,
      outstanding: outstanding?.[key] ?? null,
      overdue: overdue?.[key] ?? null,
    }))
    // A component the API omitted on both sides is not a zero — drop the row
    // rather than assert a balance the server never reported.
    .filter((r) => r.outstanding !== null || r.overdue !== null);

  if (rows.length === 0) return null;

  return {
    kind: "table",
    title: "Outstanding vs Overdue Composition",
    columns: COMPOSITION_COLUMNS,
    rows,
    totals: [
      {
        column: "outstanding",
        label: "Total",
        value: currencyOrDash(totalOutstanding),
      },
      { column: "overdue", value: currencyOrDash(pick(overdue, ["total"])) },
    ],
  };
}

/**
 * The range is not read: this report is the whole portfolio as of a day, the same
 * book as the Dashboard's Total Portfolio. The signature keeps it for the
 * catalog's mapper type.
 */
export function buildPortfolioSummaryDoc(raw: unknown, range?: DateRange): ReportDocument;
export function buildPortfolioSummaryDoc(raw: unknown): ReportDocument {
  const obj = asRecord(raw);
  const portfolio = asRecord(obj?.portfolio);
  const outstanding = asRecord(obj?.outstanding);
  const overdue = asRecord(obj?.overdue);

  const loanCount = pick(obj, ["active_loans"]) ?? pick(portfolio, ["loan_count"]);
  // The headline figures are the server's flat ones only. Never the deprecated
  // `outstanding_balance` (principal plus premium), and never the nested
  // components added up.
  const principalBalance = pick(obj, ["outstanding_principal"]);
  const totalOutstanding = pick(obj, ["total_outstanding"]);
  const atRisk = pick(obj, ["at_risk_amount"]) ?? pick(portfolio, ["at_risk_amount"]);
  const parRatio = pick(obj, ["par_ratio"]) ?? pick(portfolio, ["par_ratio"]);
  const overdueLoans = toNumber(pick(overdue, ["loan_count"]));
  const thresholdDays =
    toNumber(pick(obj, ["par_threshold_days"])) ?? DEFAULT_PAR_THRESHOLD_DAYS;

  const items: KpiItem[] = [
    kpi("Total Active Loans", countOrDash(loanCount), {
      hint: `Released: ${currencyOrDash(pick(portfolio, ["total_released"]))}`,
    }),
    kpi("Principal Balance", currencyOrDash(principalBalance)),
    kpi("Outstanding", currencyOrDash(totalOutstanding), {
      hint: "Principal, interest, penalty and insurance premium still owed",
    }),
    kpi(`At Risk (>${formatCount(thresholdDays)}d overdue)`, currencyOrDash(atRisk), {
      tone: "negative",
      hint:
        overdueLoans === null
          ? undefined
          : `${formatCount(overdueLoans)} overdue ${overdueLoans === 1 ? "loan" : "loans"}`,
    }),
    // PAR is computed server-side against the Principal Balance, so it will not
    // reproduce at-risk ÷ Outstanding on screen. Never recompute it.
    kpi("PAR Ratio", percentOrDash(parRatio), {
      tone: "negative",
      hint: "Portfolio at Risk, on the Principal Balance",
    }),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  const composition = compositionSection(outstanding, overdue, totalOutstanding);
  if (composition) sections.push(composition);

  const branches = byBranchSection(
    asArray(pick(obj, ["by_branch", "branches"])),
    asRecord(pick(obj, ["by_branch_totals"]))
  );
  if (branches) sections.push(branches);

  return {
    reportId: "portfolio_summary",
    meta: {
      title: "Portfolio Summary",
      subtitle: "Overall loan portfolio status",
      asOf: formatValue(pick(obj, ["as_of", "generated_at"]) ?? new Date(), "date"),
      generatedAt: formatGeneratedAt(),
      org: "",
    },
    sections,
  };
}

// Keyed to the fields GET /reports/income/by-loan sends, so each row renders as
// sent: the server works out each loan's interest, penalty and processing fee,
// and each row's Total Income.
const INCOME_BY_LOAN_COLUMNS: ReportColumn[] = [
  { key: "loan_account_number", header: "Loan #", format: "text", width: 130 },
  { key: "borrower_name", header: "Member", format: "text", width: 220 },
  { key: "payments", header: "Payments", format: "number", align: "right", width: 90 },
  { key: "interest_income", header: "Interest", format: "currency", align: "right", width: 130 },
  { key: "penalty_income", header: "Penalty", format: "currency", align: "right", width: 120 },
  { key: "processing_fee", header: "Processing Fee", format: "currency", align: "right", width: 130 },
  { key: "service_fee", header: "Service Fee", format: "currency", align: "right", width: 120 },
  { key: "other_fees", header: "Other Fees", format: "currency", align: "right", width: 120 },
  { key: "total_income", header: "Total Income", format: "currency", align: "right", width: 140 },
];

/**
 * The summary KPIs, plus the per-loan rows behind them when
 * `/reports/income/by-loan` for the same window is supplied. The list is left
 * out (not shown empty) when that read failed.
 */
export function buildIncomeDoc(
  raw: unknown,
  range: DateRange,
  byLoanRaw?: unknown
): ReportDocument {
  const obj = asRecord(raw);

  const interest = toNumber(pick(obj, ["interest_income", "interest"]));
  const fees = toNumber(pick(obj, ["processing_fees", "fees", "fee_income"]));
  const penalties = toNumber(pick(obj, ["penalty_income", "penalties"]));
  // Fee income booked at release to 4040 and 4080, as the server classed it.
  const serviceFees = toNumber(pick(obj, ["service_fee"]));
  const otherFees = toNumber(pick(obj, ["other_fees"]));
  // The server's total, or "—" when it sent none: never the components added
  // up here.
  const total = toNumber(pick(obj, ["total_income", "total"]));

  const items: KpiItem[] = [
    kpi("Interest Income", currencyOrDash(interest), { tone: "positive" }),
    kpi("Processing Fees", currencyOrDash(fees), { tone: "positive" }),
    kpi("Service Fees", currencyOrDash(serviceFees), { tone: "positive" }),
    kpi("Other Fees", currencyOrDash(otherFees), { tone: "positive" }),
    kpi("Penalty Income", currencyOrDash(penalties)),
    kpi("Total Income", currencyOrDash(total), { tone: "positive" }),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  if (byLoanRaw != null) {
    const { rows, totals, totalRows } = readListEnvelope(byLoanRaw);

    const note = serverTotalsTruncationNote(rows.length, totalRows, "loans", totals);
    if (note) sections.push(note);

    // Footer figures come only from the server's period-wide `totals`; a
    // missing one is "—", never the rows on this page added up.
    sections.push({
      kind: "table",
      title: "Income by Loan Account",
      columns: INCOME_BY_LOAN_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              {
                column: "payments",
                label: "Total",
                value: countOrDash(pick(totals, ["payments"])),
              },
              {
                column: "interest_income",
                value: currencyOrDash(pick(totals, ["interest_income"])),
              },
              {
                column: "penalty_income",
                value: currencyOrDash(pick(totals, ["penalty_income"])),
              },
              {
                column: "processing_fee",
                value: currencyOrDash(pick(totals, ["processing_fee"])),
              },
              { column: "service_fee", value: currencyOrDash(pick(totals, ["service_fee"])) },
              { column: "other_fees", value: currencyOrDash(pick(totals, ["other_fees"])) },
              {
                column: "total_income",
                value: currencyOrDash(pick(totals, ["total_income"])),
              },
            ]
          : undefined,
      emptyText: "No income was collected on any loan account in the selected period.",
    });
    sections.push({
      kind: "note",
      text:
        "Interest and penalty are taken from the repayments posted in the period, and processing, service and other fees from the loans released in the period, per loan account.",
    });
  }

  return {
    reportId: "income_report",
    meta: meta("Income Report", range, "Interest, fees, and penalty income"),
    sections,
  };
}

/**
 * Each aging bucket is `{ amount, count }`. A flat read handed the currency
 * formatter an object, which printed "—" for every bucket.
 */
function agingBucketKpi(
  label: string,
  buckets: Record<string, unknown> | null,
  keys: string[],
  opts: Partial<KpiItem> = {}
): KpiItem {
  const value = pick(buckets, keys);
  const bucket = asRecord(value);
  const amount = bucket ? bucket.amount : value;
  const count = toNumber(bucket?.count);

  return kpi(label, currencyOrDash(amount), {
    ...opts,
    hint:
      count === null
        ? opts.hint
        : `${formatCount(count)} ${count === 1 ? "loan" : "loans"}`,
  });
}

/**
 * Bucket amounts reconcile to the aging total; bucket loan counts deliberately
 * do not — one loan late in two buckets is still one delinquent loan. Say so,
 * so nobody reads the counts as a column to be added up.
 */
function agingTotalNote(total: Record<string, unknown> | null): ReportSection {
  const amount = toNumber(total?.amount);
  const count = toNumber(total?.count);

  const headline =
    amount === null
      ? ""
      : count === null
        ? `Total overdue: ${formatCurrency(amount)}. `
        : `Total overdue: ${formatCurrency(amount)} across ${formatCount(count)} delinquent ${count === 1 ? "loan" : "loans"}. `;

  return {
    kind: "note",
    text: `${headline}Bucket amounts add up to the total overdue; bucket loan counts do not — a loan that is late in two buckets is still one delinquent loan.`,
  };
}

/** Bucket label → the key aliases the API may use for it, in priority order. */
const AGING_BUCKETS: [string, string[]][] = [
  ["1–30 Days", ["1_30", "bucket_1_30", "days_1_30"]],
  ["31–60 Days", ["31_60", "bucket_31_60", "days_31_60"]],
  ["61–90 Days", ["61_90", "bucket_61_90", "days_61_90"]],
  ["Over 90 Days", ["over_90", "90_plus", "bucket_over_90"]],
];

const AGING_COLUMNS: ReportColumn[] = [
  { key: "bucket", header: "Aging Bucket", format: "text", width: 160 },
  { key: "amount", header: "Overdue Amount", format: "currency", align: "right", width: 170 },
  { key: "share", header: "% of Overdue", format: "percent", align: "right", width: 120 },
  { key: "count", header: "Loans", format: "number", align: "right", width: 90 },
];

/**
 * The aging schedule proper. Four KPI cards state the buckets but cannot show
 * concentration — which bucket holds the arrears is the entire question an
 * aging report exists to answer — so each row carries its share of the total:
 * the server's `share_percent`, worked out from centavos. A share it did not
 * send is "—"; none is divided out here.
 */
function agingScheduleSection(
  buckets: Record<string, unknown> | null,
  total: Record<string, unknown> | null
): ReportSection | null {
  const rows = AGING_BUCKETS.map(([label, keys]) => {
    const value = pick(buckets, keys);
    const bucket = asRecord(value);
    return {
      bucket: label,
      amount: toNumber(bucket ? bucket.amount : value),
      // Null from the server when the total is 0, and absent from an older
      // payload: "—" either way.
      share: toNumber(bucket?.share_percent),
      count: toNumber(bucket?.count),
    };
  }).filter((r) => r.amount !== null);

  if (rows.length === 0) return null;

  return {
    kind: "table",
    title: "Aging Schedule",
    columns: AGING_COLUMNS,
    rows,
    totals: [
      // The server's total; the buckets are never added up here.
      { column: "amount", label: "Total", value: currencyOrDash(total?.amount) },
      // Deliberately no total for `count`: bucket counts double-count a loan
      // that is late in two buckets, so a column sum would be wrong.
      { column: "share", value: percentOrDash(total?.share_percent) },
    ],
  };
}

export function buildAgingDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const buckets = asRecord(pick(obj, ["buckets", "aging_buckets"])) ?? obj;
  const total = asRecord(pick(obj, ["total", "totals"]));

  const items: KpiItem[] = [
    agingBucketKpi("1–30 Days Overdue", buckets, ["1_30", "bucket_1_30", "days_1_30"]),
    agingBucketKpi("31–60 Days Overdue", buckets, ["31_60", "bucket_31_60", "days_31_60"]),
    agingBucketKpi("61–90 Days Overdue", buckets, ["61_90", "bucket_61_90", "days_61_90"], {
      tone: "negative",
    }),
    agingBucketKpi(">90 Days Overdue", buckets, ["over_90", "90_plus", "bucket_over_90"], {
      tone: "negative",
    }),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  const schedule = agingScheduleSection(buckets, total);
  if (schedule) sections.push(schedule);

  sections.push(agingTotalNote(total));

  return {
    reportId: "aging_report",
    meta: meta("Aging Report", range, "Overdue amounts grouped by aging bucket"),
    sections,
  };
}

// Keyed to the fields GET /reports/borrowers/list sends, so each row renders as
// sent. `markers` is the one cell shaped here, from the server's two flags.
const MEMBER_LIST_COLUMNS: ReportColumn[] = [
  { key: "borrower_code", header: "Member No.", format: "text", width: 110 },
  { key: "borrower_name", header: "Member", format: "text", width: 220 },
  { key: "branch_name", header: "Branch", format: "text", width: 140 },
  { key: "markers", header: "New / Repeat", format: "text", width: 110 },
  { key: "active_loans", header: "Active Loans", format: "number", align: "right", width: 110 },
  { key: "loans_released", header: "Loans Released", format: "number", align: "right", width: 120 },
  { key: "outstanding", header: "Outstanding", format: "currency", align: "right", width: 140 },
  { key: "last_release_date", header: "Last Release", format: "date", width: 120 },
];

/**
 * A loan status as the loans screens label it; a value they don't know, as
 * sent. `released` and legacy `ongoing` both read "Current", the reports' word
 * for a live loan.
 */
function loanStatusText(value: unknown): unknown {
  return typeof value === "string" && Object.hasOwn(LOAN_STATUS_LABELS, value)
    ? LOAN_STATUS_LABELS[value as LoanStatus]
    : value;
}

/** Display shaping only: every figure stays exactly as the server sent it. */
function normalizeMemberRow(raw: Record<string, unknown>): Record<string, unknown> {
  const markers = [raw.is_new === true && "New", raw.is_repeat === true && "Repeat"].filter(Boolean);
  return { ...raw, markers: markers.length > 0 ? markers.join(", ") : null };
}

/**
 * The summary KPIs, plus the members behind them when `/reports/borrowers/list`
 * for the same window is supplied. The list is left out (not shown empty) when
 * that read failed.
 */
export function buildBorrowerDoc(
  raw: unknown,
  range: DateRange,
  listRaw?: unknown
): ReportDocument {
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi(
      "Total Active Members",
      countOrDash(pick(obj, ["total_active_borrowers", "active_borrowers", "total_active"]))
    ),
    kpi("New Members", countOrDash(pick(obj, ["new_borrowers", "new"])), {
      tone: "positive",
    }),
    kpi("Avg Loan Size", currencyOrDash(pick(obj, ["avg_loan_size", "average_loan"]))),
    kpi("Repeat Members", countOrDash(pick(obj, ["repeat_borrowers", "repeat"]))),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  if (listRaw != null) {
    const { rows: rawRows, totalRows } = readListEnvelope(listRaw);
    const rows = rawRows.map(normalizeMemberRow);

    const scope = truncationScope(rows.length, totalRows, "members");
    if (scope) sections.push({ kind: "note", text: scope });

    // No footer: the server sends counts for the cards, not column totals, and
    // rows are never added up here.
    sections.push({
      kind: "table",
      title: "Active and New Members",
      columns: MEMBER_LIST_COLUMNS,
      rows,
      emptyText: "No member was active or new in the selected period.",
    });
    sections.push({
      kind: "note",
      text:
        "Active: at least one collectible loan as of the end of the period, going by each loan's current status, not its status back then. New: registered in the period. Repeat: at least 2 loans released. A repeat member who is neither active nor new counts on the Repeat card but is not listed here.",
    });
  }

  return {
    reportId: "borrower_report",
    meta: meta("Member Report", range, "Active, new, and repeat member activity"),
    sections,
  };
}

// Net Proceeds leads because it is what the "Total Disbursed" KPI adds up
// (`disbursementReport()` sums `net_proceeds`), so the first money total in the
// table is the figure staff compare it with. Principal, which is larger by the
// deductions, follows.
const DISBURSEMENT_COLUMNS: ReportColumn[] = [
  { key: "release_date", header: "Release Date", format: "date", width: 120 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 130 },
  { key: "borrower_name", header: "Member", format: "text", width: 220 },
  { key: "net_proceeds", header: "Net Proceeds", format: "currency", align: "right", width: 150 },
  { key: "principal", header: "Principal Released", format: "currency", align: "right", width: 160 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

/**
 * The summary figures, plus the loan accounts behind the total disbursed when
 * the period's releases are supplied. `/reports/disbursements` returns totals
 * only, so the list is read from `/reports/releases` over the same window; it
 * is left out (not shown empty) when that read failed.
 */
export function buildDisbursementDoc(
  raw: unknown,
  range: DateRange,
  releasesRaw?: unknown
): ReportDocument {
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi("Loans Released", countOrDash(pick(obj, ["loans_released", "released_count", "count"]))),
    kpi(
      "Total Disbursed",
      currencyOrDash(pick(obj, ["total_disbursed", "total_released", "total_amount"])),
      { tone: "positive" }
    ),
    kpi("Avg Disbursement", currencyOrDash(pick(obj, ["avg_disbursement", "average_amount"]))),
    kpi("Pending Release", countOrDash(pick(obj, ["pending_release", "pending"]))),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  if (releasesRaw != null) {
    const { rows: rawRows, totals, totalRows } = readListEnvelope(releasesRaw);
    const rows = rawRows.map((raw) => ({
      ...normalizeReleaseRow(raw),
      net_proceeds: pick(raw, ["net_proceeds", "net_amount", "proceeds"]),
    }));

    const note = serverTotalsTruncationNote(rows.length, totalRows, "loans", totals);
    if (note) sections.push(note);

    // Footer figures come only from the server's period-wide `totals`; a
    // missing one is "—", never the rows on this page added up.
    sections.push({
      kind: "table",
      title: "Disbursed Loan Accounts",
      columns: DISBURSEMENT_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              {
                column: "net_proceeds",
                label: "Total",
                value: currencyOrDash(pick(totals, ["total_net_proceeds"])),
              },
              {
                column: "principal",
                value: currencyOrDash(pick(totals, ["total_principal"])),
              },
            ]
          : undefined,
      emptyText: "No loans were released in the selected period.",
    });
  }

  return {
    reportId: "disbursement_report",
    meta: meta("Disbursement Summary", range, "Loan releases during the selected period"),
    sections,
  };
}

// ---------------------------------------------------------------------------
// List reports
// ---------------------------------------------------------------------------

export function buildReleasesListDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeReleaseRow);
  // Every money total is the server's period-wide figure, or "—" when it sent
  // none: never the rows on this page added up.
  const principal = pick(totals, ["total_principal", "principal", "principal_amount"]);
  const netProceeds = pick(totals, ["total_net_proceeds"]);

  const items: KpiItem[] = [
    kpi("Total Releases", countOrDash(totalRows ?? rows.length)),
    kpi("Total Principal", currencyOrDash(principal), { tone: "positive" }),
  ];
  // Only shown when the API sends period-wide totals — never summed from a page.
  if (netProceeds !== null) {
    items.push(
      kpi("Net Proceeds", currencyOrDash(netProceeds), {
        hint: "Released less deductions",
      })
    );
  }
  // Never the deprecated `total_outstanding_balance`, principal plus premium.
  items.push(
    kpi("Principal Balance", currencyOrDash(pick(totals, ["outstanding_principal"]))),
    kpi("Outstanding", currencyOrDash(pick(totals, ["total_outstanding"])))
  );

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  const note = serverTotalsTruncationNote(rows.length, totalRows, "loans", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Releases",
    columns: RELEASE_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [{ column: "principal", label: "Total", value: currencyOrDash(principal) }]
        : undefined,
    emptyText: "No loans were released in the selected period.",
  });

  return {
    reportId: "releases_list",
    meta: meta("Releases List", range, "Loans released during the selected period"),
    sections,
  };
}

export function buildRepaymentsListDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeRepaymentRow);
  // Server totals only; "—" when one was not sent, never a page sum.
  const amount = pick(totals, ["total_amount_paid", "amount", "total_amount", "amount_paid"]);
  const penalty = pick(totals, [
    "total_penalty_applied",
    "penalty_amount",
    "total_penalty",
    "penalty_applied",
  ]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Repayments", countOrDash(totalRows ?? rows.length)),
        kpi("Total Collected", currencyOrDash(amount), {
          tone: "positive",
          // The premium total always shows, "—" when the server sent none,
          // so a missing figure is never read as "no premium collected".
          hint: [
            `Insurance premium ${currencyOrDash(pick(totals, ["total_insurance_applied"]))}`,
            breakdownHint([
              ["Principal", pick(totals, ["total_principal_applied"])],
              ["Interest", pick(totals, ["total_interest_applied"])],
            ]),
          ]
            .filter((segment): segment is string => segment !== undefined)
            .join(" · "),
        }),
        kpi("Penalty Collected", currencyOrDash(penalty)),
      ],
    },
  ];

  const note = serverTotalsTruncationNote(rows.length, totalRows, "repayments", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Repayments",
    columns: REPAYMENT_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "amount", label: "Total", value: currencyOrDash(amount) },
            { column: "penalty_amount", value: currencyOrDash(penalty) },
          ]
        : undefined,
    emptyText: "No repayments were recorded in the selected period.",
  });

  return {
    reportId: "repayments_list",
    meta: meta("Repayments List", range, "All repayments recorded in the selected period"),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Subject-scoped reports — one loan, or one borrower
// ---------------------------------------------------------------------------

const SOA_SCHEDULE_COLUMNS: ReportColumn[] = [
  { key: "period_number", header: "Period", format: "number", align: "center", width: 70 },
  { key: "due_date", header: "Due Date", format: "date", width: 110 },
  {
    key: "beginning_balance",
    header: "Beginning Principal",
    format: "currency",
    align: "right",
    width: 150,
  },
  { key: "principal_due", header: "Principal", format: "currency", align: "right", width: 120 },
  { key: "interest_due", header: "Interest", format: "currency", align: "right", width: 110 },
  { key: "penalty_amount", header: "Penalty", format: "currency", align: "right", width: 110 },
  { key: "total_due", header: "Total Due", format: "currency", align: "right", width: 130 },
  // Each period's own figures, penalty included. "Total Paid" in the summary is
  // everything received, so these two say what they cover.
  { key: "total_paid", header: "Period Paid", format: "currency", align: "right", width: 120 },
  { key: "balance", header: "Period Balance", format: "currency", align: "right", width: 130 },
  { key: "status", header: "Status", format: "text", width: 100 },
];

/** A ledger's transaction lines; the subsidiary ledger reads these. */
const TRANSACTION_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 110 },
  { key: "reference", header: "Reference", format: "text", width: 140 },
  { key: "particulars", header: "Particulars", format: "text", width: 220 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "debit", header: "Debit", format: "currency", align: "right", width: 130 },
  { key: "credit", header: "Credit", format: "currency", align: "right", width: 130 },
  { key: "running_balance", header: "Balance", format: "currency", align: "right", width: 140 },
];

/** Added after Total Due on a loan with a Share Capital Build-Up. */
const SOA_BUILD_UP_SCHEDULE_COLUMNS: ReportColumn[] = [
  { key: "build_up_due", header: "Share Capital Build-Up", format: "currency", align: "right", width: 180 },
  { key: "total_payment", header: "Total Payment", format: "currency", align: "right", width: 130 },
];

function soaScheduleColumns(hasBuildUp: boolean): ReportColumn[] {
  if (!hasBuildUp) return SOA_SCHEDULE_COLUMNS;
  const afterTotalDue = SOA_SCHEDULE_COLUMNS.findIndex((c) => c.key === "total_due") + 1;
  return [
    ...SOA_SCHEDULE_COLUMNS.slice(0, afterTotalDue),
    ...SOA_BUILD_UP_SCHEDULE_COLUMNS,
    ...SOA_SCHEDULE_COLUMNS.slice(afterTotalDue),
  ];
}

/**
 * The Statement of Account's lines split each amount the way the server applied
 * it, so a line adds up to the amount received, and end on the principal
 * balance. The split is the server's: nothing here is worked out from the amount.
 */
function soaTransactionColumns(
  hasBuildUp: boolean,
  hasOverpayment: boolean,
  hasPremium: boolean
): ReportColumn[] {
  const money = (key: string, header: string, width: number): ReportColumn => ({
    key,
    header,
    format: "currency",
    align: "right",
    width,
  });
  const [date, reference, particulars, method, debit, credit] = TRANSACTION_COLUMNS;
  return [
    date,
    reference,
    particulars,
    // Wider than the ledger's: this one also carries the reference number.
    { ...method, width: 190 },
    // The whole receipt. Credit is what it took off the debt, so it leaves out
    // build-up and overpayment.
    money("amount_paid", "Receipt Amount", 130),
    debit,
    credit,
    money("principal_applied", "Principal", 120),
    money("interest_applied", "Interest", 110),
    money("penalty_applied", "Penalty", 110),
    ...(hasPremium ? [money("insurance_applied", "Insurance Premium", 140)] : []),
    ...(hasBuildUp ? [money("build_up_applied", "Build-Up", 110)] : []),
    ...(hasOverpayment ? [money("overpayment_applied", "Overpayment", 120)] : []),
    money("principal_balance", "Principal Balance", 140),
  ];
}

function normalizeScheduleRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    period_number: pick(raw, ["period_number", "period", "installment_number"]),
    due_date: pick(raw, ["due_date", "scheduled_date", "date"]),
    beginning_balance: pick(raw, ["beginning_balance", "opening_balance"]),
    principal_due: pick(raw, ["principal_due", "principal"]),
    interest_due: pick(raw, ["interest_due", "interest"]),
    penalty_amount: pick(raw, ["penalty_amount", "penalty", "penalty_due"]),
    total_due: pick(raw, ["total_due", "amount_due", "scheduled_amount"]),
    build_up_due: pick(raw, ["build_up_due"]),
    total_payment: pick(raw, ["total_payment"]),
    // What the server says was paid on the period; "—" when it is missing, never
    // `amount_paid` or the components added here.
    total_paid: pick(raw, ["total_paid"]),
    // What the period still owes, as the server worked it out; "—" without it.
    balance: pick(raw, ["amount_remaining"]),
    status: periodStatusText(pick(raw, ["status"])),
    note: pick(raw, ["note"]),
  };
}

/** A period's status in words with capitals: `partial` reads "Partial". */
function periodStatusText(value: unknown): unknown {
  return typeof value === "string"
    ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;
}

/**
 * Ledger lines arrive either already split into debit/credit columns, or as a
 * single signed/typed amount. Both are normalized to the two-column form a
 * statement is read in.
 */
function normalizeTransactionRow(raw: Record<string, unknown>): Record<string, unknown> {
  const explicitDebit = toNumber(pick(raw, ["debit", "debit_amount"]));
  const explicitCredit = toNumber(pick(raw, ["credit", "credit_amount"]));
  const amount = toNumber(pick(raw, ["amount", "amount_paid", "total_amount"]));
  const type = String(pick(raw, ["type", "entry_type", "transaction_type"]) ?? "").toLowerCase();

  // A release/charge debits the loan; a repayment credits it.
  const isCredit = /payment|repayment|credit|collection/.test(type);
  const isDebit = /release|charge|debit|interest|penalty|disburse/.test(type);

  return {
    date: pick(raw, ["date", "transaction_date", "paid_at", "payment_date", "created_at"]),
    // The receipt number; never the row's database id. "—" without one.
    reference: pick(raw, ["receipt_number", "reference", "reference_no", "receipt_no", "or_number"]),
    particulars:
      pick(raw, ["particulars", "description", "remarks", "narration"]) ??
      (type ? type.replace(/_/g, " ") : null),
    method: paymentMethodText(pick(raw, ["method", "payment_method"])),
    debit: explicitDebit ?? (isDebit && !isCredit ? amount : null),
    credit: explicitCredit ?? (isCredit ? amount : null),
    running_balance: pick(raw, ["running_balance", "balance", "outstanding_balance"]),
  };
}

/**
 * One Statement of Account line, as the loan's Ledger has it: the release, a
 * charge, a payment, a waiver or an adjustment. Every figure is the server's, and
 * a line without one shows "—".
 *
 * Only a payment line shows its receipt amount and applied parts. The server
 * gives a release or charge negative parts ("-₱60,000.00"), which say the same as
 * its debit, so those lines show the debit and a dash in each part.
 *
 * A voided payment stays listed and moves nothing: its receipt's amount is in
 * the mark, never under Credit, and the server's totals leave it out.
 *
 * `balance` is the alias of `principal_balance` the server keeps for one release;
 * `running_balance` is another figure (principal plus premium), so it is never
 * read for this column.
 */
function normalizeSoaTransactionRow(raw: Record<string, unknown>): Record<string, unknown> {
  const method = paymentMethodText(pick(raw, ["payment_method", "method"]));
  const reference = pick(raw, ["reference_number"]);
  const referenceText = reference ? `Ref. ${reference}` : null;
  const line = normalizeTransactionRow(raw);
  const voided = pick(raw, ["voided"]) === true;
  const type = pick(raw, ["type"]);
  const isPayment = typeof type !== "string" || /payment/.test(type);
  const part = (key: string) => (isPayment ? toNumber(pick(raw, [key])) : null);

  return {
    ...line,
    particulars: voided
      ? voidedParticulars(line.particulars, pick(raw, ["amount_paid"]))
      : line.particulars,
    amount_paid: isPayment && !voided ? toNumber(pick(raw, ["amount_paid"])) : null,
    debit: voided ? null : line.debit,
    credit: voided ? null : line.credit,
    voided,
    method: method && referenceText ? `${method} (${referenceText})` : (method ?? referenceText),
    principal_applied: part("principal_applied"),
    interest_applied: part("interest_applied"),
    penalty_applied: part("penalty_applied"),
    insurance_applied: part("insurance_applied"),
    build_up_applied: part("build_up_applied"),
    overpayment_applied: part("overpayment_applied"),
    principal_balance: pick(raw, ["principal_balance", "balance"]),
  };
}

/** A voided line's words: the mark, capitalised, and the receipt's amount when sent. */
function voidedParticulars(particulars: unknown, amount: unknown): string {
  const text = typeof particulars === "string" ? particulars : "";
  const marked = /void/i.test(text)
    ? text.replace("(voided)", "(Voided)")
    : text === ""
      ? "Voided"
      : `${text} (Voided)`;
  const receipt = toNumber(amount);
  return receipt !== null && receipt > 0 ? `${marked}: ${formatCurrency(receipt)}` : marked;
}

type AccountField = [string, unknown, "text" | "currency" | "date" | "rate"];

function rateField(loan: Record<string, unknown> | null): AccountField[] {
  const label = pick(loan, ["rate_label"]);
  return label
    ? [["Interest Rate", label, "text"]]
    : [["Interest Rate", pick(loan, ["interest_rate", "rate"]), "rate"]];
}

/** Label→value particulars for the account the statement covers. */
function accountFields(
  loan: Record<string, unknown> | null,
  borrower: Record<string, unknown> | null
): FieldItem[] {
  const fields: AccountField[] = [
    ["Member", pick(borrower, ["full_name", "name", "borrower_name"]), "text"],
    ["Member No.", pick(borrower, ["borrower_code", "member_no", "code"]), "text"],
    ["Address", pick(loan, ["member_address"]) ?? pick(borrower, ["address"]), "text"],
    ["Loan Account No.", pick(loan, ["loan_account_number", "account_number"]), "text"],
    ["Application No.", pick(loan, ["application_number"]), "text"],
    ["Loan Product", pick(loan, ["product_name", "loan_product_name"]), "text"],
    ["Branch", pick(loan, ["branch_name"]), "text"],
    ["Account Officer", pick(loan, ["account_officer_name"]), "text"],
    ["Principal", pick(loan, ["principal_amount", "principal"]), "currency"],
    // The server's labels carry the units ("3.0% per month", "6 months").
    ...rateField(loan),
    ["Interest Type", pick(loan, ["interest_type"]), "text"],
    ["Term", pick(loan, ["term_label", "term"]), "text"],
    ["Payment Frequency", pick(loan, ["payment_frequency"]), "text"],
    // Only a loan that has been extended has anything to say here.
    ["Extensions", (toNumber(pick(loan, ["extensions_count"])) ?? 0) > 0 ? pick(loan, ["extensions_count"]) : null, "text"],
    ["Release Date", pick(loan, ["release_date", "released_at"]), "date"],
    ["Maturity Date", pick(loan, ["maturity_date", "end_date"]), "date"],
    // The server's label reads "Past Due" when the Past Due figure is above
    // ₱0.00, which `status` alone can't say.
    ["Status", pick(loan, ["status_label"]) ?? loanStatusText(pick(loan, ["status"])), "text"],
  ];

  // Only particulars the API actually sent — a statement padded with dashes
  // reads as missing data rather than as an inapplicable field.
  return fields
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value, format]) => ({
      label,
      value: formatValue(value, format),
    }));
}

/** Red only when something is actually owed: ₱0.00 and a dash are nothing wrong. */
function owedTone(value: unknown): KpiItem["tone"] {
  return (toNumber(value) ?? 0) > 0 ? "negative" : "neutral";
}

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The notes under the schedule. The server's own note names what restated or
 * replaced a period. Without it, each period's own note is listed, because a
 * period number can otherwise skip with no explanation.
 */
function scheduleNotes(note: unknown, rows: Record<string, unknown>[]): ReportSection[] {
  if (typeof note === "string" && note !== "") return [{ kind: "note", text: note }];
  return rows.flatMap((row): ReportSection[] =>
    typeof row.note === "string" && row.note !== ""
      ? [{ kind: "note", text: `Period ${row.period_number}: ${row.note}` }]
      : []
  );
}

/**
 * The range is not read: this statement covers the whole loan up to the server's
 * `as_of`, whatever range a caller holds. The signature keeps it because the
 * catalog's mapper type and the loan page both pass one.
 */
export function buildStatementOfAccountDoc(raw: unknown, range?: DateRange): ReportDocument;
export function buildStatementOfAccountDoc(raw: unknown): ReportDocument {
  const obj = asRecord(raw);
  const loan = asRecord(pick(obj, ["loan"])) ?? obj;
  const borrower = asRecord(pick(obj, ["borrower"])) ?? asRecord(pick(loan, ["borrower"]));
  const summary = asRecord(pick(obj, ["summary", "balance", "totals"]));
  // Both footers are the server's own totals; a figure it did not send is "—",
  // never a column added up here.
  const scheduleTotals = asRecord(pick(obj, ["schedule_totals"]));
  const transactionTotals = asRecord(pick(obj, ["transaction_totals"]));

  const scheduleRows = asArray(
    pick(obj, ["schedule", "amortization_schedule", "schedules", "installments"])
  ).map(normalizeScheduleRow);
  const transactionRows = asArray(
    pick(obj, ["transactions", "repayments", "payments", "ledger", "entries"])
  ).map(normalizeSoaTransactionRow);
  const hasBuildUp = pick(loan, ["has_build_up"]) === true;
  const hasOverpayment = transactionRows.some(
    (row) => row.overpayment_applied !== null && row.overpayment_applied !== 0
  );
  const hasPremium = transactionRows.some(
    (row) => row.insurance_applied !== null && row.insurance_applied !== 0
  );

  const outstanding =
    pick(summary, ["outstanding_balance", "total_balance", "balance"]) ??
    pick(obj, ["outstanding_balance", "balance"]);
  const totalPaid =
    pick(summary, ["total_paid", "amount_paid", "total_amount_paid"]) ??
    pick(obj, ["total_paid"]);

  const overdueAmount = pick(summary, ["overdue_amount"]);

  const sections: ReportSection[] = [];

  const fields = accountFields(loan, borrower);
  if (fields.length > 0) {
    sections.push({ kind: "fields", title: "Account Particulars", items: fields });
  }

  sections.push({
    kind: "kpi_grid",
    title: "Balance Summary",
    items: [
      kpi("Principal", currencyOrDash(pick(loan, ["principal_amount", "principal"]))),
      kpi("Total Paid", currencyOrDash(totalPaid), { tone: "positive" }),
      kpi("Outstanding Balance", currencyOrDash(outstanding), {
        tone: owedTone(outstanding),
        hint: "Principal, interest, penalty and insurance premium still owed",
      }),
      // The server's grace-rule figure, the same as the loan summary's
      // overdue amount; "—" when it was not sent.
      kpi("Past Due", currencyOrDash(overdueAmount), { tone: owedTone(overdueAmount) }),
      kpi("Insurance Premium Owed", currencyOrDash(pick(summary, ["insurance_owed"]))),
    ],
  });

  // Total Paid is everything received. Its parts are how it reconciles with the
  // narrower figures on the schedule; each is the server's, never worked out.
  sections.push({
    kind: "fields",
    title: "What Has Been Paid",
    items: [
      { label: "Principal Paid", value: currencyOrDash(pick(summary, ["principal_paid"])) },
      { label: "Interest Paid", value: currencyOrDash(pick(summary, ["interest_paid"])) },
      { label: "Penalty Paid", value: currencyOrDash(pick(summary, ["penalty_paid"])) },
      { label: "Insurance Premium Paid", value: currencyOrDash(pick(summary, ["insurance_paid"])) },
      ...(hasBuildUp
        ? [{ label: "Share Capital Build-Up Paid", value: currencyOrDash(pick(summary, ["build_up_paid"])) }]
        : []),
      // Excess a payment left over, which the parts above leave out.
      ...((toNumber(pick(summary, ["overpayment_paid"])) ?? 0) > 0
        ? [{ label: "Overpayment", value: currencyOrDash(pick(summary, ["overpayment_paid"])) }]
        : []),
      { label: "Total Paid", value: currencyOrDash(totalPaid) },
    ],
  });

  sections.push({
    kind: "table",
    title: "Amortization Schedule",
    columns: soaScheduleColumns(hasBuildUp),
    compact: hasBuildUp,
    rows: scheduleRows,
    totals:
      scheduleRows.length > 0
        ? [
            {
              column: "principal_due",
              label: "Total",
              value: currencyOrDash(pick(scheduleTotals, ["principal_due"])),
            },
            {
              column: "interest_due",
              value: currencyOrDash(pick(scheduleTotals, ["interest_due"])),
            },
            {
              column: "penalty_amount",
              value: currencyOrDash(pick(scheduleTotals, ["penalty_amount"])),
            },
            { column: "total_due", value: currencyOrDash(pick(scheduleTotals, ["total_due"])) },
            ...(hasBuildUp
              ? [
                  {
                    column: "build_up_due",
                    value: currencyOrDash(pick(scheduleTotals, ["build_up_due"])),
                  },
                  {
                    column: "total_payment",
                    value: currencyOrDash(pick(scheduleTotals, ["total_payment"])),
                  },
                ]
              : []),
            {
              column: "total_paid",
              value: currencyOrDash(pick(scheduleTotals, ["total_paid"])),
            },
            { column: "balance", value: currencyOrDash(pick(scheduleTotals, ["balance"])) },
          ]
        : undefined,
    emptyText: "No amortization schedule is available for this loan.",
  });

  sections.push(...scheduleNotes(pick(obj, ["schedule_note"]), scheduleRows));

  sections.push({
    kind: "table",
    title: "Transaction History",
    columns: soaTransactionColumns(hasBuildUp, hasOverpayment, hasPremium),
    compact: true,
    rows: transactionRows,
    totals:
      transactionRows.length > 0
        ? [
            {
              column: "amount_paid",
              label: "Total",
              // Every posted receipt is on a line, so Total Paid is this column's
              // total when the lines' isn't sent. The Credit total is smaller:
              // Debit less Credit is what is owed.
              value: currencyOrDash(pick(transactionTotals, ["amount_paid"]) ?? totalPaid),
            },
            { column: "debit", value: currencyOrDash(pick(transactionTotals, ["debit"])) },
            { column: "credit", value: currencyOrDash(pick(transactionTotals, ["credit"])) },
            ...(hasPremium
              ? [
                  {
                    column: "insurance_applied",
                    // Every collected premium is on a line, so the summary's
                    // figure is this column's total when the lines' isn't sent.
                    value: currencyOrDash(
                      pick(transactionTotals, ["insurance_applied"]) ?? pick(summary, ["insurance_paid"])
                    ),
                  },
                ]
              : []),
            ...(hasOverpayment
              ? [
                  {
                    column: "overpayment_applied",
                    value: currencyOrDash(pick(transactionTotals, ["overpayment_applied"])),
                  },
                ]
              : []),
          ]
        : undefined,
    emptyText: "No transactions have been recorded against this loan.",
  });

  return {
    reportId: "statement_of_account",
    meta: {
      title: "Statement of Account",
      subtitle: pick(loan, ["loan_account_number", "account_number"])
        ? `Loan ${pick(loan, ["loan_account_number", "account_number"])}`
        : "Schedule, payments, and balance for a single loan",
      asOf: formatValue(pick(obj, ["as_of"]), "date"),
      generatedAt: formatGeneratedAt(),
      org: "",
      referenceKey: textOrUndefined(pick(loan, ["loan_account_number", "account_number"])),
    },
    sections,
  };
}

const LEDGER_LOAN_COLUMNS: ReportColumn[] = [
  { key: "loan_account_number", header: "Loan #", format: "text", width: 130 },
  { key: "release_date", header: "Released", format: "date", width: 110 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 140 },
  { key: "total_paid", header: "Total Paid", format: "currency", align: "right", width: 140 },
  { key: "principal_balance", header: "Principal Balance", format: "currency", align: "right", width: 150 },
  { key: "outstanding", header: "Outstanding", format: "currency", align: "right", width: 140 },
  { key: "overdue", header: "Past Due", format: "currency", align: "right", width: 130 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

function normalizeLedgerLoanRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    loan_account_number: pick(raw, [
      "loan_account_number",
      "account_number",
      "application_number",
    ]),
    release_date: pick(raw, ["release_date", "released_at", "start_date"]),
    principal: pick(raw, ["principal_amount", "principal"]),
    total_paid: pick(raw, ["total_paid", "amount_paid", "total_amount_paid"]),
    // The server's two figures, as the loan pages name them: unpaid principal,
    // and everything still owed (principal, interest, penalty and premium).
    // Never the deprecated `outstanding_balance`, which is principal plus
    // premium and was labelled Outstanding.
    principal_balance: pick(raw, ["outstanding_principal"]),
    outstanding: pick(raw, ["total_outstanding"]),
    overdue: pick(raw, ["overdue_amount", "past_due_amount", "total_overdue"]),
    // The server's display_status: Past Due for a released or ongoing loan
    // past grace, as the loans screens read it; otherwise the stored status.
    status: loanStatusText(pick(raw, ["display_status", "status"])),
  };
}

export function buildSubsidiaryLedgerDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const borrower = asRecord(pick(obj, ["borrower", "member"])) ?? obj;
  // Every ledger total is the server's; a figure it did not send is "—",
  // never the loan rows added up.
  const totals = asRecord(pick(obj, ["totals"]));
  const loansTotals = asRecord(pick(obj, ["loans_totals"]));
  const totalPrincipal = pick(totals, ["total_principal"]);
  const totalPaid = pick(totals, ["total_paid"]);
  const totalOutstanding = pick(totals, ["total_outstanding"]);

  const loanRows = asArray(pick(obj, ["loans", "accounts"])).map(normalizeLedgerLoanRow);
  const entryRows = asArray(
    pick(obj, ["entries", "transactions", "ledger", "payments", "repayments"])
  ).map(normalizeTransactionRow);

  const sections: ReportSection[] = [];

  const memberFields: [string, unknown][] = [
    ["Member", pick(borrower, ["full_name", "name", "borrower_name"])],
    ["Member No.", pick(borrower, ["borrower_code", "member_no", "code"])],
    ["Branch", pick(borrower, ["branch_name"]) ?? pick(asRecord(borrower?.branch), ["name"])],
    ["Status", pick(borrower, ["status"])],
  ];
  const fields = memberFields
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
  if (fields.length > 0) {
    sections.push({ kind: "fields", title: "Member Particulars", items: fields });
  }

  sections.push({
    kind: "kpi_grid",
    title: "Ledger Summary",
    items: [
      kpi("Total Loans", countOrDash(pick(totals, ["total_loans"]))),
      kpi("Total Released", currencyOrDash(totalPrincipal)),
      kpi("Total Paid", currencyOrDash(totalPaid), { tone: "positive" }),
      kpi("Outstanding", currencyOrDash(totalOutstanding), { tone: "negative" }),
    ],
  });

  sections.push({
    kind: "table",
    title: "Loan Accounts",
    columns: LEDGER_LOAN_COLUMNS,
    rows: loanRows,
    totals:
      loanRows.length > 0
        ? [
            { column: "principal", label: "Total", value: currencyOrDash(totalPrincipal) },
            { column: "total_paid", value: currencyOrDash(totalPaid) },
            { column: "principal_balance", value: currencyOrDash(pick(loansTotals, ["outstanding_principal"])) },
            { column: "outstanding", value: currencyOrDash(totalOutstanding) },
            { column: "overdue", value: currencyOrDash(pick(loansTotals, ["overdue_amount"])) },
          ]
        : undefined,
    emptyText: "This member has no loan accounts on record.",
  });

  // Only rendered when the API returns entries — an empty transaction table on
  // a ledger reads as "no payments", which would be a claim we cannot make.
  // No totals row: the server states no debit or credit total for the entries.
  if (entryRows.length > 0) {
    sections.push({
      kind: "table",
      title: "Payment History",
      columns: TRANSACTION_COLUMNS,
      rows: entryRows,
    });
  }

  return {
    reportId: "subsidiary_ledger",
    meta: meta(
      "Subsidiary Ledger",
      range,
      pick(borrower, ["full_name", "name"])
        ? String(pick(borrower, ["full_name", "name"]))
        : "All loans and payments for a single member"
    ),
    sections,
  };
}

export function buildDuePastDueListDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeDueRow);
  // Every money figure below, KPI and footer alike, is the server's
  // period-wide total or "—" when it sent none: never this page added up, so
  // the footer never mixes a period total in one column with a page sum in
  // the next.
  const due = pick(totals, ["total_due", "amount_due", "total_amount_due"]);
  const balance = pick(totals, ["total_balance", "amount_remaining", "total_remaining", "balance"]);

  const serverOverdueCount = toNumber(
    pick(totals, ["overdue_count", "overdue", "past_due_count"])
  );
  const overdueCount =
    serverOverdueCount ??
    rows.filter((r) => (toNumber(r.days_overdue) ?? 0) > 0).length;

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Schedules", countOrDash(totalRows ?? rows.length)),
        kpi("Overdue Count", countOrDash(overdueCount), {
          tone: overdueCount > 0 ? "negative" : "neutral",
        }),
        kpi("Total Amount Due", currencyOrDash(due), {
          tone: "negative",
          hint: breakdownHint([
            ["Principal", pick(totals, ["total_principal_due"])],
            ["Interest", pick(totals, ["total_interest_due"])],
            ["Penalty", pick(totals, ["total_penalty"])],
          ]),
        }),
        kpi("Total Balance", currencyOrDash(balance)),
      ],
    },
  ];

  const note = serverTotalsTruncationNote(rows.length, totalRows, "schedules", totals);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Due / Past Due",
    columns: DUE_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            {
              column: "principal_due",
              label: "Total",
              value: currencyOrDash(pick(totals, ["total_principal_due"])),
            },
            { column: "interest_due", value: currencyOrDash(pick(totals, ["total_interest_due"])) },
            { column: "penalty_amount", value: currencyOrDash(pick(totals, ["total_penalty"])) },
            { column: "amount_due", value: currencyOrDash(due) },
            {
              column: "amount_paid",
              value: currencyOrDash(pick(totals, ["total_paid", "total_amount_paid"])),
            },
            { column: "balance", value: currencyOrDash(balance) },
          ]
        : undefined,
    emptyText: "No schedules due or past due for the selected period.",
  });

  return {
    reportId: "due_past_due_list",
    meta: meta(
      "Due / Past Due List",
      range,
      "Schedules due or overdue as of the selected period"
    ),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Financial & performance reports
//
// Shared shape helpers first: these six reports are `{ data }`-wrapped
// summaries (not paginators), so they read a nested block or two and a couple
// of breakdown arrays. A null payload — a failed request — must still produce
// the full document shell with "—" in place of every figure, exactly as the
// older builders do.
// ---------------------------------------------------------------------------

/** Particulars → amount: the two columns a financial statement is read in. */
const STATEMENT_COLUMNS: ReportColumn[] = [
  { key: "particulars", header: "Particulars", format: "text", width: 280 },
  { key: "amount", header: "Amount", format: "currency", align: "right", width: 170 },
];

// Extends the row type the table section takes, so statement lines can be
// handed to `kind: "table"` directly instead of being mapped into it.
interface StatementLine extends Record<string, unknown> {
  particulars: string;
  amount: number | null;
}

/** `[label, key aliases]` → statement lines read off one payload block. */
function statementLines(
  block: Record<string, unknown> | null,
  spec: [string, string[]][]
): StatementLine[] {
  return spec.map(([particulars, keys]) => ({
    particulars,
    amount: toNumber(pick(block, keys)),
  }));
}

/**
 * The server's figure for one key, or null when it sent none. Reads exactly
 * that key: a total or a rate the server omitted is "—", never re-derived from
 * the rows or the other figures beside it.
 */
function serverFigure(block: Record<string, unknown> | null, key: string): number | null {
  return toNumber(pick(block, [key]));
}

/** Positive figures read green, negative red — a net movement is either. */
function movementTone(value: number | null): KpiItem["tone"] {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

/** A "Total" footer cell, dashed when the figure is unknown. */
function totalCell(column: string, value: number | null, label?: string) {
  return { column, label, value: currencyOrDash(value) };
}

// ---------------------------------------------------------------------------
// Cash Flow
// ---------------------------------------------------------------------------

/**
 * Repayment components, read off `inflows.repayments`.
 *
 * The API nests them: `inflows` carries the repayment block and the share
 * capital credit side by side, then its own `total`. The flat aliases are the
 * fallback for a payload that never nested them.
 */
const CASH_INFLOW_REPAYMENT_LINES: [string, string[]][] = [
  ["Principal collected", ["principal", "principal_applied", "principal_collected"]],
  ["Interest collected", ["interest", "interest_applied", "interest_collected"]],
  ["Penalty collected", ["penalty", "penalty_applied", "penalty_collected"]],
  // Premium owed on a loan, collected first from its payments: cash in,
  // inside the repayments total, never income.
  ["Insurance premium collected", ["insurance", "insurance_applied", "insurance_collected"]],
  ["Overpayment received", ["overpayment", "overpayment_received", "excess"]],
];

const SHARE_CAPITAL_CREDIT_KEYS = [
  "share_capital_credit",
  "share_capital_contributions",
  "share_capital",
];

const SHARE_CAPITAL_DEBIT_KEYS = [
  "share_capital_debit",
  "share_capital_withdrawals",
  "share_capital",
];

/**
 * Read a nested sub-block's figure, or the same figure flat on its parent.
 *
 * `total` is only ever consulted INSIDE the sub-block: `outflows.releases.total`
 * is the release total, while `outflows.total` also carries share capital, and
 * reading the second as the first would double-count it into the release line.
 */
function nestedFigure(
  parent: Record<string, unknown> | null,
  blockKey: string,
  innerKeys: string[],
  flatKeys: string[]
): number | null {
  const block = asRecord(pick(parent, [blockKey]));
  if (block) return toNumber(pick(block, innerKeys));
  return toNumber(pick(parent, flatKeys));
}

const CASH_FLOW_BRANCH_COLUMNS: ReportColumn[] = [
  { key: "branch_name", header: "Branch", format: "text", width: 190 },
  { key: "inflows", header: "Cash In", format: "currency", align: "right", width: 155 },
  { key: "outflows", header: "Cash Out", format: "currency", align: "right", width: 155 },
  { key: "net", header: "Net Movement", format: "currency", align: "right", width: 165 },
];

function cashFlowBranchRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((raw) => ({
    branch_name: pick(raw, ["branch_name", "name"]) ?? "Unassigned",
    inflows: serverFigure(raw, "inflow_total"),
    outflows: serverFigure(raw, "outflow_total"),
    // The row's own net: never cash in less cash out worked out here.
    net: serverFigure(raw, "net_movement"),
  }));
}

/**
 * Money in versus money out for the period — the report a lending office runs
 * daily, and the one figure it runs it for is the net movement. That is why
 * the net is restated as its own block rather than left as one KPI card among
 * four.
 */
export function buildCashFlowDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const inflowBlock = asRecord(pick(obj, ["inflows", "cash_in"]));
  const outflowBlock = asRecord(pick(obj, ["outflows", "cash_out"]));
  const shareBlock = asRecord(pick(obj, ["share_capital"]));

  // Repayment components live one level down, under `inflows.repayments`.
  const repayments = asRecord(pick(inflowBlock, ["repayments"])) ?? inflowBlock;

  const inflowLines: StatementLine[] = [
    ...statementLines(repayments, CASH_INFLOW_REPAYMENT_LINES),
    {
      particulars: "Share capital contributions",
      amount:
        toNumber(pick(inflowBlock, SHARE_CAPITAL_CREDIT_KEYS)) ??
        toNumber(pick(shareBlock, ["credit"])),
    },
  ];

  const outflowLines: StatementLine[] = [
    {
      particulars: "Loan releases (net proceeds)",
      amount: nestedFigure(
        outflowBlock,
        "releases",
        ["net_proceeds", "total"],
        ["net_proceeds", "loan_releases", "releases"]
      ),
    },
    {
      particulars: "Share capital withdrawals",
      amount:
        toNumber(pick(outflowBlock, SHARE_CAPITAL_DEBIT_KEYS)) ??
        toNumber(pick(shareBlock, ["debit"])),
    },
  ];

  // The three headline figures are the server's. A missing one is "—": the
  // lines are never added up, nor one total taken from the other.
  const totalIn = serverFigure(inflowBlock, "total");
  const totalOut = serverFigure(outflowBlock, "total");
  const net = serverFigure(obj, "net_movement");

  // Deductions are withheld at release and never leave the till, so they are
  // not an outflow. Shown beside the statement so the gross principal released
  // can still be reconciled against the net proceeds paid out.
  const nonCashBlock = asRecord(pick(obj, ["non_cash"]));
  const nonCash =
    pick(nonCashBlock, ["total_deductions", "deductions"]) ??
    pick(obj, ["total_deductions"]);
  const principalReleased = pick(nonCashBlock, ["principal_released"]);

  const branchRows = cashFlowBranchRows(asArray(pick(obj, ["by_branch", "branches"])));
  const branchTotals = asRecord(pick(obj, ["by_branch_totals"]));

  // Share capital credited from loan payments (build-up), net of voids. It is
  // cash already inside the repayment's overpayment, so the server leaves it
  // out of the share capital lines and every total; said here so a reader can
  // reconcile with the Share Capital report, which counts it.
  const buildUp = toNumber(pick(shareBlock, ["build_up_from_payments"]));
  const buildUpNote: ReportSection[] =
    buildUp === null || buildUp === 0
      ? []
      : [
          {
            kind: "note",
            text:
              `Share capital build-up from loan payments (${currencyOrDash(buildUp)}, net of voids) ` +
              "is cash already counted in Overpayment received, so it is not repeated under " +
              "Share capital contributions. The Share Capital report includes it in the members' credits.",
          },
        ];

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Cash In", currencyOrDash(totalIn), { tone: "positive" }),
        kpi("Total Cash Out", currencyOrDash(totalOut), { tone: "negative" }),
        kpi("Net Movement", currencyOrDash(net), { tone: movementTone(net) }),
        kpi("Non-Cash Deductions", currencyOrDash(nonCash), {
          // principal_released = net_proceeds + total_deductions, so quoting
          // the gross figure lets the reader reconcile the release line above.
          hint:
            principalReleased === null
              ? "Withheld at release — never left the till"
              : `Withheld from ${currencyOrDash(principalReleased)} principal released`,
        }),
      ],
    },
    {
      kind: "table",
      title: "Cash Inflows",
      columns: STATEMENT_COLUMNS,
      rows: inflowLines,
      totals: [totalCell("amount", totalIn, "Total Cash Inflows")],
      emptyText: "No cash inflows were reported for this period.",
    },
    ...buildUpNote,
    {
      kind: "table",
      title: "Cash Outflows",
      columns: STATEMENT_COLUMNS,
      rows: outflowLines,
      totals: [totalCell("amount", totalOut, "Total Cash Outflows")],
      emptyText: "No cash outflows were reported for this period.",
    },
    {
      kind: "fields",
      title: "Net Cash Movement",
      items: [
        { label: "Total cash inflows", value: currencyOrDash(totalIn) },
        { label: "Less: total cash outflows", value: currencyOrDash(totalOut) },
        { label: "Net movement for the period", value: currencyOrDash(net) },
      ],
    },
  ];

  if (branchRows.length > 0) {
    sections.push({
      kind: "table",
      title: "Breakdown by Branch",
      columns: CASH_FLOW_BRANCH_COLUMNS,
      rows: branchRows,
      totals: [
        totalCell("inflows", serverFigure(branchTotals, "inflow_total"), "Total"),
        totalCell("outflows", serverFigure(branchTotals, "outflow_total")),
        totalCell("net", serverFigure(branchTotals, "net_movement")),
      ],
    });
    // Each branch row holds that branch's loan cash plus the share capital
    // paid in and out by its members (by the member's branch); a member with
    // no branch is in the server's "Unassigned" row (`branch_id` null).
    //
    // Always this plain sentence: the server's `share_capital.note` is written
    // for developers (field names and formulas) and is never printed on the
    // report. The sentence holds with or without a branch filter.
    sections.push({
      kind: "note",
      text:
        "Share capital paid in and out is in the row of the branch each member belongs to; " +
        "members with no branch are under Unassigned.",
    });
  }

  return {
    reportId: "cash_flow",
    meta: meta("Cash Flow Statement", range, "Cash received against cash paid out"),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Collection Efficiency
// ---------------------------------------------------------------------------

const EFFICIENCY_VALUE_COLUMNS: ReportColumn[] = [
  { key: "total_due", header: "Amount Due", format: "currency", align: "right", width: 160 },
  { key: "total_collected", header: "Collected", format: "currency", align: "right", width: 160 },
  { key: "uncollected", header: "Uncollected", format: "currency", align: "right", width: 150 },
  { key: "collection_rate", header: "Efficiency", format: "percent", align: "right", width: 110 },
];

function efficiencyColumns(header: string, width: number): ReportColumn[] {
  return [
    { key: "label", header, format: "text", width },
    ...EFFICIENCY_VALUE_COLUMNS,
  ];
}

/** The four figures the server sends on the headline and on every row. */
function efficiencyFigures(raw: Record<string, unknown> | null) {
  return {
    total_due: serverFigure(raw, "total_due"),
    total_collected: serverFigure(raw, "total_collected"),
    uncollected: serverFigure(raw, "uncollected"),
    collection_rate: serverFigure(raw, "collection_rate"),
  };
}

function normalizeEfficiencyRow(
  raw: Record<string, unknown>,
  labelKeys: string[],
  fallbackLabel: string
): Record<string, unknown> {
  return {
    label: pick(raw, labelKeys) ?? fallbackLabel,
    ...efficiencyFigures(raw),
  };
}

/**
 * Footer for an efficiency table: the headline four, as the server sent them.
 * The rate is the period rate, never the average of the rates above it —
 * averaging per-branch rates weights a branch with ₱5,000 due the same as one
 * with ₱5,000,000.
 */
function efficiencyTotals(headline: ReturnType<typeof efficiencyFigures>) {
  return [
    totalCell("total_due", headline.total_due, "Total"),
    totalCell("total_collected", headline.total_collected),
    totalCell("uncollected", headline.uncollected),
    { column: "collection_rate", value: percentOrDash(headline.collection_rate) },
  ];
}

/**
 * Due against collected, segmented by branch and by month.
 *
 * Daily Collection answers "how did today go" with one number; this answers
 * "which branch, and is it getting better or worse", which is the question a
 * manager actually asks.
 */
export function buildCollectionEfficiencyDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const headline = efficiencyFigures(obj);

  const branchRows = asArray(pick(obj, ["by_branch", "branches"])).map((r) =>
    normalizeEfficiencyRow(r, ["branch_name", "name"], "Unassigned")
  );
  const periodRows = asArray(pick(obj, ["by_period", "by_month", "periods"])).map((r) =>
    normalizeEfficiencyRow(r, ["period_label", "label", "period", "month"], DASH)
  );

  const sections: ReportSection[] = [
    {
        kind: "kpi_grid",
        items: [
          kpi("Total Due", currencyOrDash(headline.total_due)),
          kpi("Total Collected", currencyOrDash(headline.total_collected), { tone: "positive" }),
          kpi("Collection Efficiency", percentOrDash(headline.collection_rate), {
            hint: "Collected over due, scoped identically on both sides",
          }),
          kpi("Uncollected", currencyOrDash(headline.uncollected), { tone: "negative" }),
        ],
      },
      {
        kind: "table",
        title: "Efficiency by Branch",
        columns: efficiencyColumns("Branch", 200),
        rows: branchRows,
        totals:
          branchRows.length > 0 ? efficiencyTotals(headline) : undefined,
        emptyText: "No branch breakdown was returned for this period.",
      },
      {
        kind: "table",
        title: "Monthly Trend",
        columns: efficiencyColumns("Period", 140),
        rows: periodRows,
        totals:
          periodRows.length > 0 ? efficiencyTotals(headline) : undefined,
        emptyText: "No monthly breakdown was returned for this period.",
      },
  ];

  // A monthly bucket above 100% is real and must never be clamped: arrears
  // billed in June and settled in August make August collect more than August
  // billed. The server explains it, so its wording is what gets printed.
  const scopeNote = pick(obj, ["note"]);
  if (scopeNote !== null) {
    sections.push({ kind: "note", text: String(scopeNote) });
  }

  return {
    reportId: "collection_efficiency",
    meta: meta(
      "Collection Efficiency Report",
      range,
      "Amounts due against amounts collected, by branch and by month"
    ),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Loan Portfolio by Product
// ---------------------------------------------------------------------------

const PRODUCT_COLUMNS: ReportColumn[] = [
  { key: "product_name", header: "Loan Product", format: "text", width: 210 },
  { key: "loan_count", header: "Loans", format: "number", align: "right", width: 80 },
  { key: "total_released", header: "Released", format: "currency", align: "right", width: 155 },
  {
    key: "principal_balance",
    header: "Principal Balance",
    format: "currency",
    align: "right",
    width: 155,
  },
  {
    key: "outstanding",
    header: "Outstanding",
    format: "currency",
    align: "right",
    width: 155,
  },
  {
    key: "portfolio_share",
    header: "% of Book",
    format: "percent",
    align: "right",
    width: 105,
  },
  { key: "avg_interest_rate", header: "Avg Rate", format: "rate", align: "right", width: 100 },
  { key: "overdue_amount", header: "Overdue", format: "currency", align: "right", width: 145 },
  { key: "par_ratio", header: "PAR", format: "percent", align: "right", width: 90 },
];

function normalizeProductRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    product_name:
      pick(raw, ["product_name", "loan_product_name", "name"]) ?? "Unassigned",
    loan_count: pick(raw, ["loan_count", "loans", "count"]),
    total_released: pick(raw, ["total_released", "released", "principal"]),
    // Never the old `outstanding` or `outstanding_balance`, principal plus premium.
    principal_balance: pick(raw, ["outstanding_principal"]),
    outstanding: pick(raw, ["total_outstanding"]),
    // Which product dominates the book is the question this report exists to
    // answer, and the server already computed the share.
    portfolio_share: pick(raw, ["portfolio_share", "share"]),
    avg_interest_rate: pick(raw, ["avg_interest_rate", "average_interest_rate", "avg_rate"]),
    overdue_amount: pick(raw, ["overdue_amount", "overdue", "past_due_amount"]),
    par_ratio: pick(raw, ["par_ratio", "par"]),
  };
}

/**
 * Which products earn and which carry the risk.
 *
 * Every total is the server's `totals` block; a figure it did not send is
 * "—", never the product rows added up. PAR is computed against outstanding
 * principal server-side, so neither summing nor averaging the column
 * reproduces it, and a wrong PAR is worse than an absent one.
 */
export function buildPortfolioByProductDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const totals = asRecord(pick(obj, ["totals"]));
  const rows = asArray(pick(obj, ["products", "by_product", "data"])).map(
    normalizeProductRow
  );

  const released = serverFigure(totals, "total_released");
  const principalBalance = serverFigure(totals, "outstanding_principal");
  const outstanding = serverFigure(totals, "total_outstanding");
  const overdue = serverFigure(totals, "overdue_amount");
  const loanCount = serverFigure(totals, "loan_count");
  const productCount = serverFigure(totals, "product_count");
  // Weighted server-side across the whole book. Quoted as hints rather than as
  // column footers, because neither is a sum of the column above it.
  const parRatio = pick(totals, ["par_ratio", "par"]);
  const avgRate = pick(totals, ["avg_interest_rate", "average_interest_rate"]);
  const thresholdDays =
    toNumber(pick(obj, ["par_threshold_days"])) ?? DEFAULT_PAR_THRESHOLD_DAYS;

  return {
    reportId: "portfolio_by_product",
    meta: meta(
      "Loan Portfolio by Product",
      range,
      "Released, outstanding, and risk for each loan product"
    ),
    sections: [
      {
        kind: "kpi_grid",
        items: [
          kpi("Loan Products", countOrDash(productCount), {
            hint:
              loanCount === null
                ? undefined
                : `${formatCount(loanCount)} ${loanCount === 1 ? "loan" : "loans"}`,
          }),
          kpi("Total Released", currencyOrDash(released), {
            tone: "positive",
            hint: avgRate === null ? undefined : `Avg rate ${rateOrDash(avgRate)}`,
          }),
          kpi("Principal Balance", currencyOrDash(principalBalance)),
          kpi("Outstanding", currencyOrDash(outstanding)),
          kpi("Overdue Amount", currencyOrDash(overdue), {
            tone: "negative",
            hint:
              parRatio === null
                ? undefined
                : `PAR ${percentOrDash(parRatio)} (>${formatCount(thresholdDays)}d)`,
          }),
        ],
      },
      {
        kind: "table",
        title: "Portfolio by Product",
        columns: PRODUCT_COLUMNS,
        rows,
        totals:
          rows.length > 0
            ? [
                {
                  column: "loan_count",
                  label: "Total",
                  value: countOrDash(loanCount),
                },
                totalCell("total_released", released),
                totalCell("principal_balance", principalBalance),
                totalCell("outstanding", outstanding),
                totalCell("overdue_amount", overdue),
                // The shares are of the same denominator, so they do add to
                // 100% — unlike the two rate columns below them.
                {
                  column: "portfolio_share",
                  value: released === null ? DASH : formatPercent(100),
                },
                // Deliberately no total for `avg_interest_rate` or `par_ratio`:
                // averaging either across products of different sizes states a
                // rate the portfolio does not have. The server's weighted
                // figures are quoted as KPI hints instead.
              ]
            : undefined,
        emptyText: "No loan products carried a balance in the selected period.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Share Capital
// ---------------------------------------------------------------------------

const SHARE_CAPITAL_MONTH_COLUMNS: ReportColumn[] = [
  { key: "label", header: "Period", format: "text", width: 140 },
  { key: "credits", header: "Credits", format: "currency", align: "right", width: 160 },
  { key: "debits", header: "Debits", format: "currency", align: "right", width: 160 },
  { key: "net", header: "Net Movement", format: "currency", align: "right", width: 170 },
  {
    key: "closing_balance",
    header: "Closing Balance",
    format: "currency",
    align: "right",
    width: 170,
  },
];

const SHARE_CAPITAL_MEMBER_COLUMNS: ReportColumn[] = [
  { key: "member_name", header: "Member", format: "text", width: 200 },
  { key: "member_no", header: "Member No.", format: "text", width: 110 },
  {
    key: "opening_balance",
    header: "Opening",
    format: "currency",
    align: "right",
    width: 140,
  },
  { key: "credits", header: "Credits", format: "currency", align: "right", width: 140 },
  { key: "debits", header: "Debits", format: "currency", align: "right", width: 140 },
  { key: "balance", header: "Closing", format: "currency", align: "right", width: 150 },
];

/** Credits and debits, shared by the monthly and per-member breakdowns. */
function shareCapitalMovement(raw: Record<string, unknown>) {
  return {
    credits: toNumber(pick(raw, ["credits", "credit", "total_credits"])),
    debits: toNumber(pick(raw, ["debits", "debit", "total_debits"])),
  };
}

/**
 * A live feature with no reporting at all until now: opening and closing
 * balance, the movement that connects them, and how much of what members
 * subscribed to has actually been paid.
 */
export function buildShareCapitalDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);

  const opening = toNumber(pick(obj, ["opening_balance", "beginning_balance"]));
  const credits = toNumber(pick(obj, ["total_credits", "credits"]));
  const debits = toNumber(pick(obj, ["total_debits", "debits"]));
  // The net and the closing balance are the server's; a missing one is "—",
  // never credits less debits, or opening plus the net, worked out here.
  const net = serverFigure(obj, "net_movement");
  const closing = serverFigure(obj, "closing_balance");

  const pledges = asRecord(pick(obj, ["subscription", "pledges"]));
  // `total_subscribed_per_period` is the sum of PER-SCHEDULE pledges (the
  // 15th, the 30th, or both) — a recurring commitment, not a lump-sum
  // subscription. It is deliberately NOT netted against paid-in capital: that
  // subtraction would state an "unpaid subscription" that does not exist.
  const subscribedPerPeriod = toNumber(
    pick(pledges, ["total_subscribed_per_period", "subscribed", "total_subscribed"])
  );
  const paidIn = toNumber(
    pick(pledges, ["total_paid_in", "paid", "total_paid"]) ?? pick(obj, ["closing_balance"])
  );
  const pledgedMembers = pick(pledges, ["pledged_member_count", "member_count"]);
  const autoCreditMembers = pick(pledges, ["auto_credit_member_count"]);
  // Two different populations: members still holding capital at date_to versus
  // members whose balance moved during the period. Never interchangeable.
  const memberCount = pick(obj, ["member_count", "members", "total_members"]);
  const activeMembers = pick(obj, ["members_with_activity"]);
  const entryCount = pick(obj, ["entry_count"]);

  const monthRows = asArray(pick(obj, ["by_month", "by_period", "months"])).map((r) => ({
    label: pick(r, ["period_label", "label", "period", "month"]) ?? DASH,
    ...shareCapitalMovement(r),
    net: serverFigure(r, "net_movement"),
    closing_balance: pick(r, ["closing_balance", "balance", "running_balance"]),
  }));
  const monthTotals = asRecord(pick(obj, ["by_month_totals"]));

  const memberRows = asArray(pick(obj, ["by_member", "members_breakdown"])).map((r) => ({
    member_name:
      pick(r, ["borrower_name", "member_name", "full_name", "name"]) ?? "Unassigned",
    member_no: pick(r, ["borrower_code", "member_no", "code"]),
    opening_balance: pick(r, ["opening_balance", "beginning_balance"]),
    ...shareCapitalMovement(r),
    balance: serverFigure(r, "closing_balance"),
  }));
  // Null when the roster is withheld, like `by_member` itself.
  const memberTotals = asRecord(pick(obj, ["by_member_totals"]));

  const scope = pick(obj, ["branch_scope"]);

  // `by_member` is the whole membership roster, so the API withholds it from
  // roles without `reports:export` and sends `by_member_omitted` instead.
  //
  // It arrives as null, NOT as [], and the difference is the whole point: an
  // empty array would render the table's "no member activity" empty state,
  // telling a collector the cooperative has no share capital holders. That is
  // false, and `member_count` two sections above would flatly contradict it.
  const memberOmitted = asRecord(pick(obj, ["by_member_omitted"]));

  const sections: ReportSection[] = [
      {
        kind: "kpi_grid",
        items: [
          kpi("Opening Balance", currencyOrDash(opening)),
          kpi("Total Credits", currencyOrDash(credits), { tone: "positive" }),
          kpi("Total Debits", currencyOrDash(debits), { tone: "negative" }),
          kpi("Closing Balance", currencyOrDash(closing), {
            hint: "Opening balance plus credits, less debits",
          }),
        ],
      },
      {
        kind: "fields",
        title: "Subscription Status",
        items: [
          { label: "Members holding share capital", value: countOrDash(memberCount) },
          { label: "Members with movement this period", value: countOrDash(activeMembers) },
          { label: "Ledger entries posted", value: countOrDash(entryCount) },
          { label: "Net movement for the period", value: currencyOrDash(net) },
          { label: "Members with an active pledge", value: countOrDash(pledgedMembers) },
          { label: "Of which on auto-credit", value: countOrDash(autoCreditMembers) },
          { label: "Pledged per period", value: currencyOrDash(subscribedPerPeriod) },
          { label: "Total paid in to date", value: currencyOrDash(paidIn) },
        ],
      },
      {
        kind: "table",
        title: "Monthly Movement",
        columns: SHARE_CAPITAL_MONTH_COLUMNS,
        rows: monthRows,
        totals:
          monthRows.length > 0
            ? [
                totalCell("credits", serverFigure(monthTotals, "credits"), "Total"),
                totalCell("debits", serverFigure(monthTotals, "debits")),
                totalCell("net", serverFigure(monthTotals, "net_movement")),
                // No total for `closing_balance`: it is a running figure, and
                // adding a column of balances together means nothing.
              ]
            : undefined,
        emptyText: "No share capital movement was recorded in this period.",
      },
  ];

  // Withheld, not absent: stand a note in the table's place rather than render
  // an empty table. The server's message is written for exactly this and says
  // the aggregates above are complete, which is the reader's real question.
  if (memberOmitted) {
    sections.push({
      kind: "note",
      text: String(
        pick(memberOmitted, ["message"]) ??
          "Per-member share capital holdings are limited to roles that can export reports. " +
            "Every aggregate figure in this report is complete and unaffected."
      ),
    });
  } else {
    sections.push({
      kind: "table",
      title: "Movement by Member",
      columns: SHARE_CAPITAL_MEMBER_COLUMNS,
      rows: memberRows,
      totals:
        memberRows.length > 0
          ? [
              totalCell("opening_balance", serverFigure(memberTotals, "opening_balance"), "Total"),
              totalCell("credits", serverFigure(memberTotals, "credits")),
              totalCell("debits", serverFigure(memberTotals, "debits")),
              totalCell("balance", serverFigure(memberTotals, "closing_balance")),
            ]
          : undefined,
      emptyText: "No member share capital activity was recorded in this period.",
    });
  }

  // The pledged figure is a recurring per-schedule commitment, so the server
  // spells out why it is not comparable to paid-in capital. Printed verbatim —
  // this is exactly the subtraction a reader would otherwise do in their head.
  const pledgeNote = pick(pledges, ["note"]);
  if (pledgeNote !== null) {
    sections.push({ kind: "note", text: String(pledgeNote) });
  }

  // `branch_id` IS honoured here, through the member's branch rather than a
  // column on the ledger, so the scope is stated rather than assumed.
  if (scope === "borrower_branch") {
    sections.push({
      kind: "note",
      text:
        "Scoped to the selected branch through each member's branch — the share capital " +
        "ledger has no branch column of its own.",
    });
  }

  return {
    reportId: "share_capital",
    meta: meta(
      "Share Capital Report",
      range,
      "Member share capital movement and subscription status"
    ),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Officer / Branch Performance
// ---------------------------------------------------------------------------

/**
 * Two clocks in one row, so every header says which one it is.
 *
 * `released_*` and `collected` cover the selected period. Everything after
 * them is a point-in-time figure over the officer's WHOLE book — date-scoping
 * the portfolio would hide the book an officer actually carries. Unlabelled,
 * the two read as one, and a reader concludes an officer released ₱2.1M and is
 * carrying ₱1.3M of it, which is not what the row says.
 */
const PERFORMANCE_VALUE_COLUMNS: ReportColumn[] = [
  {
    key: "released_count",
    header: "Released (period)",
    format: "number",
    align: "right",
    width: 130,
  },
  {
    key: "released_amount",
    header: "Amount Released (period)",
    format: "currency",
    align: "right",
    width: 180,
  },
  {
    key: "collected_amount",
    header: "Collected (period)",
    format: "currency",
    align: "right",
    width: 155,
  },
  {
    key: "principal_balance",
    header: "Principal Balance (to date)",
    format: "currency",
    align: "right",
    width: 165,
  },
  {
    key: "outstanding",
    header: "Outstanding (to date)",
    format: "currency",
    align: "right",
    width: 165,
  },
  {
    key: "overdue_amount",
    header: "Overdue (to date)",
    format: "currency",
    align: "right",
    width: 150,
  },
  { key: "par_ratio", header: "PAR (to date)", format: "percent", align: "right", width: 115 },
  {
    key: "active_borrowers",
    header: "Members (to date)",
    format: "number",
    align: "right",
    width: 145,
  },
];

function performanceColumns(header: string, width: number): ReportColumn[] {
  return [
    { key: "label", header, format: "text", width },
    ...PERFORMANCE_VALUE_COLUMNS,
  ];
}

function normalizePerformanceRow(
  raw: Record<string, unknown>,
  labelKeys: string[],
  fallbackLabel: string
): Record<string, unknown> {
  return {
    // The API always names the officer, falling back to "Unassigned" server
    // side, so a loan with no `account_officer_id` is still a row here and the
    // rows still reconcile to the portfolio.
    label: pick(raw, labelKeys) ?? fallbackLabel,
    // `loan_count` is the officer's WHOLE book and is not the period release
    // count, so it is deliberately not an alias for it.
    released_count: pick(raw, ["released_count", "loans_released"]),
    released_amount: pick(raw, ["released_amount", "total_released", "released"]),
    collected_amount: pick(raw, ["collected", "collected_amount", "total_collected"]),
    // Never the old `outstanding` or `outstanding_balance`, principal plus premium.
    principal_balance: pick(raw, ["outstanding_principal"]),
    outstanding: pick(raw, ["total_outstanding"]),
    overdue_amount: pick(raw, ["overdue_amount", "overdue", "past_due_amount"]),
    par_ratio: pick(raw, ["par_ratio", "par"]),
    active_borrowers: pick(raw, ["active_borrowers", "borrower_count", "borrowers"]),
  };
}

/**
 * Footer for a performance table: the server's totals block for that table,
 * a figure it did not send shown as "—", never the rows added up. PAR and
 * `active_borrowers` deliberately have no footer: PAR is a weighted ratio, and
 * a borrower served by two officers is still one borrower, so the API states
 * neither as a grand total.
 */
function performanceTotals(totals: Record<string, unknown> | null) {
  return [
    {
      column: "released_count",
      label: "Total",
      value: countOrDash(serverFigure(totals, "released_count")),
    },
    totalCell("released_amount", serverFigure(totals, "released_amount")),
    totalCell("collected_amount", serverFigure(totals, "collected")),
    totalCell("principal_balance", serverFigure(totals, "outstanding_principal")),
    totalCell("outstanding", serverFigure(totals, "total_outstanding")),
    totalCell("overdue_amount", serverFigure(totals, "overdue_amount")),
  ];
}

/**
 * `Loan::accountOfficer()` has existed all along and was never reported on.
 * Officer first, branch second — the officer view is the one that changes
 * behaviour, the branch view is the one that gets read in a board meeting.
 */
export function buildPerformanceDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  // Three server totals blocks: the headline, and one per table. Every loan
  // sits in exactly one officer row and one branch row ("Unassigned"
  // included), so the server's figures agree; none is added up here.
  const totals = asRecord(pick(obj, ["totals"]));
  const officerTotals = asRecord(pick(obj, ["by_officer_totals"]));
  const branchTotals = asRecord(pick(obj, ["by_branch_totals"]));

  const officerRows = asArray(pick(obj, ["by_officer", "officers"])).map((r) =>
    normalizePerformanceRow(
      r,
      ["account_officer_name", "officer_name", "user_name", "full_name", "name"],
      "Unassigned"
    )
  );
  const branchRows = asArray(pick(obj, ["by_branch", "branches"])).map((r) =>
    normalizePerformanceRow(r, ["branch_name", "name"], "Unassigned")
  );

  const releasedCount = serverFigure(totals, "released_count");
  const releasedAmount = serverFigure(totals, "released_amount");
  const collected = serverFigure(totals, "collected");
  // `active_borrowers` has no headline (a borrower can be counted under two
  // officers and the API states no distinct total), so the last KPIs are the
  // book: its principal, and everything owed on it.
  const principalBalance = serverFigure(totals, "outstanding_principal");
  const outstanding = serverFigure(totals, "total_outstanding");

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Loans Released", countOrDash(releasedCount), { hint: "In the selected period" }),
        kpi("Amount Released", currencyOrDash(releasedAmount), { tone: "positive" }),
        kpi("Total Collected", currencyOrDash(collected), { tone: "positive" }),
        kpi("Principal Balance", currencyOrDash(principalBalance), {
          hint: "Whole book, as of today",
        }),
        kpi("Outstanding", currencyOrDash(outstanding), {
          hint: "Whole book, as of today",
        }),
      ],
    },
    {
      kind: "table",
      title: "By Account Officer",
      columns: performanceColumns("Account Officer", 190),
      rows: officerRows,
      totals: officerRows.length > 0 ? performanceTotals(officerTotals) : undefined,
      emptyText: "No account officer activity was recorded in this period.",
    },
    {
      kind: "table",
      title: "By Branch",
      columns: performanceColumns("Branch", 190),
      rows: branchRows,
      totals: branchRows.length > 0 ? performanceTotals(branchTotals) : undefined,
      emptyText: "No branch activity was recorded in this period.",
    },
  ];

  // The column headers say "(period)" and "(to date)"; this states the same
  // thing in full, because a row mixing two clocks is the single easiest way
  // to misread this report.
  const clockNote = pick(obj, ["note"]);
  sections.push({
    kind: "note",
    text: String(
      clockNote ??
        "Released and collected figures cover the selected period; outstanding, overdue, " +
          "PAR and member counts are as of today over each officer's whole book."
    ),
  });

  return {
    reportId: "performance",
    meta: meta(
      "Officer / Branch Performance",
      range,
      "Releases, collections, and risk by account officer and branch"
    ),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Loan Loss Provisioning
// ---------------------------------------------------------------------------

const PROVISIONING_COLUMNS: ReportColumn[] = [
  { key: "bucket", header: "Aging Bucket", format: "text", width: 170 },
  { key: "amount", header: "Overdue Amount", format: "currency", align: "right", width: 180 },
  { key: "rate", header: "Provision Rate", format: "percent", align: "right", width: 150 },
  {
    key: "required_allowance",
    header: "Required Allowance",
    format: "currency",
    align: "right",
    width: 190,
  },
];

/**
 * Required allowance by aging bucket.
 *
 * The buckets are the server's — this endpoint calls `agingReport()` rather
 * than re-deriving the 1–30 / 31–60 / 61–90 / 90+ boundaries — so the labels
 * and aliases are shared with the Aging Report on this side too.
 */
export function buildProvisioningDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  const buckets = asRecord(pick(obj, ["buckets", "aging_buckets"]));
  const totals = asRecord(pick(obj, ["totals"]));

  // `buckets` is an object keyed by bucket, not an array — the same shape the
  // Aging Report returns — so AGING_BUCKETS drives both the iteration order
  // and the labels, and the two reports can never disagree on either.
  //
  // Every figure is the server's. The API sends BOTH `rate` (a fraction, 0.05)
  // and `rate_percent` (whole, 5); everything in a report is whole percent, so
  // only `rate_percent` is read. A missing allowance is "—", never amount
  // times rate worked out here.
  const rows = AGING_BUCKETS.map(([label, keys]) => {
    const bucket = asRecord(pick(buckets, keys));
    return {
      bucket: label,
      amount: serverFigure(bucket, "amount"),
      rate: serverFigure(bucket, "rate_percent"),
      count: serverFigure(bucket, "count"),
      required_allowance: serverFigure(bucket, "required_allowance"),
    };
  });

  // The server's totals; a missing one is "—", never the buckets added up nor
  // allowance over amount. The effective rate is weighted server-side, not the
  // average of the four rates — the mix of buckets is the whole point.
  const totalAmount = serverFigure(totals, "amount");
  const totalAllowance = serverFigure(totals, "required_allowance");
  const delinquentLoans = serverFigure(totals, "count");
  const effectiveRate = serverFigure(totals, "effective_rate");
  const asOf = pick(obj, ["as_of_date", "as_of"]);

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Overdue", currencyOrDash(totalAmount), { tone: "negative" }),
        kpi("Required Allowance", currencyOrDash(totalAllowance), { tone: "negative" }),
        kpi("Effective Provision Rate", percentOrDash(effectiveRate), {
          hint: "Required allowance over total overdue",
        }),
        kpi("Delinquent Loans", countOrDash(delinquentLoans)),
      ],
    },
    {
      kind: "table",
      title: "Provisioning Schedule",
      columns: PROVISIONING_COLUMNS,
      rows,
      totals: [
        totalCell("amount", totalAmount, "Total"),
        // No total for `rate`: four provisioning rates do not add up, and the
        // weighted figure is stated as a KPI above instead.
        totalCell("required_allowance", totalAllowance),
      ],
      emptyText: "No overdue balances required a provision in this period.",
    },
    {
      kind: "note",
      text:
        `${asOf ? `Computed as of ${formatValue(asOf, "date")}. ` : ""}` +
        "Required allowance is the overdue amount in each bucket multiplied by that bucket's " +
        "provisioning rate. " +
        // The server carries its own wording for why the ladder is a constant;
        // prefer it, so a board that changes the policy changes one place.
        String(
          pick(obj, ["policy_note"]) ??
            "The rates are a policy setting, not a figure derived from the data."
        ) +
        " Bucket amounts add up to the total overdue; the delinquent loan count does not — a loan " +
        "that is late in two buckets is still one delinquent loan.",
    },
  ];

  return {
    reportId: "provisioning",
    meta: meta(
      "Loan Loss Provisioning",
      range,
      "Required allowance for probable losses by aging bucket"
    ),
    sections,
  };
}
