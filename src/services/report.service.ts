import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const reportService = {
  duePastDue: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DUE_PAST_DUE, { params }),

  loanBalanceSummary: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.LOAN_BALANCE_SUMMARY, { params }),

  releases: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.RELEASES, { params }),

  repayments: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.REPAYMENTS, { params }),

  statementOfAccount: (loanId: number) =>
    api.get(API_ENDPOINTS.REPORTS.STATEMENT_OF_ACCOUNT(loanId)),

  subsidiaryLedger: (borrowerId: number) =>
    api.get(API_ENDPOINTS.REPORTS.SUBSIDIARY_LEDGER(borrowerId)),
};
