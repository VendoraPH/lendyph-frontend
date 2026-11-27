export interface DashboardOverview {
  total_borrowers: number;
  active_loans: number;
  total_released: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  overdue_count: number;
  due_today_count: number;
}

export interface PortfolioSummary {
  total_portfolio: number;
  performing_loans: number;
  non_performing_loans: number;
  at_risk_amount: number;
}

/**
 * The daily-dues `summary` from GET /dashboard/daily-dues. Every figure is the
 * server's: a period counts as collected only once its principal and interest
 * are paid (penalty never counts), so the rate never passes 100%.
 */
export interface DailyDuesSummary {
  total_due: number;
  total_collected: number;
  collected_in_full: number;
  partially_collected: number;
  uncollected: number;
  collection_rate: number;
  counts: { collected: number; partial: number; pending: number };
}

/** GET /dashboard/daily-dues, read whole: the rows plus the `summary` beside them. */
export interface DailyDuesResponse<Row> {
  data: Row[];
  summary?: DailyDuesSummary;
}
