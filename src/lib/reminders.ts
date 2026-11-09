/**
 * Pure helpers for the reminders screens: labels, template variables, SMS
 * length, rule descriptions, form validation and the settings payload.
 *
 * None of this decides whether a reminder is sent or what it says to a real
 * member — the server owns eligibility and renders every real message.
 * `renderTemplateSample` is only the template editor's sample preview: fixed
 * sample values, never a figure worked out for a loan.
 *
 * Test mode: while the deployment sends nothing (log-only drivers, live
 * sending off, or the cooperative's switch off) every screen says so, and a
 * reminder that was only logged never reads as "Sent".
 */

import type {
  DeliveryStatus,
  ReminderChannel,
  ReminderDashboardCounts,
  ReminderMessage,
  ReminderQueueItem,
  ReminderQueueStatus,
  ReminderReasonCode,
  ReminderRuleInput,
  ReminderSettingsUpdate,
  ReminderTemplateType,
  ReminderTrigger,
} from "@/types/reminder";

const GREEN = "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-800";
const EMERALD = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800";
const BLUE = "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-800";
const INDIGO = "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-800";
const AMBER = "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800";
const RED = "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800";
const GRAY = "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-700";
const SLATE = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-700";

export interface StatusMeta {
  label: string;
  className: string;
  /** One line for a tooltip or legend. */
  description: string;
}

export const QUEUE_STATUS_META: Record<ReminderQueueStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", className: BLUE, description: "Waiting for its send time." },
  queued: { label: "Queued", className: INDIGO, description: "Ready to go to the provider." },
  processing: { label: "Processing", className: AMBER, description: "Being sent now." },
  sent: { label: "Sent", className: GREEN, description: "Accepted by the provider." },
  delivered: { label: "Delivered", className: EMERALD, description: "The provider confirmed delivery." },
  failed: { label: "Failed", className: RED, description: "Could not be sent after every retry." },
  cancelled: {
    label: "Cancelled",
    className: GRAY,
    description:
      "No longer needed: the installment was paid, the loan closed or was restructured, the schedule changed, or another reminder covers the loan that day.",
  },
  skipped: {
    label: "Skipped",
    className: SLATE,
    description:
      "Still needed but could not be sent: paused, the member opted out, no valid contact, outside contact hours, not on the allow-list, no active template, or Collected by Auto-Pay.",
  },
};

export const DELIVERY_STATUS_META: Record<DeliveryStatus, StatusMeta> = {
  pending: { label: "Pending", className: BLUE, description: "Not yet confirmed by the provider." },
  sent: { label: "Sent", className: GREEN, description: "Accepted by the provider." },
  delivered: { label: "Delivered", className: EMERALD, description: "Delivered to the recipient." },
  opened: { label: "Opened", className: EMERALD, description: "The email was opened." },
  failed: { label: "Failed", className: RED, description: "The provider could not deliver it." },
  rejected: { label: "Rejected", className: RED, description: "The provider refused the message." },
  bounced: { label: "Bounced", className: AMBER, description: "The email address bounced." },
};

// ---------------------------------------------------------------------------
// Test mode
// ---------------------------------------------------------------------------

/** The line every reminders screen shows while the deployment sends nothing. */
export const TEST_MODE_BANNER = "Test mode: reminders are logged, not sent";

/**
 * Whether messages are only logged: `true` test mode, `false` live, `null`
 * not known. The screens use the live words ("Sent", "Delivered") only on a
 * known `false`, test-mode words on `true`, and neutral words on `null`.
 */
export type SendMode = boolean | null;

/**
 * The deployment's mode, read from the server's own `test_mode` (log-only
 * drivers, live sending off, no provider set up), on the settings or the
 * dashboard. Never guessed: a missing `test_mode`, or no answer, is `null`.
 */
export function reminderTestMode(
  source: { test_mode?: boolean | null; enabled?: boolean | null } | null | undefined,
): SendMode {
  if (!source || typeof source.test_mode !== "boolean") return null;
  return source.test_mode;
}

/**
 * Two sources of the deployment's mode (settings, dashboard). Any "test"
 * wins; "live" counts only when neither source says test.
 */
export function combineTestMode(a: SendMode, b: SendMode): SendMode {
  if (a === true || b === true) return true;
  if (a === false || b === false) return false;
  return null;
}

/** One row's mode: its own `test_mode` when sent, else the deployment's. */
export function rowTestMode(
  row: { test_mode?: boolean | null },
  deployment: SendMode | undefined,
): SendMode {
  if (typeof row.test_mode === "boolean") return row.test_mode;
  return deployment ?? null;
}

const LOGGED_META: StatusMeta = {
  label: "Logged",
  className: SLATE,
  description: "Test mode: logged only, not sent. Nothing reached the member.",
};

/** A handed-over row whose mode isn't known: neither "Sent" nor "Logged". */
const PROCESSED_META: StatusMeta = {
  label: "Processed",
  className: SLATE,
  description: "Handled by the reminder service. Whether this deployment reaches members could not be read.",
};

/** The "delivered" filter option outside live mode, kept apart from "sent". */
const CONFIRMED_OPTION: StatusMeta = {
  label: "Confirmed",
  className: EMERALD,
  description: "Confirmed by the receiving service.",
};

/** Test-mode and neutral lines for statuses whose live line names sending. */
const QUEUE_DESCRIPTIONS: Partial<Record<ReminderQueueStatus, { test: string; unknown: string }>> = {
  queued: { test: "Ready to be logged.", unknown: "Ready for the reminder service." },
  processing: { test: "Being logged now.", unknown: "Being handled now." },
};

/** Statuses that would say a message went out. */
const QUEUE_WENT_OUT: ReadonlySet<ReminderQueueStatus> = new Set(["sent", "delivered"]);
const DELIVERY_WENT_OUT: ReadonlySet<DeliveryStatus> = new Set(["sent", "delivered", "opened"]);

/** Whether a queue status says the reminder was handed over (sent or delivered). */
export function queueStatusWentOut(status: ReminderQueueStatus): boolean {
  return QUEUE_WENT_OUT.has(status);
}

/** Whether a delivery status says the message was handed over. */
export function deliveryStatusWentOut(status: DeliveryStatus): boolean {
  return DELIVERY_WENT_OUT.has(status);
}

function wentOutMeta(mode: SendMode): StatusMeta | null {
  if (mode === true) return LOGGED_META;
  if (mode === null) return PROCESSED_META;
  return null;
}

/** A queue status as the screens read it in `mode` (the row's own, see `rowTestMode`). */
export function queueStatusMeta(status: ReminderQueueStatus, mode: SendMode): StatusMeta | undefined {
  if (!Object.hasOwn(QUEUE_STATUS_META, status)) return undefined;
  const live = QUEUE_STATUS_META[status];
  if (mode === false) return live;
  if (QUEUE_WENT_OUT.has(status)) return wentOutMeta(mode)!;
  const lines = QUEUE_DESCRIPTIONS[status];
  if (!lines) return live;
  return { ...live, description: mode === true ? lines.test : lines.unknown };
}

/** A delivery status as the screens read it in `mode`. */
export function deliveryStatusMeta(status: DeliveryStatus, mode: SendMode): StatusMeta | undefined {
  if (!Object.hasOwn(DELIVERY_STATUS_META, status)) return undefined;
  if (mode !== false && DELIVERY_WENT_OUT.has(status)) return wentOutMeta(mode)!;
  return DELIVERY_STATUS_META[status];
}

/**
 * The queue's status filter options. Outside live mode "sent" reads Logged
 * (test) or Processed (unknown) and "delivered" reads Confirmed, so no option
 * claims sending and no two read the same.
 */
export function queueStatusOptions(mode: SendMode): Record<ReminderQueueStatus, StatusMeta> {
  if (mode === false) return QUEUE_STATUS_META;
  const options = { ...QUEUE_STATUS_META, sent: wentOutMeta(mode)!, delivered: CONFIRMED_OPTION };
  for (const status of ["queued", "processing"] as const) options[status] = queueStatusMeta(status, mode)!;
  return options;
}

/** As `queueStatusOptions`, for message history's delivery statuses. */
export function deliveryStatusOptions(mode: SendMode): Record<DeliveryStatus, StatusMeta> {
  if (mode === false) return DELIVERY_STATUS_META;
  return { ...DELIVERY_STATUS_META, sent: wentOutMeta(mode)!, delivered: CONFIRMED_OPTION };
}

/**
 * The dashboard chart's bar names; "Sent" and "Delivered" only when live.
 * When the answer carries `daily[].logged` (`hasLogged`), "sent" leaves out
 * logged-only messages, so it keeps "Sent", as the counts do.
 */
export function chartSeriesLabel(
  series: "sent" | "logged" | "delivered" | "failed",
  mode: SendMode,
  hasLogged = false,
): string {
  if (series === "failed") return "Failed";
  if (series === "logged") return LOGGED_META.label;
  if (series === "sent" && hasLogged) return "Sent";
  if (mode === false) return series === "sent" ? "Sent" : "Delivered";
  if (series === "delivered") return CONFIRMED_OPTION.label;
  return wentOutMeta(mode)!.label;
}

/**
 * Dashboard count labels. The `logged*` counts are logged-only messages and
 * the `sent*` counts leave them out (R2), so each keeps its own word.
 */
export const KPI_LABELS: Record<keyof ReminderDashboardCounts, string> = {
  today: "Reminders today",
  sent: "Sent",
  logged: "Logged",
  pending: "Pending",
  failed: "Failed",
  sms_sent: "SMS sent",
  sms_logged: "SMS logged",
  emails_sent: "Emails sent",
  emails_logged: "Emails logged",
  upcoming_due: "Upcoming due",
  overdue: "Overdue",
};

const PROCESSED_KPI_LABELS: Partial<Record<keyof ReminderDashboardCounts, string>> = {
  sent: "Processed",
  sms_sent: "SMS processed",
  emails_sent: "Emails processed",
};

/**
 * The dashboard's count labels for one answer. An answer without the
 * `logged*` counts can't say its `sent*` counts leave out logged-only
 * messages, so outside a known live mode those read "Processed".
 */
export function kpiLabels(
  counts: Partial<ReminderDashboardCounts>,
  mode: SendMode,
): Record<keyof ReminderDashboardCounts, string> {
  if (counts.logged !== undefined || mode === false) return KPI_LABELS;
  return { ...KPI_LABELS, ...PROCESSED_KPI_LABELS };
}

/** The usage card's monthly line, by the same rule as `kpiLabels`. */
export function smsMonthLabel(
  sms: { sent_this_month?: number; logged_this_month?: number },
  mode: SendMode,
): string {
  return sms.logged_this_month !== undefined || mode === false ? "Messages sent" : "Messages processed";
}

/**
 * Whether to say "Couldn't read sending status": the settings call has
 * settled (answered or failed) and still gives no `test_mode`.
 */
export function sendingStatusUnreadable(
  settings: { loading: boolean; data: { test_mode?: boolean | null; enabled?: boolean | null } | null },
  active = true,
): boolean {
  return active && !settings.loading && reminderTestMode(settings.data) === null;
}

// ---------------------------------------------------------------------------
// Access (R2 security fixes)
// ---------------------------------------------------------------------------

/**
 * Why a branch user can't change something company-wide: settings shared by
 * every branch, templates, and rules for every branch need
 * `branches:view_all`. The server is the source (403); this only explains.
 */
export const COMPANY_WIDE_REASON = "Only users with access to every branch can change this; it applies to every branch.";

/** A stored rule a branch user can't edit or switch off: one for every branch. */
export function ruleLockReason(rule: { branch_id: number | null }, allBranches: boolean): string | null {
  return rule.branch_id === null && !allBranches ? COMPANY_WIDE_REASON : null;
}

/** The manual send types offered when the server doesn't list them. */
const MANUAL_FALLBACK: readonly ReminderTemplateType[] = [
  "upcoming",
  "due_today",
  "past_due",
  "long_past_due",
  "partial_payment",
];

export const NO_TEMPLATE_FITS =
  "No reminder fits this loan today: nothing is due yet, it is still within its grace period, or it has nothing to confirm.";

/**
 * The templates the Send dialog offers: the server's `allowed_template_types`
 * (what fits the loan today), known types only, in its order. An answer
 * without the list offers every manual reminder type; the server still
 * refuses one that doesn't fit (422).
 */
export function offeredTemplates(allowed: readonly ReminderTemplateType[] | null | undefined): ReminderTemplateType[] {
  if (!Array.isArray(allowed)) return [...MANUAL_FALLBACK];
  const known = new Set<string>(Object.keys(TEMPLATE_TYPE_LABELS));
  return [...new Set(allowed)].filter((t) => known.has(t));
}

/**
 * A member contact on the preferences card. Without `borrowers:view` the
 * server leaves contacts out (null), which is not "none on file".
 */
export function contactValueLabel(value: string | null, canSeeContacts: boolean): string {
  if (value) return value;
  return canSeeContacts ? "None on file" : "Hidden (needs access to member details)";
}

/** A masked recipient, or a dash when the server leaves it out or there is none. */
export function recipientLabel(recipient: string | null | undefined): string {
  return recipient?.trim() ? recipient : "—";
}

/** " — <reason>" after a pause line, or nothing when the server leaves it out. */
export function pauseReasonSuffix(pause: { reason: string | null }): string {
  const reason = pause.reason?.trim();
  return reason ? ` — ${reason}` : "";
}

export interface ManualSendWording {
  title: string;
  button: string;
  busy: string;
  toastTitle: string;
  toastBody: string;
}

/** The Send reminder dialog's words: live only when the mode is known live. */
export function manualSendWording(mode: SendMode): ManualSendWording {
  if (mode === false) {
    return {
      title: "Send reminder",
      button: "Send reminder",
      busy: "Sending…",
      toastTitle: "Reminder queued for sending",
      toastBody: "It shows in Message History once it has gone out.",
    };
  }
  if (mode === true) {
    return {
      title: "Log a reminder (test mode)",
      button: "Log reminder (test mode)",
      busy: "Logging…",
      toastTitle: "Reminder queued in test mode",
      toastBody: "It is logged in Message History, not sent to the member.",
    };
  }
  return {
    title: "Queue a reminder",
    button: "Queue reminder",
    busy: "Queuing…",
    toastTitle: "Reminder queued",
    toastBody: "Queued; see Message History for its result.",
  };
}

/** A message whose text was blanked 2 years after its loan closed. */
export function isMessageRedacted(message: Pick<ReminderMessage, "body"> & { redacted_at?: string | null }): boolean {
  return Boolean(message.redacted_at) || message.body === null;
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

/**
 * The engine's reason codes in words (backend #232). The server sends
 * `reason` in words too, and that wins; these cover a row without one.
 */
export const REMINDER_REASON_LABELS: Record<ReminderReasonCode, string> = {
  paid: "Payment received before send time",
  schedule_changed: "Schedule changed: the due date moved or the period closed",
  nothing_due: "Nothing is due on this loan",
  loan_closed: "Loan is closed",
  rule_not_applicable: "The rule no longer covers this loan",
  superseded: "Another reminder covers this loan today",
  rule_inactive: "Reminder rule is switched off",
  reminders_off: "Automated reminders are switched off",
  channel_off: "This channel is switched off",
  auto_pay: "Collected by Auto-Pay",
  paused: "Reminders are paused",
  opted_out: "Member turned off these reminders",
  no_contact: "Member has no contact on file for this channel",
  invalid_contact: "Contact is not a valid mobile number or email address",
  contact_flagged: "Contact was marked invalid after a failed send",
  not_allowed: "Recipient is not on the allow-list",
  fire_date_passed: "Its day has passed",
  outside_contact_hours: "Outside contact hours",
  template_unavailable: "No active template for this reminder and channel",
  rule_deleted: "Its rule was deleted",
  not_set_up: "Sending is not set up",
  retry_window_closed: "Could not be retried within contact hours",
  interrupted: "Sending was interrupted; not resent so the member is not sent it twice",
  error: "Could not be prepared for sending",
  driver_error: "The driver failed",
  already_handed_over: "Its message was already handed over; not sent again",
};

/** "some_new_code" → "Some new code". */
function codeInWords(code: string): string {
  const words = code.split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Why a reminder was cancelled, skipped or failed, in words; null when none. */
export function reminderReason(
  item: Pick<ReminderQueueItem, "reason"> & { reason_code?: string | null },
): string | null {
  const text = item.reason?.trim();
  if (text) return text;
  const code = item.reason_code?.trim();
  if (!code) return null;
  return Object.hasOwn(REMINDER_REASON_LABELS, code)
    ? REMINDER_REASON_LABELS[code as ReminderReasonCode]
    : codeInWords(code);
}

export const TEMPLATE_TYPE_LABELS: Record<ReminderTemplateType, string> = {
  upcoming: "Upcoming due",
  due_today: "Due today",
  past_due: "Past due",
  long_past_due: "Long past due",
  partial_payment: "Partial payment",
  payment_confirmation: "Payment confirmation",
};

export const TEMPLATE_TYPES = Object.keys(TEMPLATE_TYPE_LABELS) as ReminderTemplateType[];

export const TRIGGER_LABELS: Record<ReminderTrigger, string> = {
  before_due: "Before due date",
  on_due: "On due date",
  after_due: "After due date",
};

export const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  sms: "SMS",
  email: "Email",
};

export function channelsLabel(channels: ReminderChannel[]): string {
  if (channels.length === 0) return "No channel";
  return channels.map((c) => CHANNEL_LABELS[c]).join(" + ");
}

export interface TemplateVariable {
  key: string;
  label: string;
  /** Fixed sample text for SMS (and for email unless `emailSample` is set). */
  sample: string;
  /** Email's own sample, where the server formats email differently. */
  emailSample?: string;
  /** For an alias: the variable it renders the same as. */
  aliasOf?: string;
}

/** The server's amount format per channel, shown on fixed sample values only. */
const SAMPLE_AMOUNT = { sms: "PHP 2,500.00", email: "₱2,500.00" } as const;

/**
 * Variables a template may use, with the sample value the editor previews.
 *
 * Samples follow the server's rendering, not the screen's: "PHP 2,500.00" on
 * SMS and "₱2,500.00" on email, dates like "Sep 15, 2026". The SMS part
 * counter runs on the rendered SMS sample, and a "₱" would switch it to
 * Unicode and roughly double the parts it reports.
 *
 * `amount_due` and `remaining_balance` render the same server figure (what is
 * due by the period's due date), so they share one sample. The last four are
 * the task's own names, which the server accepts as aliases.
 */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  { key: "borrower_first_name", label: "First name", sample: "Juan" },
  { key: "borrower_full_name", label: "Full name", sample: "Juan Dela Cruz" },
  { key: "loan_number", label: "Loan number", sample: "LN-2026-00123" },
  { key: "installment_number", label: "Installment no.", sample: "4" },
  { key: "due_date", label: "Due date", sample: "Sep 15, 2026" },
  { key: "amount_due", label: "Amount due", sample: SAMPLE_AMOUNT.sms, emailSample: SAMPLE_AMOUNT.email },
  { key: "remaining_balance", label: "Remaining due", sample: SAMPLE_AMOUNT.sms, emailSample: SAMPLE_AMOUNT.email },
  { key: "days_overdue", label: "Days overdue", sample: "3" },
  { key: "lender_name", label: "Lender name", sample: "Sample Cooperative" },
  { key: "branch_name", label: "Branch", sample: "Main Branch" },
  { key: "branch_phone", label: "Branch phone", sample: "(082) 123-4567" },
  { key: "payment_method", label: "Payment instructions", sample: "Pay at any branch or via GCash." },
  {
    key: "remaining_amount",
    label: "Remaining amount",
    sample: SAMPLE_AMOUNT.sms,
    emailSample: SAMPLE_AMOUNT.email,
    aliasOf: "remaining_balance",
  },
  { key: "company_name", label: "Company name", sample: "Sample Cooperative", aliasOf: "lender_name" },
  { key: "company_phone", label: "Company phone", sample: "(082) 123-4567", aliasOf: "branch_phone" },
  { key: "payment_reference", label: "Payment reference", sample: "LN-2026-00123", aliasOf: "loan_number" },
];

/** The label of the variable an alias stands for. */
export function aliasTargetLabel(variable: TemplateVariable): string | null {
  if (!variable.aliasOf) return null;
  return TEMPLATE_VARIABLES.find((v) => v.key === variable.aliasOf)?.label ?? null;
}

const VARIABLE_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const KNOWN_VARIABLES = new Map<string, TemplateVariable>(TEMPLATE_VARIABLES.map((v) => [v.key, v]));

/** `{{name}}` tokens in `text` that are not template variables. */
export function unknownVariables(text: string): string[] {
  const unknown = new Set<string>();
  for (const [, name] of text.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN_VARIABLES.has(name.toLowerCase())) unknown.add(name);
  }
  return [...unknown];
}

/**
 * Replace known variables with the channel's fixed sample values; unknown
 * tokens stay visible. A sample, never a real loan's figures: the server's
 * preview shows those.
 */
export function renderTemplateSample(text: string, channel: ReminderChannel = "sms"): string {
  return text.replace(VARIABLE_PATTERN, (token, name: string) => {
    const variable = KNOWN_VARIABLES.get(name.toLowerCase());
    if (!variable) return token;
    return channel === "email" ? (variable.emailSample ?? variable.sample) : variable.sample;
  });
}

// The GSM 03.38 basic set plus its extension table (which costs two units).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f";

export interface SmsLength {
  characters: number;
  segments: number;
  encoding: "GSM-7" | "Unicode";
}

/**
 * How many SMS parts a message costs. GSM-7 fits 160 characters in one part
 * and 153 per part when split; anything outside it (e.g. "₱", emoji) forces
 * Unicode at 70 and 67. Counted on the rendered sample, so variable values
 * are included.
 */
export function smsLength(text: string): SmsLength {
  const chars = [...text];
  let units = 0;
  let gsm = true;
  for (const ch of chars) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) {
    // UCS-2 counts UTF-16 code units, so an emoji takes two.
    const length = text.length;
    return {
      characters: length,
      segments: length === 0 ? 0 : length <= 70 ? 1 : Math.ceil(length / 67),
      encoding: "Unicode",
    };
  }
  return {
    characters: units,
    segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
    encoding: "GSM-7",
  };
}

/** `"09:00"` → `"9:00 AM"`. Returns the input unchanged if it isn't `HH:mm`. */
export function formatSendTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const period = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${match[2]} ${period}`;
}

function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function describeTrigger(trigger: ReminderTrigger, days: number): string {
  if (trigger === "on_due") return "On the due date";
  const unit = days === 1 ? "day" : "days";
  return trigger === "before_due"
    ? `${days} ${unit} before due date`
    : `${days} ${unit} overdue`;
}

/** e.g. "3 days before due date · 9:00 AM · SMS + Email". */
export function describeRule(
  rule: Pick<ReminderRuleInput, "trigger" | "days" | "send_time" | "channels">,
): string {
  return [
    describeTrigger(rule.trigger, rule.days),
    formatSendTime(rule.send_time),
    channelsLabel(rule.channels),
  ].join(" · ");
}

export interface ContactWindow {
  start: string;
  end: string;
}

/**
 * The earliest and latest any organization may set. Reminders outside these
 * hours read as harassment, whatever a tenant configures.
 */
export const CONTACT_HOURS_LIMIT: ContactWindow = { start: "06:00", end: "22:00" };
export const DEFAULT_CONTACT_HOURS: ContactWindow = { start: "08:00", end: "18:00" };

/** A problem with a contact-hours window, or `null` if it is valid. */
export function validateContactWindow(window: ContactWindow): string | null {
  const start = minutesOf(window.start);
  const end = minutesOf(window.end);
  if (start === null || end === null) return "Contact hours need a start and end time";
  if (start >= end) return "Contact hours must start before they end";
  const min = minutesOf(CONTACT_HOURS_LIMIT.start)!;
  const max = minutesOf(CONTACT_HOURS_LIMIT.end)!;
  if (start < min || end > max) {
    return `Contact hours must stay between ${formatSendTime(CONTACT_HOURS_LIMIT.start)} and ${formatSendTime(CONTACT_HOURS_LIMIT.end)}`;
  }
  return null;
}

export const MAX_RULE_DAYS = 90;

/**
 * Field-level problems with a rule, in form order. Empty when valid.
 * `allBranches: false` (no `branches:view_all`): a rule with no branch is
 * refused, as the API refuses it (403).
 */
export function validateRule(
  rule: ReminderRuleInput,
  contactHours: ContactWindow,
  options: { allBranches?: boolean } = {},
): string[] {
  const problems: string[] = [];
  if (!rule.name.trim()) problems.push("Rule name");
  if (rule.trigger !== "on_due") {
    if (!Number.isInteger(rule.days) || rule.days < 1 || rule.days > MAX_RULE_DAYS) {
      problems.push(`Days (1–${MAX_RULE_DAYS})`);
    }
  } else if (rule.days !== 0) {
    problems.push("Days must be 0 on the due date");
  }
  const send = minutesOf(rule.send_time);
  const start = minutesOf(contactHours.start);
  const end = minutesOf(contactHours.end);
  if (send === null) {
    problems.push("Send time");
  } else if (start !== null && end !== null && send < start) {
    problems.push(`Send time (not before contact hours open at ${formatSendTime(contactHours.start)})`);
  } else if (start !== null && end !== null && send >= end) {
    // The end is exclusive, as the engine reads it.
    problems.push(`Send time (before contact hours end at ${formatSendTime(contactHours.end)})`);
  }
  if (rule.channels.length === 0) problems.push("At least one channel");
  if (options.allBranches === false && rule.branch_id === null) {
    problems.push("Branch (rules for every branch need access to every branch)");
  }
  return problems;
}

/**
 * The five rules the server seeds for a new organization. Shown on an empty
 * rules screen so an admin knows what "default" means; the UI never creates
 * them itself.
 */
export const DEFAULT_RULES: Pick<
  ReminderRuleInput,
  "name" | "trigger" | "days" | "send_time" | "channels" | "template_type"
>[] = [
  { name: "Upcoming due", trigger: "before_due", days: 3, send_time: "09:00", channels: ["sms", "email"], template_type: "upcoming" },
  { name: "Due today", trigger: "on_due", days: 0, send_time: "08:00", channels: ["sms", "email"], template_type: "due_today" },
  { name: "3 days overdue", trigger: "after_due", days: 3, send_time: "09:00", channels: ["sms", "email"], template_type: "past_due" },
  { name: "7 days overdue", trigger: "after_due", days: 7, send_time: "09:00", channels: ["sms", "email"], template_type: "past_due" },
  { name: "15 days overdue", trigger: "after_due", days: 15, send_time: "09:00", channels: ["sms", "email"], template_type: "long_past_due" },
];

/**
 * The settings form as `PUT /reminders/settings` takes it. Credentials are
 * write-only, so a blank credential field means "keep what is stored" and is
 * left out rather than sent as an empty string that would wipe it. Filled ones
 * are sent trimmed; every other field goes through as it is.
 */
export function toSettingsPayload(form: ReminderSettingsUpdate): ReminderSettingsUpdate {
  const { api_key: smsKey, api_secret: smsSecret, ...sms } = form.sms_provider;
  const { api_key: emailKey, ...email } = form.email_provider;
  return {
    ...form,
    sms_provider: {
      ...sms,
      ...(smsKey?.trim() ? { api_key: smsKey.trim() } : {}),
      ...(smsSecret?.trim() ? { api_secret: smsSecret.trim() } : {}),
    },
    email_provider: { ...email, ...(emailKey?.trim() ? { api_key: emailKey.trim() } : {}) },
  };
}

/**
 * The line beside a message's status badge: who sent it, or "Failed" when it
 * never went out, so a failed message is not described as sent. A message
 * that was only logged (test mode) says so, and never "Sent"; when its mode
 * can't be read the line only says who started it.
 */
export function messageSourceLabel(
  message: Pick<ReminderMessage, "status" | "source" | "created_by_name" | "test_mode">,
  deploymentTestMode: SendMode = null,
): string {
  if (message.status === "failed") return "Failed";
  const mode = rowTestMode(message, deploymentTestMode);
  if (mode === null) {
    if (message.source === "manual") return `Manual${message.created_by_name ? `, by ${message.created_by_name}` : ""}`;
    return "Automatic";
  }
  if (mode) {
    if (message.source === "manual") {
      return `Logged${message.created_by_name ? ` by ${message.created_by_name}` : " manually"}, not sent (test mode)`;
    }
    return "Logged automatically, not sent (test mode)";
  }
  if (message.source === "manual") {
    return `Sent manually${message.created_by_name ? ` by ${message.created_by_name}` : ""}`;
  }
  return "Sent automatically";
}
