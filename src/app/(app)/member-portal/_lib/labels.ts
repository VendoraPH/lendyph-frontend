import type {
  PortalAccessState,
  PortalAnnouncementAudience,
  PortalAnnouncementStatus,
  PortalCodeKind,
  PortalCodeStatus,
  PortalDashboardCard,
  PortalDisableReason,
  PortalFeature,
  PortalIdentityType,
  PortalMemberType,
  PortalRequestStatus,
  PortalRequestType,
  PortalStaffDisableReason,
  PortalWithdrawalMethod,
} from "@/types/portal-admin";

/**
 * The staff portal screens' words. Every key the server sends is read through
 * one of these maps; a key with no words reads "Other", never the key itself.
 * Adapted from #511 and #514 by Augustin (`lib/portal/labels.ts`), on the
 * server's real keys.
 */

/** A key the screen has no words for reads as this, never as the raw key. */
export const UNKNOWN_LABEL = "Other";

/** The words for `key`, or "Other"; "—" when there is no key. */
export function labelOf<K extends string>(map: Record<K, string>, key: string | null | undefined): string {
  if (key === null || key === undefined || key === "") return "—";
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key as K] : UNKNOWN_LABEL;
}

export type Tone = "success" | "warning" | "danger" | "info" | "muted";

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400",
  muted: "bg-muted text-muted-foreground border-border",
};

/** The tone for `key`, or muted. */
export function toneOf<K extends string>(map: Record<K, Tone>, key: string | null | undefined): Tone {
  return key && Object.prototype.hasOwnProperty.call(map, key) ? map[key as K] : "muted";
}

export const ACCESS_STATE_LABELS: Record<PortalAccessState, string> = {
  not_invited: "Not invited",
  invited: "Invited",
  active: "Active",
  locked: "Locked",
  disabled: "Turned off",
};

export const ACCESS_STATE_TONES: Record<PortalAccessState, Tone> = {
  not_invited: "muted",
  invited: "info",
  active: "success",
  locked: "warning",
  disabled: "danger",
};

/** The reasons staff may pick when turning access off. */
export const STAFF_DISABLE_REASON_LABELS: Record<PortalStaffDisableReason, string> = {
  member_request: "The member asked for it",
  security_concern: "Security concern",
  duplicate_account: "Duplicate account",
  administrative: "Administrative reason",
};

/** Every reason the server may store, the membership ending included. */
export const DISABLE_REASON_LABELS: Record<PortalDisableReason, string> = {
  ...STAFF_DISABLE_REASON_LABELS,
  membership_ended: "Membership ended",
  deceased: "Member deceased",
};

export const CODE_KIND_LABELS: Record<PortalCodeKind, string> = {
  activation: "Activation code",
  reset: "Password reset code",
};

export const CODE_STATUS_LABELS: Record<PortalCodeStatus, string> = {
  open: "Not used yet",
  used: "Used",
  superseded: "Replaced by a newer code",
  burned: "Blocked after 5 wrong tries",
  expired: "Expired",
};

/** The valid IDs staff may have checked, in the server's words (`CodeDesk::IDENTITY_TYPES`). */
export const IDENTITY_TYPE_LABELS: Record<PortalIdentityType, string> = {
  philippine_id: "Philippine National ID (PhilSys)",
  drivers_license: "Driver's License",
  passport: "Passport",
  sss: "SSS ID",
  umid: "UMID",
  voters_id: "Voter's ID",
  postal_id: "Postal ID",
  prc_id: "PRC ID",
  tin_id: "TIN ID",
  others: "Others",
};

/** A member's own status, as the member pages word it. */
export const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending approval",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  deceased: "Deceased",
};

export const REQUEST_TYPE_LABELS: Record<PortalRequestType, string> = {
  profile_update: "Profile change",
  savings_withdrawal: "Savings withdrawal",
  savings_opening: "New savings account",
};

export const REQUEST_STATUS_LABELS: Record<PortalRequestStatus, string> = {
  submitted: "New",
  under_review: "Under review",
  need_info: "Waiting for the member",
  approved: "Waiting for a second approval",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled by the member",
  expired: "Expired",
};

export const REQUEST_STATUS_TONES: Record<PortalRequestStatus, Tone> = {
  submitted: "info",
  under_review: "info",
  need_info: "warning",
  approved: "warning",
  completed: "success",
  rejected: "danger",
  cancelled: "muted",
  expired: "muted",
};

/** The queue's tabs, in the order a request moves. */
export const REQUEST_STATUSES: readonly PortalRequestStatus[] = [
  "submitted",
  "under_review",
  "need_info",
  "approved",
  "completed",
  "rejected",
  "cancelled",
  "expired",
];

export const ACTOR_LABELS: Record<"member" | "staff" | "system", string> = {
  member: "Member",
  staff: "Staff",
  system: "System",
};

/** How the member asked to be paid. */
export const WITHDRAWAL_METHOD_LABELS: Record<PortalWithdrawalMethod, string> = {
  cash_pickup: "Cash pickup at the branch",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
};

export const AUDIENCE_LABELS: Record<PortalAnnouncementAudience, string> = {
  all: "All members",
  branch: "Members of some branches",
  member_type: "A member type",
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<PortalAnnouncementStatus, string> = {
  draft: "Draft",
  published: "Published",
  withdrawn: "Withdrawn",
};

export const MEMBER_TYPE_LABELS: Record<PortalMemberType, string> = {
  regular: "Regular members",
  associate: "Associate members",
};

/** The portal's parts a cooperative can switch off. */
export const FEATURE_LABELS: Record<PortalFeature, string> = {
  loans: "Loans",
  share_capital: "Share capital",
  savings: "Savings",
  time_deposits: "Time deposits",
  statements: "Statements (PDF)",
  documents: "Shared documents",
  announcements: "Announcements",
  account_requests: "New savings account requests",
  profile_requests: "Profile change requests",
  withdrawal_requests: "Withdrawal requests",
};

export const DASHBOARD_CARD_LABELS: Record<PortalDashboardCard, string> = {
  share_capital: "Share capital",
  savings: "Savings",
  time_deposits: "Time deposits",
  loans: "Loans",
  next_payment: "Next payment",
  announcements: "Announcements",
  recent_activity: "Recent activity",
};

/** Options for a select, from a word map. */
export function optionsOf<K extends string>(map: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(map) as K[]).map((value) => ({ value, label: map[value] }));
}
