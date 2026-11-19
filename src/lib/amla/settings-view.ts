import { PAYMENT_METHOD_OPTIONS } from "@/constants/payment-methods";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type {
  AmlaCalendar,
  AmlaChangeRequest,
  AmlaChangeRequestBody,
  AmlaDeadlinePreview,
  AmlaLogEntry,
  AmlaSetting,
  AmlaSettingsVersion,
  AmlaStatus,
} from "@/types/amla";

/**
 * Settings → AMLA in words. Every figure is the server's: amounts arrive with
 * their ₱ words, deadlines are counted by the server, and the browser works
 * nothing out. Stored keys and raw payloads are never shown.
 */

export interface AmlaOption {
  value: string;
  label: string;
}

/** The channels a CTR may count as cash: the payment methods the server accepts, without auto-pay. */
export const AMLA_CHANNEL_OPTIONS: readonly AmlaOption[] = PAYMENT_METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/** `AmlaCalendarEntry::KINDS`. */
export const AMLA_CALENDAR_KIND_OPTIONS: readonly AmlaOption[] = [
  { value: "holiday", label: "Holiday" },
  { value: "amlc_non_reporting", label: "AMLC non-reporting day" },
  { value: "facility_suspension", label: "Facility suspension" },
];

/** `ChangeRequests::STATUS_WORDS`. */
export const AMLA_CHANGE_STATUS_OPTIONS: readonly AmlaOption[] = [
  { value: "pending", label: "Waiting for approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

/** `AmlaLog::ACTIONS`. */
export const AMLA_LOG_ACTION_OPTIONS: readonly AmlaOption[] = [
  { value: "access_denied", label: "Access refused" },
  { value: "log_viewed", label: "AMLA log viewed" },
  { value: "change_requested", label: "Change asked for" },
  { value: "change_approved", label: "Change approved" },
  { value: "change_rejected", label: "Change rejected" },
  { value: "change_withdrawn", label: "Change withdrawn" },
];

const REASON_MAX = 1000;

function toVerifyText(count: number): string {
  if (count === 0) return "Every setting is confirmed.";
  return count === 1 ? "1 setting is still to verify." : `${count} settings are still to verify.`;
}

function workingDays(count: number): string {
  return `${count} working ${count === 1 ? "day" : "days"}`;
}

/** "2027", "2026 and 2027", "2026, 2027 and 2028". */
function yearList(years: number[]): string {
  if (years.length <= 1) return years.join("");
  return `${years.slice(0, -1).join(", ")} and ${years[years.length - 1]}`;
}

export interface AmlaLine {
  label: string;
  value: string;
}

export function amlaStatusLines(status: AmlaStatus): AmlaLine[] {
  return [
    { label: "Monitoring", value: status.monitoring_enabled ? "On." : "Off. The server's AMLA monitoring switch is off." },
    { label: "Settings in force", value: `Version ${status.settings_version}` },
    { label: "Settings to verify", value: toVerifyText(status.settings_to_verify) },
    {
      label: `${status.calendar_year} calendar`,
      value: status.calendar_confirmed ? "Confirmed." : "Provisional: not confirmed yet.",
    },
  ];
}

export interface AmlaSettingRow {
  key: string;
  label: string;
  value: string;
  toVerify: boolean;
  check: string;
}

export function amlaSettingRow(setting: AmlaSetting): AmlaSettingRow {
  return {
    key: setting.key,
    label: setting.label,
    value: setting.value_words ?? "—",
    toVerify: setting.to_verify,
    check: setting.to_verify ? "To verify" : setting.source ? `Confirmed: ${setting.source}` : "Confirmed",
  };
}

export function amlaVersionLines(version: AmlaSettingsVersion): { title: string; origin: string; toVerify: string } {
  const origin =
    version.source === "system_default"
      ? "The starting values installed with AMLA."
      : `Asked for by ${version.requested_by?.name ?? "a former user"}, approved by ${version.approved_by?.name ?? "a former user"}.`;
  return {
    title: `Version ${version.version}, in force from ${formatDateTime(version.effective_at)}`,
    origin,
    toVerify: toVerifyText(version.to_verify_count),
  };
}

export function amlaChangeRequestLines(request: AmlaChangeRequest): { summary: string; asked: string; decided: string | null } {
  const asked = `Asked by ${request.requested_by?.name ?? "a former user"}, ${formatDateTime(request.requested_at)}`;
  let decided: string | null = null;
  if (request.decided_at) {
    decided = `${request.status_words} by ${request.decided_by?.name ?? "a former user"}, ${formatDateTime(request.decided_at)}.`;
    if (request.decision_note) decided += ` Note: ${request.decision_note}`;
  }
  return { summary: request.summary, asked, decided };
}

/**
 * `AmlaSettings::DEFINITIONS`: each setting's short name (as the server's
 * change summary words it) and unit, in the server's order.
 */
const SETTING_WORDS: readonly { key: string; short: string; unit: string }[] = [
  { key: "ctr_threshold", short: "CTR threshold", unit: "peso" },
  { key: "ctr_cash_channels", short: "CTR cash channels", unit: "channels" },
  { key: "ctr_deadline_working_days", short: "CTR deadline", unit: "working_days" },
  { key: "str_deadline_working_days", short: "STR deadline", unit: "working_days" },
  { key: "review_years_high", short: "High risk review cycle", unit: "years" },
  { key: "review_years_medium", short: "Medium risk review cycle", unit: "years" },
  { key: "review_years_low", short: "Low risk review cycle", unit: "years" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored value in words, as `AmlaSettings::valueWords` words it: the server's ₱ figure to two decimals, never worked out. */
function storedValueWords(unit: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (unit === "peso") return formatCurrency(String(value));
  if (unit === "channels") {
    const list = Array.isArray(value) ? value.map(String) : [];
    return list.map((c) => AMLA_CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? "Another channel").join(", ") || "—";
  }
  const count = Number(value);
  if (unit === "working_days") return workingDays(count);
  return `${count} ${count === 1 ? "year" : "years"}`;
}

/**
 * What a settings change would do, line by line, from what the server recorded
 * when it was asked for (`changed`, `verified`, `unverified`,
 * `sources_changed`): each value in force then → proposed, each setting
 * confirmed (and by what) or marked to verify again. Calendar requests add
 * nothing, since their summary says it all. Stored keys never show.
 */
export function amlaChangeRequestChanges(request: Pick<AmlaChangeRequest, "type" | "payload">): string[] {
  const payload = request.payload;
  if (request.type !== "settings" || !isRecord(payload)) return [];
  const changed = isRecord(payload.changed) ? payload.changed : {};
  const sourcesChanged = isRecord(payload.sources_changed) ? payload.sources_changed : {};
  const verified = Array.isArray(payload.verified) ? payload.verified : [];
  const unverified = Array.isArray(payload.unverified) ? payload.unverified : [];
  const lines: string[] = [];

  for (const { key, short, unit } of SETTING_WORDS) {
    const change = changed[key];
    if (isRecord(change)) lines.push(`${short}: ${storedValueWords(unit, change.from)} → ${storedValueWords(unit, change.to)}`);
    const source = isRecord(sourcesChanged[key]) ? (sourcesChanged[key] as Record<string, unknown>).to : null;
    if (verified.includes(key)) {
      lines.push(typeof source === "string" && source !== "" ? `${short}: confirmed by ${source}` : `${short}: confirmed`);
    } else if (unverified.includes(key)) {
      lines.push(`${short}: marked to verify again`);
    } else if (typeof source === "string" && source !== "") {
      lines.push(`${short}: what confirmed it changes to ${source}`);
    }
  }

  const known = new Set(SETTING_WORDS.map((s) => s.key));
  if (Object.keys(changed).some((key) => !known.has(key))) lines.push("Another setting: changed");
  return lines;
}

export type AmlaSettingCheck = "keep" | "confirm" | "to_verify";

export interface AmlaSettingDraft {
  /** The typed value, for amounts and whole numbers. */
  value: string;
  /** The ticked channels, for the cash channels setting. */
  channels: string[];
  /** Keep the setting's state, confirm it (with a source), or mark it to verify again. */
  check: AmlaSettingCheck;
  source: string;
}

export type AmlaSettingsDraft = Record<string, AmlaSettingDraft>;

export function amlaSettingsDraft(settings: AmlaSetting[]): AmlaSettingsDraft {
  return Object.fromEntries(
    settings.map((s) => [
      s.key,
      {
        value: s.unit === "channels" || s.value === null ? "" : String(s.value),
        channels: s.unit === "channels" && Array.isArray(s.value) ? [...s.value] : [],
        check: "keep" as const,
        source: "",
      },
    ]),
  );
}

export function amlaReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed === "") return "Give the reason for the change.";
  if (trimmed.length > REASON_MAX) return "Keep it to 1,000 characters.";
  return null;
}

export type AmlaBodyResult<T> = { body: T } | { error: string };

const PESO = /^\d+(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;

function inChannelOrder(channels: string[]): string[] {
  return AMLA_CHANNEL_OPTIONS.map((o) => o.value).filter((value) => channels.includes(value));
}

/**
 * The settings change to ask for: only the values that differ from those in
 * force, the settings confirmed (with what confirmed them) and those marked to
 * verify again. The server checks the limits and refuses a change that
 * changes nothing; this only catches what is plainly missing.
 */
export function amlaSettingsChangeBody(
  settings: AmlaSetting[],
  draft: AmlaSettingsDraft,
  reason: string,
): AmlaBodyResult<AmlaChangeRequestBody> {
  const values: Record<string, string | string[]> = {};
  const verified: Record<string, string> = {};
  const toVerify: string[] = [];

  for (const setting of settings) {
    const entry = draft[setting.key];
    if (!entry) continue;
    const quoted = `"${setting.label}"`;

    if (setting.unit === "channels") {
      const picked = inChannelOrder(entry.channels);
      if (picked.length === 0) return { error: `${quoted} needs at least one channel.` };
      const current = inChannelOrder(Array.isArray(setting.value) ? setting.value : []);
      if (picked.join(",") !== current.join(",")) values[setting.key] = picked;
    } else {
      const typed = entry.value.trim();
      if (setting.unit === "peso" && !PESO.test(typed)) {
        return { error: `${quoted} needs an amount in pesos with up to two decimals, such as 500000.00.` };
      }
      if (setting.unit !== "peso" && !WHOLE.test(typed)) return { error: `${quoted} needs a whole number.` };
      if (typed !== String(setting.value ?? "")) values[setting.key] = typed;
    }

    if (entry.check === "confirm") {
      const source = entry.source.trim();
      if (source === "") return { error: `Say what confirmed ${quoted}.` };
      verified[setting.key] = source;
    } else if (entry.check === "to_verify") {
      toVerify.push(setting.key);
    }
  }

  if (Object.keys(values).length === 0 && Object.keys(verified).length === 0 && toVerify.length === 0) {
    return { error: "Change a value, or confirm or re-open a setting, before asking." };
  }
  const reasonError = amlaReasonError(reason);
  if (reasonError) return { error: reasonError };

  return {
    body: {
      type: "settings",
      reason: reason.trim(),
      ...(Object.keys(values).length > 0 ? { values } : {}),
      ...(Object.keys(verified).length > 0 ? { verified } : {}),
      ...(toVerify.length > 0 ? { to_verify: toVerify } : {}),
    },
  };
}

export function amlaCalendarHeadline(calendar: AmlaCalendar): string {
  if (calendar.confirmed) {
    return calendar.confirmed_at
      ? `The ${calendar.year} calendar was confirmed ${formatDateTime(calendar.confirmed_at)}.`
      : `The ${calendar.year} calendar is confirmed.`;
  }
  return `The ${calendar.year} calendar isn't confirmed yet, so deadlines that reach ${calendar.year} are provisional.`;
}

export interface AmlaCalendarDayForm {
  date: string;
  kind: string;
  name: string;
  source: string;
  reason: string;
}

export function amlaCalendarAddBody(form: AmlaCalendarDayForm): AmlaBodyResult<AmlaChangeRequestBody> {
  if (form.date === "") return { error: "Pick the date." };
  if (form.kind === "") return { error: "Pick what kind of day it is." };
  if (form.name.trim() === "") return { error: "Give the day's name." };
  if (form.source.trim() === "") return { error: "Say where the day was announced." };
  const reasonError = amlaReasonError(form.reason);
  if (reasonError) return { error: reasonError };
  return {
    body: {
      type: "calendar_add",
      date: form.date,
      kind: form.kind,
      name: form.name.trim(),
      source: form.source.trim(),
      reason: form.reason.trim(),
    },
  };
}

export function amlaDeadlineLines(preview: AmlaDeadlinePreview): { due: string; detail: string; notes: string[] } {
  const notes: string[] = [];
  if (preview.provisional && preview.provisional_years.length > 0) {
    const years = preview.provisional_years;
    notes.push(
      years.length === 1
        ? `Provisional: the ${years[0]} calendar isn't confirmed yet.`
        : `Provisional: the ${yearList(years)} calendars aren't confirmed yet.`,
    );
  }
  if (preview.to_verify) notes.push("The deadline setting is still to verify.");
  return {
    due: `Due ${formatDate(preview.due_on)}`,
    detail:
      `${preview.kind_words}: ${workingDays(preview.working_days)} after ${formatDate(preview.from)}, ` +
      `counted from the next day, under settings version ${preview.settings_version}.`,
    notes,
  };
}

export interface AmlaLogRow {
  id: number;
  when: string;
  who: string;
  action: string;
  subject: string;
}

export function amlaLogRow(entry: AmlaLogEntry): AmlaLogRow {
  return {
    id: entry.id,
    when: formatDateTime(entry.at),
    who: entry.actor?.name ?? (entry.actor_type === "system" ? "System" : "A former user"),
    action: entry.action_words,
    subject: entry.subject_words ?? "—",
  };
}

export function amlaYearChoices(year: number): number[] {
  return [year - 1, year, year + 1];
}
