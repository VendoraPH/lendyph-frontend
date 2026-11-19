/**
 * AMLA foundation shapes, as lendyph-backend's `AmlaPresenter` sends them
 * (Phase 6, AMLA-B1). Dates are YYYY-MM-DD, times are server timestamps,
 * users are `{id, name}` (null for the system), money is a two-decimal string
 * with its ₱ words beside it, and every key has its words beside it.
 */

export interface AmlaUserRef {
  id: number;
  name: string;
}

export interface AmlaStatus {
  monitoring_enabled: boolean;
  settings_version: number;
  settings_to_verify: number;
  calendar_year: number;
  calendar_confirmed: boolean;
}

export type AmlaSettingUnit = "peso" | "channels" | "working_days" | "years";

export interface AmlaSetting {
  key: string;
  label: string;
  unit: AmlaSettingUnit;
  /** Money as a two-decimal string, channels as a list, the rest whole numbers. */
  value: string | string[] | number | null;
  value_words: string | null;
  to_verify: boolean;
  /** What confirmed the value, once it is no longer to verify. */
  source: string | null;
}

export interface AmlaSettingsVersion {
  id: number;
  version: number;
  source: "system_default" | "approved_change";
  effective_at: string;
  requested_by: AmlaUserRef | null;
  approved_by: AmlaUserRef | null;
  request_id: number | null;
  to_verify_count: number;
  settings: AmlaSetting[];
}

/** `GET /amla/settings`: the version in force, and the settings change waiting, if any. */
export interface AmlaSettingsInForce extends AmlaSettingsVersion {
  pending_request_id: number | null;
}

export type AmlaChangeRequestType = "settings" | "calendar_add" | "calendar_remove" | "calendar_confirm_year";
export type AmlaChangeRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface AmlaChangeRequest {
  id: number;
  type: AmlaChangeRequestType | string;
  type_words: string;
  status: AmlaChangeRequestStatus | string;
  status_words: string;
  /** The change in words, written by the server. */
  summary: string;
  /** Stored keys and values: never shown, the summary says it in words. */
  payload: unknown;
  reason: string;
  requested_by: AmlaUserRef | null;
  requested_at: string;
  decided_by: AmlaUserRef | null;
  decided_at: string | null;
  decision_note: string | null;
}

export type AmlaCalendarKind = "holiday" | "amlc_non_reporting" | "facility_suspension";

export interface AmlaCalendarEntry {
  id: number;
  date: string;
  kind: AmlaCalendarKind | string;
  kind_words: string;
  name: string;
  source: string;
  request_id: number | null;
  approved_by: AmlaUserRef | null;
  added_at: string;
}

export interface AmlaCalendar {
  year: number;
  confirmed: boolean;
  confirmed_at: string | null;
  provisional: boolean;
  entries: AmlaCalendarEntry[];
  /** Only for `amla:settings` holders with every branch: the year's calendar changes waiting. */
  pending?: AmlaChangeRequest[];
}

export type AmlaDeadlineKind = "ctr" | "str";

export interface AmlaDeadlinePreview {
  kind: AmlaDeadlineKind;
  kind_words: string;
  from: string;
  due_on: string;
  working_days: number;
  provisional: boolean;
  provisional_years: number[];
  settings_version: number;
  to_verify: boolean;
}

export interface AmlaLogEntry {
  id: number;
  at: string;
  action: string;
  action_words: string;
  actor_type: "user" | "system" | string;
  actor: AmlaUserRef | null;
  subject_type: string | null;
  subject_id: number | null;
  subject_words: string | null;
  /** Stored keys: never shown. */
  details: unknown;
  ip_address: string | null;
}

export interface AmlaPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface AmlaPage<T> {
  data: T[];
  meta: AmlaPageMeta;
}

/** What `POST /amla/change-requests` takes, by type. */
export type AmlaChangeRequestBody =
  | {
      type: "settings";
      reason: string;
      values?: Record<string, string | string[] | number>;
      verified?: Record<string, string>;
      to_verify?: string[];
    }
  | { type: "calendar_add"; reason: string; date: string; kind: string; name: string; source: string }
  | { type: "calendar_remove"; reason: string; entry_id: number }
  | { type: "calendar_confirm_year"; reason: string; year: number };
