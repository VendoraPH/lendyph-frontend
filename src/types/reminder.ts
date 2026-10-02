/**
 * Automated due-date reminders.
 *
 * These types ARE the backend contract: no reminder endpoint exists yet (see
 * `API_ENDPOINTS.REMINDERS`), and the handoff in the commit that added this
 * file describes each one against these shapes.
 *
 * "Loan engine calculates. Reminder engine communicates." Every amount and
 * due date here is the server's figure for the live schedule, after partial
 * payments, restructures and grace periods. The frontend shows them; it never
 * works out what a borrower owes or whether a reminder should go out.
 */

export type ReminderChannel = "sms" | "email";

/** When a rule fires, relative to an installment's due date. */
export type ReminderTrigger = "before_due" | "on_due" | "after_due";

/**
 * Where a reminder is in its life.
 *
 * `cancelled` and `skipped` are NOT the same thing, and the UI keeps them
 * apart. Cancelled: the reminder became unnecessary (the installment was paid,
 * the loan closed or was restructured). Skipped: it was still needed but could
 * not be sent (no mobile number, borrower opted out, paused, outside contact
 * hours with no later slot that day).
 */
export type ReminderQueueStatus =
  | "scheduled"
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "skipped";

/** Provider-reported delivery state, on a message that was handed over. */
export type DeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "rejected"
  | "bounced"
  | "opened";

export type ReminderTemplateType =
  | "upcoming"
  | "due_today"
  | "past_due"
  | "long_past_due"
  | "partial_payment"
  | "payment_confirmation";

export type ReminderSource = "system" | "manual";

export type BorrowerType = "all" | "member" | "non_member";

/** Who or what a pause applies to. */
export type ReminderPauseScope = "global" | "borrower" | "loan";

export interface ReminderRule {
  id: number;
  name: string;
  trigger: ReminderTrigger;
  /** Days before/after the due date. Always 0 for `on_due`. */
  days: number;
  /** `HH:mm`, 24-hour, in the organization's timezone. */
  send_time: string;
  channels: ReminderChannel[];
  /** `null` means every branch / product. */
  branch_id: number | null;
  branch_name?: string | null;
  loan_product_id: number | null;
  loan_product_name?: string | null;
  borrower_type: BorrowerType;
  /** Template used for SMS and/or email; resolved per channel by type. */
  template_type: ReminderTemplateType;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ReminderRuleInput = Omit<
  ReminderRule,
  "id" | "branch_name" | "loan_product_name" | "created_at" | "updated_at"
>;

export interface ReminderTemplate {
  id: number;
  name: string;
  type: ReminderTemplateType;
  channel: ReminderChannel;
  /** Email only. */
  subject: string | null;
  /** May contain `{{variables}}`; see `TEMPLATE_VARIABLES` in `@/lib/reminders`. */
  body: string;
  language: string;
  is_active: boolean;
  updated_at?: string;
}

export type ReminderTemplateInput = Omit<ReminderTemplate, "id" | "updated_at">;

/** The server renders a template against a real loan (or its sample data). */
export interface TemplatePreviewRequest {
  channel: ReminderChannel;
  subject?: string | null;
  body: string;
  loan_id?: number;
}

export interface TemplatePreview {
  subject: string | null;
  body: string;
  /** Variables in the body the server does not recognise. */
  unknown_variables: string[];
}

export interface ReminderQueueItem {
  id: number;
  borrower_id: number;
  borrower_name: string;
  loan_id: number;
  loan_account_number: string;
  /** Installment (schedule period) number. */
  installment_number: number;
  due_date: string;
  /** Server-computed amount still due for this installment. */
  amount_due: number;
  rule_id: number | null;
  rule_name: string | null;
  channel: ReminderChannel;
  /** Masked: `0917•••4567`, `ju•••@gmail.com`. */
  recipient: string;
  scheduled_at: string;
  status: ReminderQueueStatus;
  /** Why it was cancelled or skipped, or why the last attempt failed. */
  reason: string | null;
  attempts: number;
  source: ReminderSource;
}

export interface ReminderMessage {
  id: number;
  queue_id: number | null;
  borrower_id: number;
  borrower_name: string;
  loan_id: number;
  loan_account_number: string;
  installment_number: number | null;
  channel: ReminderChannel;
  recipient: string;
  template_type: ReminderTemplateType | null;
  /** Exactly what was sent, frozen at send time. */
  subject: string | null;
  body: string;
  status: DeliveryStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  provider: string | null;
  provider_reference: string | null;
  attempts: number;
  failure_reason: string | null;
  source: ReminderSource;
  created_by_name: string | null;
  /** SMS segments billed, when the provider reports it. */
  segments?: number | null;
  cost?: number | null;
}

export type ReminderTimelineEventKind =
  | "scheduled"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "skipped"
  | "payment_received"
  | "paused"
  | "resumed"
  | "manual_sent";

/** One line of a loan's reminder story, oldest first. */
export interface ReminderTimelineEvent {
  id: string;
  kind: ReminderTimelineEventKind;
  at: string;
  /** Short line, e.g. "Upcoming due reminder — SMS". */
  title: string;
  detail: string | null;
  channel: ReminderChannel | null;
  installment_number: number | null;
}

export interface ReminderPause {
  id: number;
  scope: ReminderPauseScope;
  borrower_id: number | null;
  borrower_name?: string | null;
  loan_id: number | null;
  loan_account_number?: string | null;
  reason: string;
  paused_by_name: string;
  paused_at: string;
  /** Optional automatic end; `null` means until resumed. */
  until: string | null;
}

export interface PauseRequest {
  scope: ReminderPauseScope;
  borrower_id?: number;
  loan_id?: number;
  reason: string;
  until?: string | null;
}

export interface ResumeRequest {
  scope: ReminderPauseScope;
  borrower_id?: number;
  loan_id?: number;
}

export interface LoanReminderSummary {
  loan_id: number;
  /** Server's figure for the next installment, after partial payments. */
  next_due_date: string | null;
  next_amount_due: number | null;
  next_reminder_at: string | null;
  pause: ReminderPause | null;
  /** Borrower- or global-level pause that also stops this loan's reminders. */
  inherited_pause: ReminderPause | null;
  events: ReminderTimelineEvent[];
}

export interface ReminderDashboardCounts {
  today: number;
  sent: number;
  pending: number;
  failed: number;
  sms_sent: number;
  emails_sent: number;
  upcoming_due: number;
  overdue: number;
}

export interface ReminderDailyStat {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface ReminderDashboard {
  counts: ReminderDashboardCounts;
  sms: {
    /** `null` when the provider does not expose a balance. */
    credits_remaining: number | null;
    low_credit_threshold: number | null;
    sent_this_month: number;
    estimated_cost_this_month: number;
  };
  /** Last 7 days, oldest first; may be empty. */
  daily: ReminderDailyStat[];
  /** Today's and upcoming reminders, same rows as the queue. */
  items: ReminderQueueItem[];
  global_pause: ReminderPause | null;
}

export interface ReminderDashboardFilters {
  date?: string;
  branch_id?: number;
  channel?: ReminderChannel;
  status?: ReminderQueueStatus;
  loan_product_id?: number;
  search?: string;
}

export interface ReminderListFilters extends ReminderDashboardFilters {
  page?: number;
  per_page?: number;
  date_from?: string;
  date_to?: string;
  loan_id?: number;
  borrower_id?: number;
}

/** Message history filters: the same, except `status` is a delivery status. */
export interface ReminderHistoryFilters extends Omit<ReminderListFilters, "status"> {
  status?: DeliveryStatus;
}

export type SmsProvider = "semaphore" | "m360" | "twilio" | "other";
export type EmailProvider = "smtp" | "mailgun" | "ses" | "postmark" | "other";

export interface BranchReminderConfig {
  branch_id: number;
  branch_name: string;
  use_company_default: boolean;
  sender_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

/**
 * Credentials are WRITE-ONLY. The server never returns them; it says whether
 * they are set (`has_credentials`). To change them the client sends
 * `api_key`/`api_secret` on PUT; omitting them keeps what is stored.
 */
export interface ReminderSettings {
  enabled: boolean;
  timezone: string;
  default_send_time: string;
  channels: { sms: boolean; email: boolean };
  contact_hours: { start: string; end: string };
  retry: { max_attempts: number; delay_minutes: number };
  sms_provider: {
    provider: SmsProvider | null;
    sender_id: string;
    has_credentials: boolean;
    cost_per_segment: number | null;
  };
  email_provider: {
    provider: EmailProvider | null;
    sender_name: string;
    sender_email: string;
    reply_to: string | null;
    has_credentials: boolean;
  };
  payment_instructions: string;
  branches: BranchReminderConfig[];
}

export interface ReminderSettingsUpdate
  extends Omit<ReminderSettings, "sms_provider" | "email_provider"> {
  sms_provider: Omit<ReminderSettings["sms_provider"], "has_credentials"> & {
    api_key?: string;
    api_secret?: string;
  };
  email_provider: Omit<ReminderSettings["email_provider"], "has_credentials"> & {
    api_key?: string;
  };
}

export interface BorrowerNotificationPreferences {
  borrower_id: number;
  sms_enabled: boolean;
  email_enabled: boolean;
  preferred_channel: ReminderChannel | "both";
  language: string;
  mobile_number: string | null;
  mobile_verified: boolean;
  email: string | null;
  email_verified: boolean;
  /** Set when a past send proved the contact bad (invalid number, bounce). */
  invalid_contact_reason: string | null;
  pause: ReminderPause | null;
}

export type BorrowerNotificationPreferencesUpdate = Pick<
  BorrowerNotificationPreferences,
  "sms_enabled" | "email_enabled" | "preferred_channel" | "language"
>;

export type ManualSendChannel = ReminderChannel | "both";

export interface ManualReminderRequest {
  loan_id: number;
  channel: ManualSendChannel;
  template_type: ReminderTemplateType;
}

/**
 * What the server would send right now. `blocked_reasons` lists why it can't
 * (paused, no mobile number, outside contact hours, …); the dialog shows them
 * and disables Send instead of letting the request fail.
 */
export interface ManualReminderPreview {
  borrower_name: string;
  loan_account_number: string;
  installment_number: number | null;
  due_date: string | null;
  amount_due: number | null;
  messages: {
    channel: ReminderChannel;
    recipient: string | null;
    subject: string | null;
    body: string;
  }[];
  blocked_reasons: string[];
}

export interface ManualReminderResult {
  queued: ReminderQueueItem[];
}
