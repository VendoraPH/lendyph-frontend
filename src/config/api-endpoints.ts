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
    LOAN_SUMMARY: (id: number) => `/borrowers/${id}/loan-summary`,
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
    // Same contract as the BORROWERS valid-ID routes; only the parent differs.
    UPLOAD_VALID_ID: (id: number) => `/co-makers/${id}/valid-ids`,
    LIST_VALID_IDS: (id: number) => `/co-makers/${id}/valid-ids`,
    DELETE_VALID_ID: (id: number, validIdId: number) =>
      `/co-makers/${id}/valid-ids/${validIdId}`,
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
    PREVIEW: "/loans/preview",
    AMORTIZATION_CALCULATOR: "/loans/amortization-calculator",
    UPDATE: (id: number) => `/loans/${id}`,
    DELETE: (id: number) => `/loans/${id}`,
    RELEASE: (id: number) => `/loans/${id}/release`,
    RELEASE_PREVIEW: (id: number) => `/loans/${id}/release-preview`,
    /** An approved, unreleased restructure back into review (`loans:release`). */
    SEND_BACK_APPROVED: (id: number) => `/loans/${id}/send-back-approved`,
    DEDUCTIONS_PREVIEW: (id: number) => `/loans/${id}/deductions-preview`,
    SUBMIT: (id: number) => `/loans/${id}/submit`,
    VOID: (id: number) => `/loans/${id}/void`,
    AMORTIZATION_PREVIEW: (id: number) => `/loans/${id}/amortization-preview`,
    AMORTIZATION_SCHEDULE: (id: number) => `/loans/${id}/amortization-schedule`,
    AMORTIZATION_BALANCES: (id: number) => `/loans/${id}/amortization-balances`,
    SUMMARY: (id: number) => `/loans/${id}/summary`,
    EXTEND: (id: number) => `/loans/${id}/extend`,
    EXTENSION_PREVIEW: (id: number) => `/loans/${id}/extension-preview`,
    TOGGLE_AUTO_PAY: (id: number) => `/loans/${id}/auto-pay`,
    ACCOUNT_OFFICER: (id: number) => `/loans/${id}/account-officer`,
    CO_MAKERS: (id: number) => `/loans/${id}/co-makers`,
    RESTRUCTURE: (id: number) => `/loans/${id}/restructure`,
    LEDGER_ENTRIES: (id: number) => `/loans/${id}/ledger-entries`,
    LEDGER: (id: number) => `/loans/${id}/ledger`,
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
    BALANCE_PREVIEW: (loanId: number) => `/loans/${loanId}/balance-adjustment-preview`,
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
    REGISTER: "/collaterals/register",
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
    INCOME_BY_LOAN: "/reports/income/by-loan",
    AGING: "/reports/aging",
    BORROWERS: "/reports/borrowers",
    BORROWERS_RELEASED: "/reports/borrowers/released",
    DISBURSEMENTS: "/reports/disbursements",
    CASH_FLOW: "/reports/cash-flow",
    COLLECTION_EFFICIENCY: "/reports/collection-efficiency",
    PORTFOLIO_BY_PRODUCT: "/reports/portfolio-by-product",
    SHARE_CAPITAL: "/reports/share-capital",
    PERFORMANCE: "/reports/performance",
    PROVISIONING: "/reports/provisioning",
    // Savings & Deposits (savings design §2). reports:view plus savings:view;
    // CSV needs reports:export. Totals cover the whole filter.
    SAVINGS_BALANCES: "/reports/savings/balances",
    SAVINGS_TRANSACTIONS: "/reports/savings/transactions",
    TIME_DEPOSIT_MATURITIES: "/reports/savings/time-deposit-maturities",
    SAVINGS_INTEREST_POSTINGS: "/reports/savings/interest-postings",
    SAVINGS_DORMANT: "/reports/savings/dormant",
    SAVINGS_STATEMENT: (accountId: number) => `/reports/savings/statement/${accountId}`,
    SAVINGS_GL_CONTROL: "/reports/savings/gl-control",
    SAVINGS_EXPORT: (report: string) => `/reports/savings/${report}/export`,
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
  STAFF: {
    LIST: "/staff",
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
    MEMBERS: "/share-capital/members",
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
    TRANSACTIONS_PREVIEW: "/gcash/transactions/preview",
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
   * Accounting. The backend serves every path here under `/accounting`; its
   * `routes/api.php` (and its `routes/accounting/*.php` partials) is the source
   * of truth. Paths are listed alongside the service method that needs them;
   * the reconciliation create, show and match routes are listed ahead of the
   * screen that will call them.
   *
   * Posting and reversing are verbs on the server (POST
   * /accounting/journals/{id}/post and /reverse), and the automatic postings
   * for loan release and collection happen there too, never from the client.
   * A journal has to be written in the same database transaction as the
   * lending event that caused it — do it in a second request and a crash
   * between the two leaves the books disagreeing with the portfolio, with
   * nothing to point at the difference.
   */
  ACCOUNTING: {
    // Dashboard
    DASHBOARD: "/accounting/dashboard",

    // Chart of accounts
    ACCOUNTS_LIST: "/accounting/accounts",
    ACCOUNTS_CREATE: "/accounting/accounts",
    ACCOUNTS_SEED: "/accounting/accounts/seed",
    ACCOUNTS_SHOW: (id: number) => `/accounting/accounts/${id}`,
    ACCOUNTS_UPDATE: (id: number) => `/accounting/accounts/${id}`,
    ACCOUNTS_DELETE: (id: number) => `/accounting/accounts/${id}`,

    // Journals. Posting and reversing are separate verbs, not a PUT on the
    // entry — a posted journal is immutable, and `reverse` writes a second
    // entry rather than editing the first.
    JOURNALS_LIST: "/accounting/journals",
    JOURNALS_CREATE: "/accounting/journals",
    JOURNALS_SHOW: (id: number) => `/accounting/journals/${id}`,
    /** Drafts only: the server refuses anything that is not a draft. */
    JOURNALS_UPDATE: (id: number) => `/accounting/journals/${id}`,
    /** The server's totals for lines being typed. Writes nothing. */
    JOURNALS_PREVIEW: "/accounting/journals/preview",
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

    // Loan Accounting: the summary is one document, the loans list pages.
    LOAN_ACCOUNTING_SUMMARY: "/accounting/loan-accounting/summary",
    LOAN_ACCOUNTING_LOANS: "/accounting/loan-accounting/loans",

    // BIR books. One path per book, keyed by `BookKind`, so the books screen
    // can pick by tab without a switch statement per call site.
    BOOKS: {
      general_journal: "/accounting/books/general-journal",
      general_ledger: "/accounting/books/general-ledger",
      cash_receipts: "/accounting/books/cash-receipts",
      cash_disbursements: "/accounting/books/cash-disbursements",
    },
    // The two cash books in columns, one per mapped account role.
    BOOK_COLUMNS: {
      cash_receipts: "/accounting/books/cash-receipts/columns",
      cash_disbursements: "/accounting/books/cash-disbursements/columns",
    },

    // Cash and bank
    CASH_ACCOUNTS_LIST: "/accounting/cash-accounts",
    CASH_TRANSFER: "/accounting/cash-accounts/transfer",

    // Expenses and payables
    EXPENSES_LIST: "/accounting/expenses",
    EXPENSES_CREATE: "/accounting/expenses",
    EXPENSES_SHOW: (id: number) => `/accounting/expenses/${id}`,
    EXPENSES_UPDATE: (id: number) => `/accounting/expenses/${id}`,
    EXPENSES_PAY: (id: number) => `/accounting/expenses/${id}/pay`,

    // Reconciliation
    RECONCILIATIONS_LIST: "/accounting/reconciliations",
    RECONCILIATIONS_CREATE: "/accounting/reconciliations",
    RECONCILIATIONS_SHOW: (id: number) => `/accounting/reconciliations/${id}`,
    RECONCILIATIONS_MATCH: (id: number) => `/accounting/reconciliations/${id}/match`,

    // Periods
    PERIODS_LIST: "/accounting/periods",
    PERIODS_CLOSE: (id: number) => `/accounting/periods/${id}/close`,
    PERIODS_REOPEN: (id: number) => `/accounting/periods/${id}/reopen`,

    // Settings
    ACCOUNT_MAPPING: "/accounting/settings/account-mapping",

    // Round C. Seeding keeps ACCOUNTS_SEED; its body gains `template`.
    // Opening balances: one organisation-wide entry, a draft until finalised.
    OPENING_BALANCES: "/accounting/opening-balances",
    OPENING_BALANCES_FINALISE: "/accounting/opening-balances/finalise",

    // Year-end close: the list, the preview, and reopening the latest close.
    YEAR_CLOSES: "/accounting/year-closes",
    YEAR_CLOSES_PREVIEW: "/accounting/year-closes/preview",
    YEAR_CLOSES_REOPEN: (id: number) => `/accounting/year-closes/${id}/reopen`,

    // Allowance for credit losses: the preview, and the postings list and run.
    ALLOWANCE_PREVIEW: "/accounting/allowance/preview",
    ALLOWANCE_POSTINGS: "/accounting/allowance/postings",

    // Reconciliation actions: book an unmatched statement line and match it.
    RECONCILIATION_LINE_EXPENSE: (reconciliationId: number, lineId: number) =>
      `/accounting/reconciliations/${reconciliationId}/lines/${lineId}/expense`,
    RECONCILIATION_LINE_TRANSFER: (reconciliationId: number, lineId: number) =>
      `/accounting/reconciliations/${reconciliationId}/lines/${lineId}/transfer`,
    RECONCILIATION_LINE_SUSPENSE: (reconciliationId: number, lineId: number) =>
      `/accounting/reconciliations/${reconciliationId}/lines/${lineId}/suspense`,

    // Attachments on a journal or an expense.
    JOURNAL_ATTACHMENTS: (journalId: number) => `/accounting/journals/${journalId}/attachments`,
    JOURNAL_ATTACHMENT: (journalId: number, attachmentId: number) =>
      `/accounting/journals/${journalId}/attachments/${attachmentId}`,
    EXPENSE_ATTACHMENTS: (expenseId: number) => `/accounting/expenses/${expenseId}/attachments`,
    EXPENSE_ATTACHMENT: (expenseId: number, attachmentId: number) =>
      `/accounting/expenses/${expenseId}/attachments/${attachmentId}`,
  },
  /**
   * Savings & Deposits: lendyph-backend's savings design §2 (Phase 3, Wave 1).
   * Money posts carry an `Idempotency-Key` header. A withdrawal, close,
   * settlement or pre-termination above the first approval tier answers 202
   * with `{approval}` instead of 201.
   */
  SAVINGS: {
    SETTINGS: "/savings/settings",
    PREPARE_BOOKS: "/savings/settings/prepare-books",
    TAX_RULES: "/savings/tax-rules",

    PRODUCTS: "/savings/products",
    PRODUCT: (id: number) => `/savings/products/${id}`,
    PRODUCT_RATES: (id: number) => `/savings/products/${id}/rates`,

    ACCOUNTS: "/savings/accounts",
    ACCOUNT: (id: number) => `/savings/accounts/${id}`,
    ACCOUNT_TRANSACTIONS: (id: number) => `/savings/accounts/${id}/transactions`,
    DEPOSITS: (id: number) => `/savings/accounts/${id}/deposits`,
    WITHDRAWALS: (id: number) => `/savings/accounts/${id}/withdrawals`,
    TRANSFERS: (id: number) => `/savings/accounts/${id}/transfers`,
    CLOSING_QUOTE: (id: number) => `/savings/accounts/${id}/closing-quote`,
    CLOSE: (id: number) => `/savings/accounts/${id}/close`,
    STATUS: (id: number) => `/savings/accounts/${id}/status`,
    HOLDS: (id: number) => `/savings/accounts/${id}/holds`,
    HOLD_RELEASE: (holdId: number) => `/savings/holds/${holdId}/release`,

    TRANSACTIONS: "/savings/transactions",
    TRANSACTION: (id: number) => `/savings/transactions/${id}`,
    TRANSACTION_REVERSE: (id: number) => `/savings/transactions/${id}/reverse`,

    APPROVALS: "/savings/approvals",
    APPROVAL_APPROVE: (id: number) => `/savings/approvals/${id}/approve`,
    APPROVAL_REJECT: (id: number) => `/savings/approvals/${id}/reject`,
    APPROVAL_CANCEL: (id: number) => `/savings/approvals/${id}/cancel`,

    TIME_DEPOSITS: "/savings/time-deposits",
    TIME_DEPOSIT: (id: number) => `/savings/time-deposits/${id}`,
    TIME_DEPOSIT_QUOTE: "/savings/time-deposits/quote",
    TIME_DEPOSIT_SETTLE: (id: number) => `/savings/time-deposits/${id}/settle`,
    TIME_DEPOSIT_PRETERMINATE: (id: number) => `/savings/time-deposits/${id}/preterminate`,
    TIME_DEPOSIT_PRETERMINATION_QUOTE: (id: number) =>
      `/savings/time-deposits/${id}/pretermination-quote`,

    INTEREST_RUNS: "/savings/interest-runs",
    INTEREST_RUNS_PREVIEW: "/savings/interest-runs/preview",
    INTEREST_RUN: (id: number) => `/savings/interest-runs/${id}`,
    INTEREST_RUN_APPROVE: (id: number) => `/savings/interest-runs/${id}/approve`,
    INTEREST_RUN_REJECT: (id: number) => `/savings/interest-runs/${id}/reject`,
    INTEREST_RUN_POST: (id: number) => `/savings/interest-runs/${id}/post`,
    INTEREST_RUN_REVERSE: (id: number) => `/savings/interest-runs/${id}/reverse`,
  },
  /**
   * Credit Scoring (backend PR #240). Every route needs credit_scoring:view,
   * settings or override as docs/CREDIT_SCORING_BACKEND_HANDOFF.md lists; the
   * loan assessment also needs loans:view, and loans:update to save.
   * The screens stay behind NEXT_PUBLIC_ENABLE_CREDIT_SCORING.
   */
  CREDIT_SCORING: {
    DASHBOARD: "/credit-scoring/dashboard",
    BORROWERS_LIST: "/credit-scoring/borrowers",
    BORROWER_PROFILE: (borrowerId: number) => `/credit-scoring/borrowers/${borrowerId}`,
    BORROWER_HISTORY: (borrowerId: number) => `/credit-scoring/borrowers/${borrowerId}/history`,
    BORROWER_DECISIONS: (borrowerId: number) => `/credit-scoring/borrowers/${borrowerId}/decisions`,
    SCORE_HISTORY: "/credit-scoring/score-history",
    RISK_MONITORING: "/credit-scoring/risk-monitoring",
    SCORECARD_CONFIG: "/credit-scoring/scorecard-config",
    POLICY_FLAGS: (borrowerId: number) => `/credit-scoring/borrowers/${borrowerId}/policy-flags`,
    DECISIONS_CREATE: "/credit-scoring/decisions",
    SETTINGS: "/credit-scoring/settings",
    LOAN_ASSESSMENT: (loanId: number) => `/credit-scoring/loans/${loanId}/assessment`,
  },
  /**
   * Automated due-date reminders. None of these exist yet: the scheduler,
   * providers and these routes are backend work still to do, and the contract
   * is `@/types/reminder` plus the handoff in the commit that added this
   * block. Until they land every screen shows "Not connected yet" (404).
   */
  REMINDERS: {
    DASHBOARD: "/reminders/dashboard",
    RULES: "/reminders/rules",
    RULE: (id: number) => `/reminders/rules/${id}`,
    RULE_DEACTIVATE: (id: number) => `/reminders/rules/${id}/deactivate`,
    TEMPLATES: "/reminders/templates",
    TEMPLATE: (id: number) => `/reminders/templates/${id}`,
    TEMPLATE_PREVIEW: "/reminders/templates/preview",
    QUEUE: "/reminders/queue",
    HISTORY: "/reminders/history",
    HISTORY_DETAIL: (id: number) => `/reminders/history/${id}`,
    LOAN: (loanId: number) => `/loans/${loanId}/reminders`,
    MANUAL_PREVIEW: "/reminders/manual-send/preview",
    MANUAL_SEND: "/reminders/manual-send",
    PAUSES: "/reminders/pauses",
    PAUSE: "/reminders/pause",
    RESUME: "/reminders/resume",
    SETTINGS: "/reminders/settings",
    BORROWER_PREFERENCES: (borrowerId: number) =>
      `/borrowers/${borrowerId}/notification-preferences`,
  },
  /**
   * Linda, the AI lending assistant. Not built on the backend yet; the
   * contract is the "Linda" backend handoff on PR feat/linda-ai-assistant.
   * The server derives tenant, branch and permissions from the token, so the
   * request carries only the question and this session's earlier turns.
   */
  LINDA: {
    CHAT: "/linda/chat",
  },
  /**
   * CDA Compliance (CDA design §3). Every route needs `branches:view_all` plus
   * its own `cda:*` permission; mediation, audit and tax reports and documents
   * need their restricted view as well. Reports and their workflow are
   * addressed by id; `REPORT_BY_TYPE` is the year and type alias.
   */
  CDA: {
    PERIODS: "/cda/periods",
    PERIOD: (year: number) => `/cda/periods/${year}`,
    DASHBOARD: (year: number) => `/cda/periods/${year}/dashboard`,
    CALENDAR: (year: number) => `/cda/periods/${year}/calendar`,
    REPORT_BY_TYPE: (year: number, type: string) => `/cda/periods/${year}/reports/${type}`,
    REPORT: (id: number) => `/cda/reports/${id}`,
    REPORT_WORKFLOW: (id: number) => `/cda/reports/${id}/workflow`,
    REPORT_DEADLINE: (id: number) => `/cda/reports/${id}/deadline`,
    REPORT_SNAPSHOTS: (id: number) => `/cda/reports/${id}/snapshots`,
    REPORT_EXPORTS: (id: number) => `/cda/reports/${id}/exports`,
    LOAN_CLASSIFICATION: (year: number) => `/cda/periods/${year}/loan-classification`,
    PESOS: (year: number) => `/cda/periods/${year}/pesos`,
    OFFICERS: "/cda/officers",
    OFFICER: (id: number) => `/cda/officers/${id}`,
    TRAININGS: "/cda/trainings",
    TRAINING: (id: number) => `/cda/trainings/${id}`,
    SOCIAL_PROGRAMS: (year: number) => `/cda/periods/${year}/social-programs`,
    SOCIAL_PROGRAM: (id: number) => `/cda/social-programs/${id}`,
    MEDIATION_CASES: (year: number) => `/cda/periods/${year}/mediation-cases`,
    MEDIATION_CASE: (id: number) => `/cda/mediation-cases/${id}`,
    DOCUMENTS: (year: number) => `/cda/periods/${year}/documents`,
    DOCUMENT_VERSIONS: (id: number) => `/cda/documents/${id}/versions`,
    DOCUMENT_WITHDRAW: (id: number) => `/cda/documents/${id}/withdraw`,
    SUBMISSIONS: (year: number) => `/cda/periods/${year}/submissions`,
    SUBMISSION: (id: number) => `/cda/submissions/${id}`,
    SUBMISSION_PROOF: (id: number) => `/cda/submissions/${id}/proof`,
    REGULATORY_PROFILE: "/cda/regulatory-profile",
    SETTINGS: "/cda/settings",
    TEMPLATES: "/cda/templates",
    TEMPLATE: (id: number) => `/cda/templates/${id}`,
    TEMPLATE_ACTIVATE: (id: number) => `/cda/templates/${id}/activate`,
    TEMPLATE_RETIRE: (id: number) => `/cda/templates/${id}/retire`,
    TEMPLATE_EXCEL_FILE: (id: number) => `/cda/templates/${id}/excel-file`,
    TEMPLATE_VALIDATE: "/cda/templates/validate",
  },
  /** The signed-in staff user's own in-app notifications (the header bell). */
  NOTIFICATIONS: {
    LIST: "/notifications",
    UNREAD_COUNT: "/notifications/unread-count",
    READ: (id: string) => `/notifications/${encodeURIComponent(id)}/read`,
    READ_ALL: "/notifications/read-all",
  },
  SYSTEM: {
    HEALTH: "/health",
  },
} as const;
