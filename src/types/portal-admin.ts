/**
 * The Member Portal's staff side (`/portal-admin`), as lendyph-backend sends
 * it (portal design §3; backend #287, #289, #291). Money is a two-decimal
 * string from the server and is shown as sent; the browser never works a
 * figure out. Keys the screens show go through explicit word maps.
 */

import type { SavingsApproval, SavingsMethod, SavingsTransaction } from "./savings";

/** A member's portal state in one word (`AccessDesk::STATES`). */
export type PortalAccessState = "not_invited" | "invited" | "active" | "locked" | "disabled";

/** Why staff turn access off (`PortalUser::STAFF_DISABLE_REASONS`). */
export type PortalStaffDisableReason = "member_request" | "security_concern" | "duplicate_account" | "administrative";

/** Every reason the server may store: the staff ones plus the membership ending. */
export type PortalDisableReason = PortalStaffDisableReason | "membership_ended" | "deceased";

export type PortalCodeKind = "activation" | "reset";
export type PortalCodeStatus = "open" | "used" | "superseded" | "burned" | "expired";

/** The valid ID a staff member checked before issuing a code (`CodeDesk::IDENTITY_TYPES`). */
export type PortalIdentityType =
  | "philippine_id"
  | "drivers_license"
  | "passport"
  | "sss"
  | "umid"
  | "voters_id"
  | "postal_id"
  | "prc_id"
  | "tin_id"
  | "others";

export interface PortalUserRef {
  id: number;
  name: string;
}

/** `GET /portal-admin/members/{borrower}/access`. Never the code itself. */
export interface PortalAccessCard {
  member: {
    id: number;
    name: string;
    member_number: string;
    status: string;
    has_birthdate: boolean;
  };
  state: PortalAccessState;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  locked_until: string | null;
  disabled_reason: PortalDisableReason | null;
  terms_version: string | null;
  code: { kind: PortalCodeKind; expires_at: string; status: PortalCodeStatus } | null;
  /** Only on the unlock answer. */
  unlocked?: boolean;
}

/** The slip the code dialog prints (`CodeDesk::slip`). The address is a path only. */
export interface PortalCodeSlip {
  title: string;
  member_name: string;
  member_number: string;
  code: string;
  expires_at: string;
  /** "12 Nov 2026, 3:00 PM (Philippine time)". */
  expires_at_text: string;
  /** "/member": the screen builds the full address from the app's own URL. */
  portal_path: string;
  instructions: string[];
}

/** The 201 body of an invite or a reset code: shown once, never again. */
export interface PortalIssuedCode {
  code: string;
  kind: PortalCodeKind;
  expires_at: string;
  slip: PortalCodeSlip;
}

export interface PortalCommunication {
  date: string | null;
  kind: string;
  description: string;
}

/** `GET /portal-admin/stats`. Counts only. */
export interface PortalStats {
  eligible: number;
  invited: number;
  codes_expired: number;
  active: number;
  active_this_month: number;
  never_signed_in: number;
  locked: number;
  disabled: number;
}

export interface PortalAccountRow {
  borrower_id: number;
  member_number: string;
  full_name: string;
  branch: { id: number; name: string } | null;
  member_status: string;
  state: PortalAccessState;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  /** Null without `borrowers:view`. */
  contact_number: string | null;
  email: string | null;
}

export interface PortalPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PortalAccountsPage {
  data: PortalAccountRow[];
  meta: PortalPageMeta;
}

export interface PortalAccountsQuery {
  status?: PortalAccessState;
  branch_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

// ── Requests ──

export type PortalRequestType = "profile_update" | "savings_withdrawal" | "savings_opening";

export type PortalRequestStatus =
  | "submitted"
  | "under_review"
  | "need_info"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled"
  | "expired";

export type PortalRequestDecision = "under_review" | "need_info" | "approve" | "reject";

export type PortalWithdrawalMethod = "cash_pickup" | "bank_transfer" | "gcash";

export interface PortalRequestRow {
  id: number;
  reference: string;
  type: PortalRequestType;
  status: PortalRequestStatus;
  /** The server's one-line summary, ₱ amounts included. */
  summary: string;
  amount: string | null;
  member: { id: number; name: string; member_number: string } | null;
  branch: { id: number; name: string } | null;
  expires_on: string | null;
  decided_by: PortalUserRef | null;
  decided_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PortalProfileChange {
  field: string;
  label: string;
  current: string | null;
  requested: string | null;
}

export interface PortalWithdrawalDetails {
  account_id: number | null;
  account_number: string | null;
  product_name: string | null;
  method: PortalWithdrawalMethod | null;
  /** Numbers in full with `savings:view`, else masked to the last 4. */
  payout: {
    bank_name: string | null;
    account_name: string | null;
    account_number: string | null;
    gcash_number: string | null;
  };
}

export interface PortalOpeningDetails {
  product_id: number | null;
  product_name: string | null;
  initial_deposit: string | null;
}

export interface PortalProfileDetails {
  changes: PortalProfileChange[];
}

export interface PortalRequestEvent {
  from_status: PortalRequestStatus | null;
  to_status: PortalRequestStatus;
  actor: "member" | "staff" | "system";
  user: PortalUserRef | null;
  message: string | null;
  created_at: string | null;
}

export interface PortalRequestDetail extends PortalRequestRow {
  details: Partial<PortalWithdrawalDetails & PortalOpeningDetails & PortalProfileDetails>;
  hold: { id: number; amount: string; status: string; expires_on: string | null } | null;
  approval: SavingsApproval | null;
  transaction: SavingsTransaction | null;
  opened_account: { id: number; account_number: string } | null;
  timeline: PortalRequestEvent[];
}

export interface PortalRequestsPage {
  data: PortalRequestRow[];
  meta: PortalPageMeta & { counts: Record<PortalRequestStatus, number> };
}

export interface PortalRequestsQuery {
  type?: PortalRequestType;
  status?: PortalRequestStatus;
  branch_id?: number;
  search?: string;
  page?: number;
}

/** Payout or deposit details: the date (today or yesterday), the method and a reference. */
export interface PortalMoneyDetails {
  date: string;
  method: SavingsMethod | "";
  reference: string;
}

export interface PortalDecisionInput {
  decision: PortalRequestDecision;
  message?: string;
  payout?: { date: string; method: string; reference?: string };
  deposit?: { date: string; method?: string; reference?: string };
}

/**
 * What a decision came back with: 200 (moved, or a profile written), 201
 * (posted or opened) or 202 (waiting for the second approval in the savings
 * approvals queue).
 */
export interface PortalDecisionResult {
  status: number;
  request: PortalRequestDetail;
}

// ── Announcements ──

export type PortalAnnouncementAudience = "all" | "branch" | "member_type";
export type PortalAnnouncementStatus = "draft" | "published" | "withdrawn";
export type PortalMemberType = "regular" | "associate";

export interface PortalAnnouncement {
  id: number;
  title: string;
  body: string;
  audience: PortalAnnouncementAudience;
  branch_ids: number[];
  branches: { id: number; name: string }[];
  member_types: PortalMemberType[];
  publish_at: string | null;
  expires_at: string | null;
  pinned: boolean;
  status: PortalAnnouncementStatus;
  /** Published, started and not expired: members see it now. */
  live: boolean;
  reads_count: number;
  created_by: PortalUserRef | null;
  published_by: PortalUserRef | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PortalAnnouncementsPage {
  data: PortalAnnouncement[];
  meta: PortalPageMeta;
}

export interface PortalAnnouncementInput {
  title: string;
  body: string;
  audience: PortalAnnouncementAudience;
  branch_ids?: number[];
  member_types?: PortalMemberType[];
  publish_at?: string | null;
  expires_at?: string | null;
  pinned?: boolean;
}

// ── Settings ──

export type PortalFeature =
  | "loans"
  | "share_capital"
  | "savings"
  | "time_deposits"
  | "statements"
  | "documents"
  | "announcements"
  | "account_requests"
  | "profile_requests"
  | "withdrawal_requests";

export type PortalDashboardCard =
  | "share_capital"
  | "savings"
  | "time_deposits"
  | "loans"
  | "next_payment"
  | "announcements"
  | "recent_activity";

export interface PortalTermsSummary {
  version: string;
  title: string;
  requires_reacceptance: boolean;
  published_at: string | null;
}

/** `GET /portal-admin/settings` (member_portal:settings and branches:view_all). */
export interface PortalSettings {
  enabled: boolean;
  portal_name: string;
  welcome_message: string | null;
  support_contact: string | null;
  payment_instructions: string | null;
  session_minutes: number;
  idle_minutes: number;
  max_login_attempts: number;
  lockout_minutes: number;
  hard_lock_after: number;
  password_min_length: number;
  activation_code_hours: number;
  reset_code_hours: number;
  otp_required: boolean;
  /** Why OTP can't be switched on now, in words, or null. */
  otp_blocked_reason: string | null;
  features: Partial<Record<PortalFeature, boolean>>;
  dashboard_cards: PortalDashboardCard[];
  withdrawal_methods: PortalWithdrawalMethod[];
  withdrawal_hold_days: number;
  request_expiry_days: number;
  terms: PortalTermsSummary | null;
  updated_by: PortalUserRef | null;
  updated_at: string | null;
}

export type PortalSettingsInput = Partial<
  Omit<PortalSettings, "otp_blocked_reason" | "terms" | "updated_by" | "updated_at">
>;

export interface PortalTermsInput {
  version: string;
  title: string;
  terms_body: string;
  privacy_body: string;
  consent_body?: string;
  requires_reacceptance: boolean;
}

/** `POST /portal-admin/members/{borrower}/documents/{share,unshare}`. */
export interface PortalShareResult {
  id: number;
  shared: boolean;
  portal_shared_at: string | null;
}
