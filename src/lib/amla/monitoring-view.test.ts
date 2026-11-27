import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  AmlaAlertDetail,
  AmlaAlertHistoryStep,
  AmlaAlertRow,
  AmlaCtrRow,
  AmlaDetectionRulesVersion,
  AmlaMonitoredTransaction,
  AmlaRiskRules,
} from "@/types/amla-monitoring";
import {
  AMLA_ALERT_STATUS_OPTIONS,
  AMLA_DETECTION_RULE_OPTIONS,
  AMLA_PRIORITY_OPTIONS,
  amlaAlertLines,
  amlaAlertRow,
  amlaAlertHistoryLine,
  amlaAlertStepNote,
  amlaEscalationNotes,
  amlaAlertWithRow,
  amlaCloseReasonBody,
  amlaCtrRow,
  amlaDetectionChangeBody,
  amlaDetectionDraft,
  amlaDetectionRuleRows,
  amlaListTotalText,
  amlaPublicText,
  amlaPriorityTone,
  amlaRiskChangeBody,
  amlaRiskDraft,
  amlaRiskRulesView,
  amlaParamFieldLabel,
  amlaRuleParamKind,
  amlaRuleParamLabel,
  amlaRuleVersionLine,
  amlaTransactionRow,
} from "./monitoring-view";

const NA = "Data not available";

test("the filters read in the server's words", () => {
  assert.deepEqual(AMLA_ALERT_STATUS_OPTIONS, [
    { value: "open", label: "Open" },
    { value: "assigned", label: "Assigned" },
    { value: "under_review", label: "Under review" },
    { value: "escalated", label: "Escalated to a case" },
    { value: "closed", label: "Closed with a documented reason" },
    { value: "cleared", label: "Cleared by a rerun" },
  ]);
  assert.deepEqual(AMLA_PRIORITY_OPTIONS.map((o) => o.label), ["Critical", "High", "Medium", "Low"]);
  assert.deepEqual(AMLA_DETECTION_RULE_OPTIONS.map((o) => o.value), ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  assert.equal(AMLA_DETECTION_RULE_OPTIONS[0].label, "A · Transaction structuring");
  assert.equal(AMLA_DETECTION_RULE_OPTIONS[11].label, "L · Relevant watchlist matches");
});

test("a priority's badge says how urgent it is", () => {
  assert.equal(amlaPriorityTone("critical"), "destructive");
  assert.equal(amlaPriorityTone("high"), "destructive");
  assert.equal(amlaPriorityTone("medium"), "secondary");
  assert.equal(amlaPriorityTone("low"), "outline");
  assert.equal(amlaPriorityTone("unknown"), "outline");
});

const ALERT: AmlaAlertRow = {
  id: 9,
  reference: "AML-ALR-000009",
  rule_code: "A",
  rule: "Transaction structuring",
  rule_version: 1,
  priority: "high",
  priority_words: "High",
  status: "open",
  status_words: "Open",
  subject: { type: "member", id: 7, name: "Juan Dela Cruz", code: "BRW-000007", account: NA },
  branch: { id: 1, name: "Main" },
  window_start: "2026-11-20",
  window_end: "2026-11-20",
  amount: "₱600,000.00",
  transactions_count: 3,
  from_history: false,
  detected_at: "2026-11-20T02:00:00+00:00",
};

test("an alert row reads in words, with the server's ₱ total", () => {
  assert.deepEqual(amlaAlertRow(ALERT), {
    id: 9,
    href: "/amla/alerts/9",
    reference: "AML-ALR-000009",
    rule: "A · Transaction structuring",
    version: "Rules version 1",
    priority: "High",
    tone: "destructive",
    status: "Open",
    subject: "Juan Dela Cruz",
    code: "BRW-000007",
    branch: "Main",
    window: formatDate("2026-11-20"),
    amount: "₱600,000.00",
    transactions: "3 transactions",
    history: null,
    detected: formatDateTime("2026-11-20T02:00:00+00:00"),
  });
});

test("a window over several days, one transaction, history screening and a head-office alert read as such", () => {
  const row = amlaAlertRow({ ...ALERT, window_start: "2026-11-14", window_end: "2026-11-20", transactions_count: 1, from_history: true, branch: { id: null, name: "Organisation-wide" }, detected_at: null });
  assert.equal(row.window, `${formatDate("2026-11-14")} to ${formatDate("2026-11-20")}`);
  assert.equal(row.transactions, "1 transaction");
  assert.equal(row.history, "From history screening");
  assert.equal(row.branch, "Organisation-wide");
  assert.equal(row.detected, "—");
});

test("a subject Lendy doesn't hold reads the server's words", () => {
  const row = amlaAlertRow({ ...ALERT, subject: { type: null, id: null, name: NA, code: NA, account: NA } });
  assert.equal(row.subject, NA);
  assert.equal(row.code, NA);
});

const DETAIL: AmlaAlertDetail = {
  ...ALERT,
  reason: "Three cash payments on one day, each below the CTR threshold, total above it.",
  indicators: [
    { label: "Transactions", value: "3" },
    { label: "Day's total", value: "₱600,000.00" },
  ],
  cleared_at: null,
  cleared_note: null,
  transactions: [],
};

test("an alert's detail gives its reason, indicators, the subject's CDD link for amla:cdd holders, and a clearing", () => {
  assert.deepEqual(amlaAlertLines(DETAIL, true), {
    reason: DETAIL.reason,
    indicators: [
      { label: "Transactions", value: "3" },
      { label: "Day's total", value: "₱600,000.00" },
    ],
    subjectHref: "/amla/customers/members/7",
    cleared: null,
  });
  assert.equal(amlaAlertLines(DETAIL, false).subjectHref, null);
  assert.equal(amlaAlertLines({ ...DETAIL, subject: { ...DETAIL.subject, type: "walk_in", id: 4 } }, true).subjectHref, "/amla/customers/walk-ins/4");
  assert.equal(amlaAlertLines({ ...DETAIL, subject: { ...DETAIL.subject, type: null, id: null } }, true).subjectHref, null);
  const cleared = amlaAlertLines({ ...DETAIL, status: "cleared", cleared_at: "2026-11-21T01:00:00Z", cleared_note: "The payment was voided." }, true);
  assert.equal(cleared.cleared, `Cleared ${formatDateTime("2026-11-21T01:00:00Z")}: The payment was voided.`);
});

const TRANSACTION: AmlaMonitoredTransaction = {
  id: 31,
  kind: "repayment",
  kind_words: "Loan payment",
  direction_words: "Money in",
  internal: false,
  amount: "₱200,000.00",
  occurred_on: "2026-11-20",
  channel: "Cash",
  reference: "RCP-000031",
  branch: "Main",
  reversed: false,
  reversed_at: null,
};

test("a transaction behind an alert reads in words, marked when reversed or internal", () => {
  assert.deepEqual(amlaTransactionRow(TRANSACTION), {
    id: 31,
    kind: "Loan payment",
    direction: "Money in",
    amount: "₱200,000.00",
    date: formatDate("2026-11-20"),
    channel: "Cash",
    reference: "RCP-000031",
    branch: "Main",
    notes: [],
  });
  assert.deepEqual(amlaTransactionRow({ ...TRANSACTION, internal: true, reversed: true, reversed_at: "2026-11-21T01:00:00Z" }).notes, [
    "Internal movement, never new funds",
    `Reversed ${formatDateTime("2026-11-21T01:00:00Z")}`,
  ]);
});

const CTR: AmlaCtrRow = {
  id: 3,
  reference: "AML-CTR-000003",
  status: "detected",
  status_words: "Detected",
  amount: "₱650,000.00",
  threshold: "₱500,000.00",
  settings_version: 2,
  direction_words: "Money in",
  channel_words: "Cash",
  subject: { type: "walk_in", id: 4, name: "Pedro Santos", code: NA, account: NA },
  branch: { id: null, name: "Organisation-wide" },
  occurred_on: "2026-11-20",
  from_history: false,
  event_reversed_at: null,
  detected_at: "2026-11-20T02:00:00+00:00",
};

test("a CTR candidate reads its amount against the threshold of the settings version it was measured by", () => {
  assert.deepEqual(amlaCtrRow(CTR), {
    id: 3,
    href: "/amla/ctr-candidates/3",
    reference: "AML-CTR-000003",
    status: "Detected",
    amount: "₱650,000.00",
    threshold: "Above ₱500,000.00 (settings version 2)",
    movement: "Money in · Cash",
    subject: "Pedro Santos",
    code: NA,
    branch: "Organisation-wide",
    date: formatDate("2026-11-20"),
    notes: [],
  });
  assert.deepEqual(amlaCtrRow({ ...CTR, from_history: true, event_reversed_at: "2026-11-21T01:00:00Z" }).notes, [
    "From history screening",
    `Its transaction was reversed ${formatDateTime("2026-11-21T01:00:00Z")}`,
  ]);
});

const RULES: AmlaDetectionRulesVersion = {
  version: 1,
  to_verify: true,
  effective_at: "2026-11-21T00:00:00+00:00",
  note: "Each parameter is a starting point, not a legal threshold, and is still to be verified.",
  rules: [
    { code: "A", rule: "Transaction structuring", description: "On one day…", active: true, priority: "high", priority_words: "High", params: { min_transactions: 2 }, availability: "Available" },
    { code: "E", rule: "Rapid movement of funds", description: "A large receipt…", active: true, priority: "high", priority_words: "High", params: { min_in_amount: "100000.00", out_share_pct: 80, within_days: 2 }, availability: "Available" },
    { code: "G", rule: "Third party transactions", description: "Payments…", active: false, priority: "low", priority_words: "Low", params: {}, availability: "Not available: Lendy records no payer or counterparty." },
    { code: "K", rule: "Missing or inconsistent identity information", description: "A cash…", active: true, priority: "medium", priority_words: "Medium", params: { review_amount: "50000.00", channels: ["cash", "gcash"] }, availability: "Available" },
    { code: "B", rule: "Unusual transaction frequency", description: "Many…", active: true, priority: "medium", priority_words: "Medium", params: { min_transactions: 10, multiplier: 3, baseline_days: 90 }, availability: "Available" },
  ],
};

test("each detection rule reads on or off, its priority, why it can't run, and every parameter in words", () => {
  const rows = amlaDetectionRuleRows(RULES);
  assert.deepEqual(rows[0], {
    code: "A",
    rule: "A · Transaction structuring",
    description: "On one day…",
    active: "On",
    priority: "High",
    availability: null,
    params: ["Fewest transactions: 2"],
  });
  assert.deepEqual(rows[1].params, ["Smallest amount received: ₱100,000.00", "Share that leaves again: 80%", "Within: 2 days"]);
  assert.equal(rows[2].active, "Off");
  assert.equal(rows[2].availability, "Not available: Lendy records no payer or counterparty.");
  assert.deepEqual(rows[2].params, ["No parameters"]);
  assert.deepEqual(rows[3].params, ["Review amount: ₱50,000.00", "Channels: Cash, GCash"]);
  assert.deepEqual(rows[4].params, ["Fewest transactions: 10", "Times the usual: 3 times", "Days of history compared: 90 days"]);
});

test("the detection rules form starts from the rules in force", () => {
  const draft = amlaDetectionDraft(RULES);
  assert.deepEqual(draft.E, { active: true, priority: "high", params: { min_in_amount: "100000.00", out_share_pct: "80", within_days: "2" } });
  assert.deepEqual(draft.K.params.channels, ["cash", "gcash"]);
});

test("a detection rules change sends the whole next definition, typed as the server stores it", () => {
  const draft = amlaDetectionDraft(RULES);
  draft.E.params.out_share_pct = "90";
  draft.G.priority = "medium";
  const result = amlaDetectionChangeBody(RULES, draft, " Counsel's advice ");
  assert.ok("body" in result);
  assert.equal(result.body.type, "detection_rules");
  assert.equal(result.body.reason, "Counsel's advice");
  assert.deepEqual(result.body.definition.E, { active: true, priority: "high", params: { min_in_amount: "100000.00", out_share_pct: 90, within_days: 2 } });
  assert.deepEqual(result.body.definition.G, { active: false, priority: "medium", params: {} });
  assert.deepEqual(result.body.definition.K, { active: true, priority: "medium", params: { review_amount: "50000.00", channels: ["cash", "gcash"] } });
  assert.deepEqual(Object.keys(result.body.definition), ["A", "E", "G", "K", "B"]);
});

test("the detection rules form says what is wrong, in words", () => {
  const draft = () => amlaDetectionDraft(RULES);
  assert.deepEqual(amlaDetectionChangeBody(RULES, draft(), "Review"), { error: "This changes nothing in the detection rules in force." });
  const amount = draft();
  amount.E.params.min_in_amount = "100,000";
  assert.deepEqual(amlaDetectionChangeBody(RULES, amount, "Review"), { error: "Rule E, Smallest amount received: give an amount in pesos with up to two decimals." });
  const whole = draft();
  whole.B.params.multiplier = "2.5";
  assert.deepEqual(amlaDetectionChangeBody(RULES, whole, "Review"), { error: "Rule B, Times the usual: give a whole number." });
  const channels = draft();
  channels.K.params.channels = [];
  assert.deepEqual(amlaDetectionChangeBody(RULES, channels, "Review"), { error: "Rule K, Channels: pick at least one channel." });
  const reason = draft();
  reason.A.active = false;
  assert.deepEqual(amlaDetectionChangeBody(RULES, reason, " "), { error: "Give the reason for the change." });
});

const RISK: AmlaRiskRules = {
  current: {
    id: 1,
    version: 1,
    to_verify: true,
    definition: {
      factors: { customer_type: { member: 0, walk_in: 10 }, pep: { not_pep: 0, pep: 30 } },
      thresholds: { medium: 20, high: 40 },
      high_risk_countries: ["KP", "IR"],
    },
    effective_at: "2026-11-20T00:00:00Z",
    source: "system_default",
    request_id: null,
    approved_by: null,
  },
  versions: [],
  factor_words: { customer_type: "Customer type", pep: "Politically exposed person" },
  value_words: { member: "Member", walk_in: "Walk-in", not_pep: "Not a PEP", pep: "PEP" },
  pending_request_id: null,
};

test("the risk rules read every factor's points by value, the thresholds and the high-risk countries, in the server's words", () => {
  assert.deepEqual(amlaRiskRulesView(RISK, RISK.current), {
    title: `Version 1, in force from ${formatDateTime("2026-11-20T00:00:00Z")}`,
    origin: "The starting values installed with AMLA.",
    toVerify: "Still to verify.",
    factors: [
      { key: "customer_type", label: "Customer type", values: [{ key: "member", label: "Member", points: "0 points" }, { key: "walk_in", label: "Walk-in", points: "10 points" }] },
      { key: "pep", label: "Politically exposed person", values: [{ key: "not_pep", label: "Not a PEP", points: "0 points" }, { key: "pep", label: "PEP", points: "30 points" }] },
    ],
    thresholds: "Medium from 20 points, High from 40 points",
    countries: "KP, IR",
  });
});

test("an approved version names its approver; an unknown key reads as another value, never raw", () => {
  const approved = { ...RISK.current, version: 2, source: "approved_change" as const, request_id: 5, approved_by: { id: 8, name: "Ben Reyes" }, to_verify: false };
  const view = amlaRiskRulesView({ ...RISK, value_words: { member: "Member" } }, approved);
  assert.equal(view.origin, "Approved by Ben Reyes (request #5).");
  assert.equal(view.toVerify, "Confirmed.");
  assert.equal(view.factors[0].values[1].label, "Another value");
});

test("a risk rules change sends the whole definition with whole-number points and two-letter countries", () => {
  const draft = amlaRiskDraft(RISK.current.definition);
  assert.deepEqual(draft, {
    factors: { customer_type: { member: "0", walk_in: "10" }, pep: { not_pep: "0", pep: "30" } },
    medium: "20",
    high: "40",
    countries: "KP, IR",
  });
  draft.factors.pep.pep = "35";
  draft.countries = " kp,ir mm ";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, draft, "Counsel"), {
    body: {
      type: "risk_rules",
      reason: "Counsel",
      definition: {
        factors: { customer_type: { member: 0, walk_in: 10 }, pep: { not_pep: 0, pep: 35 } },
        thresholds: { medium: 20, high: 40 },
        high_risk_countries: ["IR", "KP", "MM"],
      },
    },
  });
});

test("the high-risk countries are sent sorted, and a reordering alone changes nothing", () => {
  const reordered = amlaRiskDraft(RISK.current.definition);
  reordered.countries = "IR KP";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, reordered, "Review"), { error: "This changes nothing in the risk rules in force." });
});

test("the risk rules form says what is wrong, in words", () => {
  const draft = () => amlaRiskDraft(RISK.current.definition);
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, draft(), "Review"), { error: "This changes nothing in the risk rules in force." });
  const points = draft();
  points.factors.pep.pep = "101";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, points, "Review"), { error: "Points are whole numbers from 0 to 100." });
  const order = draft();
  order.medium = "40";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, order, "Review"), { error: "Give whole-number Medium and High thresholds, Medium below High, from 1 to 1,000." });
  const country = draft();
  country.countries = "KP, IRN";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, country, "Review"), { error: "List high-risk countries as two-letter codes, such as KP." });
  const twice = draft();
  twice.countries = "KP, kp";
  assert.deepEqual(amlaRiskChangeBody(RISK.current.definition, twice, "Review"), { error: "List each high-risk country once." });
});

test("a list's total reads in words, singular or plural, from the server's figure", () => {
  assert.equal(amlaListTotalText(0, "open alert", "open alerts", 10), "No open alerts.");
  assert.equal(amlaListTotalText(1, "open alert", "open alerts", 10), "1 open alert.");
  assert.equal(amlaListTotalText(7, "open alert", "open alerts", 10), "7 open alerts.");
  assert.equal(amlaListTotalText(12, "open alert", "open alerts", 10), "12 open alerts in all; the latest 10 are shown.");
});

test("server notes never show internal build codes", () => {
  assert.equal(
    amlaPublicText("Not available yet: watchlist screening (AMLA-B5) isn't built, so there is nothing to match."),
    "Not available yet: watchlist screening isn't built, so there is nothing to match.",
  );
  assert.equal(amlaPublicText("Comes with AMLA-B7 and EB-D1."), "Comes with a later release and a later release.");
  assert.equal(amlaPublicText("Not available: Lendy records no payer or counterparty."), "Not available: Lendy records no payer or counterparty.");
});

test("a branch reads the server's own words, never rewritten here", () => {
  assert.equal(amlaAlertRow({ ...ALERT, branch: { id: null, name: "Organisation-wide" } }).branch, "Organisation-wide");
  assert.equal(amlaCtrRow({ ...CTR, branch: { id: null, name: "Organisation-wide (no branch)" } }).branch, "Organisation-wide (no branch)");
});

const WITH_PARAMETERS: AmlaDetectionRulesVersion = {
  ...RULES,
  rules: [
    {
      code: "H",
      rule: "GCash and digital payment anomalies",
      description: "Many…",
      active: true,
      priority: "medium",
      priority_words: "Medium",
      params: { min_transactions: 5, min_total: "100000.00", min_new: "2500.50" },
      parameters: [
        { name: "min_transactions", label: "Fewest GCash transactions in a day", kind: "count", value: 5 },
        { name: "min_total", label: "Smallest day's GCash total", kind: "peso", value: "100000.00" },
        { name: "min_new", label: "A parameter added later", kind: "peso", value: "2500.50" },
      ],
      availability: "Available",
    },
  ],
};

test("each rule parameter reads the server's own label and kind", () => {
  assert.deepEqual(amlaDetectionRuleRows(WITH_PARAMETERS)[0].params, [
    "Fewest GCash transactions in a day: 5",
    "Smallest day's GCash total: ₱100,000.00",
    "A parameter added later: ₱2,500.50",
  ]);
});

test("the change form types each parameter by the server's kind, a new one included", () => {
  const draft = amlaDetectionDraft(WITH_PARAMETERS);
  draft.H.params.min_new = "3000";
  const result = amlaDetectionChangeBody(WITH_PARAMETERS, draft, "Review");
  assert.ok("body" in result);
  assert.deepEqual(result.body.definition.H.params, { min_transactions: 5, min_total: "100000.00", min_new: "3000" });
  draft.H.params.min_new = "3,000";
  assert.deepEqual(amlaDetectionChangeBody(WITH_PARAMETERS, draft, "Review"), {
    error: "Rule H, A parameter added later: give an amount in pesos with up to two decimals.",
  });
});

test("a rules version says which version it was asked from", () => {
  assert.equal(amlaRuleVersionLine({ ...RULES, version: 3, base_version: 2 }), "Rules version 3, asked from version 2");
  assert.equal(amlaRuleVersionLine({ ...RULES, version: 1, base_version: null }), "Rules version 1, the starting rules");
  assert.equal(amlaRuleVersionLine({ ...RULES, version: 2 }), "Rules version 2");
});

test("rule L's note reads as the server words it", () => {
  const note = "Not available yet: no watchlist match has been found to raise.";
  const rows = amlaDetectionRuleRows({ ...RULES, rules: [{ ...RULES.rules[2], code: "L", availability: note }] });
  assert.equal(rows[0].availability, note);
});

test("the change dialog labels and types each parameter as the server does, its own copy only as a fallback", () => {
  const rule = WITH_PARAMETERS.rules[0];
  assert.equal(amlaRuleParamLabel(rule, "min_transactions"), "Fewest GCash transactions in a day");
  assert.equal(amlaRuleParamKind(rule, "min_new"), "peso");
  const older = { ...rule, parameters: undefined };
  assert.equal(amlaRuleParamLabel(older, "min_transactions"), "Fewest transactions");
  assert.equal(amlaRuleParamKind(older, "min_total"), "peso");
});

test("a parameter field adds its unit only when the server's label doesn't already carry it", () => {
  assert.equal(amlaParamFieldLabel("Share that leaves again (%)", "percent"), "Share that leaves again (%)");
  assert.equal(amlaParamFieldLabel("Minimum share of the release (%)", "percent"), "Minimum share of the release (%)");
  assert.equal(amlaParamFieldLabel("Within days", "days"), "Within days");
  assert.equal(amlaParamFieldLabel("Smallest amount (₱)", "peso"), "Smallest amount (₱)");
  assert.equal(amlaParamFieldLabel("Share that leaves again", "percent"), "Share that leaves again (%)");
  assert.equal(amlaParamFieldLabel("Within", "days"), "Within (days)");
  assert.equal(amlaParamFieldLabel("Smallest amount", "peso"), "Smallest amount (₱)");
  assert.equal(amlaParamFieldLabel("Fewest transactions", "count"), "Fewest transactions");
});

test("closing an alert needs a reason of 3 to 2,000 characters, as the server checks", () => {
  assert.deepEqual(amlaCloseReasonBody("  "), { error: "Say why the alert is closed." });
  assert.deepEqual(amlaCloseReasonBody("ok"), { error: "Give a reason of at least 3 characters." });
  assert.ok("error" in amlaCloseReasonBody("x".repeat(2001)));
  assert.deepEqual(amlaCloseReasonBody(" Salary from a known employer "), { body: "Salary from a known employer" });
});

test("an optional step note is kept to 2,000 characters", () => {
  assert.deepEqual(amlaAlertStepNote("  "), { body: "" });
  assert.deepEqual(amlaAlertStepNote(" Checking "), { body: "Checking" });
  assert.ok("error" in amlaAlertStepNote("x".repeat(2001)));
});

test("a workflow step's answer updates the alert's status and assignee without reading the alert again", () => {
  const detail = { ...ALERT, reason: "Why", indicators: [], cleared_at: null, cleared_note: null, transactions: [] } as AmlaAlertDetail;
  const answered: AmlaAlertRow = { ...ALERT, status: "assigned", status_words: "Assigned", assigned_to: { id: 9, name: "Me" } };
  const merged = amlaAlertWithRow(detail, answered);
  assert.equal(merged.status, "assigned");
  assert.equal(merged.assigned_to?.name, "Me");
  assert.equal(merged.reason, "Why");
  assert.deepEqual(merged.transactions, []);
});

const step = (over: Partial<AmlaAlertHistoryStep> = {}): AmlaAlertHistoryStep => ({
  id: 1,
  action: "closed",
  action_words: "Closed with a documented reason",
  from_status: "under_review",
  to_status: "closed",
  to_status_words: "Closed with a documented reason",
  by: { id: 2, name: "Ana" },
  assignee: null,
  case_id: null,
  note: "Known salary",
  at: null,
  ...over,
});

test("a history step reads once, with its reason or note, and its new status only when it says more", () => {
  assert.deepEqual(amlaAlertHistoryLine(step()), { title: "Closed with a documented reason", note: "Reason: Known salary" });
  assert.deepEqual(
    amlaAlertHistoryLine(step({ action: "assigned", action_words: "Assigned", to_status: "assigned", to_status_words: "Assigned", assignee: { id: 9, name: "Me" }, note: null })),
    { title: "Assigned to Me", note: null },
  );
  assert.deepEqual(
    amlaAlertHistoryLine(step({ action: "review_started", action_words: "Review started", to_status: "under_review", to_status_words: "Under review", note: "Checking" })),
    { title: "Review started · Under review", note: "Note: Checking" },
  );
});

test("the notes typed when an alert was escalated, for the case it went to", () => {
  const history = [
    step({ id: 1, action: "assigned", note: "mine" }),
    step({ id: 2, action: "escalated", case_id: 4, note: "See the cash-ins" }),
    step({ id: 3, action: "escalated", case_id: 5, note: "Another case" }),
    step({ id: 4, action: "escalated", case_id: 4, note: null }),
  ];
  assert.deepEqual(amlaEscalationNotes(history, 4).map((h) => h.note), ["See the cash-ins"]);
});
