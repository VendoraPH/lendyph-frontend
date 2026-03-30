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
