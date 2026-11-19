/**
 * The executive dashboard's own endpoints (Phase 6 EB-D1), under
 * `/dashboard/executive`. Every figure is the server's: the browser formats
 * them and never works one out.
 */

/** `DashboardPeriod::PRESETS` keys. */
export type ExecutivePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

/** The filters the dashboard sends, as `filters_applied` names them. */
export type ExecutiveFilterKey = "product_id" | "officer_id" | "collector_id";

/** `DashboardPeriod::toArray()`: the range in Manila, and the one it is compared with. */
export interface ExecutivePeriod {
  preset: ExecutivePreset;
  label: string;
  from: string;
  to: string;
  days: number;
  previous: { from: string; to: string; days: number };
  as_of: string;
}

export type ExecutiveCardState = "ready" | "no_snapshot" | "requires_configuration" | "no_access";

/** One card of `GET /dashboard/executive/overview`. */
export interface ExecutiveCard {
  key: string;
  label: string;
  unit: "money" | "percent" | "count";
  value: number | null;
  previous_value: number | null;
  /** A percentage, or points for a ratio (`change_unit`); null when it can't be worked out. */
  change: number | null;
  change_unit: "percent" | "points";
  as_of: string | null;
  previous_as_of: string | null;
  state: ExecutiveCardState;
  /** The filters sent that this card followed. */
  filters_applied: ExecutiveFilterKey[];
  details: Record<string, unknown>;
}

export interface ExecutiveOverview {
  period: ExecutivePeriod;
  /** Server time (Manila, no zone): the figures are cached for a few minutes. */
  generated_at: string;
  /** The filters sent, of those a card may follow. */
  filters_applied: ExecutiveFilterKey[];
  cards: Record<string, ExecutiveCard>;
}

/** PAR as `PortfolioRisk` sends it: pesos, whole percent, loans. */
export interface ParFigure {
  amount: number;
  ratio: number;
  loans: number;
}

/** One row of `GET /dashboard/executive/branches`; `branch_id` null is the "No branch" row. */
export interface ExecutiveBranchRow {
  branch_id: number | null;
  branch_name: string | null;
  gross_loan_portfolio: number | null;
  total_outstanding: number | null;
  active_loans: number | null;
  past_due_amount: number | null;
  past_due_loans: number | null;
  par_30: ParFigure | null;
  loans_released: number | null;
  collections: number | null;
  collected_insurance: number | null;
  collection_efficiency: number | null;
  revenue: number | null;
  expenses: number | null;
  net: number | null;
}

export type ExecutiveBranchColumn = Exclude<keyof ExecutiveBranchRow, "branch_id" | "branch_name">;

export interface ExecutiveBranches {
  period: ExecutivePeriod;
  /** Per column: the filters sent that it followed. */
  filters_applied: Partial<Record<ExecutiveBranchColumn | "past_due_loans", ExecutiveFilterKey[]>>;
  generated_at: string;
  /** Balances are as of this day; period figures cover the period. */
  balances_as_of: string;
  books_state: "ready" | "requires_configuration" | "no_access";
  rows: ExecutiveBranchRow[];
  totals: Omit<ExecutiveBranchRow, "branch_id" | "branch_name">;
}

/** One loan of `GET /dashboard/executive/par-loans`: the member by id, name and code only. */
export interface ParLoan {
  loan_id: number;
  account_number: string | null;
  member: { id: number; name: string | null; code: string | null };
  branch: { id: number; name: string } | null;
  product: { id: number; name: string } | null;
  display_status: string | null;
  oldest_unpaid_due_date: string | null;
  days_past_due: number;
  outstanding_principal: number;
  past_due_amount: number;
  total_outstanding: number;
}

export type ParLevel = "1" | "30" | "60" | "90";

export interface ParLoansPage {
  data: ParLoan[];
  meta: {
    par: string;
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    totals: { loans: number; outstanding_principal: number };
    filters_applied: ExecutiveFilterKey[];
  };
}

/** What the dashboard asks for: a preset, or a custom range, plus the filters. */
export interface ExecutiveQuery {
  preset: ExecutivePreset;
  date_from?: string;
  date_to?: string;
  branch_id?: number;
}
