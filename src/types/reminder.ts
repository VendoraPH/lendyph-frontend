/**
 * Automated due-date reminders.
 *
 * These types ARE the backend contract (`API_ENDPOINTS.REMINDERS`, served by
 * slice R2). The engine behind them is backend #232; its statuses, reason
 * codes and per-message `test_mode` are typed here.
 *
 * "Loan engine calculates. Reminder engine communicates." Every amount and
 * due date here is the server's figure for the live schedule, after partial
 * payments, restructures and grace periods. The frontend shows them; it never
 * works out what a member owes or whether a reminder should go out.
 */

export type ReminderChannel = "sms" | "email";

/** When a rule fires, relative to an installment's due date. */
export type ReminderTrigger = "before_due" | "on_due" | "after_due";

/**
 * Where a reminder is in its life.
 *
 * `cancelled` and `skipped` are NOT the same thing, and the UI keeps them
 * apart. Cancelled: the reminder became unnecessary (the installment was paid,
 * the loan closed or was restructured, the schedule changed, or a later
 * reminder the same day covers it). Skipped: it was still needed but could not
 * be sent (paused, member opted out, no valid contact, outside contact hours,
 * not on the allow-list, Collected by Auto-Pay).
 *
 * In test mode `sent` means "handed to the log driver": nothing reached the
 * member, and the screens read it as "Logged".
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

/**
 * Why a reminder was cancelled, skipped or failed: the engine's
 * `reason_code` (backend #232). The server also sends `reason` in words; the
 * code is the fallback, read by `REMINDER_REASON_LABELS` in `@/lib/reminders`.
 * Any other string is a code added on the server later.
 */
export type ReminderReasonCode =
  // cancelled: no longer needed
  | "paid"
  | "schedule_changed"
  | "nothing_due"
  | "loan_closed"
  | "rule_not_applicable"
  | "superseded"
  // skipped: still needed, not sendable
  | "rule_inactive"
  | "reminders_off"
  | "channel_off"
  | "auto_pay"
  | "paused"
  | "opted_out"
  | "no_contact"
  | "invalid_contact"
  | "contact_flagged"
  | "not_allowed"
  | "fire_date_passed"
  | "outside_contact_hours"
  | "template_unavailable"
  // failed
  | "not_set_up"
  | "retry_window_closed"
  | "interrupted"
  | "error"
  | "driver_error";

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
  /** Why it was cancelled or skipped, or why the last attempt failed, in words. */
  reason: string | null;
  /** The engine's code for `reason` (R2 to send it). */
  reason_code?: ReminderReasonCode | (string & {}) | null;
  attempts: number;
  source: ReminderSource;
  /**
   * True when its message was only logged (log-only driver, or live sending
   * off): nothing reached the member. R2 to send it from the message's own
   * `test_mode`; absent, the deployment's test mode applies.
   */
  test_mode?: boolean | null;
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
  /**
   * Exactly what was handed over, frozen at send time. Both are blanked
   * (null) 2 years after the loan closes; `redacted_at` says when.
   */
  subject: string | null;
  body: string | null;
  redacted_at?: string | null;
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
  /**
   * True when the message was only logged (log-only driver, or live sending
   * off): nothing reached the member. Stored per message by the engine
   * (`reminder_messages.test_mode`); R2 to send it.
   */
  test_mode?: boolean | null;
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
  /** A `sent`/`manual_sent` event whose message was only logged (R2 to send it). */
  test_mode?: boolean | null;
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
  /**
   * The template the server's own rules would pick for this loan right now
   * (e.g. `past_due`, or `long_past_due` past the escalation point). The
   * "Send reminder" dialog preselects it. Optional: when it is missing or
   * `null`, staff choose the template themselves; the browser never works it
   * out from dates.
   */
  suggested_template_type?: ReminderTemplateType | null;
  events: ReminderTimelineEvent[];
}

/**
 * `sent*` counts leave out logged-only messages; `logged*` counts are just
 * those (R2). An older answer without the `logged*` fields shows a dash.
 */
export interface ReminderDashboardCounts {
  today: number;
  sent: number;
  logged?: number;
  pending: number;
  failed: number;
  sms_sent: number;
  sms_logged?: number;
  emails_sent: number;
  emails_logged?: number;
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
    /** Leaves out logged-only messages. */
    sent_this_month: number;
    /** Logged-only messages this month (R2). */
    logged_this_month?: number;
    estimated_cost_this_month: number;
  };
  /** Last 7 days, oldest first; may be empty. */
  daily: ReminderDailyStat[];
  /** Today's and upcoming reminders, same rows as the queue. */
  items: ReminderQueueItem[];
  global_pause: ReminderPause | null;
  /**
   * The deployment's mode and the cooperative's switch, as on the settings:
   * a second source for test mode, for users who can't read the settings.
   */
  test_mode?: boolean;
  enabled?: boolean;
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
  /** The cooperative's own switch. It starts off. */
  enabled: boolean;
  /**
   * The server's answer to "does this deployment send nothing?": true while
   * the drivers are log-only, live sending is off, or no provider is set up.
   * Every reminder screen shows the test-mode banner while it is true (or
   * while `enabled` is off). Only `false` with `enabled` on counts as live, so
   * a server that leaves it out reads as test mode. Not in the original
   * contract: R2 to send it, read-only (a PUT ignores it).
   */
  test_mode?: boolean;
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
  extends Omit<ReminderSettings, "sms_provider" | "email_provider" | "test_mode"> {
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
