/**
 * The member portal's API shapes, as the backend sends them (portal design §3,
 * backend `app/Services/Portal/**`). Money is always the server's two-decimal
 * peso string ("1500.00"); the browser only shows it.
 */

/** A two-decimal peso string from the server. Never parsed for maths. */
export type Pesos = string;

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

export type PortalFeatures = Partial<Record<PortalFeature, boolean>>;

export interface PasswordRules {
  min_length: number;
  max_length: number;
  needs_letter: boolean;
  needs_number: boolean;
  no_member_number: boolean;
}

export interface PortalConfig {
  enabled: boolean;
  portal_name: string | null;
  logo_url: string | null;
  welcome_message: string | null;
  support_contact: string | null;
  password_rules: PasswordRules;
  otp_required: boolean;
  session_minutes: number;
  idle_minutes: number;
  terms: { version: string; title: string } | null;
  features: PortalFeatures;
  dashboard_cards: string[];
}

export interface PortalTerms {
  version: string;
  title: string;
  terms_body: string;
  privacy_body: string;
  consent_body: string | null;
  requires_reacceptance: boolean;
  published_at: string | null;
}

/** What the session keeps about the member: names and numbers, never money. */
export interface PortalMember {
  first_name: string;
  member_number: string;
  full_name?: string | null;
  branch_name?: string | null;
}

export interface LoginResponse {
  token: string;
  expires_in: number | null;
  idle_minutes: number;
  member: { first_name: string; member_number: string };
  terms_required: boolean;
}

export interface MeResponse {
  member: {
    first_name: string;
    last_name: string | null;
    full_name: string | null;
    member_number: string;
    branch_name: string | null;
  };
  account: {
    status: string;
    last_login_at: string | null;
    password_changed_at: string | null;
    terms_version: string | null;
    ecomm_consent: boolean;
  };
  terms_required: boolean;
  terms: { version: string | null };
  session: { expires_at: string | null; idle_minutes: number };
  features: PortalFeatures;
}

export type CodeKind = "activation" | "reset";

export interface CodeVerifyResponse {
  step_token: string;
  kind: CodeKind;
  first_name: string;
  otp_required: boolean;
  sent_to: string | null;
  terms: { version: string | null };
}

export interface PortalSession {
  id: number;
  device: string;
  ip_address: string | null;
  created_at: string;
  last_active_at: string;
  expires_at: string | null;
  current: boolean;
}

export interface PortalLoginEvent {
  id: number;
  outcome: string;
  outcome_label: string;
  device: string | null;
  ip_address: string | null;
  created_at: string;
  reported_at: string | null;
}

export interface ReportResult {
  reported_at: string;
  sessions_ended: number;
  password_change_required: boolean;
}

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Paged<T, M = object> {
  data: T[];
  meta: PageMeta & M;
}

export interface Dashboard {
  member: {
    first_name: string;
    member_number: string;
    member_since: string | null;
    status: string;
    branch_name: string | null;
  };
  share_capital: { paid_up: Pesos } | null;
  savings: { total: Pesos; available: Pesos; accounts: number } | null;
  time_deposits: { total: Pesos; count: number } | null;
  loans: { total_outstanding: Pesos; active_count: number; overdue_amount: Pesos } | null;
  next_payment: { due_date: string; amount: Pesos; loans_count: number } | null;
  pending_requests: number;
  unread: { notifications: number; announcements: number };
  documents: number | null;
  announcements: { id: number; title: string; publish_at: string | null; pinned: boolean }[] | null;
  recent_activity: { date: string; kind: string; description: string; amount: Pesos }[] | null;
}

export interface Membership {
  member_number: string;
  member_type: string | null;
  status: string;
  membership_date: string | null;
  branch: { name: string | null; address: string | null; contact_number: string | null };
  standing: { key: string; label: string; status: string; amount: Pesos | null }[];
  support_contact: string | null;
}

export interface ProfileField {
  key: string;
  label: string;
  value: string | null;
  masked: boolean;
}

export interface Profile {
  fields: ProfileField[];
  editable_fields: string[];
}

export interface LoanRow {
  id: number;
  loan_account_number: string;
  product_name: string | null;
  display_status: string | null;
  release_date: string | null;
  maturity_date: string | null;
  principal_amount: Pesos;
  total_outstanding: Pesos;
  outstanding_principal: Pesos;
  overdue_amount: Pesos;
  next_due_date: string | null;
  next_due_amount: Pesos;
  paid_percent: number;
  penalty_months: number;
}

export interface LoanDetail extends LoanRow {
  term: number | null;
  term_unit: string | null;
  frequency: string | null;
  interest_rate: string | null;
  interest_rate_frequency: string | null;
  interest_method: string | null;
  outstanding_interest: Pesos;
  outstanding_penalty: Pesos;
  insurance_owed: Pesos;
  total_repaid: Pesos;
  principal_paid: Pesos;
  interest_paid: Pesos;
  penalty_paid: Pesos;
}

export interface MoneyParts {
  due?: Pesos;
  charged?: Pesos;
  paid: Pesos;
  balance: Pesos;
}

export interface SchedulePeriod {
  period_number: number;
  due_date: string;
  status: string;
  principal: MoneyParts;
  interest: MoneyParts;
  penalty: MoneyParts;
  balance: Pesos;
  penalty_months: number;
}

export interface LoanSchedule {
  periods: SchedulePeriod[];
  totals: {
    principal: MoneyParts;
    interest: MoneyParts;
    penalty: MoneyParts;
    paid: Pesos;
    insurance_owed: Pesos;
    balance: Pesos;
    overdue: Pesos;
  };
}

export interface LoanPayment {
  receipt_number: string | null;
  loan_account_number: string | null;
  payment_date: string | null;
  amount_paid: Pesos;
  principal: Pesos;
  interest: Pesos;
  penalty: Pesos;
  insurance: Pesos;
  build_up: Pesos;
  method: string | null;
  reference_number: string | null;
}

export interface ShareCapital {
  paid_up: Pesos;
  pledged: Pesos;
  remaining_pledge: Pesos;
  total_contributions: Pesos;
  last_contribution: { date: string; amount: Pesos } | null;
}

export interface ShareCapitalEntry {
  date: string;
  reference: string | null;
  description: string | null;
  debit: Pesos;
  credit: Pesos;
  running_balance: Pesos;
}

export interface SavingsAccount {
  id: number;
  account_number: string;
  product_name: string | null;
  status: string;
  ledger_balance: Pesos;
  held: Pesos;
  pending_withdrawal: Pesos;
  maintaining_balance: Pesos;
  available_balance: Pesos;
  withdrawable: Pesos;
  annual_rate: string | null;
  accrued_interest: Pesos;
  interest_credited_through: string | null;
  opened_on: string | null;
  branch_name: string | null;
  last_transaction_on: string | null;
}

export interface PassbookRow {
  date: string;
  reference: string | null;
  type: string;
  debit: Pesos;
  credit: Pesos;
  balance_after: Pesos;
}

export interface TimeDeposit {
  id: number;
  certificate_number: string;
  product_name: string | null;
  principal: Pesos;
  annual_rate: string | null;
  term_days: number;
  placement_date: string;
  maturity_date: string;
  days_remaining: number | null;
  maturing_soon: boolean;
  gross_interest: Pesos;
  withholding_tax: Pesos;
  net_interest: Pesos;
  maturity_amount: Pesos;
  maturity_instruction: string | null;
  status: string;
}

export interface SharedFile {
  id: number;
  title: string;
  category: string | null;
  shared_on: string | null;
  file_name: string | null;
  size: number | null;
}

export interface GeneratedDocument {
  kind: string;
  id: number | null;
  title: string;
  reference: string | null;
}

export interface Documents {
  files: SharedFile[];
  generated: GeneratedDocument[];
}

export interface PortalNotification {
  id: string;
  category: string | null;
  title: string | null;
  body: string | null;
  created_at: string;
  read_at: string | null;
  link: string | null;
}

export interface UnreadCount {
  notifications: number;
  announcements: number;
  total: number;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  publish_at: string | null;
  expires_at: string | null;
  pinned: boolean;
  read_at: string | null;
}

export type RequestType = "profile_update" | "savings_withdrawal" | "savings_opening";

export interface RequestRow {
  id: number;
  reference: string;
  type: string;
  status: string;
  summary: string;
  amount: Pesos | null;
  expires_on: string | null;
  created_at: string;
  updated_at: string;
  can_cancel: boolean;
  can_reply: boolean;
}

export interface RequestDetail extends RequestRow {
  details: {
    account_id?: number | null;
    account_number?: string | null;
    product_id?: number | null;
    product_name?: string | null;
    method?: string | null;
    initial_deposit?: Pesos | null;
    payout?: {
      bank_name: string | null;
      account_name: string | null;
      account_number: string | null;
      gcash_number: string | null;
    };
    changes?: { field: string; label: string; current: string | null; requested: string | null }[];
  };
  timeline: {
    from_status: string | null;
    to_status: string;
    actor: string;
    message: string | null;
    created_at: string;
  }[];
}

export interface RequestOptions {
  types: Partial<Record<RequestType, boolean>>;
  withdrawal_accounts: {
    id: number;
    account_number: string;
    product_name: string | null;
    withdrawable: Pesos;
    has_open_request: boolean;
  }[];
  payout_methods: string[];
  hold_days: number;
  opening_products: { id: number; name: string; minimum_opening_balance: Pesos }[];
  profile_fields: { field: string; label: string; current: string | null }[];
}
