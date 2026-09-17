/**
 * API Endpoints — synced with Swagger spec at
 * https://api-lendyph.abedubas.dev/api/documentation
 *
 * Last synced: 2026-04-04
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    ME: "/auth/me",
    UPDATE_ME: "/auth/me",
    CHANGE_PASSWORD: "/auth/change-password",
  },
  DATA_IMPORT: {
    RUNS: "/imports",
    RUN: (id: number | string) => `/imports/${id}`,
    CHUNK: (id: number | string, kind: string, index: number) =>
      `/imports/${id}/files/${kind}/chunks/${index}`,
    ASSEMBLE: (id: number | string) => `/imports/${id}/assemble`,
    PRODUCT_MAPPING: (id: number | string) => `/imports/${id}/product-mapping`,
    ERRORS: (id: number | string) => `/imports/${id}/errors`,
    ERRORS_CSV: (id: number | string) => `/imports/${id}/errors.csv`,
  },
  BORROWERS: {
    LIST: "/borrowers",
    DETAIL: (id: number) => `/borrowers/${id}`,
    CREATE: "/borrowers",
    UPDATE: (id: number) => `/borrowers/${id}`,
    DELETE: (id: number) => `/borrowers/${id}`,
    BULK_DELETE: "/borrowers/bulk",
    BULK_DEACTIVATE: "/borrowers/bulk-deactivate",
    DEACTIVATE: (id: number) => `/borrowers/${id}/deactivate`,
    REACTIVATE: (id: number) => `/borrowers/${id}/reactivate`,
    UPLOAD_PHOTO: (id: number) => `/borrowers/${id}/photo`,
    DELETE_PHOTO: (id: number) => `/borrowers/${id}/photo`,
    UPLOAD_VALID_ID: (id: number) => `/borrowers/${id}/valid-ids`,
    LIST_VALID_IDS: (id: number) => `/borrowers/${id}/valid-ids`,
    DELETE_VALID_ID: (id: number, validIdId: number) =>
      `/borrowers/${id}/valid-ids/${validIdId}`,
    LEDGER: (id: number) => `/borrowers/${id}/ledger`,
  },
  REGISTRATIONS: {
    LIST: "/borrowers",
    DETAIL: (id: number) => `/borrowers/${id}`,
    SUBMIT: "/borrowers",
    UPDATE: (id: number) => `/borrowers/${id}`,
    // Registration review has purpose-built endpoints — do NOT point these at
    // the generic borrower routes. `/reactivate` only flips status to active:
    // it skips the `borrowers:approve` gate, the must-be-pending check and the
    // valid-ID KYC gate, and never stamps approved_by/approved_at (which the
    // nightly registrations:prune job relies on). `DELETE /borrowers/{id}`
    // hard-deletes the applicant, their pledge, documents and KYC files.
    APPROVE: (id: number) => `/borrowers/${id}/approve-registration`,
    REJECT: (id: number) => `/borrowers/${id}/reject`,
  },
  CO_MAKERS: {
    LIST: (borrowerId: number) => `/borrowers/${borrowerId}/co-makers`,
    CREATE: (borrowerId: number) => `/borrowers/${borrowerId}/co-makers`,
    DETAIL: (id: number) => `/co-makers/${id}`,
    UPDATE: (id: number) => `/co-makers/${id}`,
    DELETE: (id: number) => `/co-makers/${id}`,
  },
  DOCUMENTS: {
    BORROWER_LIST: (borrowerId: number) => `/borrowers/${borrowerId}/documents`,
    BORROWER_UPLOAD: (borrowerId: number) => `/borrowers/${borrowerId}/documents`,
    CO_MAKER_LIST: (coMakerId: number) => `/co-makers/${coMakerId}/documents`,
    CO_MAKER_UPLOAD: (coMakerId: number) => `/co-makers/${coMakerId}/documents`,
    LOAN_LIST: (loanId: number) => `/loans/${loanId}/documents`,
    LOAN_UPLOAD: (loanId: number) => `/loans/${loanId}/documents`,
    DETAIL: (id: number) => `/documents/${id}`,
    DELETE: (id: number) => `/documents/${id}`,
  },
  LOANS: {
    LIST: "/loans",
    DETAIL: (id: number) => `/loans/${id}`,
    CREATE: "/loans",
    UPDATE: (id: number) => `/loans/${id}`,
    DELETE: (id: number) => `/loans/${id}`,
    APPROVE: (id: number) => `/loans/${id}/approve`,
    REJECT: (id: number) => `/loans/${id}/reject`,
    RELEASE: (id: number) => `/loans/${id}/release`,
    SUBMIT: (id: number) => `/loans/${id}/submit`,
    VOID: (id: number) => `/loans/${id}/void`,
    AMORTIZATION_PREVIEW: (id: number) => `/loans/${id}/amortization-preview`,
    AMORTIZATION_SCHEDULE: (id: number) => `/loans/${id}/amortization-schedule`,
    SUMMARY: (id: number) => `/loans/${id}/summary`,
    EXTEND: (id: number) => `/loans/${id}/extend`,
    TOGGLE_AUTO_PAY: (id: number) => `/loans/${id}/auto-pay`,
    RESTRUCTURE: (id: number) => `/loans/${id}/restructure`,
    LEDGER_ENTRIES: (id: number) => `/loans/${id}/ledger-entries`,
  },
  LOAN_DOCUMENTS: {
    DISCLOSURE: (loanId: number) => `/loans/${loanId}/disclosure`,
    PROMISSORY_NOTE: (loanId: number) => `/loans/${loanId}/promissory-note`,
  },
  /**
   * The multi-step BOD approval chain. The chain used to live in the browser's
   * `localStorage`; these are its server-side replacement, and the only place
   * approval history is read from or written to.
   *
   * `{step}` is the step ROW's `id`. Not `step_id`, which is the chain-config
   * slug ("loan-processor") and repeats on every round and every loan, so it
   * cannot address a row — passing it 404s, which is exactly what this comment
   * used to tell you to do. And not `index`, which is the server's `step_order`
   * and is what `send-back` carries as `target_step_order`. Three different
   * keys, none of them interchangeable.
   */
  LOAN_APPROVAL: {
    STEPS: (loanId: number) => `/loans/${loanId}/approval-steps`,
    APPROVE_STEP: (loanId: number, stepId: number | string) =>
      `/loans/${loanId}/approval-steps/${stepId}/approve`,
    SEND_BACK_STEP: (loanId: number, stepId: number | string) =>
      `/loans/${loanId}/approval-steps/${stepId}/send-back`,
  },
  LOAN_ADJUSTMENTS: {
    LIST: (loanId: number) => `/loans/${loanId}/adjustments`,
    CREATE: (loanId: number) => `/loans/${loanId}/adjustments`,
    DETAIL: (id: number) => `/loan-adjustments/${id}`,
    APPROVE: (id: number) => `/loan-adjustments/${id}/approve`,
    REJECT: (id: number) => `/loan-adjustments/${id}/reject`,
    APPLY: (id: number) => `/loan-adjustments/${id}/apply`,
  },
  REPAYMENTS: {
    LIST: (loanId: number) => `/loans/${loanId}/repayments`,
    LIST_ALL: "/repayments",
    CREATE: (loanId: number) => `/loans/${loanId}/repayments`,
    PREVIEW: (loanId: number) => `/loans/${loanId}/repayments/preview`,
    DETAIL: (id: number) => `/repayments/${id}`,
    VOID: (id: number) => `/repayments/${id}/void`,
  },
  LOAN_PRODUCTS: {
    LIST: "/loan-products",
    CREATE: "/loan-products",
    DETAIL: (id: number) => `/loan-products/${id}`,
    UPDATE: (id: number) => `/loan-products/${id}`,
    DELETE: (id: number) => `/loan-products/${id}`,
  },
  FEES: {
    LIST: "/fees",
    CREATE: "/fees",
    DETAIL: (id: number) => `/fees/${id}`,
    UPDATE: (id: number) => `/fees/${id}`,
    DELETE: (id: number) => `/fees/${id}`,
  },
  COLLATERAL_TYPES: {
    LIST: "/collateral-types",
    CREATE: "/collateral-types",
    DETAIL: (id: number) => `/collateral-types/${id}`,
    UPDATE: (id: number) => `/collateral-types/${id}`,
    DELETE: (id: number) => `/collateral-types/${id}`,
    REORDER: "/collateral-types/reorder",
  },
  COLLATERALS: {
    LIST: "/collaterals",
    CREATE: "/collaterals",
    DETAIL: (id: number) => `/collaterals/${id}`,
    UPDATE: (id: number) => `/collaterals/${id}`,
    DELETE: (id: number) => `/collaterals/${id}`,
    LIST_FOR_LOAN: (loanId: number) => `/loans/${loanId}/collaterals`,
    ATTACH: (loanId: number) => `/loans/${loanId}/collaterals`,
    DETACH: (loanId: number, collateralId: number) =>
      `/loans/${loanId}/collaterals/${collateralId}`,
  },
  REPORTS: {
    DUE_PAST_DUE: "/reports/due-past-due",
    LOAN_BALANCE_SUMMARY: "/reports/loan-balance-summary",
    RELEASES: "/reports/releases",
    REPAYMENTS: "/reports/repayments",
    STATEMENT_OF_ACCOUNT: (loanId: number) => `/reports/statement-of-account/${loanId}`,
    SUBSIDIARY_LEDGER: (borrowerId: number) => `/reports/subsidiary-ledger/${borrowerId}`,
    DAILY_COLLECTION: "/reports/daily-collection",
    INCOME: "/reports/income",
    AGING: "/reports/aging",
    BORROWERS: "/reports/borrowers",
    DISBURSEMENTS: "/reports/disbursements",
    CASH_FLOW: "/reports/cash-flow",
    COLLECTION_EFFICIENCY: "/reports/collection-efficiency",
    PORTFOLIO_BY_PRODUCT: "/reports/portfolio-by-product",
    SHARE_CAPITAL: "/reports/share-capital",
    PERFORMANCE: "/reports/performance",
    PROVISIONING: "/reports/provisioning",
    // Running-balance statement for one member. Separate from SHARE_CAPITAL
    // (the org-wide summary) and from SHARE_CAPITAL.LEDGER_LIST, whose
    // paginator caps at 100 rows and carries no opening/closing balance.
    SHARE_CAPITAL_STATEMENT: (borrowerId: number) =>
      `/reports/share-capital-statement/${borrowerId}`,
    EXPORT_RELEASES: "/reports/releases/export",
    EXPORT_REPAYMENTS: "/reports/repayments/export",
    EXPORT_DUE_PAST_DUE: "/reports/due-past-due/export",
  },
  DASHBOARD: {
    STATS: "/dashboard/stats",
    COLLECTIONS_TREND: "/dashboard/collections-trend",
    DAILY_DUES: "/dashboard/daily-dues",
    RECENT_TRANSACTIONS: "/dashboard/recent-transactions",
  },
  USERS: {
    LIST: "/users",
    DETAIL: (id: number) => `/users/${id}`,
    CREATE: "/users",
    UPDATE: (id: number) => `/users/${id}`,
    DEACTIVATE: (id: number) => `/users/${id}/deactivate`,
    REACTIVATE: (id: number) => `/users/${id}/reactivate`,
    RESET_PASSWORD: (id: number) => `/users/${id}/reset-password`,
  },
  AUDIT_LOGS: {
    LIST: "/audit-logs",
    DETAIL: (id: number) => `/audit-logs/${id}`,
    EXPORT: "/audit-logs/export",
  },
  ROLES: {
    LIST: "/roles",
    DETAIL: (id: number) => `/roles/${id}`,
    CREATE: "/roles",
    UPDATE: (id: number) => `/roles/${id}`,
    DELETE: (id: number) => `/roles/${id}`,
    DEACTIVATE: (id: number) => `/roles/${id}/deactivate`,
    REACTIVATE: (id: number) => `/roles/${id}/reactivate`,
  },
  BRANCHES: {
    LIST: "/branches",
    PUBLIC_LIST: "/branches/public",
    DETAIL: (id: number) => `/branches/${id}`,
    CREATE: "/branches",
    UPDATE: (id: number) => `/branches/${id}`,
  },
  SHARE_CAPITAL: {
    LEDGER_LIST: "/share-capital/ledger",
    LEDGER_CREATE: "/share-capital/ledger",
  },
  PLEDGES: {
    LIST: "/pledges",
    UPDATE: (id: number) => `/pledges/${id}`,
    TOGGLE_AUTO_CREDIT: (id: number) => `/pledges/${id}/auto-credit`,
    CREATE_ENTRY: (id: number) => `/pledges/${id}/entries`,
    BULK_ENTRIES: "/pledges/bulk-entries",
  },
  AUTO_CREDIT: {
    STATUS: "/auto-credit/status",
    PROCESS: "/auto-credit/process",
  },
  AUTO_PAY: {
    PREVIEW: "/auto-pay/preview",
    PROCESS: "/auto-pay/process",
  },
  GCASH: {
    TRANSACTIONS_LIST: "/gcash/transactions",
    TRANSACTIONS_CREATE: "/gcash/transactions",
    TRANSACTIONS_MARK_PAID: (id: number) => `/gcash/transactions/${id}/paid`,
    NON_MEMBERS_LIST: "/gcash/non-members",
    NON_MEMBERS_CREATE: "/gcash/non-members",
    NON_MEMBERS_UPDATE: (id: number) => `/gcash/non-members/${id}`,
    NON_MEMBERS_DELETE: (id: number) => `/gcash/non-members/${id}`,
    TIERS_LIST: "/gcash/tiers",
    TIERS_UPSERT: "/gcash/tiers",
    REPORTS_INCOME: "/gcash/reports/income",
    REPORTS_PENDING: "/gcash/reports/pending",
  },
  SETTINGS: {
    APPROVAL_WORKFLOW: "/settings/approval-workflow",
    BRANDING: "/settings/branding",
    BRANDING_LOGO: "/settings/branding/logo",
  },
  BRANDING: {
    // Unauthenticated read that resolves the org logo for the public
    // register/login pages and the app shell. Mirrors BRANCHES.PUBLIC_LIST.
    PUBLIC: "/branding/public",
  },
  /**
   * Accounting — NOT YET IN SWAGGER.
   *
   * Every path below is a proposal, written here so the service layer has one
   * place to be wrong rather than thirteen. None of them answer today; the
   * handoff covering payloads and responses went to the backend team. Re-check
   * against the spec before trusting any of these.
   *
   * The three that matter most, because they cannot be done from the client at
   * all: POST /accounting/journals/{id}/post, /reverse, and the automatic
   * postings raised by loan release and collection. A journal has to be written
   * in the same database transaction as the lending event that caused it — do
   * it in a second request and a crash between the two leaves the books
   * disagreeing with the portfolio, with nothing to point at the difference.
   */
  ACCOUNTING: {
    // Dashboard
    DASHBOARD: "/accounting/dashboard",

    // Chart of accounts
    ACCOUNTS_LIST: "/accounting/accounts",
    ACCOUNTS_DETAIL: (id: number) => `/accounting/accounts/${id}`,
    ACCOUNTS_CREATE: "/accounting/accounts",
    ACCOUNTS_UPDATE: (id: number) => `/accounting/accounts/${id}`,
    ACCOUNTS_DELETE: (id: number) => `/accounting/accounts/${id}`,
    ACCOUNTS_SEED: "/accounting/accounts/seed",

    // Journals. Posting and reversing are separate verbs, not a PUT on the
    // entry — a posted journal is immutable, and `reverse` writes a second
    // entry rather than editing the first.
    JOURNALS_LIST: "/accounting/journals",
    JOURNALS_DETAIL: (id: number) => `/accounting/journals/${id}`,
    JOURNALS_CREATE: "/accounting/journals",
    JOURNALS_UPDATE: (id: number) => `/accounting/journals/${id}`,
    JOURNALS_POST: (id: number) => `/accounting/journals/${id}/post`,
    JOURNALS_REVERSE: (id: number) => `/accounting/journals/${id}/reverse`,

    // Reporting
    GENERAL_LEDGER: "/accounting/general-ledger",
    TRIAL_BALANCE: "/accounting/trial-balance",
    BALANCE_SHEET: "/accounting/statements/balance-sheet",
    INCOME_STATEMENT: "/accounting/statements/income-statement",
    CASH_FLOW: "/accounting/statements/cash-flow",
    EQUITY_CHANGES: "/accounting/statements/equity-changes",
    RECEIVABLE_AGING: "/accounting/loans/aging",

    // BIR books. One path per book, keyed by `BookKind`, so the books screen
    // can pick by tab without a switch statement per call site.
    BOOKS: {
      general_journal: "/accounting/books/general-journal",
      general_ledger: "/accounting/books/general-ledger",
      cash_receipts: "/accounting/books/cash-receipts",
      cash_disbursements: "/accounting/books/cash-disbursements",
    },

    // Cash and bank
    CASH_ACCOUNTS_LIST: "/accounting/cash-accounts",
    CASH_TRANSFER: "/accounting/cash-accounts/transfer",

    // Expenses and payables
    EXPENSES_LIST: "/accounting/expenses",
    EXPENSES_DETAIL: (id: number) => `/accounting/expenses/${id}`,
    EXPENSES_CREATE: "/accounting/expenses",
    EXPENSES_UPDATE: (id: number) => `/accounting/expenses/${id}`,
    EXPENSES_PAY: (id: number) => `/accounting/expenses/${id}/pay`,

    // Reconciliation
    RECONCILIATIONS_LIST: "/accounting/reconciliations",
    RECONCILIATIONS_CREATE: "/accounting/reconciliations",
    RECONCILIATIONS_DETAIL: (id: number) => `/accounting/reconciliations/${id}`,
    RECONCILIATIONS_MATCH: (id: number) => `/accounting/reconciliations/${id}/match`,

    // Periods
    PERIODS_LIST: "/accounting/periods",
    PERIODS_CLOSE: (id: number) => `/accounting/periods/${id}/close`,
    PERIODS_REOPEN: (id: number) => `/accounting/periods/${id}/reopen`,

    // Settings and opening balances
    SETTINGS: "/accounting/settings",
    ACCOUNT_MAPPING: "/accounting/settings/account-mapping",
    OPENING_BALANCES: "/accounting/opening-balances",
  },
  SYSTEM: {
    HEALTH: "/health",
  },
} as const;
