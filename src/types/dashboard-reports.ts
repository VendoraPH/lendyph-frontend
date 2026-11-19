/**
 * The report payloads the executive dashboard reads, as `ReportService` sends
 * them (`api.get` has already unwrapped `{ success, data }`).
 *
 * Laravel's `decimal:2` casts arrive as strings and sums as numbers, so every
 * figure is `Num`; read them through `toNumber` in the dashboard's `_lib`.
 * Every field is optional: a field the server leaves out must read as "Data
 * Unavailable", never as a zero.
 */

export type Num = number | string | null | undefined;

/**
 * GET /reports/loan-balance-summary — balances are always as of today.
 * `total_outstanding` (everything owed) and `outstanding_principal` are the
 * loan pages' figures on the collectible loans; `outstanding.balance` and
 * `by_branch[].outstanding_balance` are deprecated aliases the screens never read.
 */
export interface LoanBalanceSummaryReport {
  portfolio?: { loan_count?: Num; active_loan_count?: Num; total_released?: Num };
  active_loans?: Num;
  total_outstanding?: Num;
  outstanding_principal?: Num;
  outstanding?: { principal?: Num; interest?: Num; penalty?: Num; insurance?: Num; balance?: Num; total?: Num };
  /** From the bare due date (grace not applied); `total` is the server's sum of the three. */
  overdue?: { principal?: Num; interest?: Num; penalty?: Num; loan_count?: Num; total?: Num };
  at_risk_amount?: Num;
  /** Percent, e.g. 4.25 for 4.25%. */
  par_ratio?: Num;
  par_threshold_days?: Num;
  by_branch?: {
    branch_id?: number | null;
    branch_name?: string | null;
    loan_count?: Num;
    total_released?: Num;
    total_outstanding?: Num;
    outstanding_principal?: Num;
    outstanding_balance?: Num;
  }[];
}

export interface AgingBucket {
  amount?: Num;
  count?: Num;
}

/** GET /reports/aging — measured from the due date, grace ignored, penalty included. `count` is loans. */
export interface AgingReport {
  as_of_date?: string;
  buckets?: Partial<Record<"1_30" | "31_60" | "61_90" | "over_90", AgingBucket>>;
  total?: AgingBucket | Num;
}

/** GET /reports/cash-flow over a date range. */
export interface CashFlowReport {
  inflows?: {
    /** `total` includes the insurance premium collected (`insurance`). */
    repayments?: { principal?: Num; interest?: Num; penalty?: Num; insurance?: Num; overpayment?: Num; total?: Num; count?: Num };
    share_capital_credit?: Num;
  };
  outflows?: { releases?: { net_proceeds?: Num; count?: Num } };
  non_cash?: { principal_released?: Num; total_deductions?: Num };
  net_movement?: Num;
}

export interface CollectionFigures {
  total_due?: Num;
  total_collected?: Num;
  /** Percent. */
  collection_rate?: Num;
  uncollected?: Num;
}

/** GET /reports/collection-efficiency over a date range. */
export interface CollectionEfficiencyReport extends CollectionFigures {
  by_branch?: (CollectionFigures & { branch_id?: number | null; branch_name?: string | null })[];
  by_period?: (CollectionFigures & { period?: string })[];
}

export interface ProductPortfolioRow {
  product_id?: number | null;
  product_name?: string | null;
  loan_count?: Num;
  total_released?: Num;
  /** Everything owed on the collectible loans. */
  total_outstanding?: Num;
  /** Deprecated alias (principal plus premium): never read. */
  outstanding?: Num;
  outstanding_principal?: Num;
  avg_interest_rate?: Num;
  overdue_amount?: Num;
  at_risk_amount?: Num;
  par_ratio?: Num;
  /** Share of the released amount, not of the outstanding book. */
  portfolio_share?: Num;
  /** Share of every product's unpaid principal, whole percent; null when nothing is owed. */
  outstanding_share?: Num;
}

/** The products past the server's named ones, as one row (EB-A). */
export interface OtherProductsShare {
  product_count?: Num;
  product_ids?: number[];
  loan_count?: Num;
  outstanding_principal?: Num;
  total_outstanding?: Num;
  outstanding_share?: Num;
}

/** GET /reports/portfolio-by-product. */
export interface PortfolioByProductReport {
  products?: ProductPortfolioRow[];
  /** The products a share chart names, largest first; the rest are `other`. */
  named_product_ids?: number[];
  other?: OtherProductsShare | null;
  totals?: Omit<ProductPortfolioRow, "product_id" | "product_name">;
}

export interface PerformanceRow {
  officer_id?: number | null;
  officer_name?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  loan_count?: Num;
  released_count?: Num;
  released_amount?: Num;
  collected?: Num;
  payment_count?: Num;
  /** Everything owed on the collectible loans. */
  total_outstanding?: Num;
  /** Deprecated alias (principal plus premium): never read. */
  outstanding?: Num;
  outstanding_principal?: Num;
  overdue_amount?: Num;
  at_risk_amount?: Num;
  par_ratio?: Num;
  active_borrowers?: Num;
}

/** GET /reports/performance — releases and collections over the range, balances as of today. */
export interface PerformanceReport {
  by_officer?: PerformanceRow[];
  by_branch?: PerformanceRow[];
}

/** GET /reports/provisioning. */
export interface ProvisioningReport {
  totals?: { required_allowance?: Num; outstanding?: Num };
}

/** GET /reports/share-capital over a date range. */
export interface ShareCapitalReport {
  opening_balance?: Num;
  credits?: Num;
  debits?: Num;
  net_movement?: Num;
  closing_balance?: Num;
  member_count?: Num;
}

/** GET /reports/income — cash basis: what was collected, not what was recognized. */
export interface IncomeReport {
  interest_income?: Num;
  processing_fees?: Num;
  service_fee?: Num;
  other_fees?: Num;
  penalty_income?: Num;
  total?: Num;
}

/** GET /reports/borrowers over a date range. */
export interface BorrowersReport {
  total_active_borrowers?: Num;
  new_borrowers?: Num;
  avg_loan_size?: Num;
  repeat_borrowers?: Num;
}

/** GET /reports/disbursements over a date range. */
export interface DisbursementsReport {
  loans_released?: Num;
  total_disbursed?: Num;
  avg_disbursement?: Num;
  pending_release?: Num;
}

/**
 * `totals` of GET /reports/due-past-due?past_due_only=1: the Past Due Loans
 * page's money cards, past the grace period, each loan counted once.
 */
export interface PastDueTotals {
  past_due_amount?: Num;
  total_outstanding?: Num;
}
