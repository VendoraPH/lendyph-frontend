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

  exportReleases: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_RELEASES, { params }),

  exportRepayments: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_REPAYMENTS, { params }),

  exportDuePastDue: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.REPORTS.EXPORT_DUE_PAST_DUE, { params }),
};
