/**
 * The Member Portal's staff side (`/portal-admin`), on the staff token like
 * every other staff screen. The member side has its own client
 * (`src/lib/portal/`) and never goes through here.
 *
 * Everything is branch-scoped by the server: another branch's member, request
 * or announcement answers 404, and a branch filter outside the caller's
 * branches answers 403. A code is in the 201 body of an invite or a reset code
 * only, and is never read again.
 *
 * Adapted from #511, #513 and #514 by Augustin (`portal-admin.service.ts`),
 * on lendyph-backend's contract (#287, #289, #291).
 */

import axiosClient from "@/lib/axios-client";
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type {
  PortalAccessCard,
  PortalAccountsPage,
  PortalAccountsQuery,
  PortalAnnouncement,
  PortalAnnouncementInput,
  PortalAnnouncementsPage,
  PortalAnnouncementStatus,
  PortalCommunication,
  PortalDecisionInput,
  PortalDecisionResult,
  PortalIdentityType,
  PortalIssuedCode,
  PortalRequestDetail,
  PortalRequestsPage,
  PortalRequestsQuery,
  PortalSettings,
  PortalSettingsInput,
  PortalShareResult,
  PortalStaffDisableReason,
  PortalStats,
  PortalTermsInput,
  PortalTermsSummary,
} from "@/types/portal-admin";

const E = API_ENDPOINTS.PORTAL_ADMIN;

/** Query params without the empty ones, so the server never reads `status=`. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<T>;
}

export const portalAdminService = {
  // ── Settings and terms (member_portal:settings and branches:view_all) ──

  settings: () => api.get<PortalSettings>(E.SETTINGS),
  updateSettings: (data: PortalSettingsInput) => api.put<PortalSettings>(E.SETTINGS, data),
  /** Published at once and never edited. 422 for a version that already exists. */
  publishTerms: (data: PortalTermsInput) => api.post<PortalTermsSummary>(E.TERMS, data),

  // ── Access (member_portal:view, invite, manage) ──

  stats: (branchId?: number) => api.get<PortalStats>(E.STATS, { params: compact({ branch_id: branchId }) }),
  accounts: (query: PortalAccountsQuery) =>
    api.getRaw<PortalAccountsPage>(E.ACCOUNTS, { params: compact(query) }),
  access: (borrowerId: number) => api.get<PortalAccessCard>(E.MEMBER_ACCESS(borrowerId)),
  communications: (borrowerId: number) => api.get<PortalCommunication[]>(E.MEMBER_COMMUNICATIONS(borrowerId)),
  /** 201 with the code, once. 409 when the member already uses the portal. */
  invite: (borrowerId: number, identityCheckedAs: PortalIdentityType) =>
    api.post<PortalIssuedCode>(E.MEMBER_INVITE(borrowerId), { identity_checked_as: identityCheckedAs }),
  /** 201 with the code, once; for an active or locked account. */
  resetCode: (borrowerId: number, identityCheckedAs: PortalIdentityType) =>
    api.post<PortalIssuedCode>(E.MEMBER_RESET_CODE(borrowerId), { identity_checked_as: identityCheckedAs }),
  disable: (borrowerId: number, reason: PortalStaffDisableReason) =>
    api.put<PortalAccessCard>(E.MEMBER_ACCESS(borrowerId), { enabled: false, reason }),
  enable: (borrowerId: number) => api.put<PortalAccessCard>(E.MEMBER_ACCESS(borrowerId), { enabled: true }),
  unlock: (borrowerId: number) => api.post<PortalAccessCard>(E.MEMBER_UNLOCK(borrowerId)),
  signOut: (borrowerId: number) => api.post<{ sessions_ended: number }>(E.MEMBER_SIGN_OUT(borrowerId)),

  // ── Shared documents (member_portal:manage and borrowers:view) ──

  shareDocument: (borrowerId: number, documentId: number) =>
    api.post<PortalShareResult>(E.DOCUMENT_SHARE(borrowerId), { document_id: documentId }),
  unshareDocument: (borrowerId: number, documentId: number) =>
    api.post<PortalShareResult>(E.DOCUMENT_UNSHARE(borrowerId), { document_id: documentId }),

  // ── Requests (member_portal:requests plus each type's own permission) ──

  /** 25 a page, with `meta.counts` per status (the other filters applied). */
  requests: (query: PortalRequestsQuery) =>
    api.getRaw<PortalRequestsPage>(E.REQUESTS, { params: compact(query) }),
  request: (id: number) => api.get<PortalRequestDetail>(E.REQUEST(id)),
  /**
   * Decide a request. Approve carries the form's `Idempotency-Key`, so a retry
   * after a lost answer gets the first answer back. The HTTP status says what
   * happened: 201 posted or opened, 202 waiting for the second approval.
   */
  decide: async (id: number, input: PortalDecisionInput, key: string | null): Promise<PortalDecisionResult> => {
    const response = await axiosClient.post<{ success: boolean; data: PortalRequestDetail }>(
      E.REQUEST_DECISION(id),
      input,
      input.decision === "approve" ? idempotencyHeaders(key) : {},
    );
    return { status: response.status, request: response.data.data };
  },

  // ── Announcements (member_portal:announcements) ──

  announcements: (query: { status?: PortalAnnouncementStatus; page?: number }) =>
    api.getRaw<PortalAnnouncementsPage>(E.ANNOUNCEMENTS, { params: compact(query) }),
  createAnnouncement: (data: PortalAnnouncementInput) => api.post<PortalAnnouncement>(E.ANNOUNCEMENTS, data),
  updateAnnouncement: (id: number, data: Partial<PortalAnnouncementInput>) =>
    api.put<PortalAnnouncement>(E.ANNOUNCEMENT(id), data),
  /** Drafts only. */
  deleteAnnouncement: (id: number) => api.delete<void>(E.ANNOUNCEMENT(id)),
  publishAnnouncement: (id: number) => api.post<PortalAnnouncement>(E.ANNOUNCEMENT_PUBLISH(id)),
  withdrawAnnouncement: (id: number) => api.post<PortalAnnouncement>(E.ANNOUNCEMENT_WITHDRAW(id)),
};
