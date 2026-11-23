/**
 * The ten AMLA reports' titles by the server's report key, as lendyph-backend
 * names them (`ComplianceReport::title()`, Phase 6 AMLA-B7). The Reports
 * page's AMLA section and the breadcrumb of `/amla/reports/<key>` both read
 * them from here. Titles only, so the header can import them.
 */
export const AMLA_REPORT_TITLES = {
  covered_transactions: "Covered Transactions",
  suspicious_transactions: "Suspicious Transactions",
  transaction_monitoring: "Transaction Monitoring",
  risk_assessment: "Customer AML Risk Assessment",
  customer_due_diligence: "Customer Due Diligence",
  watchlist_screening: "Watchlist and Sanctions Screening",
  case_register: "Compliance Case Register",
  submissions_register: "Regulatory Submissions Register",
  audit_history: "Compliance Audit and History",
  management_summary: "AMLA Management Summary",
} as const;

export type AmlaReportKey = keyof typeof AMLA_REPORT_TITLES;
