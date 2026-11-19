/**
 * The executive dashboard's cards, branch table and PAR loans, read from its
 * own endpoints (Phase 6 EB-D1). Pure, and display only: every value, change,
 * period and total is the server's. Nothing here adds, divides or compares
 * figures; it puts them in words.
 */

import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type {
  ExecutiveBranchColumn,
  ExecutiveBranches,
  ExecutiveCard,
  ExecutiveFilterKey,
  ExecutiveOverview,
  ExecutivePeriod,
  ExecutivePreset,
  ExecutiveQuery,
  ParFigure,
  ParLoansPage,
} from "@/types/executive-dashboard";
import { changeTone, compactPeso, type ChangeTone } from "./metrics";

// ── Periods ────────────────────────────────────────────────────────────────

/** `DashboardPeriod::PRESETS`, in its order. The server works out each one's dates in Manila. */
export const EXECUTIVE_PRESETS: { id: ExecutivePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 Days" },
  { id: "last_30_days", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "last_quarter", label: "Last Quarter" },
  { id: "this_year", label: "This Year" },
  { id: "last_year", label: "Last Year" },
  { id: "custom", label: "Custom Date Range" },
];

/** What the user picked: a preset, or a custom range with its two dates. */
export interface PeriodChoice {
  preset: ExecutivePreset;
  from?: string;
  to?: string;
}

/** The query: a preset sends only its name; only a custom range sends dates. */
export function executiveQuery(choice: PeriodChoice, branchId: number | undefined): ExecutiveQuery {
  const query: ExecutiveQuery = { preset: choice.preset };
  if (choice.preset === "custom") {
    if (choice.from) query.date_from = choice.from;
    if (choice.to) query.date_to = choice.to;
  }
  if (branchId !== undefined) query.branch_id = branchId;
  return query;
}

const range = (from: string, to: string) => (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`);

/** "This Month: Nov 1, 2026 – Nov 19, 2026, compared with Oct 1, 2026 – Oct 19, 2026". */
export function periodCaption(period: ExecutivePeriod): string {
  return `${period.label}: ${range(period.from, period.to)}, compared with ${range(period.previous.from, period.previous.to)}`;
}

/** The server's cache time, in Manila. */
export function updatedText(generatedAt: string): string {
  return `Updated ${formatDateTime(generatedAt)}`;
}

// ── Filter notes ───────────────────────────────────────────────────────────

const FILTER_WORDS: Record<ExecutiveFilterKey, string> = {
  product_id: "product",
  officer_id: "loan officer",
  collector_id: "collector",
};

/** The filters sent that a figure didn't follow, in words; null when it followed them all. */
export function ignoredFilterNote(sent: readonly ExecutiveFilterKey[], followed: readonly ExecutiveFilterKey[]): string | null {
  const ignored = sent.filter((key) => !followed.includes(key)).map((key) => FILTER_WORDS[key]);
  if (ignored.length === 0) return null;
  if (ignored.length === 1) return `Covers every ${ignored[0]}: this figure doesn't follow the ${ignored[0]} filter.`;
  const words = `${ignored.slice(0, -1).join(", ")} and ${ignored.at(-1)}`;
  return `Covers every ${words}: this figure doesn't follow those filters.`;
}

// ── Cards ──────────────────────────────────────────────────────────────────

/** What the card says instead of a figure. */
export const CARD_STATE_TEXT = {
  no_snapshot: "No snapshot for this date",
  requires_configuration: "Requires configuration",
  no_access: "Not available",
} as const;

interface CardMeta {
  /** Where the card drills to; `par` opens the PAR loans. */
  href: string | "par";
  /** A balance on a date ("As of"), or a flow over the period ("Through"). */
  kind: "balance" | "flow";
  lowerIsBetter?: boolean;
  /** How it's worked out, for the tooltip, in words. */
  formula: string;
}

/** The screen's own facts about each card; its label, figures and state are the server's. */
export const CARD_META: Record<string, CardMeta> = {
  gross_loan_portfolio: {
    href: "/reports/portfolio_summary",
    kind: "balance",
    formula: "The principal still unpaid on released, ongoing and defaulted loans. Interest, penalty and the insurance premium are not in it.",
  },
  total_outstanding: {
    href: "/reports/portfolio_summary",
    kind: "balance",
    formula: "Everything still owed on released, ongoing and defaulted loans: principal, interest, penalty and the insurance premium owed.",
  },
  active_loans: { href: "/loans", kind: "balance", formula: "Loans released or ongoing. Defaulted loans are counted apart." },
  loans_released: {
    href: "/reports/releases_list",
    kind: "flow",
    formula: "The principal of the loans released in the period, before deductions.",
  },
  collections: {
    href: "/reports/cash_flow",
    kind: "flow",
    formula: "Loan payments received in the period: principal, interest, penalty, build-up and overpayment. The insurance premium is shown on its own card.",
  },
  past_due_amount: {
    href: "/loans/past-due",
    kind: "balance",
    lowerIsBetter: true,
    formula: "Principal, interest and penalty on instalments past their due date and grace: the Past Due Loans page's total.",
  },
  par_30: {
    href: "par",
    kind: "balance",
    lowerIsBetter: true,
    formula: "The unpaid principal of loans more than 30 days past due, as a share of the unpaid principal, from the Portfolio Summary.",
  },
  active_members: { href: "/reports/borrower_report", kind: "flow", formula: "Members with a loan being repaid, from the Member Report." },
  collection_efficiency: {
    href: "/reports/collection_efficiency",
    kind: "flow",
    formula: "Principal and interest collected on the periods due in the range, as a share of what was due.",
  },
  interest_income: {
    href: "/accounting",
    kind: "flow",
    formula: "Interest posted to the interest income account in the period, counted when the money is received (cash basis).",
  },
  net_income: { href: "/accounting", kind: "flow", formula: "Posted income less posted expenses in the period, from the income statement." },
  share_capital: {
    href: "/reports/share_capital",
    kind: "balance",
    formula: "Share capital at the end of the period. Its change is against the opening balance.",
  },
  collected_insurance: {
    href: "/reports/cash_flow",
    kind: "flow",
    formula: "Insurance premium collected with loan payments in the period, held for the insurer.",
  },
  required_allowance: {
    href: "/reports/provisioning",
    kind: "balance",
    lowerIsBetter: true,
    formula: "Each aging bucket's unpaid principal times its provisioning rate, from the Provisioning report.",
  },
};

const FALLBACK_META: CardMeta = { href: "/reports", kind: "balance", formula: "" };

export type CardViewState = "ready" | "no_snapshot" | "requires_configuration";

export interface CardView {
  key: string;
  label: string;
  state: CardViewState;
  /** The full figure, or the state's words. */
  valueText: string;
  /** The tile's figure: abbreviated pesos ("₱1.3M"), or the state's words. */
  compactText: string;
  changeText: string | null;
  changeTone: ChangeTone;
  /** For screen readers, after the change. */
  changeBasis: string;
  previousText: string | null;
  asOfText: string | null;
  filterNote: string | null;
  href: string | "par";
  formula: string;
}

const COUNT = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/** A server figure in its unit: ₱ with two decimals, a whole count, or a percent to two places. */
export function unitText(value: number | null, unit: ExecutiveCard["unit"], compact = false): string {
  if (value === null) return "—";
  if (unit === "money") return compact ? compactPeso(value) : formatCurrency(value);
  if (unit === "count") return COUNT.format(value);
  return `${value.toFixed(2)}%`;
}

/** "+25.0%" or "−1.50 pts"; null when the server sent no change. */
function changeText(change: number | null, unit: ExecutiveCard["change_unit"]): string | null {
  if (change === null) return null;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const size = Math.abs(change);
  return unit === "points" ? `${sign}${size.toFixed(2)} pts` : `${sign}${size.toFixed(1)}%`;
}

function cardView(card: ExecutiveCard, sent: readonly ExecutiveFilterKey[]): CardView {
  const meta = CARD_META[card.key] ?? FALLBACK_META;
  const state = card.state as CardViewState;
  const ready = state === "ready";
  const stateText = ready ? null : CARD_STATE_TEXT[state];
  const previous =
    ready && card.previous_value !== null
      ? `Previous: ${unitText(card.previous_value, card.unit)}${card.previous_as_of ? ` (${formatDate(card.previous_as_of)})` : ""}`
      : null;

  return {
    key: card.key,
    label: card.label,
    state,
    valueText: stateText ?? unitText(card.value, card.unit),
    compactText: stateText ?? unitText(card.value, card.unit, true),
    changeText: ready ? changeText(card.change, card.change_unit) : null,
    changeTone: changeTone(ready ? card.change : null, meta.lowerIsBetter),
    changeBasis: card.key === "share_capital" ? "against the opening balance" : "against the previous period",
    previousText: previous,
    asOfText: card.as_of ? `${meta.kind === "balance" ? "As of" : "Through"} ${formatDate(card.as_of)}` : null,
    filterNote: ignoredFilterNote(sent, card.filters_applied),
    href: meta.href,
    formula: meta.formula,
  };
}

/** The cards to show, in the server's order. A card the caller may not see (`no_access`) is left out. */
export function cardViews(overview: ExecutiveOverview): CardView[] {
  return Object.values(overview.cards)
    .filter((card) => card.state !== "no_access")
    .map((card) => cardView(card, overview.filters_applied));
}

// ── Branch table ───────────────────────────────────────────────────────────

type Format = "money" | "count" | "percent" | "par";

const LENDING_COLUMNS: { key: ExecutiveBranchColumn; header: string; format: Format }[] = [
  { key: "gross_loan_portfolio", header: "Gross Loan Portfolio", format: "money" },
  { key: "total_outstanding", header: "Outstanding", format: "money" },
  { key: "active_loans", header: "Active Loans", format: "count" },
  { key: "past_due_amount", header: "Past Due", format: "money" },
  { key: "par_30", header: "PAR 30", format: "par" },
  { key: "loans_released", header: "Released", format: "money" },
  { key: "collections", header: "Collections", format: "money" },
  { key: "collection_efficiency", header: "Collection Efficiency", format: "percent" },
];

const BOOK_COLUMNS: { key: ExecutiveBranchColumn; header: string; format: Format }[] = [
  { key: "revenue", header: "Revenue", format: "money" },
  { key: "expenses", header: "Expenses", format: "money" },
  { key: "net", header: "Net", format: "money" },
];

function cellText(value: number | ParFigure | null, format: Format): string {
  if (value === null || value === undefined) return "—";
  if (format === "par") return unitText((value as ParFigure).ratio, "percent");
  return unitText(value as number, format);
}

export interface BranchTableColumn {
  key: ExecutiveBranchColumn;
  header: string;
  /** A filter sent that this column ignores, in words. */
  note: string | null;
}

export interface BranchTable {
  columns: BranchTableColumn[];
  rows: { key: string; name: string; cells: Partial<Record<ExecutiveBranchColumn, string>> }[];
  /** The server's totals, never a sum of the rows. */
  totals: Partial<Record<ExecutiveBranchColumn, string>>;
  updated: string;
  balancesNote: string;
  /** Why the books columns are missing, when it isn't the caller's access. */
  booksNote: string | null;
}

/**
 * `GET /dashboard/executive/branches` as a table: the server's rows (a "No
 * branch" row only when it sends one) and totals, each in words, and a note
 * on each column that ignores a filter the user set. The books columns show
 * only while the books are ready for the caller.
 */
export function branchTable(response: ExecutiveBranches, sent: readonly ExecutiveFilterKey[]): BranchTable {
  const books = response.books_state === "ready";
  const columns = [...LENDING_COLUMNS, ...(books ? BOOK_COLUMNS : [])];
  const cells = (row: Omit<ExecutiveBranches["totals"], never>) =>
    Object.fromEntries(columns.map((c) => [c.key, cellText(row[c.key], c.format)]));

  return {
    columns: columns.map((c) => ({
      key: c.key,
      header: c.header,
      note: ignoredFilterNote(sent, response.filters_applied[c.key] ?? []),
    })),
    rows: response.rows.map((row) => ({
      key: row.branch_id === null ? "none" : String(row.branch_id),
      name: row.branch_name?.trim() || (row.branch_id === null ? "No branch" : "Unnamed branch"),
      cells: cells(row),
    })),
    totals: cells(response.totals),
    updated: updatedText(response.generated_at),
    balancesNote: `Balances are as of ${formatDate(response.balances_as_of)}; released, collections and efficiency cover the period.`,
    booksNote: response.books_state === "requires_configuration" ? `Revenue, expenses and net: ${CARD_STATE_TEXT.requires_configuration}.` : null,
  };
}

// ── PAR loans ──────────────────────────────────────────────────────────────

export interface ParLoanRow {
  key: number;
  href: string;
  account: string;
  member: string;
  branch: string;
  product: string;
  oldestDue: string;
  daysPastDue: string;
  principal: string;
  pastDue: string;
  outstanding: string;
}

/** The loans behind PAR, each with its member by name and code only. */
export function parLoanRows(page: ParLoansPage): ParLoanRow[] {
  return page.data.map((loan) => ({
    key: loan.loan_id,
    href: `/loans/${loan.loan_id}`,
    account: loan.account_number ?? "—",
    member: [loan.member.name ?? "—", loan.member.code ? `(${loan.member.code})` : null].filter(Boolean).join(" "),
    branch: loan.branch?.name ?? "—",
    product: loan.product?.name ?? "—",
    oldestDue: loan.oldest_unpaid_due_date ? formatDate(loan.oldest_unpaid_due_date) : "—",
    daysPastDue: COUNT.format(loan.days_past_due),
    principal: formatCurrency(loan.outstanding_principal),
    pastDue: formatCurrency(loan.past_due_amount),
    outstanding: formatCurrency(loan.total_outstanding),
  }));
}
