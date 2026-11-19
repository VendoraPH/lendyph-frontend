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
  /** Why `previous_value` is missing, when the server says (a backend follow-up adds it). */
  previous_state?: ExecutiveCardState | null;
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
  product_id?: number;
  officer_id?: number;
  collector_id?: number;
}

/** The page filters a figure may follow, by id; absent means every one. */
export type ExecutiveFilters = Partial<Record<ExecutiveFilterKey, number>>;

/** EB-D2's responses name the filters each figure followed, by filter. */
export interface FiltersAppliedTo {
  /** The filters sent that every figure followed. */
  filters_applied: ExecutiveFilterKey[];
  /** For a filter only some figures follow: which ones. */
  filters_applied_to: Partial<Record<ExecutiveFilterKey, string[]>>;
}

// ── EB-D2 ──────────────────────────────────────────────────────────────────

export type AttentionState =
  | "needs_attention"
  | "clear"
  | "no_access"
  | "no_data"
  | "no_snapshot"
  | "requires_configuration";

/** One rule of `GET /dashboard/executive/attention`, in the server's words. */
export interface AttentionRule {
  key: string;
  label: string;
  /** The rule in words, from the dashboard settings. */
  rule: string | null;
  threshold: number | null;
  link: string;
  state: AttentionState;
  value: number | string | null;
  title: string;
  detail: string;
  /** The day the rule's figures are read on. */
  as_of?: string | null;
}

export interface ExecutiveAttention extends FiltersAppliedTo {
  period: ExecutivePeriod;
  as_of: string;
  thresholds: Record<string, number>;
  rules: AttentionRule[];
  alerts: AttentionRule[];
}

/** One month of `GET /dashboard/executive/trends`: Cash Flow's and the Member Report's own figures. */
export interface TrendMonth {
  month: string;
  from: string;
  to: string;
  principal_released: number;
  principal_collected: number;
  cash_in: number;
  cash_out: number;
  net_cash: number;
  new_members: number;
}

export interface ExecutiveTrends extends FiltersAppliedTo {
  period: ExecutivePeriod;
  months: TrendMonth[];
}

/** One stretch of `GET /dashboard/executive/turnaround`. */
export interface TurnaroundStretch {
  loans: number;
  average_days: number | null;
  median_days: number | null;
  /** Loans that ended the stretch in the period but have no start to measure from. */
  not_measured: number;
}

export interface ExecutiveTurnaround extends FiltersAppliedTo {
  period: ExecutivePeriod;
  submitted_to_approved: TurnaroundStretch;
  approved_to_released: TurnaroundStretch;
  submitted_to_released: TurnaroundStretch;
}

/** One branch of `GET /dashboard/executive/share-capital-control`. Centavos. */
export interface ShareCapitalControlRow {
  branch_id: number | null;
  branch_name: string;
  subledger: number;
  books: number | null;
  difference: number | null;
  is_reconciled: boolean | null;
}

export interface ShareCapitalControl {
  as_of: string;
  books_state: { state: string; label: string; reason: string | null };
  account: { id: number; code: string; name: string } | null;
  rows: ShareCapitalControlRow[];
  totals: Omit<ShareCapitalControlRow, "branch_id" | "branch_name">;
  is_reconciled: boolean | null;
}
