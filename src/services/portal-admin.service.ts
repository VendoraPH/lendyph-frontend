import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import type {
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
  StaffProfileRequest,
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
};
