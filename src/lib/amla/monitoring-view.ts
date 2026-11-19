import { formatDate, formatDateTime } from "@/lib/format";
import { amlaSubjectHref } from "@/lib/amla/cdd-access";
import { NO_BRANCH, type AmlaBadgeTone } from "@/lib/amla/cdd-view";
import {
  AMLA_DETECTION_RULE_WORDS,
  AMLA_PRIORITY_WORDS,
  amlaParamKind,
  amlaParamLabel,
  amlaParamLine,
  amlaPoints,
  amlaRuleTitle,
  amlaSortedList,
  amlaThresholdsLine,
} from "@/lib/amla/rule-words";
import { AMLA_CHANNEL_OPTIONS, amlaReasonError, type AmlaOption } from "@/lib/amla/settings-view";
import type { AmlaChangeRequestBody, AmlaPage } from "@/types/amla";
import type {
  AmlaAlertDetail,
  AmlaAlertHistoryStep,
  AmlaAlertRow,
  AmlaCtrRow,
  AmlaDetectionRulesVersion,
  AmlaIndicator,
  AmlaMonitoredTransaction,
  AmlaMonitoringBranch,
  AmlaRiskRules,
  AmlaRiskRulesDefinition,
  AmlaRiskRulesVersion,
} from "@/types/amla-monitoring";

/**
 * AMLA monitoring in words (Phase 6, AMLA-B3). The server detects, scores and
 * totals everything, and sends money already in ₱ words; these helpers only
 * word what it sends, and check the rule-change forms for what is plainly
 * wrong before the server decides.
 */

type Result<T> = { body: T } | { error: string };

/** `AmlaAlert::STATUS_WORDS`, with the alert workflow's statuses (AMLA-B6). */
export const AMLA_ALERT_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "under_review", label: "Under review" },
  { value: "escalated", label: "Escalated to a case" },
  { value: "closed", label: "Closed with a documented reason" },
  { value: "cleared", label: "Cleared by a rerun" },
];

/** A workflow step answers the alert's row; it updates the open alert without reading it again. */
export function amlaAlertWithRow(detail: AmlaAlertDetail, row: AmlaAlertRow): AmlaAlertDetail {
  return { ...detail, ...row };
}

/** One workflow step in words: its action (to whom), its new status only when that says more, and its reason or note. */
export function amlaAlertHistoryLine(step: AmlaAlertHistoryStep): { title: string; note: string | null } {
  let title = step.assignee ? `${step.action_words} to ${step.assignee.name}` : step.action_words;
  if (step.to_status_words !== step.action_words) title += ` · ${step.to_status_words}`;
  const note = step.note ? `${step.action === "closed" ? "Reason" : "Note"}: ${step.note}` : null;
  return { title, note };
}

/** The notes typed when the alert was escalated into this case: the server keeps them on the alert's history. */
export function amlaEscalationNotes(history: AmlaAlertHistoryStep[], caseId: number): AmlaAlertHistoryStep[] {
  return history.filter((step) => step.action === "escalated" && step.case_id === caseId && step.note);
}

/** Closing needs the reason the server keeps (3 to 2,000 characters). */
export function amlaCloseReasonBody(reason: string): Result<string> {
  const trimmed = reason.trim();
  if (trimmed === "") return { error: "Say why the alert is closed." };
  if (trimmed.length < 3) return { error: "Give a reason of at least 3 characters." };
  if (trimmed.length > 2000) return { error: "Keep the reason to 2,000 characters." };
  return { body: trimmed };
}

/** Assigning and starting a review take an optional note, up to 2,000 characters. */
export function amlaAlertStepNote(note: string): Result<string> {
  const trimmed = note.trim();
  if (trimmed.length > 2000) return { error: "Keep the note to 2,000 characters." };
  return { body: trimmed };
}

/** `DetectionRules::PRIORITIES`, most urgent first. */
export const AMLA_PRIORITY_OPTIONS: readonly AmlaOption[] = ["critical", "high", "medium", "low"].map((value) => ({
  value,
  label: AMLA_PRIORITY_WORDS[value],
}));

export const AMLA_DETECTION_RULE_OPTIONS: readonly AmlaOption[] = Object.keys(AMLA_DETECTION_RULE_WORDS).map((code) => ({
  value: code,
  label: amlaRuleTitle(code),
}));

const PRIORITY_TONES: Readonly<Record<string, AmlaBadgeTone>> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export function amlaPriorityTone(priority: string): AmlaBadgeTone {
  return Object.hasOwn(PRIORITY_TONES, priority) ? PRIORITY_TONES[priority] : "outline";
}

/** Multi-branch decision 6: no branch reads "Organisation-wide" (the server words it "Head office"). */
function branchWords(branch: AmlaMonitoringBranch): string {
  return branch.id === null ? NO_BRANCH : branch.name;
}

const HISTORY = "From history screening";

export function amlaAlertRow(row: AmlaAlertRow) {
  return {
    id: row.id,
    href: `/amla/alerts/${row.id}`,
    reference: row.reference,
    rule: amlaRuleTitle(row.rule_code, row.rule),
    version: `Rules version ${row.rule_version}`,
    priority: row.priority_words,
    tone: amlaPriorityTone(row.priority),
    status: row.status_words,
    subject: row.subject.name,
    code: row.subject.code,
    branch: branchWords(row.branch),
    window:
      row.window_start === row.window_end
        ? formatDate(row.window_start)
        : `${formatDate(row.window_start)} to ${formatDate(row.window_end)}`,
    amount: row.amount,
    transactions: `${row.transactions_count} ${row.transactions_count === 1 ? "transaction" : "transactions"}`,
    history: row.from_history ? HISTORY : null,
    detected: row.detected_at ? formatDateTime(row.detected_at) : "—",
  };
}

export function amlaAlertLines(
  alert: AmlaAlertDetail,
  canOpenCustomer: boolean,
): { reason: string; indicators: AmlaIndicator[]; subjectHref: string | null; cleared: string | null } {
  const { type, id } = alert.subject;
  let cleared: string | null = null;
  if (alert.cleared_at) {
    cleared = `Cleared ${formatDateTime(alert.cleared_at)}${alert.cleared_note ? `: ${alert.cleared_note}` : "."}`;
  }
  return {
    reason: alert.reason,
    indicators: alert.indicators.map((i) => ({ label: i.label, value: i.value })),
    subjectHref: canOpenCustomer && type !== null && id !== null ? amlaSubjectHref(type, id) : null,
    cleared,
  };
}

export function amlaTransactionRow(transaction: AmlaMonitoredTransaction) {
  const notes: string[] = [];
  if (transaction.internal) notes.push("Internal movement, never new funds");
  if (transaction.reversed) notes.push(transaction.reversed_at ? `Reversed ${formatDateTime(transaction.reversed_at)}` : "Reversed");
  return {
    id: transaction.id,
    kind: transaction.kind_words,
    direction: transaction.direction_words,
    amount: transaction.amount,
    date: formatDate(transaction.occurred_on),
    channel: transaction.channel,
    reference: transaction.reference,
    branch: transaction.branch,
    notes,
  };
}

export function amlaCtrRow(row: AmlaCtrRow) {
  const notes: string[] = [];
  if (row.from_history) notes.push(HISTORY);
  if (row.event_reversed_at) notes.push(`Its transaction was reversed ${formatDateTime(row.event_reversed_at)}`);
  return {
    id: row.id,
    href: `/amla/ctr-candidates/${row.id}`,
    reference: row.reference,
    status: row.status_words,
    amount: row.amount,
    threshold: `Above ${row.threshold} (settings version ${row.settings_version})`,
    movement: `${row.direction_words} · ${row.channel_words}`,
    subject: row.subject.name,
    code: row.subject.code,
    branch: branchWords(row.branch),
    date: formatDate(row.occurred_on),
    notes,
  };
}

/** "1 open alert.", "12 open alerts in all; the latest 10 are shown." from the server's total, never the rows received. */
export function amlaListTotalText(total: number, one: string, many: string, shown: number): string {
  if (total === 0) return `No ${many}.`;
  const noun = total === 1 ? one : many;
  return total > shown ? `${total} ${noun} in all; the latest ${shown} are shown.` : `${total} ${noun}.`;
}

/**
 * A server note as users read it: the internal build codes some notes carry
 * ("(AMLA-B5)") are dropped, and a bare one reads "a later release".
 */
export function amlaPublicText(text: string): string {
  const CODE = "[A-Z]{2,5}-[A-Z]{0,3}\\d+[a-z]?";
  return text
    .replace(new RegExp(`\\s*\\(${CODE}\\)`, "g"), "")
    .replace(new RegExp(`\\b${CODE}\\b`, "g"), "a later release");
}

/** The waiting change of one type: the first pending request the server lists for it, or none. */
export function amlaPendingRequestId(page: AmlaPage<{ id: number }>): number | null {
  return page.data[0]?.id ?? null;
}

export function amlaDetectionRuleRows(version: AmlaDetectionRulesVersion) {
  return version.rules.map((rule) => {
    const params = Object.entries(rule.params).map(([name, value]) => amlaParamLine(name, value));
    return {
      code: rule.code,
      rule: amlaRuleTitle(rule.code, rule.rule),
      description: amlaPublicText(rule.description),
      active: rule.active ? "On" : "Off",
      priority: rule.priority_words,
      availability: rule.availability === "Available" ? null : amlaPublicText(rule.availability),
      params: params.length > 0 ? params : ["No parameters"],
    };
  });
}

export interface AmlaDetectionRuleDraft {
  active: boolean;
  priority: string;
  params: Record<string, string | string[]>;
}

export type AmlaDetectionDraft = Record<string, AmlaDetectionRuleDraft>;

export function amlaDetectionDraft(version: AmlaDetectionRulesVersion): AmlaDetectionDraft {
  return Object.fromEntries(
    version.rules.map((rule) => [
      rule.code,
      {
        active: rule.active,
        priority: rule.priority,
        params: Object.fromEntries(
          Object.entries(rule.params).map(([name, value]) => [name, Array.isArray(value) ? [...value] : String(value)]),
        ),
      },
    ]),
  );
}

const PESO = /^\d{1,12}(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;
const COUNTRY = /^[A-Z]{2}$/;

function inChannelOrder(channels: readonly string[]): string[] {
  return AMLA_CHANNEL_OPTIONS.map((o) => o.value).filter((value) => channels.includes(value));
}

type StoredParams = Record<string, string | number | string[]>;

/**
 * The detection rules change to ask for: the whole next definition, in the
 * order the server lists the rules, with money as two-decimal-or-fewer text,
 * channels as a list and the rest whole numbers. The server checks the limits
 * and refuses a change that changes nothing.
 */
export function amlaDetectionChangeBody(
  version: AmlaDetectionRulesVersion,
  draft: AmlaDetectionDraft,
  reason: string,
): Result<Extract<AmlaChangeRequestBody, { type: "detection_rules" }>> {
  const definition: Record<string, { active: boolean; priority: string; params: StoredParams }> = {};
  let changed = false;

  for (const rule of version.rules) {
    const entry = draft[rule.code];
    if (!entry) continue;
    const params: StoredParams = {};
    for (const [name, raw] of Object.entries(entry.params)) {
      const kind = amlaParamKind(name, rule.params[name]);
      const where = `Rule ${rule.code}, ${amlaParamLabel(name)}`;
      if (kind === "channels") {
        const picked = inChannelOrder(Array.isArray(raw) ? raw : []);
        if (picked.length === 0) return { error: `${where}: pick at least one channel.` };
        params[name] = picked;
      } else if (kind === "peso") {
        const text = String(raw).trim();
        if (!PESO.test(text)) return { error: `${where}: give an amount in pesos with up to two decimals.` };
        params[name] = text;
      } else {
        const text = String(raw).trim();
        if (!WHOLE.test(text)) return { error: `${where}: give a whole number.` };
        params[name] = Number(text);
      }
    }
    definition[rule.code] = { active: entry.active, priority: entry.priority, params };
    const before = Object.fromEntries(
      Object.entries(rule.params).map(([name, value]) => [name, Array.isArray(value) ? inChannelOrder(value) : value]),
    );
    if (entry.active !== rule.active || entry.priority !== rule.priority || JSON.stringify(params) !== JSON.stringify(before)) {
      changed = true;
    }
  }

  if (!changed) return { error: "This changes nothing in the detection rules in force." };
  const reasonError = amlaReasonError(reason);
  if (reasonError) return { error: reasonError };
  return { body: { type: "detection_rules", reason: reason.trim(), definition } };
}

export function amlaRiskRulesView(rules: AmlaRiskRules, version: AmlaRiskRulesVersion) {
  const factorWords = (key: string) => (Object.hasOwn(rules.factor_words, key) ? rules.factor_words[key] : "Another factor");
  const valueWords = (key: string) => (Object.hasOwn(rules.value_words, key) ? rules.value_words[key] : "Another value");
  const { factors, thresholds, high_risk_countries: countries } = version.definition;
  return {
    title: version.effective_at
      ? `Version ${version.version}, in force from ${formatDateTime(version.effective_at)}`
      : `Version ${version.version}`,
    origin:
      version.source === "system_default"
        ? "The starting values installed with AMLA."
        : `Approved by ${version.approved_by?.name ?? "a former user"}${version.request_id ? ` (request #${version.request_id})` : ""}.`,
    toVerify: version.to_verify ? "Still to verify." : "Confirmed.",
    factors: Object.entries(factors).map(([key, values]) => ({
      key,
      label: factorWords(key),
      values: Object.entries(values).map(([value, points]) => ({ key: value, label: valueWords(value), points: amlaPoints(points) })),
    })),
    thresholds: amlaThresholdsLine(thresholds),
    countries: countries.length > 0 ? countries.join(", ") : "None",
  };
}

export interface AmlaRiskDraft {
  factors: Record<string, Record<string, string>>;
  medium: string;
  high: string;
  /** Two-letter codes, separated by commas or spaces. */
  countries: string;
}

export function amlaRiskDraft(definition: AmlaRiskRulesDefinition): AmlaRiskDraft {
  return {
    factors: Object.fromEntries(
      Object.entries(definition.factors).map(([key, values]) => [
        key,
        Object.fromEntries(Object.entries(values).map(([value, points]) => [value, String(points)])),
      ]),
    ),
    medium: String(definition.thresholds.medium),
    high: String(definition.thresholds.high),
    countries: definition.high_risk_countries.join(", "),
  };
}

const MAX_POINTS = 100;
const MAX_THRESHOLD = 1000;

/** The risk rules change to ask for: the whole next definition. The server checks it again and refuses no change. */
export function amlaRiskChangeBody(
  current: AmlaRiskRulesDefinition,
  draft: AmlaRiskDraft,
  reason: string,
): Result<Extract<AmlaChangeRequestBody, { type: "risk_rules" }>> {
  const factors: Record<string, Record<string, number>> = {};
  for (const [key, values] of Object.entries(draft.factors)) {
    factors[key] = {};
    for (const [value, raw] of Object.entries(values)) {
      const text = raw.trim();
      const points = Number(text);
      if (!WHOLE.test(text) || points > MAX_POINTS) return { error: "Points are whole numbers from 0 to 100." };
      factors[key][value] = points;
    }
  }

  const medium = Number(draft.medium.trim());
  const high = Number(draft.high.trim());
  if (!WHOLE.test(draft.medium.trim()) || !WHOLE.test(draft.high.trim()) || medium < 1 || high > MAX_THRESHOLD || medium >= high) {
    return { error: "Give whole-number Medium and High thresholds, Medium below High, from 1 to 1,000." };
  }

  const countries = draft.countries
    .split(/[\s,]+/)
    .filter((code) => code !== "")
    .map((code) => code.toUpperCase());
  if (countries.some((code) => !COUNTRY.test(code))) return { error: "List high-risk countries as two-letter codes, such as KP." };
  if (new Set(countries).size !== countries.length) return { error: "List each high-risk country once." };

  // Countries are a set: sent sorted, and compared regardless of the order stored.
  const definition = { factors, thresholds: { medium, high }, high_risk_countries: amlaSortedList(countries) };
  const now = { factors: current.factors, thresholds: current.thresholds, high_risk_countries: amlaSortedList(current.high_risk_countries) };
  if (JSON.stringify(definition) === JSON.stringify(now)) {
    return { error: "This changes nothing in the risk rules in force." };
  }
  const reasonError = amlaReasonError(reason);
  if (reasonError) return { error: reasonError };
  return { body: { type: "risk_rules", reason: reason.trim(), definition } };
}
