import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const reportService = {
  // The three list endpoints return a Laravel paginator envelope
  // ({ data, meta, totals }) rather than the { success, data } wrapper, so they
  // use getRaw — unwrapping to `data` would throw away the server-side totals
  // and row count the reports need to avoid summing a single page.
  duePastDue: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.DUE_PAST_DUE, { params }),

  loanBalanceSummary: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.LOAN_BALANCE_SUMMARY, { params }),

  releases: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.RELEASES, { params }),

  repayments: (params?: Record<string, unknown>) =>
    api.getRaw(API_ENDPOINTS.REPORTS.REPAYMENTS, { params }),

  statementOfAccount: (loanId: number) =>
    api.get(API_ENDPOINTS.REPORTS.STATEMENT_OF_ACCOUNT(loanId)),

  // Accepts date_from/date_to to window the payment history.
  subsidiaryLedger: (borrowerId: number, params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SUBSIDIARY_LEDGER(borrowerId), { params }),

  dailyCollection: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DAILY_COLLECTION, { params }),

  income: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.INCOME, { params }),

  aging: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.AGING, { params }),

  borrowers: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.BORROWERS, { params }),

  disbursements: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DISBURSEMENTS, { params }),

  // The six financial/performance reports below are `{ success, data }`-wrapped
  // summaries rather than paginators — there is no envelope worth preserving,
  // so they use `api.get` and the builders receive the summary object directly.
  cashFlow: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.CASH_FLOW, { params }),

  collectionEfficiency: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.COLLECTION_EFFICIENCY, { params }),

  portfolioByProduct: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PORTFOLIO_BY_PRODUCT, { params }),

  // Accepts branch_id: the ledger has no branch column, so the API resolves
  // the filter through the member's branch and echoes back `branch_scope`.
  shareCapital: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SHARE_CAPITAL, { params }),

  performance: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PERFORMANCE, { params }),

  provisioning: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PROVISIONING, { params }),

  // One member's share capital statement: opening balance, entries with a
  // running balance, period credits/debits, closing balance. Accepts
  // date_from/date_to to window the entries.
  shareCapitalStatement: (borrowerId: number, params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.SHARE_CAPITAL_STATEMENT(borrowerId), { params }),

  exportReleases: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_RELEASES, { params }),

  exportRepayments: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_REPAYMENTS, { params }),

  exportDuePastDue: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_DUE_PAST_DUE, { params }),
};
