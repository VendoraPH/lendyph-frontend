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
  PortalDocument,
  PortalLoanApplication,
  PortalLoanApplicationSubmit,
  PortalLoanEligibility,
  PortalLoanProduct,
  PortalRequest,
  PortalRequestSubmit,
  PortalSavingsProduct,
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

  requests: () => portalApi.get<PortalRequest[]>(P.REQUESTS),
  submitRequest: (body: PortalRequestSubmit) =>
    portalApi.upload<PortalRequest>(P.REQUESTS, requestForm(body)),
  cancelRequest: (id: number) => portalApi.delete<void>(P.REQUEST(id)),
  /** Answer a "more information needed" request. */
  replyToRequest: (id: number, message: string, attachments: File[]) => {
    const form = new FormData();
    form.append("message", message);
    attachments.forEach((f) => form.append("attachments[]", f));
    return portalApi.upload<PortalRequest>(P.REQUEST_REPLY(id), form);
  },
  savingsProducts: () => portalApi.get<PortalSavingsProduct[]>(P.SAVINGS_PRODUCTS),

  loanProducts: () => portalApi.get<PortalLoanProduct[]>(P.LOAN_PRODUCTS),
  loanEligibility: (productId: number) =>
    portalApi.get<PortalLoanEligibility>(P.LOAN_ELIGIBILITY(productId)),
  loanApplications: () => portalApi.get<PortalLoanApplication[]>(P.LOAN_APPLICATIONS),
  submitLoanApplication: (body: PortalLoanApplicationSubmit) =>
    portalApi.upload<PortalLoanApplication>(P.LOAN_APPLICATIONS, loanApplicationForm(body)),
  cancelLoanApplication: (id: number) => portalApi.delete<void>(P.LOAN_APPLICATION(id)),

  documents: () => portalApi.get<PortalDocument[]>(P.DOCUMENTS),
  downloadDocument: (id: number) => portalApi.download(P.DOCUMENT_DOWNLOAD(id)),
};

function requestForm(body: PortalRequestSubmit): FormData {
  const form = new FormData();
  form.append("type", body.type);
  Object.entries(body.details).forEach(([key, value]) => form.append(`details[${key}]`, value));
  if (body.remarks) form.append("remarks", body.remarks);
  body.attachments?.forEach((f) => form.append("attachments[]", f));
  return form;
}

function loanApplicationForm(body: PortalLoanApplicationSubmit): FormData {
  const form = new FormData();
  const { documents, ...fields } = body;
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  documents.forEach((d, i) => {
    form.append(`documents[${i}][name]`, d.name);
    form.append(`documents[${i}][file]`, d.file);
  });
  return form;
}
