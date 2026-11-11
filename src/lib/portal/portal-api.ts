import { idempotencyHeaders } from "@/lib/idempotency-key";
import { PORTAL_ENDPOINTS as E } from "./endpoints";
import { portalApi, type Confirmed, type DownloadedFile } from "./portal-client";
import type {
  Announcement,
  CodeVerifyResponse,
  Dashboard,
  Documents,
  LoanDetail,
  LoanPayment,
  LoanRow,
  LoanSchedule,
  LoginResponse,
  MeResponse,
  Membership,
  Paged,
  PassbookRow,
  PortalConfig,
  PortalLoginEvent,
  PortalNotification,
  PortalSession,
  PortalTerms,
  Profile,
  ReportResult,
  RequestDetail,
  RequestOptions,
  RequestRow,
  RequestType,
  SavingsAccount,
  ShareCapital,
  ShareCapitalEntry,
  TimeDeposit,
  UnreadCount,
} from "./types";

/** Rows per page on the member's lists (the server allows up to 50). */
export const PORTAL_PER_PAGE = 20;

const page = (n: number, extra: Record<string, string | number | boolean | undefined> = {}) => ({
  params: { page: n, per_page: PORTAL_PER_PAGE, ...extra },
});

export interface CompleteCodeBody {
  step_token: string;
  password: string;
  password_confirmation: string;
  accepted_terms_version?: string;
  ecomm_consent?: boolean;
}

export interface NewRequestBody {
  type: RequestType;
  details: Record<string, string | number | boolean>;
  remarks?: string;
}

/**
 * Every member portal call. The screens use this and never a path: the
 * member is taken from the token only, so no call sends a member id.
 */
export const portalService = {
  config: () => portalApi.get<PortalConfig>(E.CONFIG),
  terms: () => portalApi.get<PortalTerms>(E.TERMS),

  login: (member_number: string, password: string) =>
    portalApi.postConfirmed<LoginResponse>(E.LOGIN, { member_number, password }),
  verifyCode: (member_number: string, code: string, birthdate: string) =>
    portalApi.post<CodeVerifyResponse>(E.CODE_VERIFY, { member_number, code, birthdate }),
  verifyOtp: (step_token: string, otp: string) => portalApi.post<{ verified: boolean }>(E.CODE_OTP, { step_token, otp }),
  completeCode: (body: CompleteCodeBody) => portalApi.postConfirmed<LoginResponse>(E.CODE_COMPLETE, body),

  me: () => portalApi.get<MeResponse>(E.ME),
  acceptTerms: (version: string, ecomm_consent: boolean) =>
    portalApi.postConfirmed<{ terms_version: string; terms_required: boolean }>(E.TERMS_ACCEPT, { version, ecomm_consent }),
  changePassword: (current_password: string, password: string, password_confirmation: string) =>
    portalApi.postConfirmed<unknown>(E.PASSWORD_CHANGE, { current_password, password, password_confirmation }),

  sessions: () => portalApi.get<PortalSession[]>(E.SESSIONS),
  endSession: (id: number) => portalApi.deleteConfirmed<unknown>(E.SESSION(id)),
  logoutOthers: () => portalApi.postConfirmed<{ sessions_ended: number }>(E.SESSIONS_LOGOUT_OTHERS),
  logins: () => portalApi.get<PortalLoginEvent[]>(E.LOGINS),
  reportLogin: (id: number) => portalApi.postConfirmed<ReportResult>(E.LOGIN_REPORT(id)),

  dashboard: () => portalApi.get<Dashboard>(E.DASHBOARD),
  membership: () => portalApi.get<Membership>(E.MEMBERSHIP),
  profile: () => portalApi.get<Profile>(E.PROFILE),

  loans: () => portalApi.get<LoanRow[]>(E.LOANS),
  loan: (id: number) => portalApi.get<LoanDetail>(E.LOAN(id)),
  loanSchedule: (id: number) => portalApi.get<LoanSchedule>(E.LOAN_SCHEDULE(id)),
  loanPayments: (id: number, n: number) => portalApi.getPage<LoanPayment>(E.LOAN_PAYMENTS(id), page(n)) as Promise<Paged<LoanPayment>>,
  payments: (n: number) => portalApi.getPage<LoanPayment>(E.PAYMENTS, page(n)) as Promise<Paged<LoanPayment>>,
  loanStatement: (id: number): Promise<DownloadedFile> => portalApi.download(E.LOAN_STATEMENT(id)),

  shareCapital: () => portalApi.get<ShareCapital>(E.SHARE_CAPITAL),
  shareCapitalEntries: (n: number) =>
    portalApi.getPage<ShareCapitalEntry>(E.SHARE_CAPITAL_TRANSACTIONS, page(n)) as Promise<Paged<ShareCapitalEntry>>,
  shareCapitalStatement: (from: string, to: string) => portalApi.download(E.SHARE_CAPITAL_STATEMENT, { params: { from, to } }),
  shareCapitalCertificate: (asOf: string) => portalApi.download(E.SHARE_CAPITAL_CERTIFICATE, { params: { as_of: asOf } }),

  savings: () => portalApi.get<SavingsAccount[]>(E.SAVINGS),
  savingsAccount: (id: number) => portalApi.get<SavingsAccount>(E.SAVINGS_ACCOUNT(id)),
  passbook: (id: number, n: number, filters: { from?: string; to?: string; type?: string; search?: string }) =>
    portalApi.getPage<PassbookRow, { opening_balance: string }>(E.SAVINGS_TRANSACTIONS(id), page(n, filters)) as Promise<
      Paged<PassbookRow, { opening_balance: string }>
    >,
  savingsStatement: (id: number, from?: string, to?: string) =>
    portalApi.download(E.SAVINGS_STATEMENT(id), { params: { from: from || undefined, to: to || undefined } }),

  timeDeposits: () => portalApi.get<TimeDeposit[]>(E.TIME_DEPOSITS),
  timeDeposit: (id: number) => portalApi.get<TimeDeposit>(E.TIME_DEPOSIT(id)),
  timeDepositCertificate: (id: number) => portalApi.download(E.TIME_DEPOSIT_CERTIFICATE(id)),

  documents: () => portalApi.get<Documents>(E.DOCUMENTS),
  downloadDocument: (id: number) => portalApi.download(E.DOCUMENT_DOWNLOAD(id)),

  notifications: (n: number, unread?: boolean) =>
    portalApi.getPage<PortalNotification>(E.NOTIFICATIONS, page(n, unread ? { unread: 1 } : {})) as Promise<
      Paged<PortalNotification>
    >,
  unreadCount: () => portalApi.get<UnreadCount>(E.NOTIFICATIONS_UNREAD),
  readNotification: (id: string) => portalApi.post<PortalNotification>(E.NOTIFICATION_READ(id)),
  readAllNotifications: () => portalApi.postConfirmed<{ marked_read: number }>(E.NOTIFICATIONS_READ_ALL),

  announcements: (n: number) =>
    portalApi.getPage<Announcement, { unread: number }>(E.ANNOUNCEMENTS, { params: { page: n } }) as Promise<
      Paged<Announcement, { unread: number }>
    >,
  readAnnouncement: (id: number) => portalApi.post<Announcement>(E.ANNOUNCEMENT_READ(id)),

  requests: (n: number) => portalApi.getPage<RequestRow>(E.REQUESTS, { params: { page: n } }) as Promise<Paged<RequestRow>>,
  requestOptions: () => portalApi.get<RequestOptions>(E.REQUEST_OPTIONS),
  request: (id: number) => portalApi.get<RequestDetail>(E.REQUEST(id)),
  /** Sent with the attempt's Idempotency-Key; the caller waits for the 201. */
  createRequest: (body: NewRequestBody, key: string | null): Promise<Confirmed<RequestDetail>> =>
    portalApi.postConfirmed<RequestDetail>(E.REQUESTS, body, idempotencyHeaders(key)),
  cancelRequest: (id: number) => portalApi.postConfirmed<RequestDetail>(E.REQUEST_CANCEL(id)),
  replyRequest: (id: number, message: string) => portalApi.postConfirmed<RequestDetail>(E.REQUEST_REPLY(id), { message }),
};
