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

/**
 * `org` is deliberately empty here.
 *
 * Lendyph is single-tenant-per-deployment, and this module is pure: it has no
 * session and no branding to read, so hardcoding a name printed one
 * cooperative's letterhead on every other cooperative's reports. The name is
 * filled by `applyChrome()` from branding settings — exactly the way the logo
 * already is — with `siteConfig.name` as the fallback.
 */
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
    org: "",
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
 * A section total: the server's figure when it sent one, otherwise the sum of
 * the lines it did send.
 *
 * Returns null — not 0 — when the block is missing entirely, so a failed
 * request shows "—" rather than asserting a zero the server never reported.
 */
function lineTotal(lines: StatementLine[], server: unknown): number | null {
  const fromServer = toNumber(server);
  if (fromServer !== null) return fromServer;
  const present = lines.filter((line) => line.amount !== null);
  return present.length === 0
    ? null
    : present.reduce((acc, line) => acc + (line.amount ?? 0), 0);
}

/** Sum a column, or null when not one row carried a figure for it. */
function sumOrNull(rows: Record<string, unknown>[], key: string): number | null {
  const present = rows.filter((r) => toNumber(r[key]) !== null);
  return present.length === 0 ? null : sum(present, key);
}

/**
 * Whole-percent ratio of two figures, or null when it cannot be stated.
 *
 * Only ever a fallback: every one of these endpoints computes its own rates
 * server-side, where both sides of the ratio are scoped identically. A rate
 * derived here from two rounded display figures can disagree with the server's
 * in the last decimal, so the server's always wins.
 */
function ratioPercent(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return (part / whole) * 100;
}

/**
 * Normalise a rate that may arrive as a fraction into whole percent.
 *
 * Report percentages are always whole (12.5 means 12.5%), so a provisioning
 * ladder sent as 0.05/0.15/0.25/0.50 has to be scaled up or a 5% provision
 * prints as 0.05%.
 *
 * "At or below 1 is a fraction" is a guess, and it is wrong for exactly one
 * input: a genuine whole 1, meaning 1%, comes back out as 100. The assumption
 * that makes it safe is not about provisioning ladders in general — it is
 * about the single call site. `buildProvisioningDoc()` reads the API's
 * `rate_percent` first and only falls back to the raw `rate`/`provision_rate`
 * when that key is absent, which no response omits; and the raw key is a
 * fraction in every one of them. So the ambiguous input is unreachable.
 *
 * That is a property of the caller, not of this function. Anything that could
 * hand it a whole percent has to carry its own unit rather than have the unit
 * guessed here — do not widen the rule to cover it.
 */
function scaleToPercent(value: number | null): number | null {
  if (value === null) return null;
  return value > 0 && value <= 1 ? value * 100 : value;
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
  return rows.map((raw) => {
    // `inflow_total` / `outflow_total` are the API's names; the plain forms are
    // the fallback.
    const inflows = toNumber(pick(raw, ["inflow_total", "inflows", "total_inflows", "cash_in"]));
    const outflows = toNumber(
      pick(raw, ["outflow_total", "outflows", "total_outflows", "cash_out"])
    );
    return {
      branch_name: pick(raw, ["branch_name", "name"]) ?? "Unassigned",
      inflows,
      outflows,
      net:
        toNumber(pick(raw, ["net_movement", "net", "net_cash_flow"])) ??
        (inflows !== null && outflows !== null ? inflows - outflows : null),
    };
  });
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

  const totalIn = lineTotal(
    inflowLines,
    pick(inflowBlock, ["total"]) ?? pick(obj, ["total_inflows"])
  );
  const totalOut = lineTotal(
    outflowLines,
    pick(outflowBlock, ["total"]) ?? pick(obj, ["total_outflows"])
  );

  // The server states the net; subtracting the two totals is the fallback, and
  // it is only meaningful when both sides actually came back.
  const net =
    toNumber(pick(obj, ["net_movement", "net_cash_flow", "net"])) ??
    (totalIn !== null && totalOut !== null ? totalIn - totalOut : null);

  // Deductions are withheld at release and never leave the till, so they are
  // not an outflow. Shown beside the statement so the gross principal released
  // can still be reconciled against the net proceeds paid out.
  const nonCashBlock = asRecord(pick(obj, ["non_cash"]));
  const nonCash =
    pick(nonCashBlock, ["total_deductions", "deductions"]) ??
    pick(obj, ["total_deductions"]);
  const principalReleased = pick(nonCashBlock, ["principal_released"]);

  const branchRows = cashFlowBranchRows(asArray(pick(obj, ["by_branch", "branches"])));

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
        totalCell("inflows", sumOrNull(branchRows, "inflows"), "Total"),
        totalCell("outflows", sumOrNull(branchRows, "outflows")),
        totalCell("net", sumOrNull(branchRows, "net")),
      ],
    });
    // The branch rows are loan cash ONLY: they sum to the repayment and
    // net-proceeds lines, not to the statement totals.
    //
    // The server's wording wins because it is now scope-dependent — with a
    // branch filter applied, share capital IS scoped through the member's
    // branch (matching the Share Capital report), and only the unfiltered case
    // is organisation-wide. What never changes is that share capital is
    // excluded from `by_branch`, so the fallback claims only that.
    sections.push({
      kind: "note",
      text: String(
        pick(shareBlock, ["note"]) ??
          "Share capital cannot be attributed to a branch row, so the branch breakdown " +
            "covers loan collections and releases only; add the share capital lines back " +
            "to reach the totals above."
      ),
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

function normalizeEfficiencyRow(
  raw: Record<string, unknown>,
  labelKeys: string[],
  fallbackLabel: string
): Record<string, unknown> {
  const due = toNumber(pick(raw, ["total_due", "due", "amount_due"]));
  const collected = toNumber(
    pick(raw, ["total_collected", "collected", "amount_collected"])
  );

  return {
    label: pick(raw, labelKeys) ?? fallbackLabel,
    total_due: due,
    total_collected: collected,
    uncollected:
      toNumber(pick(raw, ["uncollected", "outstanding", "balance"])) ??
      (due !== null && collected !== null ? Math.max(0, due - collected) : null),
    collection_rate:
      toNumber(pick(raw, ["collection_rate", "efficiency", "rate"])) ??
      ratioPercent(collected, due),
  };
}

/**
 * Footer for an efficiency table. The rate is the period rate the server
 * reported, never the average of the rates above it — averaging per-branch
 * rates weights a branch with ₱5,000 due the same as one with ₱5,000,000.
 */
function efficiencyTotals(
  rows: Record<string, unknown>[],
  headlineDue: number | null,
  headlineCollected: number | null,
  headlineUncollected: number | null,
  headlineRate: number | null
) {
  const due = headlineDue ?? sumOrNull(rows, "total_due");
  const collected = headlineCollected ?? sumOrNull(rows, "total_collected");
  const rate = headlineRate ?? ratioPercent(collected, due);

  return [
    totalCell("total_due", due, "Total"),
    totalCell("total_collected", collected),
    totalCell("uncollected", headlineUncollected ?? sumOrNull(rows, "uncollected")),
    { column: "collection_rate", value: percentOrDash(rate) },
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

  const due = toNumber(pick(obj, ["total_due", "due"]));
  const collected = toNumber(pick(obj, ["total_collected", "collected"]));
  const uncollected =
    toNumber(pick(obj, ["uncollected", "outstanding"])) ??
    (due !== null && collected !== null ? Math.max(0, due - collected) : null);
  const rate =
    toNumber(pick(obj, ["collection_rate", "efficiency", "rate"])) ??
    ratioPercent(collected, due);

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
          kpi("Total Due", currencyOrDash(due)),
          kpi("Total Collected", currencyOrDash(collected), { tone: "positive" }),
          kpi("Collection Efficiency", percentOrDash(rate), {
            hint: "Collected over due, scoped identically on both sides",
          }),
          kpi("Uncollected", currencyOrDash(uncollected), { tone: "negative" }),
        ],
      },
      {
        kind: "table",
        title: "Efficiency by Branch",
        columns: efficiencyColumns("Branch", 200),
        rows: branchRows,
        totals:
          branchRows.length > 0
            ? efficiencyTotals(branchRows, due, collected, uncollected, rate)
            : undefined,
        emptyText: "No branch breakdown was returned for this period.",
      },
      {
        kind: "table",
        title: "Monthly Trend",
        columns: efficiencyColumns("Period", 140),
        rows: periodRows,
        totals:
          periodRows.length > 0
            ? efficiencyTotals(periodRows, due, collected, uncollected, rate)
            : undefined,
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
    key: "outstanding_balance",
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
  { key: "avg_interest_rate", header: "Avg Rate", format: "percent", align: "right", width: 100 },
  { key: "overdue_amount", header: "Overdue", format: "currency", align: "right", width: 145 },
  { key: "par_ratio", header: "PAR", format: "percent", align: "right", width: 90 },
];

function normalizeProductRow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    product_name:
      pick(raw, ["product_name", "loan_product_name", "name"]) ?? "Unassigned",
    loan_count: pick(raw, ["loan_count", "loans", "count"]),
    total_released: pick(raw, ["total_released", "released", "principal"]),
    // `outstanding` is the API's name; it already includes insurance, exactly
    // as the Portfolio Summary's headline balance does.
    outstanding_balance: pick(raw, ["outstanding", "outstanding_balance", "balance"]),
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
 * Every money column prefers the server's `totals` block. PAR has no fallback
 * at all: it is computed against outstanding principal server-side, so neither
 * summing nor averaging the column reproduces it, and a wrong PAR is worse
 * than an absent one.
 */
export function buildPortfolioByProductDoc(
  raw: unknown,
  range: DateRange
): ReportDocument {
  const obj = asRecord(raw);
  const totals = asRecord(pick(obj, ["totals", "summary"]));
  const rows = asArray(pick(obj, ["products", "by_product", "data"])).map(
    normalizeProductRow
  );

  const released =
    toNumber(pick(totals, ["total_released", "released"])) ??
    sumOrNull(rows, "total_released");
  const outstanding =
    toNumber(pick(totals, ["outstanding", "outstanding_balance"])) ??
    sumOrNull(rows, "outstanding_balance");
  const overdue =
    toNumber(pick(totals, ["overdue_amount", "overdue"])) ??
    sumOrNull(rows, "overdue_amount");
  const loanCount =
    toNumber(pick(totals, ["loan_count", "loans"])) ?? sumOrNull(rows, "loan_count");
  // A response carrying an empty product list genuinely means zero products; a
  // failed request means we know nothing, so it dashes rather than claiming a
  // zero the server never sent.
  const productCount =
    toNumber(pick(totals, ["product_count"])) ?? (obj === null ? null : rows.length);
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
            hint: avgRate === null ? undefined : `Avg rate ${percentOrDash(avgRate)}`,
          }),
          kpi("Outstanding Balance", currencyOrDash(outstanding)),
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
                totalCell("outstanding_balance", outstanding),
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

/** Credits/debits/net, shared by the monthly and per-member breakdowns. */
function shareCapitalMovement(raw: Record<string, unknown>) {
  const credits = toNumber(pick(raw, ["credits", "credit", "total_credits"]));
  const debits = toNumber(pick(raw, ["debits", "debit", "total_debits"]));
  return {
    credits,
    debits,
    net:
      toNumber(pick(raw, ["net", "net_movement"])) ??
      (credits !== null && debits !== null ? credits - debits : null),
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
  const net =
    toNumber(pick(obj, ["net_movement", "net"])) ??
    (credits !== null && debits !== null ? credits - debits : null);
  const closing =
    toNumber(pick(obj, ["closing_balance", "ending_balance"])) ??
    (opening !== null && net !== null ? opening + net : null);

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
    closing_balance: pick(r, ["closing_balance", "balance", "running_balance"]),
  }));

  const memberRows = asArray(pick(obj, ["by_member", "members_breakdown"])).map((r) => {
    const movement = shareCapitalMovement(r);
    return {
      member_name:
        pick(r, ["borrower_name", "member_name", "full_name", "name"]) ?? "Unassigned",
      member_no: pick(r, ["borrower_code", "member_no", "code"]),
      opening_balance: pick(r, ["opening_balance", "beginning_balance"]),
      credits: movement.credits,
      debits: movement.debits,
      balance: pick(r, ["closing_balance", "balance", "total"]) ?? movement.net,
    };
  });

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
                totalCell("credits", sumOrNull(monthRows, "credits"), "Total"),
                totalCell("debits", sumOrNull(monthRows, "debits")),
                totalCell("net", sumOrNull(monthRows, "net")),
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
              totalCell("opening_balance", sumOrNull(memberRows, "opening_balance"), "Total"),
              totalCell("credits", sumOrNull(memberRows, "credits")),
              totalCell("debits", sumOrNull(memberRows, "debits")),
              totalCell("balance", sumOrNull(memberRows, "balance")),
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
    key: "outstanding_balance",
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
    header: "Borrowers (to date)",
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
    outstanding_balance: pick(raw, ["outstanding", "outstanding_balance", "balance"]),
    overdue_amount: pick(raw, ["overdue_amount", "overdue", "past_due_amount"]),
    par_ratio: pick(raw, ["par_ratio", "par"]),
    active_borrowers: pick(raw, ["active_borrowers", "borrower_count", "borrowers"]),
  };
}

/**
 * Footer for a performance table.
 *
 * Every loan belongs to exactly one branch and to exactly one officer row —
 * "Unassigned" included — so the money and release counts sum exactly. PAR and
 * `active_borrowers` deliberately have no footer: PAR is a weighted ratio, and
 * a borrower served by two officers is still one borrower, so both would be
 * wrong as a column sum and the API states neither as a grand total.
 */
function performanceTotals(rows: Record<string, unknown>[]) {
  return [
    {
      column: "released_count",
      label: "Total",
      value: countOrDash(sumOrNull(rows, "released_count")),
    },
    totalCell("released_amount", sumOrNull(rows, "released_amount")),
    totalCell("collected_amount", sumOrNull(rows, "collected_amount")),
    totalCell("outstanding_balance", sumOrNull(rows, "outstanding_balance")),
    totalCell("overdue_amount", sumOrNull(rows, "overdue_amount")),
  ];
}

/**
 * `Loan::accountOfficer()` has existed all along and was never reported on.
 * Officer first, branch second — the officer view is the one that changes
 * behaviour, the branch view is the one that gets read in a board meeting.
 */
export function buildPerformanceDoc(raw: unknown, range: DateRange): ReportDocument {
  const obj = asRecord(raw);
  // The API sends no grand-total block: every headline below is summed from
  // the officer rows, which is exact because each loan appears in exactly one
  // of them ("Unassigned" included).
  const totals = asRecord(pick(obj, ["totals", "summary"]));

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

  const headline = officerRows.length > 0 ? officerRows : branchRows;

  const releasedCount =
    toNumber(pick(totals, ["released_count", "loans_released"])) ??
    sumOrNull(headline, "released_count");
  const releasedAmount =
    toNumber(pick(totals, ["released_amount", "total_released"])) ??
    sumOrNull(headline, "released_amount");
  const collected =
    toNumber(pick(totals, ["collected", "collected_amount", "total_collected"])) ??
    sumOrNull(headline, "collected_amount");
  // Outstanding sums exactly and is always available; `active_borrowers` does
  // not (a borrower can be counted under two officers) and the API states no
  // distinct total, so the fourth headline is the one that can be trusted.
  const outstanding =
    toNumber(pick(totals, ["outstanding", "outstanding_balance"])) ??
    sumOrNull(headline, "outstanding_balance");

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Loans Released", countOrDash(releasedCount), { hint: "In the selected period" }),
        kpi("Amount Released", currencyOrDash(releasedAmount), { tone: "positive" }),
        kpi("Total Collected", currencyOrDash(collected), { tone: "positive" }),
        kpi("Outstanding Balance", currencyOrDash(outstanding), {
          hint: "Whole book, as of today",
        }),
      ],
    },
    {
      kind: "table",
      title: "By Account Officer",
      columns: performanceColumns("Account Officer", 190),
      rows: officerRows,
      totals: officerRows.length > 0 ? performanceTotals(officerRows) : undefined,
      emptyText: "No account officer activity was recorded in this period.",
    },
    {
      kind: "table",
      title: "By Branch",
      columns: performanceColumns("Branch", 190),
      rows: branchRows,
      totals: branchRows.length > 0 ? performanceTotals(branchRows) : undefined,
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
          "PAR and borrower counts are as of today over each officer's whole book."
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
  const total = asRecord(pick(obj, ["total", "totals"]));
  const rates = asRecord(pick(obj, ["provision_rates", "rates"]));

  // `buckets` is an object keyed by bucket, not an array — the same shape the
  // Aging Report returns — so AGING_BUCKETS drives both the iteration order
  // and the labels, and the two reports can never disagree on either.
  const rows = AGING_BUCKETS.map(([label, keys]) => {
    const bucket = asRecord(pick(buckets, keys));
    const amount = toNumber(bucket?.amount);

    // The API sends BOTH `rate` (a fraction, 0.05) and `rate_percent` (whole,
    // 5). Everything in a report is whole percent, so reading `rate` would
    // print a 5% provision as 0.1%. `rate_percent` first; a bare fraction from
    // `rates` is scaled up rather than trusted as-is.
    const ratePercent =
      toNumber(pick(bucket, ["rate_percent"])) ??
      scaleToPercent(toNumber(pick(bucket, ["rate", "provision_rate"]))) ??
      scaleToPercent(toNumber(pick(rates, keys)));

    return {
      bucket: label,
      amount,
      rate: ratePercent,
      count: toNumber(bucket?.count),
      // Server-first. The fallback is the report's own definition — amount
      // times rate — and only runs when the server sent both inputs, so it
      // cannot invent a figure.
      required_allowance:
        toNumber(pick(bucket, ["required_allowance", "allowance", "provision"])) ??
        (amount !== null && ratePercent !== null ? (amount * ratePercent) / 100 : null),
    };
  });

  const totalAmount = toNumber(total?.amount) ?? sumOrNull(rows, "amount");
  const totalAllowance =
    toNumber(pick(total, ["required_allowance", "allowance", "provision"])) ??
    sumOrNull(rows, "required_allowance");
  const delinquentLoans = toNumber(total?.count);
  // Weighted, not the average of the four rates — the mix of buckets is the
  // whole point of the report.
  const effectiveRate =
    toNumber(pick(total, ["effective_rate"])) ??
    toNumber(pick(obj, ["effective_rate", "provision_rate"])) ??
    ratioPercent(totalAllowance, totalAmount);
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
