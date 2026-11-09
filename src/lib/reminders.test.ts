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
  isLoggedOnly,
  kpiLabel,
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
  assert.deepEqual(validateRule(rule({ trigger: "on_due", days: 0 }), HOURS), []);
  assert.deepEqual(validateRule(rule({ trigger: "on_due", days: 2 }), HOURS), [
    "Days must be 0 on the due date",
  ]);
});

test("validateRule keeps the send time inside contact hours", () => {
  assert.equal(validateRule(rule({ send_time: "07:59" }), HOURS).length, 1);
  assert.equal(validateRule(rule({ send_time: "18:01" }), HOURS).length, 1);
  assert.deepEqual(validateRule(rule({ send_time: "18:00" }), HOURS), []);
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
  assert.equal(messageSourceLabel({ status: "delivered", source: "system", created_by_name: null }), "Sent automatically");
  assert.equal(
    messageSourceLabel({ status: "sent", source: "manual", created_by_name: "Ana Admin" }),
    "Sent manually by Ana Admin",
  );
  assert.equal(messageSourceLabel({ status: "sent", source: "manual", created_by_name: null }), "Sent manually");
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

test("test mode: on while the server says so or the cooperative's switch is off", () => {
  assert.equal(reminderTestMode({ enabled: true, test_mode: true }), true);
  assert.equal(reminderTestMode({ enabled: false, test_mode: false }), true);
  assert.equal(reminderTestMode({ enabled: false, test_mode: true }), true);
  assert.equal(reminderTestMode({ enabled: true, test_mode: false }), false);
});

// Only the server's explicit "live" turns the banner off; an answer that
// says nothing about live sending is not read as live.
test("test mode: a settings answer without test_mode is test mode; no settings is unknown", () => {
  assert.equal(reminderTestMode({ enabled: true } as { enabled: boolean; test_mode: boolean }), true);
  assert.equal(reminderTestMode(null), null);
  assert.equal(reminderTestMode(undefined), null);
});

test("a row is logged-only by its own test_mode, else by the deployment's", () => {
  assert.equal(isLoggedOnly({ test_mode: true }, false), true);
  assert.equal(isLoggedOnly({ test_mode: false }, true), false);
  assert.equal(isLoggedOnly({}, true), true);
  assert.equal(isLoggedOnly({ test_mode: null }, true), true);
  assert.equal(isLoggedOnly({}, false), false);
  assert.equal(isLoggedOnly({}, null), false);
});

test("in test mode a sent reminder reads Logged, never Sent or Delivered", () => {
  for (const status of ["sent", "delivered"] as ReminderQueueStatus[]) {
    const meta = queueStatusMeta(status, true)!;
    assert.equal(meta.label, "Logged", status);
    assert.match(meta.description, /not sent/i);
  }
  for (const status of ["sent", "delivered", "opened"] as DeliveryStatus[]) {
    assert.equal(deliveryStatusMeta(status, true)!.label, "Logged", status);
  }
  assert.equal(queueStatusMeta("sent", false)!.label, "Sent");
  assert.equal(deliveryStatusMeta("delivered", false)!.label, "Delivered");
  assert.equal(queueStatusMeta("skipped", true)!.label, "Skipped");
  assert.equal(queueStatusMeta("cancelled", true)!.label, "Cancelled");
  assert.equal(deliveryStatusMeta("failed", true)!.label, "Failed");
  assert.equal(queueStatusMeta("nonsense" as ReminderQueueStatus, false), undefined);
});

test("skipped names the engine's reasons, cancelled names no longer needed", () => {
  assert.match(QUEUE_STATUS_META.skipped.description, /Auto-Pay/);
  assert.match(QUEUE_STATUS_META.skipped.description, /allow-list/);
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
  assert.equal(reminderReason({ reason: null, reason_code: "some_new_code" }), "Some new code");
  assert.equal(reminderReason({ reason: null, reason_code: null }), null);
  assert.equal(reminderReason({ reason: null }), null);
});

test("dashboard counts of sent messages say Logged in test mode", () => {
  assert.equal(kpiLabel("sent", true), "Logged");
  assert.equal(kpiLabel("sms_sent", true), "SMS logged");
  assert.equal(kpiLabel("emails_sent", true), "Emails logged");
  assert.equal(kpiLabel("sent", false), "Sent");
  assert.equal(kpiLabel("sms_sent", false), "SMS sent");
  assert.equal(kpiLabel("today", true), "Reminders today");
  assert.equal(kpiLabel("failed", true), "Failed");
});

test("messageSourceLabel never says Sent for a logged-only message", () => {
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
});

// Status filters: in test mode the "sent" filter reads Logged; every other
// option keeps its own label, so no two options read the same.
test("status filters say Logged for sent in test mode, and keep every option distinct", () => {
  const queue = queueStatusOptions(true);
  assert.equal(queue.sent.label, "Logged");
  assert.equal(queue.cancelled.label, "Cancelled");
  assert.deepEqual(Object.keys(queue), Object.keys(QUEUE_STATUS_META));
  assert.equal(new Set(Object.values(queue).map((o) => o.label)).size, Object.keys(queue).length);
  assert.equal(queueStatusOptions(false).sent.label, "Sent");

  const delivery = deliveryStatusOptions(true);
  assert.equal(delivery.sent.label, "Logged");
  assert.equal(new Set(Object.values(delivery).map((o) => o.label)).size, Object.keys(delivery).length);
  assert.equal(deliveryStatusOptions(false).sent.label, "Sent");
});

// The Test mode badge goes on a message that was logged, not on one still
// scheduled, skipped or cancelled.
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
