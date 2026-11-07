/**
 * Member self-service portal. Contract: docs/MEMBER_PORTAL_BACKEND_HANDOFF.md.
 *
 * Money arrives as decimal strings or numbers; read it with `toNumber`-style
 * coercion at the edge, never do arithmetic on the raw value. Dates are
 * `YYYY-MM-DD`; timestamps are UTC ISO strings.
 */

export type Money = number | string;

// ── Configuration (public: drives the login screen and the shell) ──────────

export type PortalLoginIdentifier = "email" | "mobile" | "membership_number";
export type PortalOtpMethod = "sms" | "email";
export type CreditScoreVisibility = "hidden" | "category" | "score" | "score_factors";

export interface PortalFeatures {
  share_capital: boolean;
  savings: boolean;
  time_deposits: boolean;
  loans: boolean;
  credit_score: CreditScoreVisibility;
  documents: boolean;
  loan_applications: boolean;
  withdrawal_requests: boolean;
  profile_updates: boolean;
  gcash_payments: boolean;
  statements: boolean;
}

export type DashboardCardKey =
  | "share_capital"
  | "savings"
  | "time_deposits"
  | "loans"
  | "next_payment"
  | "announcements";

export interface PasswordRules {
  min_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_symbol: boolean;
}

/** GET /portal/config — public, no token. */
export interface PortalConfig {
  enabled: boolean;
  portal_name: string;
  logo_url: string | null;
  welcome_message: string | null;
  support_contact: string | null;
  login_identifiers: PortalLoginIdentifier[];
  self_registration: boolean;
  otp_method: PortalOtpMethod;
  password_rules: PasswordRules;
  terms_version: string;
  terms_url: string | null;
  privacy_url: string | null;
  features: PortalFeatures;
  dashboard_cards: DashboardCardKey[];
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface PortalMember {
  member_id: number;
  member_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  branch_name: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
}

export interface PortalLoginRequest {
  identifier_type: PortalLoginIdentifier;
  identifier: string;
  password: string;
}

export interface PortalLoginResponse {
  token: string;
  expires_in: number;
  member: PortalMember;
}

/** Step 1 of activation: an invitation token, or membership number + mobile/email. */
export interface ActivationVerifyRequest {
  invitation_token?: string;
  member_number?: string;
  contact?: string;
  birthdate?: string;
}

export interface ActivationChallenge {
  /** Opaque, short-lived; carried through the OTP and password steps. */
  challenge_id: string;
  /** Where the code went, already masked ("+63 9** *** 4821"). */
  sent_to: string;
  expires_in: number;
  member_first_name: string;
}

export interface ActivationOtpRequest {
  challenge_id: string;
  otp: string;
}

export interface ActivationCompleteRequest {
  challenge_id: string;
  password: string;
  password_confirmation: string;
  accepted_terms_version: string;
  electronic_communication_consent: boolean;
}

export interface ForgotPasswordRequest {
  identifier_type: PortalLoginIdentifier;
  identifier: string;
}

export interface ResetPasswordRequest {
  challenge_id: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export type MembershipStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "pending"
  | "withdrawn"
  | "closed"
  | "deceased"
  | (string & {});

export interface ActivityItem {
  id: string;
  date: string;
  kind: "loan_payment" | "savings" | "share_capital" | "loan" | "request" | "other";
  description: string;
  amount: Money | null;
}

/** GET /portal/dashboard — one aggregated call instead of one per module. */
export interface PortalDashboard {
  member: {
    first_name: string;
    member_number: string;
    member_since: string | null;
    status: MembershipStatus;
    branch_name: string | null;
  };
  share_capital: { total: Money } | null;
  savings: { total: Money; available: Money } | null;
  time_deposits: { total: Money; count: number } | null;
  loans: { outstanding: Money; active_count: number } | null;
  next_payment: { amount: Money; due_date: string; loan_number: string } | null;
  pending_requests: number;
  unread_notifications: number;
  documents: number;
  announcements: { id: number; title: string; published_at: string }[];
  recent_activity: ActivityItem[];
}

// ── Membership ─────────────────────────────────────────────────────────────

export type StandingValue = "good" | "attention" | "not_applicable";

export interface StandingItem {
  key: string;
  label: string;
  value: string;
  state: StandingValue;
}

export interface RequirementItem {
  key: string;
  label: string;
  complete: boolean;
  detail: string | null;
}

export interface PortalBranch {
  name: string;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  office_hours: string | null;
  contact_person: string | null;
}

/** GET /portal/membership */
export interface PortalMembership {
  member_number: string;
  membership_type: string | null;
  membership_category: string | null;
  status: MembershipStatus;
  date_joined: string | null;
  account_standing: string | null;
  share_capital: Money | null;
  branch: PortalBranch | null;
  standing: StandingItem[];
  requirements: RequirementItem[];
}

// ── Profile ────────────────────────────────────────────────────────────────

/** GET /portal/profile. Sensitive values arrive already masked by the server. */
export interface PortalProfile {
  full_name: string;
  birthdate: string | null;
  civil_status: string | null;
  gender: string | null;
  address: string | null;
  mobile: string | null;
  email: string | null;
  occupation: string | null;
  employer: string | null;
  member_number: string;
  branch_name: string | null;
  government_id: string | null;
  beneficiary: string | null;
}

export type ProfileUpdateField =
  | "address"
  | "mobile"
  | "email"
  | "civil_status"
  | "occupation"
  | "employer"
  | "beneficiary";

export type ProfileRequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "need_info";

export interface ProfileUpdateChange {
  field: ProfileUpdateField;
  current: string | null;
  requested: string;
}

export interface ProfileUpdateRequest {
  id: number;
  reference: string;
  status: ProfileRequestStatus;
  changes: ProfileUpdateChange[];
  remarks: string | null;
  /** Shown to the member: the staff reply when rejected or asking for info. */
  response: string | null;
  submitted_at: string;
  decided_at: string | null;
}

export interface ProfileUpdateSubmit {
  changes: { field: ProfileUpdateField; requested: string }[];
  remarks?: string;
}

// ── Security ───────────────────────────────────────────────────────────────

export interface PortalSession {
  id: number;
  device: string;
  ip_address: string | null;
  location: string | null;
  last_active_at: string;
  current: boolean;
}

export interface PortalLogin {
  id: number;
  at: string;
  device: string;
  ip_address: string | null;
  location: string | null;
  success: boolean;
  reported: boolean;
}

// ── Staff side ─────────────────────────────────────────────────────────────

export type PortalAccountStatus =
  | "not_invited"
  | "invitation_sent"
  | "registered"
  | "active"
  | "locked"
  | "disabled";

export type PortalDisableReason =
  | "member_request"
  | "membership_terminated"
  | "security_concern"
  | "deceased"
  | "duplicate_account"
  | "administrative";

/** GET /portal-admin/members/{id}/access */
export interface PortalAccess {
  borrower_id: number;
  enabled: boolean;
  status: PortalAccountStatus;
  invited_at: string | null;
  registered_at: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  disabled_reason: PortalDisableReason | null;
  terms_version_accepted: string | null;
  terms_accepted_at: string | null;
}

export interface PortalAccessUpdate {
  enabled: boolean;
  disabled_reason?: PortalDisableReason;
}

export interface PortalCommunication {
  id: number;
  at: string;
  kind: string;
  channel: "sms" | "email" | "in_app";
  description: string;
}

/** A row of GET /portal-admin/accounts. */
export interface PortalAccountRow {
  borrower_id: number;
  member_number: string;
  full_name: string;
  branch_name: string | null;
  membership_type: string | null;
  email: string | null;
  mobile: string | null;
  status: PortalAccountStatus;
  last_login_at: string | null;
}

export interface PortalAccountFilters {
  page?: number;
  per_page?: number;
  search?: string;
  status?: PortalAccountStatus;
  branch_id?: number;
  has_email?: boolean;
  has_mobile?: boolean;
}

/** GET /portal-admin/stats */
export interface PortalStats {
  total_members: number;
  eligible: number;
  activated: number;
  registered: number;
  active_this_month: number;
  never_logged_in: number;
  locked: number;
  invitations_pending: number;
}

export interface BulkInviteRequest {
  borrower_ids: number[];
}

export interface BulkInviteResult {
  invited: number;
  skipped: { borrower_id: number; reason: string }[];
}

/** A row of GET /portal-admin/profile-requests. */
export interface StaffProfileRequest extends ProfileUpdateRequest {
  borrower_id: number;
  member_name: string;
  member_number: string;
}

export interface ProfileRequestDecision {
  decision: "approve" | "reject" | "need_info";
  response?: string;
}

/** GET/PUT /portal-admin/settings — everything the public config shows, plus security. */
export interface PortalSettings {
  enabled: boolean;
  portal_name: string;
  welcome_message: string | null;
  support_contact: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  terms_version: string;
  require_reacceptance: boolean;
  invitation_only: boolean;
  self_registration: boolean;
  login_identifiers: PortalLoginIdentifier[];
  otp_method: PortalOtpMethod;
  session_minutes: number;
  password_rules: PasswordRules;
  max_login_attempts: number;
  lockout_minutes: number;
  features: PortalFeatures;
  dashboard_cards: DashboardCardKey[];
  deceased_policy: "disable" | "read_only";
}

// ── Finances (PR2) ─────────────────────────────────────────────────────────

export type PortalLoanStatus = "active" | "past_due" | "restructured" | "paid" | "written_off" | "pending" | "approved";

/** A row of GET /portal/loans. */
export interface PortalLoanSummary {
  id: number;
  loan_number: string;
  product_name: string;
  status: PortalLoanStatus;
  principal: Money;
  outstanding_balance: Money;
  past_due_amount: Money;
  next_due_date: string | null;
  next_due_amount: Money | null;
  released_at: string | null;
  maturity_date: string | null;
}

export interface PortalCollateral {
  id: number;
  type: string;
  description: string;
  appraised_value: Money | null;
}

/** GET /portal/loans/{id} */
export interface PortalLoanDetail extends PortalLoanSummary {
  term: number;
  term_unit: string;
  frequency: string;
  interest_rate: number;
  interest_method: string;
  total_payable: Money;
  total_paid: Money;
  penalty_balance: Money;
  collaterals: PortalCollateral[];
  co_makers: { name: string }[];
}

export type ScheduleRowStatus = "paid" | "partial" | "due" | "overdue" | "upcoming";

/** A row of GET /portal/loans/{id}/schedule */
export interface PortalScheduleRow {
  installment_no: number;
  due_date: string;
  principal: Money;
  interest: Money;
  total_due: Money;
  amount_paid: Money;
  balance: Money;
  status: ScheduleRowStatus;
}

/** A row of GET /portal/payments and /portal/loans/{id}/payments */
export interface PortalPayment {
  id: number;
  receipt_number: string;
  paid_at: string;
  amount: Money;
  loan_id: number | null;
  loan_number: string | null;
  method: string;
  principal: Money;
  interest: Money;
  penalty: Money;
  has_receipt: boolean;
}

export interface PortalPaymentFilters {
  page?: number;
  per_page?: number;
  loan_id?: number;
}

/** GET /portal/share-capital */
export interface PortalShareCapital {
  subscribed: Money;
  paid_up: Money;
  unpaid_subscription: Money;
  share_count: number | null;
  last_transaction_at: string | null;
}

/** A row of any member ledger (share capital, savings). */
export interface PortalLedgerEntry {
  id: number;
  date: string;
  description: string;
  reference: string | null;
  debit: Money;
  credit: Money;
  balance: Money;
}

/** A row of GET /portal/savings */
export interface PortalSavingsAccount {
  id: number;
  account_number: string;
  product_name: string;
  status: string;
  balance: Money;
  available_balance: Money;
  interest_rate: number;
  opened_at: string | null;
}

/** A row of GET /portal/time-deposits */
export interface PortalTimeDeposit {
  id: number;
  certificate_number: string;
  principal: Money;
  interest_rate: number;
  term_days: number;
  placed_at: string;
  maturity_date: string;
  maturity_value: Money;
  status: "active" | "matured" | "withdrawn" | "rolled_over";
}

/** POST /portal/payments/gcash */
export interface GCashPaymentRequest {
  loan_id: number;
  amount: number;
}

export interface GCashCheckout {
  reference: string;
  checkout_url: string;
}

export type StatementKind = "consolidated" | "loan" | "savings" | "share_capital";

export interface StatementRequest {
  kind: StatementKind;
  account_id?: number;
  from: string;
  to: string;
}
