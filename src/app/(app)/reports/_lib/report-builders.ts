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
  toNumber,
} from "./formatters";
import type {
  DateRange,
  FieldItem,
  KpiItem,
  ReportColumn,
  ReportDocument,
  ReportSection,
} from "./types";

/**
 * Pure payload → ReportDocument builders.
 *
 * Everything here takes the value the API already returned, so the whole
 * frontend→backend contract is testable without a network call. Fetching and
 * the catalog wiring live in `report-catalog.ts`.
 */

const ORG = "Lendyph — Cooperative Lending";

/** Rows requested per list report. The API paginates; this is one page. */
export const LIST_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Raw payload helpers
// ---------------------------------------------------------------------------

function pick<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): T | null {
  if (!obj) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key] as T;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const obj = asRecord(value);
  if (!obj) return [];
  for (const key of ["data", "rows", "items", "results"]) {
    const inner = obj[key];
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  }
  return [];
}

function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, r) => acc + (toNumber(r[key]) ?? 0), 0);
}

/**
 * Add up sibling fields of a nested block (e.g. outstanding.{principal,
 * interest,penalty}). Returns null when the block is missing entirely so the
 * KPI shows "—" instead of a misleading ₱0.00.
 */
function sumFields(
  obj: Record<string, unknown> | null,
  keys: string[]
): number | null {
  if (!obj) return null;
  let total = 0;
  let found = false;
  for (const key of keys) {
    const n = toNumber(obj[key]);
    if (n !== null) {
      total += n;
      found = true;
    }
  }
  return found ? total : null;
}

function meta(
  title: string,
  range: DateRange,
  subtitle?: string
): ReportDocument["meta"] {
  return {
    title,
    subtitle,
    period: formatDateRange(range.from, range.to),
    generatedAt: formatGeneratedAt(),
    org: ORG,
  };
}

function kpi(label: string, value: string, opts: Partial<KpiItem> = {}): KpiItem {
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
  { key: "borrower_name", header: "Borrower", format: "text", width: 220 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 140 },
  { key: "term", header: "Term", format: "text", align: "right", width: 80 },
  { key: "interest_rate", header: "Rate", format: "percent", align: "right", width: 80 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

const REPAYMENT_COLUMNS: ReportColumn[] = [
  // The API sends a date-only `paid_at`; formatting it as a datetime printed
  // a phantom time-of-day on every row.
  { key: "paid_at", header: "Paid On", format: "date", width: 140 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Borrower", format: "text", width: 220 },
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
  { key: "borrower_name", header: "Borrower", format: "text", width: 200 },
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
    status: pick(raw, ["status"]),
  };
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
    method: pick(raw, ["method", "payment_method"]),
    status: pick(raw, ["status"]),
  };
}

function normalizeDueRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  const loan = asRecord(raw.loan);

  // The API reports what was paid per component, not a combined figure, so the
  // "Paid" column adds them. sumFields returns null when neither key is
  // present, keeping the cell a dash rather than claiming nothing was paid.
  const amountPaid = sumFields(raw, ["principal_paid", "interest_paid"]);

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
    amount_paid: amountPaid,
    // `amount_remaining` is the API's name for the unpaid balance of a schedule.
    balance: pick(raw, [
      "amount_remaining",
      "balance",
      "outstanding_balance",
      "remaining_balance",
    ]),
    status: pick(raw, ["status"]),
  };
}

// ---------------------------------------------------------------------------
// Paginated list envelopes
// ---------------------------------------------------------------------------

interface ListEnvelope {
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
function readListEnvelope(raw: unknown): ListEnvelope {
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

interface ResolvedTotal {
  value: number;
  fromServer: boolean;
}

/** Prefer the server total; fall back to summing the page we were given. */
function resolveTotal(
  totals: Record<string, unknown> | null,
  keys: string[],
  rows: Record<string, unknown>[],
  rowKey: string
): ResolvedTotal {
  const server = toNumber(pick(totals, keys));
  if (server !== null) return { value: server, fromServer: true };
  return { value: sum(rows, rowKey), fromServer: false };
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

/**
 * Warn in the preview (and in every export) when the table is only the first
 * page, so a partial list is never read as the complete one.
 */
function truncationNote(
  shown: number,
  totalRows: number | null,
  totalsFromServer: boolean
): ReportSection | null {
  const truncated =
    totalRows !== null ? totalRows > shown : shown >= LIST_PAGE_SIZE;
  if (!truncated || shown === 0) return null;

  const scope =
    totalRows !== null
      ? `Showing the first ${formatCount(shown)} of ${formatCount(totalRows)} rows.`
      : `Showing the first ${formatCount(shown)} rows — the API did not report a row count, so there may be more.`;
  const totalsScope = totalsFromServer
    ? "The totals above cover every row in the period, not just the rows listed."
    : "The totals above cover only the rows listed.";

  return {
    kind: "note",
    text: `${scope} ${totalsScope} Export to CSV for the complete list.`,
  };
}

// ---------------------------------------------------------------------------
// KPI-only reports
// ---------------------------------------------------------------------------

export function buildDailyCollectionDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi("Total Due", currencyOrDash(pick(obj, ["total_due", "due", "total_scheduled"]))),
    kpi(
      "Total Collected",
      currencyOrDash(pick(obj, ["total_collected", "collected", "total_amount"])),
      { tone: "positive" }
    ),
    kpi("Collection Rate", percentOrDash(pick(obj, ["collection_rate", "rate"]))),
    kpi("Uncollected", currencyOrDash(pick(obj, ["uncollected", "outstanding"])), {
      tone: "negative",
    }),
  ];

  return {
    reportId: "daily_collection",
    meta: meta("Daily Collection Report", range, "Summary of amounts due vs collected"),
    sections: [{ kind: "kpi_grid", items }],
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
    key: "outstanding_balance",
    header: "Outstanding Balance",
    format: "currency",
    align: "right",
    width: 170,
  },
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
function byBranchSection(rows: Record<string, unknown>[]): ReportSection | null {
  if (rows.length === 0) return null;

  const normalized = rows.map((raw) => ({
    branch_name: pick(raw, ["branch_name", "name"]) ?? "Unassigned",
    loan_count: pick(raw, ["loan_count", "loans", "count"]),
    total_released: pick(raw, ["total_released", "released"]),
    outstanding_balance: pick(raw, ["outstanding_balance", "outstanding"]),
  }));

  return {
    kind: "table",
    title: "Breakdown by Branch",
    columns: BY_BRANCH_COLUMNS,
    rows: normalized,
    totals: [
      {
        column: "loan_count",
        label: "Total",
        value: formatCount(sum(normalized, "loan_count")),
      },
      { column: "total_released", value: formatCurrency(sum(normalized, "total_released")) },
      {
        column: "outstanding_balance",
        value: formatCurrency(sum(normalized, "outstanding_balance")),
      },
    ],
    emptyText: "No branch breakdown was returned for this period.",
  };
}

/**
 * Principal / interest / penalty, outstanding against overdue. Both blocks
 * come back on every response and neither was rendered — the headline balance
 * alone cannot tell a collections officer what the arrears are made of.
 */
function compositionSection(
  outstanding: Record<string, unknown> | null,
  overdue: Record<string, unknown> | null
): ReportSection | null {
  if (!outstanding && !overdue) return null;

  const components: [string, string][] = [
    ["Principal", "principal"],
    ["Interest", "interest"],
    ["Penalty", "penalty"],
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
      { column: "outstanding", label: "Total", value: formatCurrency(sum(rows, "outstanding")) },
      { column: "overdue", value: formatCurrency(sum(rows, "overdue")) },
    ],
  };
}

export function buildPortfolioSummaryDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  // The API sends flat headline figures alongside the nested blocks; read the
  // headline first and keep the nested blocks as the fallback.
  const portfolio = asRecord(obj?.portfolio);
  const outstanding = asRecord(obj?.outstanding);
  const overdue = asRecord(obj?.overdue);

  const loanCount = pick(obj, ["active_loans"]) ?? pick(portfolio, ["loan_count"]);
  const flatOutstanding = pick(obj, ["outstanding_balance"]);
  const outstandingTotal =
    flatOutstanding ?? sumFields(outstanding, ["principal", "interest", "penalty"]);
  const atRisk = pick(obj, ["at_risk_amount"]) ?? pick(portfolio, ["at_risk_amount"]);
  const parRatio = pick(obj, ["par_ratio"]) ?? pick(portfolio, ["par_ratio"]);
  const overdueLoans = toNumber(pick(overdue, ["loan_count"]));
  const thresholdDays =
    toNumber(pick(obj, ["par_threshold_days"])) ?? DEFAULT_PAR_THRESHOLD_DAYS;

  const items: KpiItem[] = [
    kpi("Total Active Loans", countOrDash(loanCount), {
      hint: `Released: ${currencyOrDash(pick(portfolio, ["total_released"]))}`,
    }),
    kpi("Outstanding Balance", currencyOrDash(outstandingTotal), {
      // The headline balance includes insurance; the nested fallback does not.
      hint: flatOutstanding === null ? "Principal + interest + penalty" : undefined,
    }),
    kpi(`At Risk (>${formatCount(thresholdDays)}d overdue)`, currencyOrDash(atRisk), {
      tone: "negative",
      hint:
        overdueLoans === null
          ? undefined
          : `${formatCount(overdueLoans)} overdue ${overdueLoans === 1 ? "loan" : "loans"}`,
    }),
    // PAR is computed server-side against outstanding *principal*, so it will
    // not reproduce at-risk ÷ outstanding balance on screen. Never recompute it.
    kpi("PAR Ratio", percentOrDash(parRatio), {
      tone: "negative",
      hint: "Portfolio at Risk, on outstanding principal",
    }),
  ];

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  const composition = compositionSection(outstanding, overdue);
  if (composition) sections.push(composition);

  const branches = byBranchSection(asArray(pick(obj, ["by_branch", "branches"])));
  if (branches) sections.push(branches);

  return {
    reportId: "portfolio_summary",
    meta: meta("Portfolio Summary", range, "Overall loan portfolio status"),
    sections,
  };
}

export function buildIncomeDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);

  const interest = toNumber(pick(obj, ["interest_income", "interest"]));
  const fees = toNumber(pick(obj, ["processing_fees", "fees", "fee_income"]));
  const penalties = toNumber(pick(obj, ["penalty_income", "penalties"]));
  const total =
    toNumber(pick(obj, ["total_income", "total"])) ??
    (interest !== null || fees !== null || penalties !== null
      ? (interest ?? 0) + (fees ?? 0) + (penalties ?? 0)
      : null);

  const items: KpiItem[] = [
    kpi("Interest Income", currencyOrDash(interest), { tone: "positive" }),
    kpi("Processing Fees", currencyOrDash(fees), { tone: "positive" }),
    kpi("Penalty Income", currencyOrDash(penalties)),
    kpi("Total Income", currencyOrDash(total), { tone: "positive" }),
  ];

  return {
    reportId: "income_report",
    meta: meta("Income Report", range, "Interest, fees, and penalty income"),
    sections: [{ kind: "kpi_grid", items }],
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
 * aging report exists to answer, so each bucket's share of the total is
 * computed here from the amounts the API already sent.
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
      count: toNumber(bucket?.count),
    };
  }).filter((r) => r.amount !== null);

  if (rows.length === 0) return null;

  // Prefer the server's total as the denominator; fall back to the buckets we
  // were given so the shares still add to 100% rather than to nothing.
  const totalAmount = toNumber(total?.amount) ?? sum(rows, "amount");
  const withShare = rows.map((r) => ({
    ...r,
    // A zero total would make every share NaN — report no share instead.
    share: totalAmount > 0 ? ((r.amount ?? 0) / totalAmount) * 100 : null,
  }));

  return {
    kind: "table",
    title: "Aging Schedule",
    columns: AGING_COLUMNS,
    rows: withShare,
    totals: [
      { column: "amount", label: "Total", value: formatCurrency(totalAmount) },
      // Deliberately no total for `count`: bucket counts double-count a loan
      // that is late in two buckets, so a column sum would be wrong.
      { column: "share", value: totalAmount > 0 ? formatPercent(100) : DASH },
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

export function buildBorrowerDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi(
      "Total Active Borrowers",
      countOrDash(pick(obj, ["total_active_borrowers", "active_borrowers", "total_active"]))
    ),
    kpi("New Borrowers", countOrDash(pick(obj, ["new_borrowers", "new"])), {
      tone: "positive",
    }),
    kpi("Avg Loan Size", currencyOrDash(pick(obj, ["avg_loan_size", "average_loan"]))),
    kpi("Repeat Borrowers", countOrDash(pick(obj, ["repeat_borrowers", "repeat"]))),
  ];

  return {
    reportId: "borrower_report",
    meta: meta("Borrower Report", range, "Active, new, and repeat borrower activity"),
    sections: [{ kind: "kpi_grid", items }],
  };
}

export function buildDisbursementDoc(raw: unknown, range: DateRange): ReportDocument {
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

  return {
    reportId: "disbursement_report",
    meta: meta("Disbursement Report", range, "Loan releases during the selected period"),
    sections: [{ kind: "kpi_grid", items }],
  };
}

// ---------------------------------------------------------------------------
// List reports
// ---------------------------------------------------------------------------

export function buildReleasesListDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeReleaseRow);
  const principal = resolveTotal(
    totals,
    ["total_principal", "principal", "principal_amount"],
    rows,
    "principal"
  );
  const netProceeds = pick(totals, ["total_net_proceeds"]);
  const outstanding = pick(totals, ["total_outstanding_balance"]);

  const items: KpiItem[] = [
    kpi("Total Releases", countOrDash(totalRows ?? rows.length)),
    kpi("Total Principal", formatCurrency(principal.value), { tone: "positive" }),
  ];
  // Only shown when the API sends period-wide totals — never summed from a page.
  if (netProceeds !== null) {
    items.push(
      kpi("Net Proceeds", currencyOrDash(netProceeds), {
        hint: "Released less deductions",
      })
    );
  }
  if (outstanding !== null) {
    items.push(kpi("Outstanding Balance", currencyOrDash(outstanding)));
  }

  const sections: ReportSection[] = [{ kind: "kpi_grid", items }];

  const note = truncationNote(rows.length, totalRows, principal.fromServer);
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Releases",
    columns: RELEASE_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [{ column: "principal", label: "Total", value: formatCurrency(principal.value) }]
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
  const amount = resolveTotal(
    totals,
    ["total_amount_paid", "amount", "total_amount", "amount_paid"],
    rows,
    "amount"
  );
  const penalty = resolveTotal(
    totals,
    ["total_penalty_applied", "penalty_amount", "total_penalty", "penalty_applied"],
    rows,
    "penalty_amount"
  );

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Repayments", countOrDash(totalRows ?? rows.length)),
        kpi("Total Collected", formatCurrency(amount.value), {
          tone: "positive",
          hint: breakdownHint([
            ["Principal", pick(totals, ["total_principal_applied"])],
            ["Interest", pick(totals, ["total_interest_applied"])],
          ]),
        }),
        kpi("Penalty Collected", formatCurrency(penalty.value)),
      ],
    },
  ];

  const note = truncationNote(
    rows.length,
    totalRows,
    amount.fromServer && penalty.fromServer
  );
  if (note) sections.push(note);

  sections.push({
    kind: "table",
    title: "Repayments",
    columns: REPAYMENT_COLUMNS,
    rows,
    totals:
      rows.length > 0
        ? [
            { column: "amount", label: "Total", value: formatCurrency(amount.value) },
            { column: "penalty_amount", value: formatCurrency(penalty.value) },
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
    header: "Beginning Balance",
    format: "currency",
    align: "right",
    width: 150,
  },
  { key: "principal_due", header: "Principal", format: "currency", align: "right", width: 120 },
  { key: "interest_due", header: "Interest", format: "currency", align: "right", width: 110 },
  { key: "penalty_amount", header: "Penalty", format: "currency", align: "right", width: 110 },
  { key: "total_due", header: "Total Due", format: "currency", align: "right", width: 130 },
  { key: "amount_paid", header: "Paid", format: "currency", align: "right", width: 120 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 130 },
  { key: "status", header: "Status", format: "text", width: 100 },
];

const SOA_TRANSACTION_COLUMNS: ReportColumn[] = [
  { key: "date", header: "Date", format: "date", width: 110 },
  { key: "reference", header: "Reference", format: "text", width: 140 },
  { key: "particulars", header: "Particulars", format: "text", width: 220 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "debit", header: "Debit", format: "currency", align: "right", width: 130 },
  { key: "credit", header: "Credit", format: "currency", align: "right", width: 130 },
  { key: "running_balance", header: "Balance", format: "currency", align: "right", width: 140 },
];

function normalizeScheduleRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    period_number: pick(raw, ["period_number", "period", "installment_number"]),
    due_date: pick(raw, ["due_date", "scheduled_date", "date"]),
    beginning_balance: pick(raw, ["beginning_balance", "opening_balance"]),
    principal_due: pick(raw, ["principal_due", "principal"]),
    interest_due: pick(raw, ["interest_due", "interest"]),
    penalty_amount: pick(raw, ["penalty_amount", "penalty", "penalty_due"]),
    total_due: pick(raw, ["total_due", "amount_due", "scheduled_amount"]),
    amount_paid:
      sumFields(raw, ["principal_paid", "interest_paid"]) ??
      toNumber(pick(raw, ["amount_paid", "total_paid"])),
    balance: pick(raw, ["amount_remaining", "balance", "remaining_balance"]),
    status: pick(raw, ["status"]),
  };
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
    reference: pick(raw, ["reference", "reference_no", "receipt_no", "or_number", "id"]),
    particulars:
      pick(raw, ["particulars", "description", "remarks", "narration"]) ??
      (type ? type.replace(/_/g, " ") : null),
    method: pick(raw, ["method", "payment_method"]),
    debit: explicitDebit ?? (isDebit && !isCredit ? amount : null),
    credit: explicitCredit ?? (isCredit ? amount : null),
    running_balance: pick(raw, ["running_balance", "balance", "outstanding_balance"]),
  };
}

/** Label→value particulars for the account the statement covers. */
function accountFields(
  loan: Record<string, unknown> | null,
  borrower: Record<string, unknown> | null
): FieldItem[] {
  const fields: [string, unknown, "text" | "currency" | "date" | "percent"][] = [
    ["Borrower", pick(borrower, ["full_name", "name", "borrower_name"]), "text"],
    ["Member No.", pick(borrower, ["borrower_code", "member_no", "code"]), "text"],
    ["Loan Account No.", pick(loan, ["loan_account_number", "account_number"]), "text"],
    ["Application No.", pick(loan, ["application_number"]), "text"],
    ["Loan Product", pick(loan, ["product_name", "loan_product_name"]), "text"],
    ["Principal", pick(loan, ["principal_amount", "principal"]), "currency"],
    ["Interest Rate", pick(loan, ["interest_rate", "rate"]), "percent"],
    ["Term", pick(loan, ["term_label", "term"]), "text"],
    ["Release Date", pick(loan, ["release_date", "released_at"]), "date"],
    ["Maturity Date", pick(loan, ["maturity_date", "end_date"]), "date"],
    ["Status", pick(loan, ["status"]), "text"],
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

export function buildStatementOfAccountDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const loan = asRecord(pick(obj, ["loan"])) ?? obj;
  const borrower = asRecord(pick(obj, ["borrower"])) ?? asRecord(pick(loan, ["borrower"]));
  const summary = asRecord(pick(obj, ["summary", "balance", "totals"]));

  const scheduleRows = asArray(
    pick(obj, ["schedule", "amortization_schedule", "schedules", "installments"])
  ).map(normalizeScheduleRow);
  const transactionRows = asArray(
    pick(obj, ["transactions", "repayments", "payments", "ledger", "entries"])
  ).map(normalizeTransactionRow);

  const outstanding =
    pick(summary, ["outstanding_balance", "total_balance", "balance"]) ??
    pick(obj, ["outstanding_balance", "balance"]);
  const totalPaid =
    pick(summary, ["total_paid", "amount_paid", "total_amount_paid"]) ??
    pick(obj, ["total_paid"]);

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
      kpi("Outstanding Balance", currencyOrDash(outstanding), { tone: "negative" }),
      kpi(
        "Past Due",
        currencyOrDash(pick(summary, ["overdue_amount", "past_due_amount", "total_overdue"])),
        { tone: "negative" }
      ),
    ],
  });

  sections.push({
    kind: "table",
    title: "Amortization Schedule",
    columns: SOA_SCHEDULE_COLUMNS,
    rows: scheduleRows,
    totals:
      scheduleRows.length > 0
        ? [
            {
              column: "principal_due",
              label: "Total",
              value: formatCurrency(sum(scheduleRows, "principal_due")),
            },
            { column: "interest_due", value: formatCurrency(sum(scheduleRows, "interest_due")) },
            {
              column: "penalty_amount",
              value: formatCurrency(sum(scheduleRows, "penalty_amount")),
            },
            { column: "total_due", value: formatCurrency(sum(scheduleRows, "total_due")) },
            { column: "amount_paid", value: formatCurrency(sum(scheduleRows, "amount_paid")) },
          ]
        : undefined,
    emptyText: "No amortization schedule is available for this loan.",
  });

  sections.push({
    kind: "table",
    title: "Transaction History",
    columns: SOA_TRANSACTION_COLUMNS,
    rows: transactionRows,
    totals:
      transactionRows.length > 0
        ? [
            {
              column: "debit",
              label: "Total",
              value: formatCurrency(sum(transactionRows, "debit")),
            },
            { column: "credit", value: formatCurrency(sum(transactionRows, "credit")) },
          ]
        : undefined,
    emptyText: "No transactions have been recorded against this loan.",
  });

  return {
    reportId: "statement_of_account",
    meta: meta(
      "Statement of Account",
      range,
      pick(loan, ["loan_account_number", "account_number"])
        ? `Loan ${pick(loan, ["loan_account_number", "account_number"])}`
        : "Schedule, payments, and balance for a single loan"
    ),
    sections,
  };
}

const LEDGER_LOAN_COLUMNS: ReportColumn[] = [
  { key: "loan_account_number", header: "Loan #", format: "text", width: 130 },
  { key: "release_date", header: "Released", format: "date", width: 110 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 140 },
  { key: "total_paid", header: "Total Paid", format: "currency", align: "right", width: 140 },
  { key: "balance", header: "Outstanding", format: "currency", align: "right", width: 140 },
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
    balance: pick(raw, ["outstanding_balance", "balance", "remaining_balance"]),
    overdue: pick(raw, ["overdue_amount", "past_due_amount", "total_overdue"]),
    status: pick(raw, ["status"]),
  };
}

export function buildSubsidiaryLedgerDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const borrower = asRecord(pick(obj, ["borrower", "member"])) ?? obj;
  const summary = asRecord(pick(obj, ["summary", "totals"]));

  const loanRows = asArray(pick(obj, ["loans", "accounts"])).map(normalizeLedgerLoanRow);
  const entryRows = asArray(
    pick(obj, ["entries", "transactions", "ledger", "payments", "repayments"])
  ).map(normalizeTransactionRow);

  const sections: ReportSection[] = [];

  const memberFields: [string, unknown][] = [
    ["Borrower", pick(borrower, ["full_name", "name", "borrower_name"])],
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

  // Loan-level figures are summed from the account rows only when the API
  // sends no summary block of its own.
  sections.push({
    kind: "kpi_grid",
    title: "Ledger Summary",
    items: [
      kpi("Total Loans", countOrDash(pick(summary, ["loan_count", "total_loans"]) ?? loanRows.length)),
      kpi(
        "Total Released",
        currencyOrDash(pick(summary, ["total_released", "total_principal"]) ?? sum(loanRows, "principal")),
      ),
      kpi(
        "Total Paid",
        currencyOrDash(pick(summary, ["total_paid", "total_amount_paid"]) ?? sum(loanRows, "total_paid")),
        { tone: "positive" }
      ),
      kpi(
        "Outstanding Balance",
        currencyOrDash(
          pick(summary, ["outstanding_balance", "total_balance"]) ?? sum(loanRows, "balance")
        ),
        { tone: "negative" }
      ),
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
            {
              column: "principal",
              label: "Total",
              value: formatCurrency(sum(loanRows, "principal")),
            },
            { column: "total_paid", value: formatCurrency(sum(loanRows, "total_paid")) },
            { column: "balance", value: formatCurrency(sum(loanRows, "balance")) },
            { column: "overdue", value: formatCurrency(sum(loanRows, "overdue")) },
          ]
        : undefined,
    emptyText: "This borrower has no loan accounts on record.",
  });

  // Only rendered when the API returns entries — an empty transaction table on
  // a ledger reads as "no payments", which would be a claim we cannot make.
  if (entryRows.length > 0) {
    sections.push({
      kind: "table",
      title: "Payment History",
      columns: SOA_TRANSACTION_COLUMNS,
      rows: entryRows,
      totals: [
        { column: "debit", label: "Total", value: formatCurrency(sum(entryRows, "debit")) },
        { column: "credit", value: formatCurrency(sum(entryRows, "credit")) },
      ],
    });
  }

  return {
    reportId: "subsidiary_ledger",
    meta: meta(
      "Subsidiary Ledger",
      range,
      pick(borrower, ["full_name", "name"])
        ? String(pick(borrower, ["full_name", "name"]))
        : "All loans and payments for a single borrower"
    ),
    sections,
  };
}

export function buildDuePastDueListDoc(raw: unknown, range: DateRange): ReportDocument {
  const { rows: rawRows, totals, totalRows } = readListEnvelope(raw);
  const rows = rawRows.map(normalizeDueRow);
  const due = resolveTotal(
    totals,
    ["total_due", "amount_due", "total_amount_due"],
    rows,
    "amount_due"
  );
  const balance = resolveTotal(
    totals,
    ["total_balance", "amount_remaining", "total_remaining", "balance"],
    rows,
    "balance"
  );

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
        kpi("Total Amount Due", formatCurrency(due.value), {
          tone: "negative",
          hint: breakdownHint([
            ["Principal", pick(totals, ["total_principal_due"])],
            ["Interest", pick(totals, ["total_interest_due"])],
            ["Penalty", pick(totals, ["total_penalty"])],
          ]),
        }),
        kpi("Total Balance", formatCurrency(balance.value)),
      ],
    },
  ];

  const note = truncationNote(
    rows.length,
    totalRows,
    due.fromServer && balance.fromServer && serverOverdueCount !== null
  );
  if (note) sections.push(note);

  // Each component prefers the server's period-wide total and falls back to
  // summing the page, exactly as the headline figures do — so the footer never
  // mixes a period total in one column with a page total in the next.
  const principalDue = resolveTotal(
    totals,
    ["total_principal_due"],
    rows,
    "principal_due"
  );
  const interestDue = resolveTotal(totals, ["total_interest_due"], rows, "interest_due");
  const penalty = resolveTotal(totals, ["total_penalty"], rows, "penalty_amount");

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
              value: formatCurrency(principalDue.value),
            },
            { column: "interest_due", value: formatCurrency(interestDue.value) },
            { column: "penalty_amount", value: formatCurrency(penalty.value) },
            { column: "amount_due", value: formatCurrency(due.value) },
            { column: "amount_paid", value: formatCurrency(sum(rows, "amount_paid")) },
            { column: "balance", value: formatCurrency(balance.value) },
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
