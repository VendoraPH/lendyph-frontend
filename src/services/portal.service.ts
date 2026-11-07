import { API_ENDPOINTS } from "@/config/api-endpoints";
import { portalApi } from "@/lib/portal/portal-client";
import type {
  ActivationChallenge,
  ActivationCompleteRequest,
  ActivationOtpRequest,
  ActivationVerifyRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GCashCheckout,
  GCashPaymentRequest,
  PortalLedgerEntry,
  PortalLoanDetail,
  PortalLoanSummary,
  PortalPayment,
  PortalPaymentFilters,
  PortalSavingsAccount,
  PortalScheduleRow,
  PortalShareCapital,
  PortalTimeDeposit,
  PortalConfig,
  PortalDashboard,
  PortalLogin,
  PortalLoginRequest,
  PortalLoginResponse,
  PortalMember,
  PortalMembership,
  PortalProfile,
  PortalSession,
  ProfileUpdateRequest,
  ProfileUpdateSubmit,
  ResetPasswordRequest,
  StatementRequest,
} from "@/types/portal";
import type { PaginatedResponse } from "@/types/api";

const P = API_ENDPOINTS.PORTAL;

/**
 * The member's own calls, made with the member token. Every route resolves the
 * member from that token, so nothing here takes a member id: a member can only
 * ever read their own records. Contract: docs/MEMBER_PORTAL_BACKEND_HANDOFF.md.
 */
export const portalService = {
  config: () => portalApi.get<PortalConfig>(P.CONFIG),

  login: (body: PortalLoginRequest) => portalApi.post<PortalLoginResponse>(P.AUTH.LOGIN, body),
  logout: () => portalApi.post<void>(P.AUTH.LOGOUT),
  me: () => portalApi.get<PortalMember>(P.AUTH.ME),

  verifyActivation: (body: ActivationVerifyRequest) =>
    portalApi.post<ActivationChallenge>(P.AUTH.ACTIVATION_VERIFY, body),
  verifyActivationOtp: (body: ActivationOtpRequest) =>
    portalApi.post<void>(P.AUTH.ACTIVATION_OTP, body),
  completeActivation: (body: ActivationCompleteRequest) =>
    portalApi.post<PortalLoginResponse>(P.AUTH.ACTIVATION_COMPLETE, body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    portalApi.post<ActivationChallenge>(P.AUTH.FORGOT, body),
  verifyResetOtp: (body: ActivationOtpRequest) => portalApi.post<void>(P.AUTH.FORGOT_OTP, body),
  resetPassword: (body: ResetPasswordRequest) => portalApi.post<void>(P.AUTH.RESET, body),
  changePassword: (body: ChangePasswordRequest) =>
    portalApi.post<void>(P.AUTH.CHANGE_PASSWORD, body),

  dashboard: () => portalApi.get<PortalDashboard>(P.DASHBOARD),
  membership: () => portalApi.get<PortalMembership>(P.MEMBERSHIP),
  profile: () => portalApi.get<PortalProfile>(P.PROFILE),
  profileRequests: () => portalApi.get<ProfileUpdateRequest[]>(P.PROFILE_REQUESTS),
  submitProfileRequest: (body: ProfileUpdateSubmit) =>
    portalApi.post<ProfileUpdateRequest>(P.PROFILE_REQUESTS, body),
  cancelProfileRequest: (id: number) => portalApi.delete<void>(P.PROFILE_REQUEST(id)),

  sessions: () => portalApi.get<PortalSession[]>(P.SECURITY.SESSIONS),
  endSession: (id: number) => portalApi.delete<void>(P.SECURITY.SESSION(id)),
  logoutOthers: () => portalApi.post<void>(P.SECURITY.LOGOUT_OTHERS),
  logins: () => portalApi.get<PortalLogin[]>(P.SECURITY.LOGINS),
  reportLogin: (id: number) => portalApi.post<void>(P.SECURITY.REPORT_LOGIN(id)),

  loans: () => portalApi.get<PortalLoanSummary[]>(P.LOANS),
  loan: (id: number) => portalApi.get<PortalLoanDetail>(P.LOAN(id)),
  loanSchedule: (id: number) => portalApi.get<PortalScheduleRow[]>(P.LOAN_SCHEDULE(id)),
  loanPayments: (id: number) => portalApi.get<PortalPayment[]>(P.LOAN_PAYMENTS(id)),
  loanStatement: (id: number) => portalApi.download(P.LOAN_SOA(id)),

  /** Paged: the whole body so the page can read `meta.total`. */
  payments: (params: PortalPaymentFilters) =>
    portalApi.getRaw<PaginatedResponse<PortalPayment>>(P.PAYMENTS, { params }),
  paymentReceipt: (id: number) => portalApi.download(P.PAYMENT_RECEIPT(id)),
  payWithGCash: (body: GCashPaymentRequest) => portalApi.post<GCashCheckout>(P.GCASH_PAY, body),

  shareCapital: () => portalApi.get<PortalShareCapital>(P.SHARE_CAPITAL),
  shareCapitalLedger: () => portalApi.get<PortalLedgerEntry[]>(P.SHARE_CAPITAL_LEDGER),
  savings: () => portalApi.get<PortalSavingsAccount[]>(P.SAVINGS),
  savingsLedger: (id: number) => portalApi.get<PortalLedgerEntry[]>(P.SAVINGS_LEDGER(id)),
  timeDeposits: () => portalApi.get<PortalTimeDeposit[]>(P.TIME_DEPOSITS),
  timeDepositCertificate: (id: number) => portalApi.download(P.TIME_DEPOSIT_CERTIFICATE(id)),

  /** A PDF statement for the chosen account and period. */
  statement: (params: StatementRequest) => portalApi.download(P.STATEMENT, { params }),
};
