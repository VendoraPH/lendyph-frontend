import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  BookOpen,
  ClipboardList,
  Clock,
  Coins,
  FileText,
  Gauge,
  Hourglass,
  Scale,
  Layers,
  ListChecks,
  MoonStar,
  PieChart,
  PiggyBank,
  ReceiptText,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { env } from "@/config/env";
import { api } from "@/lib/api-client";
import { reportService } from "@/services";
import { REPORT_TITLES } from "@/lib/page-titles";
import {
  LIST_PAGE_SIZE,
  buildAgingDoc,
  buildBorrowerDoc,
  buildCashFlowDoc,
  buildCollectionEfficiencyDoc,
  buildDailyCollectionDoc,
  buildDisbursementDoc,
  buildDuePastDueListDoc,
  buildIncomeDoc,
  buildPerformanceDoc,
  buildPortfolioByProductDoc,
  buildPortfolioSummaryDoc,
  buildProvisioningDoc,
  buildReleasesListDoc,
  buildRepaymentsListDoc,
  buildShareCapitalDoc,
  buildStatementOfAccountDoc,
  buildSubsidiaryLedgerDoc,
} from "./report-builders";
import {
  buildSavingsBalancesDoc,
  buildSavingsDormantDoc,
  buildSavingsGlControlDoc,
  buildSavingsInterestPostingsDoc,
  buildSavingsStatementDoc,
  buildSavingsTransactionsDoc,
  buildTimeDepositMaturitiesDoc,
} from "./savings-report-builders";
import type { Permission } from "@/types";
import type {
  DateRange,
  ReportContext,
  ReportDefinition,
  ReportDocument,
} from "./types";

/**
 * Fetch wiring + the catalog itself. Every payload→document mapping lives in
 * `report-builders.ts` so it stays unit-testable against the API contract.
 */

type Fetcher = (params: Record<string, unknown>) => Promise<unknown>;
type Mapper = (raw: unknown, range: DateRange) => ReportDocument;

/**
 * A failed request must still render the report shell — the builders turn a
 * null payload into "—" placeholders rather than an error screen.
 *
 * `branch_id` is only attached when a branch is actually selected: sending
 * `branch_id=null` would be a filter value to the API, not the absence of one.
 */
function reportBuilder(fetcher: Fetcher, map: Mapper, extraParams: Record<string, unknown> = {}) {
  return async (ctx: ReportContext): Promise<ReportDocument> => {
    const raw = await fetcher({
      date_from: ctx.range.from,
      date_to: ctx.range.to,
      ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
      ...extraParams,
    }).catch(() => null);
    return map(raw, ctx.range);
  };
}

/**
 * Wiring for the two reports that read a single loan or borrower. They take a
 * path id rather than a date filter, so they cannot share `reportBuilder`.
 */
function subjectReportBuilder(
  fetcher: (id: number, params: Record<string, unknown>) => Promise<unknown>,
  map: Mapper
) {
  return async (ctx: ReportContext): Promise<ReportDocument> => {
    // The detail page blocks Generate until a subject is picked, so this is a
    // guard against a malformed call rather than an expected state.
    if (!ctx.subjectId) return map(null, ctx.range);
    const raw = await fetcher(ctx.subjectId, {
      date_from: ctx.range.from,
      date_to: ctx.range.to,
    }).catch(() => null);
    return map(raw, ctx.range);
  };
}

/**
 * A report of the whole book as of today. The API narrows by release date when
 * dates are sent, so none are: hiding the date controls alone would still report
 * only the loans released in the default month.
 */
function pointInTimeBuilder(fetcher: Fetcher, map: Mapper) {
  return async (ctx: ReportContext): Promise<ReportDocument> => {
    const raw = await fetcher(ctx.branchId ? { branch_id: ctx.branchId } : {}).catch(() => null);
    return map(raw, ctx.range);
  };
}

const listParams = { per_page: LIST_PAGE_SIZE };

/** Savings reports need `savings:view` and the deployment's savings switch. */
const SAVINGS_REPORT = { permission: "savings:view", available: env.features.savings } as const;

/** The members behind the Member Report's cards; a paginator envelope, so getRaw. */
const MEMBER_LIST_ENDPOINT = "/reports/borrowers/list";

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
    title: REPORT_TITLES.daily_collection,
    description: "Today's collections versus the schedule.",
    category: "operations",
    icon: ClipboardList,
    accent: ACCENT.orange,
    build: async (ctx) => {
      const params = {
        date_from: ctx.range.from,
        date_to: ctx.range.to,
        ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
      };
      // Independent reads: either failing leaves the other's section intact.
      const [summary, repayments] = await Promise.all([
        reportService.dailyCollection(params).catch(() => null),
        reportService.repayments({ ...params, ...listParams }).catch(() => null),
      ]);
      return buildDailyCollectionDoc(summary, ctx.range, repayments);
    },
  },
  {
    id: "repayments_list",
    title: REPORT_TITLES.repayments_list,
    description: "Every repayment recorded in the period.",
    category: "operations",
    icon: ReceiptText,
    accent: ACCENT.emerald,
    supportsBranch: true,
    build: reportBuilder(reportService.repayments, buildRepaymentsListDoc, listParams),
  },
  {
    id: "collection_efficiency",
    title: REPORT_TITLES.collection_efficiency,
    description: "Amounts due against collected, by branch and by month.",
    category: "performance",
    icon: Gauge,
    accent: ACCENT.orange,
    supportsBranch: true,
    build: reportBuilder(
      reportService.collectionEfficiency,
      buildCollectionEfficiencyDoc
    ),
  },
  {
    id: "performance",
    title: REPORT_TITLES.performance,
    description: "Releases, collections, and risk per account officer.",
    category: "performance",
    icon: Target,
    accent: ACCENT.blue,
    supportsBranch: true,
    build: reportBuilder(reportService.performance, buildPerformanceDoc),
  },
  {
    id: "cash_flow",
    title: REPORT_TITLES.cash_flow,
    description: "Cash received against cash paid out for the period.",
    category: "financial",
    icon: ArrowLeftRight,
    accent: ACCENT.emerald,
    supportsBranch: true,
    build: reportBuilder(reportService.cashFlow, buildCashFlowDoc),
  },
  {
    id: "share_capital",
    title: REPORT_TITLES.share_capital,
    description: "Member share capital movement and subscription status.",
    category: "financial",
    icon: PiggyBank,
    accent: ACCENT.purple,
    // The ledger has no branch column of its own, but the endpoint still
    // honours `branch_id` by resolving it through the member's branch, and
    // reports which scope it applied via `branch_scope`.
    supportsBranch: true,
    build: reportBuilder(reportService.shareCapital, buildShareCapitalDoc),
  },
  {
    id: "provisioning",
    title: REPORT_TITLES.provisioning,
    description: "Required allowance for probable losses by aging bucket.",
    category: "financial",
    icon: ShieldAlert,
    accent: ACCENT.red,
    supportsBranch: true,
    build: reportBuilder(reportService.provisioning, buildProvisioningDoc),
  },
  {
    id: "portfolio_summary",
    title: REPORT_TITLES.portfolio_summary,
    description: "Active loans, outstanding balance, portfolio at risk.",
    category: "portfolio",
    icon: PieChart,
    accent: ACCENT.blue,
    supportsBranch: true,
    noDateRange: true,
    build: pointInTimeBuilder(reportService.loanBalanceSummary, buildPortfolioSummaryDoc),
  },
  {
    id: "income_report",
    title: REPORT_TITLES.income_report,
    description: "Interest, processing fees, and penalty income.",
    category: "portfolio",
    icon: TrendingUp,
    accent: ACCENT.green,
    build: async (ctx) => {
      const params = {
        date_from: ctx.range.from,
        date_to: ctx.range.to,
        ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
      };
      // Independent reads: either failing leaves the other's section intact.
      const [summary, byLoan] = await Promise.all([
        reportService.income(params).catch(() => null),
        reportService.incomeByLoan({ ...params, ...listParams }).catch(() => null),
      ]);
      return buildIncomeDoc(summary, ctx.range, byLoan);
    },
  },
  {
    id: "aging_report",
    title: REPORT_TITLES.aging_report,
    description: "Overdue balances by 1–30, 31–60, 61–90, and 90+ buckets.",
    category: "portfolio",
    icon: Clock,
    accent: ACCENT.red,
    supportsBranch: true,
    build: reportBuilder(reportService.aging, buildAgingDoc),
  },
  {
    id: "portfolio_by_product",
    title: REPORT_TITLES.portfolio_by_product,
    description: "Released, outstanding, and risk for each loan product.",
    category: "portfolio",
    icon: Layers,
    accent: ACCENT.indigo,
    supportsBranch: true,
    build: reportBuilder(reportService.portfolioByProduct, buildPortfolioByProductDoc),
  },
  {
    id: "due_past_due_list",
    title: REPORT_TITLES.due_past_due_list,
    description: "Schedules due or overdue as of the selected period.",
    category: "portfolio",
    icon: AlertTriangle,
    accent: ACCENT.amber,
    supportsBranch: true,
    build: reportBuilder(reportService.duePastDue, buildDuePastDueListDoc, listParams),
  },
  {
    id: "borrower_report",
    title: REPORT_TITLES.borrower_report,
    description: "Active, new, and repeat member counts.",
    category: "member",
    icon: Users,
    accent: ACCENT.purple,
    build: async (ctx) => {
      const params = {
        date_from: ctx.range.from,
        date_to: ctx.range.to,
        ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
      };
      // Independent reads: either failing leaves the other's section intact.
      const [summary, members] = await Promise.all([
        reportService.borrowers(params).catch(() => null),
        api.getRaw(MEMBER_LIST_ENDPOINT, { params: { ...params, ...listParams } }).catch(() => null),
      ]);
      return buildBorrowerDoc(summary, ctx.range, members);
    },
  },
  {
    id: "disbursement_report",
    title: REPORT_TITLES.disbursement_report,
    description: "Totals for releases during the period.",
    category: "disbursement",
    icon: Banknote,
    accent: ACCENT.cyan,
    supportsBranch: true,
    build: async (ctx) => {
      const params = {
        date_from: ctx.range.from,
        date_to: ctx.range.to,
        ...(ctx.branchId ? { branch_id: ctx.branchId } : {}),
      };
      // Independent reads: either failing leaves the other's section intact.
      const [summary, releases] = await Promise.all([
        reportService.disbursements(params).catch(() => null),
        reportService.releases({ ...params, ...listParams }).catch(() => null),
      ]);
      return buildDisbursementDoc(summary, ctx.range, releases);
    },
  },
  {
    id: "releases_list",
    title: REPORT_TITLES.releases_list,
    description: "Every loan released in the period with key terms.",
    category: "disbursement",
    icon: ListChecks,
    accent: ACCENT.indigo,
    supportsBranch: true,
    build: reportBuilder(reportService.releases, buildReleasesListDoc, listParams),
  },
  {
    id: "statement_of_account",
    title: REPORT_TITLES.statement_of_account,
    description: "Full schedule, payments, and balance for one loan.",
    category: "member",
    icon: FileText,
    accent: ACCENT.emerald,
    subject: "loan",
    noDateRange: true,
    build: subjectReportBuilder(
      (id) => reportService.statementOfAccount(id),
      buildStatementOfAccountDoc
    ),
  },
  {
    id: "subsidiary_ledger",
    title: REPORT_TITLES.subsidiary_ledger,
    description: "Every loan and payment for one member.",
    category: "member",
    icon: BookOpen,
    accent: ACCENT.purple,
    subject: "borrower",
    build: subjectReportBuilder(
      (id, params) => reportService.subsidiaryLedger(id, params),
      buildSubsidiaryLedgerDoc
    ),
  },
  // Savings & Deposits: listed only where NEXT_PUBLIC_ENABLE_SAVINGS is on, and
  // only to users who hold savings:view as well as reports:view.
  {
    id: "savings_balances",
    title: REPORT_TITLES.savings_balances,
    description: "Every savings account's balance, holds, pending approvals and accrued interest today.",
    category: "savings",
    icon: Wallet,
    accent: ACCENT.emerald,
    supportsBranch: true,
    noDateRange: true,
    ...SAVINGS_REPORT,
    build: pointInTimeBuilder(
      (params) => reportService.savingsBalances({ ...params, ...listParams }),
      buildSavingsBalancesDoc,
    ),
  },
  {
    id: "savings_transactions",
    title: REPORT_TITLES.savings_transactions,
    description: "Every deposit, withdrawal, transfer, interest and payout posted in the period.",
    category: "savings",
    icon: ArrowLeftRight,
    accent: ACCENT.blue,
    supportsBranch: true,
    ...SAVINGS_REPORT,
    build: reportBuilder(reportService.savingsTransactions, buildSavingsTransactionsDoc, listParams),
  },
  {
    id: "time_deposit_maturities",
    title: REPORT_TITLES.time_deposit_maturities,
    description: "Time deposits maturing in the period and the cash due on them.",
    category: "savings",
    icon: Hourglass,
    accent: ACCENT.amber,
    supportsBranch: true,
    ...SAVINGS_REPORT,
    defaultPeriod: "whole_month",
    build: reportBuilder(reportService.timeDepositMaturities, buildTimeDepositMaturitiesDoc, listParams),
  },
  {
    id: "savings_interest_postings",
    title: REPORT_TITLES.savings_interest_postings,
    description: "Interest runs posted in the period: gross interest, tax withheld and net credited.",
    category: "savings",
    icon: Coins,
    accent: ACCENT.green,
    supportsBranch: true,
    ...SAVINGS_REPORT,
    build: reportBuilder(reportService.savingsInterestPostings, buildSavingsInterestPostingsDoc, listParams),
  },
  {
    id: "savings_dormant",
    title: REPORT_TITLES.savings_dormant,
    description: "Accounts with no member activity for the dormancy period, and the balance they hold.",
    category: "savings",
    icon: MoonStar,
    accent: ACCENT.indigo,
    supportsBranch: true,
    noDateRange: true,
    ...SAVINGS_REPORT,
    build: pointInTimeBuilder(
      (params) => reportService.savingsDormant({ ...params, ...listParams }),
      (raw) => buildSavingsDormantDoc(raw),
    ),
  },
  {
    id: "savings_statement",
    title: REPORT_TITLES.savings_statement,
    description: "One savings account's transactions with its opening, running and closing balances.",
    category: "savings",
    icon: BookOpen,
    accent: ACCENT.purple,
    accountParam: true,
    noCsv: true,
    ...SAVINGS_REPORT,
    build: async (ctx: ReportContext): Promise<ReportDocument> => {
      if (!ctx.subjectId) return buildSavingsStatementDoc(null, ctx.range);
      const raw = await reportService
        .savingsStatement(ctx.subjectId, { date_from: ctx.range.from, date_to: ctx.range.to })
        .catch(() => null);
      return buildSavingsStatementDoc(raw, ctx.range);
    },
  },
  {
    id: "savings_gl_control",
    title: REPORT_TITLES.savings_gl_control,
    description: "The savings subledger against GL 2050 and 2060, by branch, as of today.",
    category: "savings",
    icon: Scale,
    accent: ACCENT.red,
    supportsBranch: true,
    noDateRange: true,
    ...SAVINGS_REPORT,
    build: pointInTimeBuilder(reportService.savingsGlControl, (raw) => buildSavingsGlControlDoc(raw)),
  },
];

/**
 * The reports this user may open: their module is switched on for this
 * deployment, and they hold any extra permission the report's data needs.
 */
export function visibleReports(can: (permission: Permission) => boolean): ReportDefinition[] {
  return REPORT_CATALOG.filter(
    (r) => r.available !== false && (!r.permission || can(r.permission)),
  );
}
