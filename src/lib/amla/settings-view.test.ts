import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AmlaCalendar, AmlaChangeRequest, AmlaDeadlinePreview, AmlaLogEntry, AmlaSetting, AmlaSettingsVersion } from "@/types/amla";
import {
  AMLA_CALENDAR_KIND_OPTIONS,
  AMLA_CHANNEL_OPTIONS,
  AMLA_LOG_ACTION_OPTIONS,
  amlaCalendarAddBody,
  amlaCalendarHeadline,
  amlaChangeRequestChanges,
  amlaChangeRequestLines,
  amlaDeadlineLines,
  amlaLogRow,
  amlaReasonError,
  amlaSettingRow,
  amlaSettingsChangeBody,
  amlaSettingsDraft,
  amlaStatusLines,
  amlaVersionLines,
  amlaYearChoices,
} from "./settings-view";

const ana = { id: 7, name: "Ana Cruz" };
const ben = { id: 8, name: "Ben Reyes" };

const SETTINGS: AmlaSetting[] = [
  { key: "ctr_threshold", label: "Covered transaction (CTR): one transaction above this amount", unit: "peso", value: "500000.00", value_words: "₱500,000.00", to_verify: true, source: null },
  { key: "ctr_cash_channels", label: "Payment channels counted as cash for a CTR", unit: "channels", value: ["cash"], value_words: "Cash", to_verify: true, source: null },
  { key: "ctr_deadline_working_days", label: "A CTR is due within this many working days after the transaction", unit: "working_days", value: 5, value_words: "5 working days", to_verify: false, source: "AMLC RI No. 2, s. 2024" },
];

test("the status reads in words: monitoring, settings version, what is to verify, and the calendar", () => {
  assert.deepEqual(
    amlaStatusLines({ monitoring_enabled: false, settings_version: 1, settings_to_verify: 7, calendar_year: 2026, calendar_confirmed: false }),
    [
      { label: "Monitoring", value: "Off. The server's AMLA monitoring switch is off." },
      { label: "Settings in force", value: "Version 1" },
      { label: "Settings to verify", value: "7 settings are still to verify." },
      { label: "2026 calendar", value: "Provisional: not confirmed yet." },
    ],
  );
  const on = amlaStatusLines({ monitoring_enabled: true, settings_version: 3, settings_to_verify: 1, calendar_year: 2027, calendar_confirmed: true });
  assert.equal(on[0].value, "On.");
  assert.equal(on[2].value, "1 setting is still to verify.");
  assert.equal(on[3].value, "Confirmed.");
  const none = amlaStatusLines({ monitoring_enabled: true, settings_version: 3, settings_to_verify: 0, calendar_year: 2027, calendar_confirmed: true });
  assert.equal(none[2].value, "Every setting is confirmed.");
});

test("a setting reads the server's words, marked to verify or with what confirmed it", () => {
  assert.deepEqual(amlaSettingRow(SETTINGS[0]), {
    key: "ctr_threshold",
    label: SETTINGS[0].label,
    value: "₱500,000.00",
    toVerify: true,
    check: "To verify",
  });
  assert.equal(amlaSettingRow(SETTINGS[2]).check, "Confirmed: AMLC RI No. 2, s. 2024");
  assert.equal(amlaSettingRow({ ...SETTINGS[2], source: null }).check, "Confirmed");
  assert.equal(amlaSettingRow({ ...SETTINGS[0], value: null, value_words: null }).value, "—");
});

test("the peso value is the server's words, never worked out in the browser", () => {
  const row = amlaSettingRow({ ...SETTINGS[0], value: "500000.5", value_words: "₱500,000.50" });
  assert.equal(row.value, "₱500,000.50");
});

const VERSION: AmlaSettingsVersion = {
  id: 2,
  version: 2,
  source: "approved_change",
  effective_at: "2026-11-19T02:05:00.000000Z",
  requested_by: ana,
  approved_by: ben,
  request_id: 4,
  to_verify_count: 6,
  settings: SETTINGS,
};

test("a version reads its number, when it took effect, who asked and who approved", () => {
  assert.deepEqual(amlaVersionLines(VERSION), {
    title: `Version 2, in force from ${formatDateTime(VERSION.effective_at)}`,
    origin: "Asked for by Ana Cruz, approved by Ben Reyes.",
    toVerify: "6 settings are still to verify.",
  });
  const first = amlaVersionLines({ ...VERSION, version: 1, source: "system_default", requested_by: null, approved_by: null, request_id: null });
  assert.equal(first.origin, "The starting values installed with AMLA.");
});

const REQUEST: AmlaChangeRequest = {
  id: 4,
  type: "settings",
  type_words: "AMLA settings",
  status: "pending",
  status_words: "Waiting for approval",
  summary: "AMLA settings: CTR threshold",
  payload: { base_version: 1 },
  reason: "Counsel confirmed the amount.",
  requested_by: ana,
  requested_at: "2026-11-19T02:05:00.000000Z",
  decided_by: null,
  decided_at: null,
  decision_note: null,
};

test("a change request reads its summary, who asked and when, and the decision when there is one", () => {
  assert.deepEqual(amlaChangeRequestLines(REQUEST), {
    summary: "AMLA settings: CTR threshold",
    asked: `Asked by Ana Cruz, ${formatDateTime(REQUEST.requested_at)}`,
    decided: null,
  });
  const decided = amlaChangeRequestLines({ ...REQUEST, status: "rejected", status_words: "Rejected", decided_by: ben, decided_at: "2026-11-19T03:00:00Z", decision_note: "Wrong source." });
  assert.equal(decided.decided, `Rejected by Ben Reyes, ${formatDateTime("2026-11-19T03:00:00Z")}. Note: Wrong source.`);
});

test("a change request never shows its raw payload", () => {
  const lines = amlaChangeRequestLines(REQUEST);
  assert.doesNotMatch(JSON.stringify(lines), /base_version/);
});

test("the draft starts from the values in force", () => {
  assert.deepEqual(amlaSettingsDraft(SETTINGS), {
    ctr_threshold: { value: "500000.00", channels: [], check: "keep", source: "" },
    ctr_cash_channels: { value: "", channels: ["cash"], check: "keep", source: "" },
    ctr_deadline_working_days: { value: "5", channels: [], check: "keep", source: "" },
  });
});

test("only changed values are sent, with the reason", () => {
  const draft = amlaSettingsDraft(SETTINGS);
  draft.ctr_threshold.value = " 450000.50 ";
  draft.ctr_cash_channels.channels = ["gcash", "cash"];
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, " Counsel advice "), {
    body: {
      type: "settings",
      reason: "Counsel advice",
      values: { ctr_threshold: "450000.50", ctr_cash_channels: ["cash", "gcash"] },
    },
  });
});

test("confirming a setting sends its source; marking one to verify again sends its key", () => {
  const draft = amlaSettingsDraft(SETTINGS);
  draft.ctr_threshold.check = "confirm";
  draft.ctr_threshold.source = " AMLA IRR 2018, Rule 22 ";
  draft.ctr_deadline_working_days.check = "to_verify";
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    body: {
      type: "settings",
      reason: "Review",
      verified: { ctr_threshold: "AMLA IRR 2018, Rule 22" },
      to_verify: ["ctr_deadline_working_days"],
    },
  });
});

test("the settings form says what is missing, in words", () => {
  const draft = amlaSettingsDraft(SETTINGS);
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    error: "Change a value, or confirm or re-open a setting, before asking.",
  });
  draft.ctr_threshold.value = "450000";
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "  "), { error: "Give the reason for the change." });
  draft.ctr_threshold.value = "45,000";
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    error: `"${SETTINGS[0].label}" needs an amount in pesos with up to two decimals, such as 500000.00.`,
  });
  draft.ctr_threshold.value = "500000.00";
  draft.ctr_deadline_working_days.value = "5.5";
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    error: `"${SETTINGS[2].label}" needs a whole number.`,
  });
  draft.ctr_deadline_working_days.value = "5";
  draft.ctr_cash_channels.channels = [];
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    error: `"${SETTINGS[1].label}" needs at least one channel.`,
  });
  draft.ctr_cash_channels.channels = ["cash"];
  draft.ctr_threshold.check = "confirm";
  assert.deepEqual(amlaSettingsChangeBody(SETTINGS, draft, "Review"), {
    error: `Say what confirmed "${SETTINGS[0].label}".`,
  });
});

test("the channel choices read in words, the five payment methods the server accepts", () => {
  assert.deepEqual(AMLA_CHANNEL_OPTIONS.map((o) => o.value), ["cash", "gcash", "maya", "bank_transfer", "online"]);
  assert.deepEqual(AMLA_CHANNEL_OPTIONS.map((o) => o.label), ["Cash", "GCash", "Maya", "Bank Transfer", "Online"]);
});

test("a reason or a rejection note is required, in words", () => {
  assert.equal(amlaReasonError(""), "Give the reason for the change.");
  assert.equal(amlaReasonError(" ok "), null);
  assert.equal(amlaReasonError("x".repeat(1001)), "Keep it to 1,000 characters.");
});

const CALENDAR: AmlaCalendar = {
  year: 2026,
  confirmed: false,
  confirmed_at: null,
  provisional: true,
  entries: [],
};

test("the calendar headline says whether the year is confirmed", () => {
  assert.equal(
    amlaCalendarHeadline(CALENDAR),
    "The 2026 calendar isn't confirmed yet, so deadlines that reach 2026 are provisional.",
  );
  assert.equal(
    amlaCalendarHeadline({ ...CALENDAR, confirmed: true, provisional: false, confirmed_at: "2026-01-05T01:00:00Z" }),
    `The 2026 calendar was confirmed ${formatDateTime("2026-01-05T01:00:00Z")}.`,
  );
});

test("a calendar day request needs every field, and sends them trimmed", () => {
  const form = { date: "2026-12-30", kind: "holiday", name: " Rizal Day ", source: " Proclamation No. 727 ", reason: " Official " };
  assert.deepEqual(amlaCalendarAddBody(form), {
    body: { type: "calendar_add", date: "2026-12-30", kind: "holiday", name: "Rizal Day", source: "Proclamation No. 727", reason: "Official" },
  });
  assert.deepEqual(amlaCalendarAddBody({ ...form, date: "" }), { error: "Pick the date." });
  assert.deepEqual(amlaCalendarAddBody({ ...form, kind: "" }), { error: "Pick what kind of day it is." });
  assert.deepEqual(amlaCalendarAddBody({ ...form, name: " " }), { error: "Give the day's name." });
  assert.deepEqual(amlaCalendarAddBody({ ...form, source: "" }), { error: "Say where the day was announced." });
  assert.deepEqual(amlaCalendarAddBody({ ...form, reason: "" }), { error: "Give the reason for the change." });
});

test("the calendar kinds read in words", () => {
  assert.deepEqual(AMLA_CALENDAR_KIND_OPTIONS, [
    { value: "holiday", label: "Holiday" },
    { value: "amlc_non_reporting", label: "AMLC non-reporting day" },
    { value: "facility_suspension", label: "Facility suspension" },
  ]);
});

const PREVIEW: AmlaDeadlinePreview = {
  kind: "ctr",
  kind_words: "Covered transaction report (CTR)",
  from: "2026-12-28",
  due_on: "2027-01-05",
  working_days: 5,
  provisional: true,
  provisional_years: [2026, 2027],
  settings_version: 1,
  to_verify: true,
};

test("a deadline preview reads the server's due date, with its provisional and to-verify notes", () => {
  assert.deepEqual(amlaDeadlineLines(PREVIEW), {
    due: `Due ${formatDate("2027-01-05")}`,
    detail: `Covered transaction report (CTR): 5 working days after ${formatDate("2026-12-28")}, counted from the next day, under settings version 1.`,
    notes: [
      "Provisional: the 2026 and 2027 calendars aren't confirmed yet.",
      "The deadline setting is still to verify.",
    ],
  });
  const firm = amlaDeadlineLines({ ...PREVIEW, kind: "str", kind_words: "Suspicious transaction report (STR)", working_days: 1, provisional: false, provisional_years: [], to_verify: false });
  assert.match(firm.detail, /: 1 working day after/);
  assert.deepEqual(firm.notes, []);
  const oneYear = amlaDeadlineLines({ ...PREVIEW, provisional_years: [2027] });
  assert.equal(oneYear.notes[0], "Provisional: the 2027 calendar isn't confirmed yet.");
});

const LOG: AmlaLogEntry = {
  id: 9,
  at: "2026-11-19T02:05:00.000000Z",
  action: "change_requested",
  action_words: "Change asked for",
  actor_type: "user",
  actor: ana,
  subject_type: "change_request",
  subject_id: 4,
  subject_words: "Change request #4",
  details: { type: "settings" },
  ip_address: "127.0.0.1",
};

test("a log row reads when, who, what and on what, in words, never its raw details", () => {
  assert.deepEqual(amlaLogRow(LOG), {
    id: 9,
    when: formatDateTime(LOG.at),
    who: "Ana Cruz",
    action: "Change asked for",
    subject: "Change request #4",
  });
  const system = amlaLogRow({ ...LOG, actor_type: "system", actor: null, subject_type: null, subject_id: null, subject_words: null });
  assert.equal(system.who, "System");
  assert.equal(system.subject, "—");
});

test("the log filter offers the server's actions in words", () => {
  assert.deepEqual(AMLA_LOG_ACTION_OPTIONS.map((o) => o.value), [
    "access_denied",
    "log_viewed",
    "change_requested",
    "change_approved",
    "change_rejected",
    "change_withdrawn",
  ]);
  assert.ok(AMLA_LOG_ACTION_OPTIONS.every((o) => !o.label.includes("_")));
});

test("the year picker offers the year shown and the years either side", () => {
  assert.deepEqual(amlaYearChoices(2026), [2025, 2026, 2027]);
});

const SETTINGS_PAYLOAD = {
  base_version: 1,
  values: {},
  to_verify: [],
  sources: { ctr_deadline_working_days: "AMLC RI No. 2, s. 2024", str_deadline_working_days: "AMLC advisory" },
  changed: {
    ctr_cash_channels: { from: ["cash"], to: ["cash", "gcash"] },
    ctr_threshold: { from: "500000.00", to: "450000.50" },
    review_years_high: { from: 1, to: 2 },
    ctr_deadline_working_days: { from: 5, to: 1 },
  },
  sources_changed: {
    ctr_deadline_working_days: { from: null, to: "AMLC RI No. 2, s. 2024" },
    str_deadline_working_days: { from: "Old memo", to: "AMLC advisory" },
    review_years_low: { from: "Board policy", to: null },
  },
  verified: ["ctr_deadline_working_days"],
  unverified: ["review_years_low"],
};

test("a settings change lists each change in words, in force when asked → proposed, in the server's settings order", () => {
  assert.deepEqual(amlaChangeRequestChanges({ ...REQUEST, payload: SETTINGS_PAYLOAD }), [
    "CTR threshold: ₱500,000.00 → ₱450,000.50",
    "CTR cash channels: Cash → Cash, GCash",
    "CTR deadline: 5 working days → 1 working day",
    "CTR deadline: confirmed by AMLC RI No. 2, s. 2024",
    "STR deadline: what confirmed it changes to AMLC advisory",
    "High risk review cycle: 1 year → 2 years",
    "Low risk review cycle: marked to verify again",
  ]);
});

test("calendar requests and unreadable payloads add nothing: the summary already says it", () => {
  assert.deepEqual(amlaChangeRequestChanges({ ...REQUEST, type: "calendar_add", payload: { date: "2026-12-30" } }), []);
  assert.deepEqual(amlaChangeRequestChanges({ ...REQUEST, payload: null }), []);
  assert.deepEqual(amlaChangeRequestChanges({ ...REQUEST, payload: { changed: [] } }), []);
});

test("a setting this screen doesn't know yet never shows its stored key", () => {
  const lines = amlaChangeRequestChanges({ ...REQUEST, payload: { changed: { new_rule: { from: 1, to: 2 } } } });
  assert.deepEqual(lines, ["Another setting: changed"]);
});
