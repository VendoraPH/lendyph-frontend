/**
 * The member portal's API paths (backend `routes/api/portal/*.php`).
 *
 * The only file that spells them out: the screens call `portalService`, and a
 * guard test fails on a `/portal/` path anywhere a member could read it. These
 * are kept apart from `src/config/api-endpoints.ts` (the staff app's) on
 * purpose, so a portal call can never pick up a staff path or the other way
 * round.
 */
export const PORTAL_ENDPOINTS = {
  CONFIG: "/portal/config",
  TERMS: "/portal/terms",

  LOGIN: "/portal/auth/login",
  CODE_VERIFY: "/portal/auth/codes/verify",
  CODE_OTP: "/portal/auth/codes/otp",
  CODE_COMPLETE: "/portal/auth/codes/complete",

  LOGOUT: "/portal/auth/logout",
  ME: "/portal/auth/me",
  TERMS_ACCEPT: "/portal/auth/terms/accept",
  PASSWORD_CHANGE: "/portal/auth/password/change",

  SESSIONS: "/portal/security/sessions",
  SESSION: (id: number) => `/portal/security/sessions/${id}`,
  SESSIONS_LOGOUT_OTHERS: "/portal/security/sessions/logout-others",
  LOGINS: "/portal/security/logins",
  LOGIN_REPORT: (id: number) => `/portal/security/logins/${id}/report`,

  DASHBOARD: "/portal/dashboard",
  MEMBERSHIP: "/portal/membership",
  PROFILE: "/portal/profile",

  LOANS: "/portal/loans",
  LOAN: (id: number) => `/portal/loans/${id}`,
  LOAN_SCHEDULE: (id: number) => `/portal/loans/${id}/schedule`,
  LOAN_PAYMENTS: (id: number) => `/portal/loans/${id}/payments`,
  LOAN_STATEMENT: (id: number) => `/portal/loans/${id}/statement`,
  PAYMENTS: "/portal/payments",

  SHARE_CAPITAL: "/portal/share-capital",
  SHARE_CAPITAL_TRANSACTIONS: "/portal/share-capital/transactions",
  SHARE_CAPITAL_STATEMENT: "/portal/share-capital/statement",
  SHARE_CAPITAL_CERTIFICATE: "/portal/share-capital/certificate",

  SAVINGS: "/portal/savings",
  SAVINGS_ACCOUNT: (id: number) => `/portal/savings/${id}`,
  SAVINGS_TRANSACTIONS: (id: number) => `/portal/savings/${id}/transactions`,
  SAVINGS_STATEMENT: (id: number) => `/portal/savings/${id}/statement`,

  TIME_DEPOSITS: "/portal/time-deposits",
  TIME_DEPOSIT: (id: number) => `/portal/time-deposits/${id}`,
  TIME_DEPOSIT_CERTIFICATE: (id: number) => `/portal/time-deposits/${id}/certificate`,

  DOCUMENTS: "/portal/documents",
  DOCUMENT_DOWNLOAD: (id: number) => `/portal/documents/${id}/download`,

  NOTIFICATIONS: "/portal/notifications",
  NOTIFICATIONS_UNREAD: "/portal/notifications/unread-count",
  NOTIFICATIONS_READ_ALL: "/portal/notifications/read-all",
  NOTIFICATION_READ: (id: string) => `/portal/notifications/${encodeURIComponent(id)}/read`,

  ANNOUNCEMENTS: "/portal/announcements",
  ANNOUNCEMENT: (id: number) => `/portal/announcements/${id}`,
  ANNOUNCEMENT_READ: (id: number) => `/portal/announcements/${id}/read`,

  REQUESTS: "/portal/requests",
  REQUEST_OPTIONS: "/portal/requests/options",
  REQUEST: (id: number) => `/portal/requests/${id}`,
  REQUEST_CANCEL: (id: number) => `/portal/requests/${id}/cancel`,
  REQUEST_REPLY: (id: number) => `/portal/requests/${id}/reply`,
} as const;

/**
 * Sign-in steps: a 401 or 422 from these is a wrong answer, never a session
 * ending, so the client's session handling leaves them alone.
 */
export const PORTAL_PUBLIC_PATHS: readonly string[] = [
  PORTAL_ENDPOINTS.CONFIG,
  PORTAL_ENDPOINTS.TERMS,
  PORTAL_ENDPOINTS.LOGIN,
  PORTAL_ENDPOINTS.CODE_VERIFY,
  PORTAL_ENDPOINTS.CODE_OTP,
  PORTAL_ENDPOINTS.CODE_COMPLETE,
];
