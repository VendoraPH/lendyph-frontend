import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES,
  QUEUE_STATUS_META,
  TEMPLATE_VARIABLES,
  TEST_MODE_BANNER,
  deliveryStatusMeta,
  deliveryStatusOptions,
  describeRule,
  KPI_LABELS,
  providerLabel,
  TEMPLATES_PAGE_INTRO,
  sendButtonLabel,
  HIDDEN_DETAILS,
  RULE_TEMPLATES_FOR_TRIGGER,
  fitRuleTemplate,
  COMPANY_WIDE_REASON,
  NO_TEMPLATE_FITS,
  contactValueLabel,
  offeredTemplates,
  pauseReasonSuffix,
  recipientLabel,
  ruleLockReason,
  kpiLabels,
  sendingStatusUnreadable,
  smsMonthLabel,
  REMINDER_REASON_LABELS,
  chartSeriesLabel,
  combineTestMode,
  isMessageRedacted,
  manualSendWording,
  rowTestMode,
  queueStatusMeta,
  queueStatusOptions,
  queueStatusWentOut,
  deliveryStatusWentOut,
  reminderReason,
  reminderTestMode,
  formatSendTime,
  messageSourceLabel,
  renderTemplateSample,
  smsLength,
  toSettingsPayload,
  unknownVariables,
  validateContactWindow,
  validateRule,
  type SendMode,
} from "./reminders";
import type { DeliveryStatus, ReminderQueueStatus, ReminderRuleInput, ReminderSettingsUpdate } from "@/types/reminder";

const HOURS = { start: "08:00", end: "18:00" };

function rule(overrides: Partial<ReminderRuleInput> = {}): ReminderRuleInput {
  return {
    name: "Upcoming",
    trigger: "before_due",
    days: 3,
    send_time: "09:00",
    channels: ["sms"],
    branch_id: null,
    loan_product_id: null,
    borrower_type: "all",
    template_type: "upcoming",
    is_active: true,
    ...overrides,
  };
}

test("cancelled and skipped stay distinct statuses", () => {
  assert.notEqual(QUEUE_STATUS_META.cancelled.label, QUEUE_STATUS_META.skipped.label);
  assert.match(QUEUE_STATUS_META.cancelled.description, /no longer needed/i);
  assert.match(QUEUE_STATUS_META.skipped.description, /could not be sent/i);
});

test("renderTemplateSample fills known variables and leaves unknown ones visible", () => {
  assert.equal(
    renderTemplateSample("Hi {{borrower_first_name}}, {{ amount_due }} is due. {{foo}}"),
    "Hi Juan, PHP 2,500.00 is due. {{foo}}",
  );
});

// The server writes amounts as "PHP 2,541.67". A "₱" in the sample would
// make the counter report Unicode and about twice the parts it really costs.
test("a typical template with {{amount_due}} counts as one GSM-7 part", () => {
  const sample = renderTemplateSample(
    "Hi {{borrower_first_name}}, your payment of {{amount_due}} for loan {{loan_number}} is due on {{due_date}}. {{payment_method}}",
  );
  assert.deepEqual(
    { encoding: smsLength(sample).encoding, segments: smsLength(sample).segments },
    { encoding: "GSM-7", segments: 1 },
  );
});

test("no variable's sample value forces Unicode on its own", () => {
  for (const v of TEMPLATE_VARIABLES) {
    assert.equal(smsLength(v.sample).encoding, "GSM-7", v.key);
  }
});

test("unknownVariables lists each unrecognised token once", () => {
  assert.deepEqual(unknownVariables("{{due_date}} {{foo}} {{foo}} {{bar}}"), ["foo", "bar"]);
  assert.deepEqual(unknownVariables("no tokens"), []);
});

test("smsLength counts GSM-7 at 160 per part and 153 when split", () => {
  assert.deepEqual(smsLength(""), { characters: 0, segments: 0, encoding: "GSM-7" });
  assert.equal(smsLength("a".repeat(160)).segments, 1);
  assert.equal(smsLength("a".repeat(161)).segments, 2);
  assert.equal(smsLength("a".repeat(306)).segments, 2);
  assert.equal(smsLength("a".repeat(307)).segments, 3);
});

test("smsLength counts extension characters twice", () => {
  assert.equal(smsLength("{}").characters, 4);
});

test("smsLength switches to Unicode for the peso sign", () => {
  const short = smsLength("Pay ₱100");
  assert.equal(short.encoding, "Unicode");
  assert.equal(short.segments, 1);
  assert.equal(smsLength("₱" + "a".repeat(70)).segments, 2);
});

test("formatSendTime renders a 12-hour clock", () => {
  assert.equal(formatSendTime("09:00"), "9:00 AM");
  assert.equal(formatSendTime("12:30"), "12:30 PM");
  assert.equal(formatSendTime("00:15"), "12:15 AM");
  assert.equal(formatSendTime("17:45"), "5:45 PM");
});

test("describeRule reads the way the spec writes rules", () => {
  assert.equal(
    describeRule({ trigger: "before_due", days: 3, send_time: "09:00", channels: ["sms", "email"] }),
    "3 days before due date · 9:00 AM · SMS + Email",
  );
  assert.equal(
    describeRule({ trigger: "after_due", days: 1, send_time: "10:00", channels: ["email"] }),
    "1 day overdue · 10:00 AM · Email",
  );
  assert.equal(
    describeRule({ trigger: "on_due", days: 0, send_time: "08:00", channels: ["sms"] }),
    "On the due date · 8:00 AM · SMS",
  );
});

test("validateContactWindow enforces order and the 6 AM–10 PM limit", () => {
  assert.equal(validateContactWindow({ start: "08:00", end: "18:00" }), null);
  assert.match(validateContactWindow({ start: "18:00", end: "08:00" })!, /start before/);
  assert.match(validateContactWindow({ start: "05:00", end: "18:00" })!, /between/);
  assert.match(validateContactWindow({ start: "08:00", end: "23:00" })!, /between/);
  assert.match(validateContactWindow({ start: "", end: "18:00" })!, /start and end/);
});

test("validateRule accepts a valid rule", () => {
  assert.deepEqual(validateRule(rule(), HOURS), []);
});

test("validateRule requires a channel and a name", () => {
  assert.deepEqual(validateRule(rule({ name: " ", channels: [] }), HOURS), [
    "Rule name",
    "At least one channel",
  ]);
});

test("validateRule bounds days, and pins on-due rules to 0", () => {
  assert.equal(validateRule(rule({ days: 0 }), HOURS).length, 1);
  assert.equal(validateRule(rule({ days: 91 }), HOURS).length, 1);
  assert.equal(validateRule(rule({ days: 2.5 }), HOURS).length, 1);
  assert.deepEqual(validateRule(rule({ trigger: "on_due", days: 0, template_type: "due_today" }), HOURS), []);
  assert.deepEqual(validateRule(rule({ trigger: "on_due", days: 2, template_type: "due_today" }), HOURS), [
    "Days must be 0 on the due date",
  ]);
});

// The engine treats the contact hours' end as exclusive (Arvin: standard),
// so a send time at the end itself is refused, as R2's API refuses it.
test("validateRule keeps the send time inside contact hours, the end excluded", () => {
  assert.deepEqual(validateRule(rule({ send_time: "07:59" }), HOURS), [
    "Send time (not before contact hours open at 8:00 AM)",
  ]);
  assert.deepEqual(validateRule(rule({ send_time: "08:00" }), HOURS), []);
  assert.deepEqual(validateRule(rule({ send_time: "17:59" }), HOURS), []);
  assert.deepEqual(validateRule(rule({ send_time: "18:00" }), HOURS), [
    "Send time (before contact hours end at 6:00 PM)",
  ]);
  assert.deepEqual(validateRule(rule({ send_time: "18:01" }), HOURS), [
    "Send time (before contact hours end at 6:00 PM)",
  ]);
  assert.deepEqual(validateRule(rule({ send_time: "25:00" }), HOURS), ["Send time"]);
});

test("every default rule is valid under the default contact hours", () => {
  for (const d of DEFAULT_RULES) {
    assert.deepEqual(
      validateRule(rule({ ...d, branch_id: null }), HOURS),
      [],
      d.name,
    );
  }
});

function settingsForm(
  sms: Pick<ReminderSettingsUpdate["sms_provider"], "api_key" | "api_secret">,
  email: Pick<ReminderSettingsUpdate["email_provider"], "api_key">,
): ReminderSettingsUpdate {
  return {
    enabled: true,
    timezone: "Asia/Manila",
    default_send_time: "09:00",
    channels: { sms: true, email: true },
    contact_hours: { start: "08:00", end: "18:00" },
    retry: { max_attempts: 3, delay_minutes: 15 },
    sms_provider: { provider: "semaphore", sender_id: "COOP", cost_per_segment: 0.355, ...sms },
    email_provider: {
      provider: "smtp",
      sender_name: "Sample Cooperative",
      sender_email: "no-reply@example.com",
      reply_to: null,
      ...email,
    },
    payment_instructions: "Pay at any branch.",
    branches: [
      {
        branch_id: 1,
        branch_name: "Main Branch",
        use_company_default: false,
        sender_name: "Main",
        contact_phone: "(082) 123-4567",
        contact_email: null,
      },
    ],
  };
}

test("toSettingsPayload leaves blank credentials out, so the stored ones are kept", () => {
  const payload = toSettingsPayload(settingsForm({ api_key: "", api_secret: "   " }, { api_key: "" }));
  assert.equal("api_key" in payload.sms_provider, false);
  assert.equal("api_secret" in payload.sms_provider, false);
  assert.equal("api_key" in payload.email_provider, false);
});

test("toSettingsPayload sends filled credentials, trimmed", () => {
  const payload = toSettingsPayload(
    settingsForm({ api_key: " sms-key ", api_secret: "sms-secret" }, { api_key: "mail-key" }),
  );
  assert.equal(payload.sms_provider.api_key, "sms-key");
  assert.equal(payload.sms_provider.api_secret, "sms-secret");
  assert.equal(payload.email_provider.api_key, "mail-key");
});

test("toSettingsPayload drops nothing but the blank credentials", () => {
  const blank = settingsForm({ api_key: "", api_secret: "" }, { api_key: "" });
  assert.deepEqual(toSettingsPayload(blank), settingsForm({}, {}));

  const filled = settingsForm({ api_key: "k", api_secret: "s" }, { api_key: "e" });
  assert.deepEqual(toSettingsPayload(filled), filled);
});

test("messageSourceLabel says Failed for a failed message, not that it was sent", () => {
  assert.equal(messageSourceLabel({ status: "failed", source: "system", created_by_name: null }), "Failed");
  assert.equal(messageSourceLabel({ status: "failed", source: "manual", created_by_name: "Ana Admin" }), "Failed");
});

test("messageSourceLabel names who sent a message that did go out", () => {
  assert.equal(
    messageSourceLabel({ status: "delivered", source: "system", created_by_name: null }, false),
    "Sent automatically",
  );
  assert.equal(
    messageSourceLabel({ status: "sent", source: "manual", created_by_name: "Ana Admin" }, false),
    "Sent manually by Ana Admin",
  );
  assert.equal(messageSourceLabel({ status: "sent", source: "manual", created_by_name: null, test_mode: false }), "Sent manually");
});

// ── Phase 2: aligned with the reminders engine (backend #232) ──

test("the default rules are the five the server seeds, every one on SMS and email", () => {
  assert.deepEqual(
    DEFAULT_RULES.map((r) => [r.name, r.trigger, r.days, r.send_time, r.channels, r.template_type]),
    [
      ["Upcoming due", "before_due", 3, "09:00", ["sms", "email"], "upcoming"],
      ["Due today", "on_due", 0, "08:00", ["sms", "email"], "due_today"],
      ["3 days overdue", "after_due", 3, "09:00", ["sms", "email"], "past_due"],
      ["7 days overdue", "after_due", 7, "09:00", ["sms", "email"], "past_due"],
      ["15 days overdue", "after_due", 15, "09:00", ["sms", "email"], "long_past_due"],
    ],
  );
});

test("the variable list offers the task's names as aliases of the server's variables", () => {
  const aliases = Object.fromEntries(
    TEMPLATE_VARIABLES.filter((v) => "aliasOf" in v && v.aliasOf).map((v) => [v.key, (v as { aliasOf: string }).aliasOf]),
  );
  assert.deepEqual(aliases, {
    remaining_amount: "remaining_balance",
    company_name: "lender_name",
    company_phone: "branch_phone",
    payment_reference: "loan_number",
  });
  const keys = new Set(TEMPLATE_VARIABLES.map((v) => v.key));
  for (const target of Object.values(aliases)) assert.ok(keys.has(target), target);
});

test("aliases are known variables and render the same sample as their target", () => {
  assert.deepEqual(
    unknownVariables("{{remaining_amount}} {{company_name}} {{company_phone}} {{payment_reference}}"),
    [],
  );
  assert.equal(renderTemplateSample("{{company_name}}"), renderTemplateSample("{{lender_name}}"));
  assert.equal(renderTemplateSample("{{payment_reference}}"), renderTemplateSample("{{loan_number}}"));
  assert.equal(renderTemplateSample("{{company_phone}}"), renderTemplateSample("{{branch_phone}}"));
  assert.equal(renderTemplateSample("{{remaining_amount}}", "email"), renderTemplateSample("{{remaining_balance}}", "email"));
});

// The server renders "PHP 2,500.00" on SMS (a "₱" forces Unicode) and
// "₱2,500.00" on email, with dates like "Sep 15, 2026".
test("samples read PHP on SMS and ₱ on email, with server-style dates", () => {
  assert.equal(renderTemplateSample("{{amount_due}}"), "PHP 2,500.00");
  assert.equal(renderTemplateSample("{{amount_due}}", "sms"), "PHP 2,500.00");
  assert.equal(renderTemplateSample("{{amount_due}}", "email"), "₱2,500.00");
  assert.equal(renderTemplateSample("{{due_date}}", "email"), "Sep 15, 2026");
  assert.equal(renderTemplateSample("{{due_date}}", "sms"), "Sep 15, 2026");
});

// amount_due and remaining_balance render the same server figure; two
// different samples would suggest the screen works out a second amount.
test("amount due and remaining due show the same sample, never a second figure", () => {
  for (const channel of ["sms", "email"] as const) {
    assert.equal(
      renderTemplateSample("{{remaining_balance}}", channel),
      renderTemplateSample("{{amount_due}}", channel),
      channel,
    );
  }
});

test("the banner reads exactly as agreed", () => {
  assert.equal(TEST_MODE_BANNER, "Test mode: reminders are logged, not sent");
});

// The banner shows only on the server's explicit test_mode: true.
test("test mode is the server's test_mode; a missing one or no settings is unknown", () => {
  assert.equal(reminderTestMode({ enabled: true, test_mode: true }), true);
  assert.equal(reminderTestMode({ enabled: false, test_mode: true }), true);
  assert.equal(reminderTestMode({ enabled: true, test_mode: false }), false);
  assert.equal(reminderTestMode({ enabled: false, test_mode: false }), false);
  assert.equal(reminderTestMode({ enabled: true }), null);
  assert.equal(reminderTestMode(null), null);
  assert.equal(reminderTestMode(undefined), null);
});

// The dashboard's own test_mode is a second source: any "test" wins, a
// "live" counts only when the other source is unknown or live too.
test("combineTestMode: test wins, live needs no contrary source, both unknown stays unknown", () => {
  assert.equal(combineTestMode(true, false), true);
  assert.equal(combineTestMode(false, true), true);
  assert.equal(combineTestMode(null, true), true);
  assert.equal(combineTestMode(false, null), false);
  assert.equal(combineTestMode(null, false), false);
  assert.equal(combineTestMode(false, false), false);
  assert.equal(combineTestMode(null, null), null);
});

test("a row's mode is its own test_mode, else the deployment's, else unknown", () => {
  assert.equal(rowTestMode({ test_mode: true }, false), true);
  assert.equal(rowTestMode({ test_mode: false }, true), false);
  assert.equal(rowTestMode({}, true), true);
  assert.equal(rowTestMode({ test_mode: null }, false), false);
  assert.equal(rowTestMode({}, null), null);
  assert.equal(rowTestMode({ test_mode: null }, undefined), null);
});

const WENT_OUT_QUEUE: ReminderQueueStatus[] = ["sent", "delivered"];
const WENT_OUT_DELIVERY: DeliveryStatus[] = ["sent", "delivered", "opened"];
const LIVE_WORDS = /\b(sent|delivered|provider)\b/i;

test("in test mode a handed-over reminder reads Logged, never Sent or Delivered", () => {
  for (const status of WENT_OUT_QUEUE) {
    const meta = queueStatusMeta(status, true)!;
    assert.equal(meta.label, "Logged", status);
    assert.match(meta.description, /not sent/i);
  }
  for (const status of WENT_OUT_DELIVERY) assert.equal(deliveryStatusMeta(status, true)!.label, "Logged", status);
  assert.equal(queueStatusMeta("skipped", true)!.label, "Skipped");
  assert.equal(deliveryStatusMeta("failed", true)!.label, "Failed");
  assert.equal(queueStatusMeta("nonsense" as ReminderQueueStatus, false), undefined);
});

test("live mode keeps the live words", () => {
  assert.equal(queueStatusMeta("sent", false)!.label, "Sent");
  assert.equal(queueStatusMeta("delivered", false)!.label, "Delivered");
  assert.equal(queueStatusMeta("processing", false)!.description, "Being sent now.");
  assert.equal(queueStatusMeta("queued", false)!.description, "Ready to go to the provider.");
  assert.equal(deliveryStatusMeta("delivered", false)!.label, "Delivered");
});

// Unknown mode: a row with no test_mode of its own, while the deployment's
// mode couldn't be read, says neither Sent nor Logged.
test("unknown mode: handed-over rows read a neutral status, never Sent, Delivered or Logged", () => {
  for (const status of WENT_OUT_QUEUE) {
    const meta = queueStatusMeta(status, null)!;
    assert.equal(meta.label, "Processed", status);
    assert.doesNotMatch(`${meta.label} ${meta.description}`, LIVE_WORDS);
  }
  for (const status of WENT_OUT_DELIVERY) {
    const meta = deliveryStatusMeta(status, null)!;
    assert.equal(meta.label, "Processed", status);
    assert.doesNotMatch(`${meta.label} ${meta.description}`, LIVE_WORDS);
  }
});

test("queued and processing have test-mode and neutral lines, without live words", () => {
  for (const mode of [true, null] as SendMode[]) {
    for (const status of ["queued", "processing"] as ReminderQueueStatus[]) {
      const meta = queueStatusMeta(status, mode)!;
      assert.doesNotMatch(meta.description, LIVE_WORDS, `${status} ${mode}`);
      assert.notEqual(meta.description, QUEUE_STATUS_META[status].description);
    }
  }
  assert.match(queueStatusMeta("processing", true)!.description, /logged/i);
});

test("status filters: Sent and Delivered read neutral outside live mode, options stay distinct", () => {
  for (const mode of [true, null] as SendMode[]) {
    const queue = queueStatusOptions(mode);
    const delivery = deliveryStatusOptions(mode);
    for (const options of [queue, delivery] as Record<string, { label: string }>[]) {
      assert.notEqual(options.sent.label, "Sent", String(mode));
      assert.notEqual(options.delivered.label, "Delivered", String(mode));
      const labels = Object.values(options).map((o) => o.label);
      assert.equal(new Set(labels).size, labels.length, String(mode));
    }
    assert.deepEqual(Object.keys(queue), Object.keys(QUEUE_STATUS_META));
  }
  assert.equal(queueStatusOptions(true).sent.label, "Logged");
  assert.equal(queueStatusOptions(null).sent.label, "Processed");
  assert.equal(queueStatusOptions(false).sent.label, "Sent");
  assert.equal(deliveryStatusOptions(false).delivered.label, "Delivered");
});

test("chart bars: Sent and Delivered only in live mode", () => {
  assert.equal(chartSeriesLabel("sent", false), "Sent");
  assert.equal(chartSeriesLabel("delivered", false), "Delivered");
  assert.equal(chartSeriesLabel("sent", true), "Logged");
  for (const mode of [true, null] as SendMode[]) {
    assert.doesNotMatch(chartSeriesLabel("sent", mode), LIVE_WORDS);
    assert.doesNotMatch(chartSeriesLabel("delivered", mode), LIVE_WORDS);
  }
  assert.equal(chartSeriesLabel("failed", null), "Failed");
});

test("only a handed-over status carries the Test mode badge", () => {
  assert.deepEqual(
    (Object.keys(QUEUE_STATUS_META) as ReminderQueueStatus[]).filter(queueStatusWentOut),
    ["sent", "delivered"],
  );
  assert.equal(deliveryStatusWentOut("sent"), true);
  assert.equal(deliveryStatusWentOut("opened"), true);
  assert.equal(deliveryStatusWentOut("pending"), false);
  assert.equal(deliveryStatusWentOut("failed"), false);
});

test("skipped names the engine's reasons, cancelled names no longer needed", () => {
  assert.match(QUEUE_STATUS_META.skipped.description, /Auto-Pay/);
  assert.match(QUEUE_STATUS_META.skipped.description, /allow-list/);
  assert.match(QUEUE_STATUS_META.skipped.description, /no active template/);
  assert.match(QUEUE_STATUS_META.cancelled.description, /paid/);
});

test("a reason reads as the server wrote it, else by its code in words", () => {
  assert.equal(
    reminderReason({ reason: "Member has no mobile number", reason_code: "no_contact" }),
    "Member has no mobile number",
  );
  assert.equal(reminderReason({ reason: null, reason_code: "auto_pay" }), "Collected by Auto-Pay");
  assert.equal(reminderReason({ reason: "  ", reason_code: "not_set_up" }), "Sending is not set up");
  assert.equal(reminderReason({ reason: null, reason_code: "invalid_contact" }), "Contact is not a valid mobile number or email address");
  assert.equal(reminderReason({ reason: null, reason_code: "contact_flagged" }), "Contact was marked invalid after a failed send");
  assert.equal(reminderReason({ reason: null, reason_code: "superseded" }), "Another reminder covers this loan today");
  assert.equal(reminderReason({ reason: null, reason_code: "template_unavailable" }), "No active template for this reminder and channel");
  assert.equal(reminderReason({ reason: null, reason_code: "some_new_code" }), "Some new code");
  assert.equal(reminderReason({ reason: null, reason_code: null }), null);
  assert.equal(reminderReason({ reason: null }), null);
  assert.ok(Object.hasOwn(REMINDER_REASON_LABELS, "template_unavailable"));
});

// R2 sends logged counts beside the sent ones; sent leaves out logged-only.
test("dashboard counts: logged figures say Logged, sent figures say Sent", () => {
  assert.equal(KPI_LABELS.sent, "Sent");
  assert.equal(KPI_LABELS.sms_sent, "SMS sent");
  assert.equal(KPI_LABELS.emails_sent, "Emails sent");
  assert.equal(KPI_LABELS.logged, "Logged");
  assert.equal(KPI_LABELS.sms_logged, "SMS logged");
  assert.equal(KPI_LABELS.emails_logged, "Emails logged");
  assert.equal(KPI_LABELS.today, "Reminders today");
});

test("messageSourceLabel: logged-only says so, unknown mode is neutral, failed is Failed", () => {
  assert.equal(
    messageSourceLabel({ status: "sent", source: "system", created_by_name: null, test_mode: true }),
    "Logged automatically, not sent (test mode)",
  );
  assert.equal(
    messageSourceLabel({ status: "sent", source: "manual", created_by_name: "Ana Admin", test_mode: true }),
    "Logged by Ana Admin, not sent (test mode)",
  );
  assert.equal(
    messageSourceLabel({ status: "failed", source: "manual", created_by_name: "Ana Admin", test_mode: true }),
    "Failed",
  );
  const auto = messageSourceLabel({ status: "sent", source: "system", created_by_name: null }, null);
  const manual = messageSourceLabel({ status: "sent", source: "manual", created_by_name: "Ana Admin" }, null);
  assert.equal(auto, "Automatic");
  assert.equal(manual, "Manual, by Ana Admin");
  assert.doesNotMatch(`${auto} ${manual}`, LIVE_WORDS);
});

test("manual send wording: live only when the mode is known live, neutral when unknown", () => {
  const live = manualSendWording(false);
  assert.deepEqual(
    [live.title, live.button, live.busy, live.toastTitle],
    ["Send reminder", "Send reminder", "Sending…", "Reminder queued for sending"],
  );
  const test = manualSendWording(true);
  assert.equal(test.button, "Log reminder (test mode)");
  assert.match(test.toastBody, /not sent/);

  const unknown = manualSendWording(null);
  assert.equal(unknown.button, "Queue reminder");
  assert.equal(unknown.toastBody, "Queued; see Message History for its result.");
  for (const key of ["title", "button", "busy", "toastTitle", "toastBody"] as const) {
    assert.notEqual(unknown[key], live[key], key);
    assert.doesNotMatch(unknown[key], /\bsen[dt]/i, key);
  }
});

test("a redacted message is recognised by redacted_at or a blanked body", () => {
  assert.equal(isMessageRedacted({ body: null, redacted_at: "2028-11-09T04:15:00Z" }), true);
  assert.equal(isMessageRedacted({ body: null }), true);
  assert.equal(isMessageRedacted({ body: "", redacted_at: "2028-11-09T04:15:00Z" }), true);
  assert.equal(isMessageRedacted({ body: "Hi Juan", redacted_at: null }), false);
});

// An answer without the logged* fields can't say its sent* counts leave out
// logged-only messages, so outside a known live mode they read neutral.
test("sent counts read Processed when the answer has no logged counts and the mode isn't live", () => {
  const old = { sent: 3, sms_sent: 2, emails_sent: 1 };
  for (const mode of [true, null] as SendMode[]) {
    const labels = kpiLabels(old, mode);
    assert.equal(labels.sent, "Processed", String(mode));
    assert.equal(labels.sms_sent, "SMS processed", String(mode));
    assert.equal(labels.emails_sent, "Emails processed", String(mode));
    assert.equal(smsMonthLabel({ sent_this_month: 2 }, mode), "Messages processed", String(mode));
  }
  assert.deepEqual(kpiLabels(old, false), KPI_LABELS);
  assert.equal(smsMonthLabel({ sent_this_month: 2 }, false), "Messages sent");
});

test("with logged counts in the answer, sent counts keep Sent when live or unknown", () => {
  for (const mode of [false, null] as SendMode[]) {
    assert.deepEqual(kpiLabels({ sent: 3, logged: 4 }, mode), KPI_LABELS, String(mode));
    assert.equal(smsMonthLabel({ sent_this_month: 2, logged_this_month: 5 }, mode), "Messages sent", String(mode));
  }
});

// Browser check 13: in test mode a plain "Sent" tile reads as if something
// went out. The tiles stay, saying what they count.
test("in test mode the sent tiles say Sent by a real provider", () => {
  const labels = kpiLabels({ sent: 0, logged: 4 }, true);
  assert.equal(labels.sent, "Sent by a real provider");
  assert.equal(labels.sms_sent, "SMS sent by a real provider");
  assert.equal(labels.emails_sent, "Emails sent by a real provider");
  assert.equal(labels.logged, "Logged");
  assert.equal(smsMonthLabel({ sent_this_month: 0, logged_this_month: 5 }, true), "Messages sent by a real provider");
});

// "Couldn't read sending status" shows whenever the settings call has
// settled and still says nothing about the mode.
test("sending status is unreadable once settled without a test_mode, data or not", () => {
  assert.equal(sendingStatusUnreadable({ loading: false, data: { enabled: true } }), true);
  assert.equal(sendingStatusUnreadable({ loading: false, data: null }), true);
  assert.equal(sendingStatusUnreadable({ loading: false, data: { test_mode: true } }), false);
  assert.equal(sendingStatusUnreadable({ loading: false, data: { test_mode: false } }), false);
  assert.equal(sendingStatusUnreadable({ loading: true, data: null }), false);
  assert.equal(sendingStatusUnreadable({ loading: false, data: null }, false), false);
});

test("R2's reason codes read in words: a deleted rule, a message already handed over", () => {
  assert.equal(reminderReason({ reason: null, reason_code: "rule_deleted" }), "Its rule was deleted");
  assert.equal(
    reminderReason({ reason: null, reason_code: "already_handed_over" }),
    "Its message was already handed over; not sent again",
  );
});

// daily[].logged (R2) gets its own bar; with it present, "sent" leaves out
// logged-only messages and keeps its live word, like the counts.
test("chart: a Logged bar, and Sent stays Sent when the answer carries logged", () => {
  assert.equal(chartSeriesLabel("logged", true), "Logged");
  assert.equal(chartSeriesLabel("logged", null), "Logged");
  assert.equal(chartSeriesLabel("sent", true, true), "Sent");
  assert.equal(chartSeriesLabel("sent", null, true), "Sent");
  assert.equal(chartSeriesLabel("sent", true, false), "Logged");
  assert.equal(chartSeriesLabel("sent", null), "Processed");
});

// R2 security fixes: the server lists the templates that fit the loan today.
test("the Send dialog offers exactly the server's allowed templates, in its order", () => {
  assert.deepEqual(offeredTemplates(["past_due", "partial_payment"]), ["past_due", "partial_payment"]);
  assert.deepEqual(offeredTemplates(["payment_confirmation"]), ["payment_confirmation"]);
  assert.deepEqual(offeredTemplates(["upcoming", "nonsense" as never, "upcoming"]), ["upcoming"]);
  assert.deepEqual(offeredTemplates([]), []);
  assert.match(NO_TEMPLATE_FITS, /no reminder fits this loan today/i);
});

test("an answer without allowed templates falls back to every manual reminder type", () => {
  assert.deepEqual(offeredTemplates(undefined), ["upcoming", "due_today", "past_due", "long_past_due", "partial_payment"]);
  assert.deepEqual(offeredTemplates(null), offeredTemplates(undefined));
});

// Every-branch rules need branches:view_all (403 otherwise).
test("validateRule: without every-branch access a rule needs a branch", () => {
  const problems = validateRule(rule({ branch_id: null }), HOURS, { allBranches: false });
  assert.deepEqual(problems, ["Branch (rules for every branch need access to every branch)"]);
  assert.deepEqual(validateRule(rule({ branch_id: 3 }), HOURS, { allBranches: false }), []);
  assert.deepEqual(validateRule(rule({ branch_id: null }), HOURS, { allBranches: true }), []);
  assert.deepEqual(validateRule(rule({ branch_id: null }), HOURS), []);
});

test("a stored every-branch rule is locked, with a reason, for a branch user", () => {
  assert.equal(ruleLockReason({ branch_id: null }, false), COMPANY_WIDE_REASON);
  assert.equal(ruleLockReason({ branch_id: 3 }, false), null);
  assert.equal(ruleLockReason({ branch_id: null }, true), null);
  assert.match(COMPANY_WIDE_REASON, /every branch/);
});

// Without borrowers:view the server leaves contacts out; that is not "none".
test("a hidden contact reads hidden, never None on file", () => {
  assert.equal(contactValueLabel("63917*****01", true), "63917*****01");
  assert.equal(contactValueLabel(null, true), "None on file");
  assert.equal(contactValueLabel(null, false), "Hidden (needs access to member details)");
  assert.equal(contactValueLabel("63917*****01", false), "63917*****01");
});

test("a null recipient or pause reason shows a dash or nothing", () => {
  assert.equal(recipientLabel(null), "—");
  assert.equal(recipientLabel(undefined), "—");
  assert.equal(recipientLabel("ju***@example.com"), "ju***@example.com");
  assert.equal(pauseReasonSuffix({ reason: "Restructure talks" }), " — Restructure talks");
  assert.equal(pauseReasonSuffix({ reason: null }), "");
  assert.equal(pauseReasonSuffix({ reason: "  " }), "");
});

// R2 re-review: a failed row's provider text is null for callers without
// borrowers:view or the member's branch.
test("a failed row without its reason reads Details hidden, never blank", () => {
  assert.equal(HIDDEN_DETAILS, "Details hidden (needs access to member details)");
  assert.equal(reminderReason({ reason: null, reason_code: "provider_error" }, { failed: true }), HIDDEN_DETAILS);
  assert.equal(reminderReason({ reason: null }, { failed: true }), HIDDEN_DETAILS);
  assert.equal(reminderReason({ reason: "  " }, { failed: true }), HIDDEN_DETAILS);
  assert.equal(
    reminderReason({ reason: "Sending is not set up", reason_code: "not_set_up" }, { failed: true }),
    "Sending is not set up",
  );
  assert.equal(reminderReason({ reason: null, reason_code: "auto_pay" }), "Collected by Auto-Pay");
  assert.equal(reminderReason({ reason: null }), null);
});

// Mirrors R2's TemplateFit::FOR_TRIGGER; the payment-state templates don't
// apply to rules.
test("a rule's templates follow its trigger", () => {
  assert.deepEqual(RULE_TEMPLATES_FOR_TRIGGER, {
    before_due: ["upcoming"],
    on_due: ["due_today"],
    after_due: ["past_due", "long_past_due"],
  });
});

test("changing the trigger keeps a fitting template and resets one that doesn't", () => {
  assert.equal(fitRuleTemplate("after_due", "long_past_due"), "long_past_due");
  assert.equal(fitRuleTemplate("after_due", "upcoming"), "past_due");
  assert.equal(fitRuleTemplate("before_due", "past_due"), "upcoming");
  assert.equal(fitRuleTemplate("on_due", "upcoming"), "due_today");
  assert.equal(fitRuleTemplate("before_due", "partial_payment"), "upcoming");
});

test("validateRule refuses a template that doesn't fit the trigger", () => {
  assert.deepEqual(validateRule(rule({ trigger: "before_due", template_type: "past_due" }), HOURS), [
    "Template (Upcoming due for this trigger)",
  ]);
  assert.deepEqual(
    validateRule(rule({ trigger: "after_due", days: 3, template_type: "due_today" }), HOURS),
    ["Template (Past due or Long past due for this trigger)"],
  );
  assert.deepEqual(validateRule(rule({ trigger: "after_due", days: 15, template_type: "long_past_due" }), HOURS), []);
});

// Browser check 13: the API sends recipient null both when the contact is
// hidden and when it's missing; only a user with borrowers:view knows which.
test("a null recipient reads Hidden for a user without member access, a dash otherwise", () => {
  assert.equal(recipientLabel(null, false), "Hidden (needs access to member details)");
  assert.equal(recipientLabel(undefined, false), "Hidden (needs access to member details)");
  assert.equal(recipientLabel(null, true), "—");
  assert.equal(recipientLabel("63917*****01", false), "63917*****01");
});

test("the loan card's send button uses the dialog's wording: Send only when live", () => {
  assert.equal(sendButtonLabel(true), "Log reminder (test mode)");
  assert.equal(sendButtonLabel(null), "Queue reminder");
  assert.equal(sendButtonLabel(false), "Send reminder");
  for (const mode of [true, null] as SendMode[]) assert.doesNotMatch(sendButtonLabel(mode), /\bsend/i);
});

test("the Templates page intro doesn't say a reminder sends", () => {
  assert.doesNotMatch(TEMPLATES_PAGE_INTRO, /\bsen[dt]/i);
  assert.match(TEMPLATES_PAGE_INTRO, /when a reminder is made/);
});

test("the preview's blocked notice: logged in test mode, queued when unknown, sent only when live", () => {
  assert.equal(manualSendWording(true).blocked, "This reminder can't be logged");
  assert.equal(manualSendWording(null).blocked, "This reminder can't be queued");
  assert.equal(manualSendWording(false).blocked, "This reminder can't be sent");
});

// The log driver reaches nobody, so it isn't a provider.
test("the log driver reads as no provider", () => {
  assert.equal(providerLabel("log"), "none (test mode, logged only)");
  assert.equal(providerLabel("semaphore"), "semaphore");
  assert.equal(providerLabel(null), null);
});
