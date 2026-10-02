/**
 * Pure helpers for the reminders screens: labels, template variables, SMS
 * length, rule descriptions, form validation and the settings payload.
 *
 * None of this decides whether a reminder is sent or what it says to a real
 * borrower — the server owns eligibility and renders every real message.
 * `renderTemplateSample` is only the template editor's live preview.
 */

import type {
  DeliveryStatus,
  ReminderChannel,
  ReminderQueueStatus,
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
    description: "No longer needed — the installment was paid, or the loan closed or changed.",
  },
  skipped: {
    label: "Skipped",
    className: SLATE,
    description: "Still needed but could not be sent — no valid contact, opted out, or paused.",
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

/**
 * Variables a template may use, with the sample value the editor previews.
 *
 * Samples follow the server's rendering ("PHP 2,541.67", "Oct 5, 2026"), not
 * the screen's: the SMS part counter runs on the rendered sample, and a "₱"
 * would switch it to Unicode and roughly double the parts it reports.
 */
export const TEMPLATE_VARIABLES = [
  { key: "borrower_first_name", label: "First name", sample: "Juan" },
  { key: "borrower_full_name", label: "Full name", sample: "Juan Dela Cruz" },
  { key: "loan_number", label: "Loan number", sample: "LN-2026-00123" },
  { key: "installment_number", label: "Installment no.", sample: "4" },
  { key: "due_date", label: "Due date", sample: "Oct 15, 2026" },
  { key: "amount_due", label: "Amount due", sample: "PHP 2,500.00" },
  { key: "remaining_balance", label: "Remaining due", sample: "PHP 1,200.00" },
  { key: "days_overdue", label: "Days overdue", sample: "3" },
  { key: "lender_name", label: "Lender name", sample: "Sample Cooperative" },
  { key: "branch_name", label: "Branch", sample: "Main Branch" },
  { key: "branch_phone", label: "Branch phone", sample: "(082) 123-4567" },
  { key: "payment_method", label: "Payment instructions", sample: "Pay at any branch or via GCash." },
] as const;

const VARIABLE_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const KNOWN_VARIABLES = new Map<string, string>(TEMPLATE_VARIABLES.map((v) => [v.key, v.sample]));

/** `{{name}}` tokens in `text` that are not template variables. */
export function unknownVariables(text: string): string[] {
  const unknown = new Set<string>();
  for (const [, name] of text.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN_VARIABLES.has(name.toLowerCase())) unknown.add(name);
  }
  return [...unknown];
}

/** Replace known variables with sample values; unknown tokens stay visible. */
export function renderTemplateSample(text: string): string {
  return text.replace(VARIABLE_PATTERN, (token, name: string) =>
    KNOWN_VARIABLES.get(name.toLowerCase()) ?? token,
  );
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

/** Field-level problems with a rule, in form order. Empty when valid. */
export function validateRule(rule: ReminderRuleInput, contactHours: ContactWindow): string[] {
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
  } else if (start !== null && end !== null && (send < start || send > end)) {
    problems.push(
      `Send time (within contact hours, ${formatSendTime(contactHours.start)}–${formatSendTime(contactHours.end)})`,
    );
  }
  if (rule.channels.length === 0) problems.push("At least one channel");
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
  { name: "Due today", trigger: "on_due", days: 0, send_time: "08:00", channels: ["sms"], template_type: "due_today" },
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
