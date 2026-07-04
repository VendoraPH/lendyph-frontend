import {
  Banknote,
  ClipboardList,
  Clock,
  PieChart,
  TrendingUp,
  Users,
  ListChecks,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { reportService } from "@/services";
import { formatCurrency, formatDateRange, formatGeneratedAt } from "./formatters";
import type {
  DateRange,
  KpiItem,
  ReportColumn,
  ReportDefinition,
  ReportDocument,
  ReportSection,
} from "./types";

const ORG = "Lendyph — Cooperative Lending";

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

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
  return rows.reduce((acc, r) => acc + (numeric(r[key]) ?? 0), 0);
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

// ---------------------------------------------------------------------------
// Column schemas for list reports
// ---------------------------------------------------------------------------

const RELEASE_COLUMNS: ReportColumn[] = [
  { key: "release_date", header: "Release Date", format: "date", width: 120 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Borrower", format: "text", width: 220 },
  { key: "principal", header: "Principal", format: "currency", align: "right", width: 140 },
  { key: "term", header: "Term", format: "text", align: "right", width: 80 },
  { key: "interest_rate", header: "Rate", format: "percent", align: "right", width: 80 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

const REPAYMENT_COLUMNS: ReportColumn[] = [
  { key: "paid_at", header: "Paid On", format: "datetime", width: 170 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Borrower", format: "text", width: 220 },
  { key: "amount", header: "Amount", format: "currency", align: "right", width: 140 },
  { key: "penalty_amount", header: "Penalty", format: "currency", align: "right", width: 120 },
  { key: "method", header: "Method", format: "text", width: 110 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

const DUE_COLUMNS: ReportColumn[] = [
  { key: "due_date", header: "Due Date", format: "date", width: 120 },
  { key: "days_overdue", header: "Days Overdue", format: "number", align: "right", width: 120 },
  { key: "loan_account_number", header: "Loan #", format: "text", width: 120 },
  { key: "borrower_name", header: "Borrower", format: "text", width: 220 },
  { key: "amount_due", header: "Amount Due", format: "currency", align: "right", width: 140 },
  { key: "balance", header: "Balance", format: "currency", align: "right", width: 140 },
  { key: "status", header: "Status", format: "text", width: 110 },
];

// Normalizers — accept multiple backend key conventions and shape rows for
// display. This keeps the UI resilient to snake_case, camelCase, or nested
// borrower objects.

function normalizeReleaseRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  return {
    release_date:
      pick(raw, ["release_date", "released_at", "start_date"]) ??
      pick(borrower, ["release_date"]),
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    principal: pick(raw, ["principal", "principal_amount", "amount"]),
    term: pick(raw, ["term", "term_months", "term_label"]),
    interest_rate: pick(raw, ["interest_rate", "rate"]),
    status: pick(raw, ["status"]),
  };
}

function normalizeRepaymentRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  const loan = asRecord(raw.loan);
  return {
    paid_at: pick(raw, ["paid_at", "created_at"]),
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number"]) ??
      pick(loan, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    amount: pick(raw, ["amount", "total_amount"]),
    penalty_amount: pick(raw, ["penalty_amount", "penalty"]),
    method: pick(raw, ["method", "payment_method"]),
    status: pick(raw, ["status"]),
  };
}

function normalizeDueRow(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = asRecord(raw.borrower);
  const loan = asRecord(raw.loan);
  return {
    due_date: pick(raw, ["due_date", "scheduled_date", "date"]),
    days_overdue: pick(raw, ["days_overdue", "days_past_due"]) ?? 0,
    loan_account_number:
      pick(raw, ["loan_account_number", "account_number"]) ??
      pick(loan, ["loan_account_number", "account_number", "application_number"]),
    borrower_name:
      pick(raw, ["borrower_name", "borrower_full_name"]) ??
      pick(borrower, ["full_name", "name"]),
    amount_due: pick(raw, ["amount_due", "total_due", "scheduled_amount"]),
    balance: pick(raw, ["balance", "outstanding_balance", "remaining_balance"]),
    status: pick(raw, ["status"]),
  };
}

// ---------------------------------------------------------------------------
// KPI builders — tolerate missing/partial API shapes by falling back to "—".
// ---------------------------------------------------------------------------

function kpi(label: string, value: string, opts: Partial<KpiItem> = {}): KpiItem {
  return { label, value, ...opts };
}

function currencyOrDash(value: unknown): string {
  const n = numeric(value);
  return n === null ? "—" : formatCurrency(n);
}

function countOrDash(value: unknown): string {
  const n = numeric(value);
  return n === null ? "—" : n.toLocaleString("en-PH");
}

function percentOrDash(value: unknown): string {
  const n = numeric(value);
  if (n === null) return "—";
  return `${(n > 1 ? n : n * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Report builders
// ---------------------------------------------------------------------------

async function buildDailyCollection(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .dailyCollection({ date_from: range.from, date_to: range.to })
    .catch(() => null);
  const obj = asRecord(raw);

  const totalDue = pick(obj, ["total_due", "due", "total_scheduled"]);
  const totalCollected = pick(obj, ["total_collected", "collected", "total_amount"]);
  const uncollected = pick(obj, ["uncollected", "outstanding"]);
  const rate = pick(obj, ["collection_rate", "rate"]);

  const items: KpiItem[] = [
    kpi("Total Due", currencyOrDash(totalDue)),
    kpi("Total Collected", currencyOrDash(totalCollected), { tone: "positive" }),
    kpi("Collection Rate", percentOrDash(rate)),
    kpi("Uncollected", currencyOrDash(uncollected), { tone: "negative" }),
  ];

  return {
    reportId: "daily_collection",
    meta: meta("Daily Collection Report", range, "Summary of amounts due vs collected"),
    sections: [{ kind: "kpi_grid", items }],
  };
}

async function buildPortfolioSummary(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .loanBalanceSummary({ date_from: range.from, date_to: range.to })
    .catch(() => null);
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi("Total Active Loans", countOrDash(pick(obj, ["active_loans", "total_active", "active_count"]))),
    kpi("Outstanding Balance", currencyOrDash(pick(obj, ["outstanding_balance", "outstanding", "total_balance"]))),
    kpi("At Risk (>30d overdue)", currencyOrDash(pick(obj, ["at_risk_amount", "at_risk"])), {
      tone: "negative",
    }),
    kpi("PAR Ratio", percentOrDash(pick(obj, ["par_ratio", "par"])), {
      tone: "negative",
      hint: "Portfolio at Risk",
    }),
  ];

  return {
    reportId: "portfolio_summary",
    meta: meta("Portfolio Summary", range, "Overall loan portfolio status"),
    sections: [{ kind: "kpi_grid", items }],
  };
}

async function buildIncomeReport(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .income({ date_from: range.from, date_to: range.to })
    .catch(() => null);
  const obj = asRecord(raw);

  const interest = numeric(pick(obj, ["interest_income", "interest"]));
  const fees = numeric(pick(obj, ["processing_fees", "fees", "fee_income"]));
  const penalties = numeric(pick(obj, ["penalty_income", "penalties"]));
  const total =
    numeric(pick(obj, ["total_income", "total"])) ??
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

async function buildAgingReport(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .aging({ date_from: range.from, date_to: range.to })
    .catch(() => null);
  const obj = asRecord(raw);
  const buckets = asRecord(pick(obj, ["buckets", "aging_buckets"])) ?? obj;

  const items: KpiItem[] = [
    kpi(
      "1–30 Days Overdue",
      currencyOrDash(pick(buckets, ["1_30", "bucket_1_30", "days_1_30"]))
    ),
    kpi(
      "31–60 Days Overdue",
      currencyOrDash(pick(buckets, ["31_60", "bucket_31_60", "days_31_60"]))
    ),
    kpi(
      "61–90 Days Overdue",
      currencyOrDash(pick(buckets, ["61_90", "bucket_61_90", "days_61_90"])),
      { tone: "negative" }
    ),
    kpi(
      ">90 Days Overdue",
      currencyOrDash(pick(buckets, ["over_90", "90_plus", "bucket_over_90"])),
      { tone: "negative" }
    ),
  ];

  return {
    reportId: "aging_report",
    meta: meta("Aging Report", range, "Overdue amounts grouped by aging bucket"),
    sections: [{ kind: "kpi_grid", items }],
  };
}

async function buildBorrowerReport(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .borrowers({ date_from: range.from, date_to: range.to })
    .catch(() => null);
  const obj = asRecord(raw);

  const items: KpiItem[] = [
    kpi("Total Active Borrowers", countOrDash(pick(obj, ["active_borrowers", "total_active"]))),
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

async function buildDisbursementReport(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .disbursements({ date_from: range.from, date_to: range.to })
    .catch(() => null);
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

async function buildReleasesList(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .releases({ date_from: range.from, date_to: range.to, per_page: 200 })
    .catch(() => null);
  const rows = asArray(raw).map(normalizeReleaseRow);
  const totalPrincipal = sum(rows, "principal");

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Releases", countOrDash(rows.length)),
        kpi("Total Principal", formatCurrency(totalPrincipal), { tone: "positive" }),
      ],
    },
    {
      kind: "table",
      title: "Releases",
      columns: RELEASE_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [{ column: "principal", label: "Total", value: formatCurrency(totalPrincipal) }]
          : undefined,
      emptyText: "No loans were released in the selected period.",
    },
  ];

  return {
    reportId: "releases_list",
    meta: meta("Releases List", range, "Loans released during the selected period"),
    sections,
  };
}

async function buildRepaymentsList(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .repayments({ date_from: range.from, date_to: range.to, per_page: 200 })
    .catch(() => null);
  const rows = asArray(raw).map(normalizeRepaymentRow);
  const totalAmount = sum(rows, "amount");
  const totalPenalty = sum(rows, "penalty_amount");

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Repayments", countOrDash(rows.length)),
        kpi("Total Collected", formatCurrency(totalAmount), { tone: "positive" }),
        kpi("Penalty Collected", formatCurrency(totalPenalty)),
      ],
    },
    {
      kind: "table",
      title: "Repayments",
      columns: REPAYMENT_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "amount", label: "Total", value: formatCurrency(totalAmount) },
              { column: "penalty_amount", value: formatCurrency(totalPenalty) },
            ]
          : undefined,
      emptyText: "No repayments were recorded in the selected period.",
    },
  ];

  return {
    reportId: "repayments_list",
    meta: meta("Repayments List", range, "All repayments recorded in the selected period"),
    sections,
  };
}

async function buildDuePastDueList(range: DateRange): Promise<ReportDocument> {
  const raw = await reportService
    .duePastDue({ date_from: range.from, date_to: range.to, per_page: 200 })
    .catch(() => null);
  const rows = asArray(raw).map(normalizeDueRow);
  const totalDue = sum(rows, "amount_due");
  const totalBalance = sum(rows, "balance");
  const overdueCount = rows.filter((r) => (numeric(r.days_overdue) ?? 0) > 0).length;

  const sections: ReportSection[] = [
    {
      kind: "kpi_grid",
      items: [
        kpi("Total Schedules", countOrDash(rows.length)),
        kpi("Overdue Count", countOrDash(overdueCount), {
          tone: overdueCount > 0 ? "negative" : "neutral",
        }),
        kpi("Total Amount Due", formatCurrency(totalDue), { tone: "negative" }),
        kpi("Total Balance", formatCurrency(totalBalance)),
      ],
    },
    {
      kind: "table",
      title: "Due / Past Due",
      columns: DUE_COLUMNS,
      rows,
      totals:
        rows.length > 0
          ? [
              { column: "amount_due", label: "Total", value: formatCurrency(totalDue) },
              { column: "balance", value: formatCurrency(totalBalance) },
            ]
          : undefined,
      emptyText: "No schedules due or past due for the selected period.",
    },
  ];

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
// Accent palettes — chosen per category to give the catalog visual rhythm.
// ---------------------------------------------------------------------------

const ACCENT = {
  orange: {
    text: "text-brand-orange",
    bg: "bg-brand-orange/10",
    ring: "ring-brand-orange/20",
  },
  blue: { text: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  green: { text: "text-green-600", bg: "bg-green-50", ring: "ring-green-200" },
  red: { text: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" },
  purple: { text: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-200" },
  cyan: { text: "text-cyan-600", bg: "bg-cyan-50", ring: "ring-cyan-200" },
  indigo: { text: "text-indigo-600", bg: "bg-indigo-50", ring: "ring-indigo-200" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  amber: { text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
} as const;

// ---------------------------------------------------------------------------
// Exported catalog
// ---------------------------------------------------------------------------

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: "daily_collection",
    title: "Daily Collection Report",
    description: "Today's collections versus the schedule.",
    category: "operations",
    icon: ClipboardList,
    accent: ACCENT.orange,
    build: buildDailyCollection,
  },
  {
    id: "repayments_list",
    title: "Repayments List",
    description: "Every repayment recorded in the period.",
    category: "operations",
    icon: Receipt,
    accent: ACCENT.emerald,
    build: buildRepaymentsList,
  },
  {
    id: "portfolio_summary",
    title: "Portfolio Summary",
    description: "Active loans, outstanding balance, portfolio at risk.",
    category: "portfolio",
    icon: PieChart,
    accent: ACCENT.blue,
    build: buildPortfolioSummary,
  },
  {
    id: "income_report",
    title: "Income Report",
    description: "Interest, processing fees, and penalty income.",
    category: "portfolio",
    icon: TrendingUp,
    accent: ACCENT.green,
    build: buildIncomeReport,
  },
  {
    id: "aging_report",
    title: "Aging Report",
    description: "Overdue balances by 1–30, 31–60, 61–90, and 90+ buckets.",
    category: "portfolio",
    icon: Clock,
    accent: ACCENT.red,
    build: buildAgingReport,
  },
  {
    id: "due_past_due_list",
    title: "Due / Past Due List",
    description: "Schedules due or overdue as of the selected period.",
    category: "portfolio",
    icon: AlertTriangle,
    accent: ACCENT.amber,
    build: buildDuePastDueList,
  },
  {
    id: "borrower_report",
    title: "Borrower Report",
    description: "Active, new, and repeat borrower counts.",
    category: "member",
    icon: Users,
    accent: ACCENT.purple,
    build: buildBorrowerReport,
  },
  {
    id: "disbursement_report",
    title: "Disbursement Summary",
    description: "Totals for releases during the period.",
    category: "disbursement",
    icon: Banknote,
    accent: ACCENT.cyan,
    build: buildDisbursementReport,
  },
  {
    id: "releases_list",
    title: "Releases List",
    description: "Every loan released in the period with key terms.",
    category: "disbursement",
    icon: ListChecks,
    accent: ACCENT.indigo,
    build: buildReleasesList,
  },
];
