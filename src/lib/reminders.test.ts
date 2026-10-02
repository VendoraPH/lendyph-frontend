import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES,
  QUEUE_STATUS_META,
  TEMPLATE_VARIABLES,
  describeRule,
  formatSendTime,
  renderTemplateSample,
  smsLength,
  toSettingsPayload,
  unknownVariables,
  validateContactWindow,
  validateRule,
} from "./reminders";
import type { ReminderRuleInput, ReminderSettingsUpdate } from "@/types/reminder";

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
