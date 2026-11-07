import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type {
  AnnouncementInput,
  BulkInviteRequest,
  BulkInviteResult,
  PortalAccess,
  PortalAccessUpdate,
  PortalAccountFilters,
  PortalAccountRow,
  PortalCommunication,
  PortalSettings,
  PortalStats,
  ProfileRequestDecision,
  StaffPortalRequest,
  StaffProfileRequest,
  StaffRequestDecisionBody,
  StaffRequestFilters,
  StaffAnnouncement,
  StaffSupportTicket,
  StaffTicketFilters,
  TicketStatus,
} from "@/types/portal";

const A = API_ENDPOINTS.PORTAL_ADMIN;

/** Staff-side portal management, with the staff token (member_portal:*). */
export const portalAdminService = {
  settings: () => api.get<PortalSettings>(A.SETTINGS),
  saveSettings: (body: PortalSettings) => api.put<PortalSettings>(A.SETTINGS, body),
  stats: () => api.get<PortalStats>(A.STATS),

  /** One page of members with their portal status; `meta` drives the table pager. */
  accounts: (filters: PortalAccountFilters) =>
    api.getRaw<PaginatedResponse<PortalAccountRow>>(A.ACCOUNTS, { params: filters }),

  access: (borrowerId: number) => api.get<PortalAccess>(A.MEMBER_ACCESS(borrowerId)),
  updateAccess: (borrowerId: number, body: PortalAccessUpdate) =>
    api.put<PortalAccess>(A.MEMBER_ACCESS(borrowerId), body),
  invite: (borrowerId: number) => api.post<PortalAccess>(A.MEMBER_INVITE(borrowerId)),
  unlock: (borrowerId: number) => api.post<PortalAccess>(A.MEMBER_UNLOCK(borrowerId)),
  communications: (borrowerId: number) =>
    api.get<PortalCommunication[]>(A.MEMBER_COMMUNICATIONS(borrowerId)),
  bulkInvite: (body: BulkInviteRequest) => api.post<BulkInviteResult>(A.BULK_INVITE, body),

  profileRequests: (status?: string) =>
    api.get<StaffProfileRequest[]>(A.PROFILE_REQUESTS, { params: status ? { status } : undefined }),
  decideProfileRequest: (id: number, body: ProfileRequestDecision) =>
    api.post<StaffProfileRequest>(A.PROFILE_REQUEST_DECIDE(id), body),

  /** One page of members' service requests; `meta` drives the pager and tab counts. */
  requests: (filters: StaffRequestFilters) =>
    api.getRaw<PaginatedResponse<StaffPortalRequest>>(A.REQUESTS, { params: filters }),
  decideRequest: (id: number, body: StaffRequestDecisionBody) =>
    api.post<StaffPortalRequest>(A.REQUEST_DECIDE(id), body),

  announcements: (params: { page: number; per_page: number; status?: string }) =>
    api.getRaw<PaginatedResponse<StaffAnnouncement>>(A.ANNOUNCEMENTS, { params }),
  createAnnouncement: (body: AnnouncementInput) => api.post<StaffAnnouncement>(A.ANNOUNCEMENTS, body),
  updateAnnouncement: (id: number, body: AnnouncementInput) =>
    api.put<StaffAnnouncement>(A.ANNOUNCEMENT(id), body),
  deleteAnnouncement: (id: number) => api.delete<void>(A.ANNOUNCEMENT(id)),

  tickets: (filters: StaffTicketFilters) =>
    api.getRaw<PaginatedResponse<StaffSupportTicket>>(A.TICKETS, { params: filters }),
  /** A reply the member sees, and the ticket's new status. */
  replyToTicket: (id: number, body: { message: string; status: TicketStatus }) =>
    api.post<StaffSupportTicket>(A.TICKET_REPLY(id), body),
};
