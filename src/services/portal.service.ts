import { API_ENDPOINTS } from "@/config/api-endpoints";
import { portalApi } from "@/lib/portal/portal-client";
import type {
  ActivationChallenge,
  ActivationCompleteRequest,
  ActivationOtpRequest,
  ActivationVerifyRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
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
} from "@/types/portal";

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
};
