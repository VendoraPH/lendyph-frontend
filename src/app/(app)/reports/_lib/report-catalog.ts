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
import {
  LIST_PAGE_SIZE,
  buildAgingDoc,
  buildBorrowerDoc,
  buildDailyCollectionDoc,
  buildDisbursementDoc,
  buildDuePastDueListDoc,
  buildIncomeDoc,
  buildPortfolioSummaryDoc,
  buildReleasesListDoc,
  buildRepaymentsListDoc,
} from "./report-builders";
import type { DateRange, ReportDefinition, ReportDocument } from "./types";

/**
 * Fetch wiring + the catalog itself. Every payload→document mapping lives in
 * `report-builders.ts` so it stays unit-testable against the API contract.
 */

type Fetcher = (params: Record<string, unknown>) => Promise<unknown>;
type Mapper = (raw: unknown, range: DateRange) => ReportDocument;

/**
 * A failed request must still render the report shell — the builders turn a
 * null payload into "—" placeholders rather than an error screen.
 */
function reportBuilder(fetcher: Fetcher, map: Mapper, extraParams: Record<string, unknown> = {}) {
  return async (range: DateRange): Promise<ReportDocument> => {
    const raw = await fetcher({
      date_from: range.from,
      date_to: range.to,
      ...extraParams,
    }).catch(() => null);
    return map(raw, range);
  };
}

const listParams = { per_page: LIST_PAGE_SIZE };

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
    build: reportBuilder(reportService.dailyCollection, buildDailyCollectionDoc),
  },
  {
    id: "repayments_list",
    title: "Repayments List",
    description: "Every repayment recorded in the period.",
    category: "operations",
    icon: Receipt,
    accent: ACCENT.emerald,
    build: reportBuilder(reportService.repayments, buildRepaymentsListDoc, listParams),
  },
  {
    id: "portfolio_summary",
    title: "Portfolio Summary",
    description: "Active loans, outstanding balance, portfolio at risk.",
    category: "portfolio",
    icon: PieChart,
    accent: ACCENT.blue,
    build: reportBuilder(reportService.loanBalanceSummary, buildPortfolioSummaryDoc),
  },
  {
    id: "income_report",
    title: "Income Report",
    description: "Interest, processing fees, and penalty income.",
    category: "portfolio",
    icon: TrendingUp,
    accent: ACCENT.green,
    build: reportBuilder(reportService.income, buildIncomeDoc),
  },
  {
    id: "aging_report",
    title: "Aging Report",
    description: "Overdue balances by 1–30, 31–60, 61–90, and 90+ buckets.",
    category: "portfolio",
    icon: Clock,
    accent: ACCENT.red,
    build: reportBuilder(reportService.aging, buildAgingDoc),
  },
  {
    id: "due_past_due_list",
    title: "Due / Past Due List",
    description: "Schedules due or overdue as of the selected period.",
    category: "portfolio",
    icon: AlertTriangle,
    accent: ACCENT.amber,
    build: reportBuilder(reportService.duePastDue, buildDuePastDueListDoc, listParams),
  },
  {
    id: "borrower_report",
    title: "Borrower Report",
    description: "Active, new, and repeat borrower counts.",
    category: "member",
    icon: Users,
    accent: ACCENT.purple,
    build: reportBuilder(reportService.borrowers, buildBorrowerDoc),
  },
  {
    id: "disbursement_report",
    title: "Disbursement Summary",
    description: "Totals for releases during the period.",
    category: "disbursement",
    icon: Banknote,
    accent: ACCENT.cyan,
    build: reportBuilder(reportService.disbursements, buildDisbursementDoc),
  },
  {
    id: "releases_list",
    title: "Releases List",
    description: "Every loan released in the period with key terms.",
    category: "disbursement",
    icon: ListChecks,
    accent: ACCENT.indigo,
    build: reportBuilder(reportService.releases, buildReleasesListDoc, listParams),
  },
];
