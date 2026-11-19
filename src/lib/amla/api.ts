/**
 * The AMLA foundation's API client (Phase 6, AMLA-B1). The server checks each
 * route's `amla:*` key and head-office access, and decides every change; the
 * screens only hide what it would refuse. AMLA data stays on these screens:
 * nothing here feeds Linda, notifications or the command palette.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  AmlaCalendar,
  AmlaChangeRequest,
  AmlaChangeRequestBody,
  AmlaDeadlineKind,
  AmlaDeadlinePreview,
  AmlaLogEntry,
  AmlaPage,
  AmlaSettingsInForce,
  AmlaSettingsVersion,
  AmlaStatus,
} from "@/types/amla";

const A = API_ENDPOINTS.AMLA;

type Query = Record<string, string | number | null | undefined>;

/** Only the filters that are set, so an empty one is never sent as `?from=`. */
export function only(query: Query): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined && entry[1] !== ""),
  );
}

/** A paged list's rows and page meta, without the envelope. */
export async function paged<T>(request: Promise<AmlaPage<T> & { success?: boolean }>): Promise<AmlaPage<T>> {
  const { data, meta } = await request;
  return { data, meta };
}

/** A note is sent only when there is one: approve and withdraw take it as optional. */
function note(text: string): { note?: string } {
  const trimmed = text.trim();
  return trimmed === "" ? {} : { note: trimmed };
}

export interface AmlaChangeRequestFilters {
  status: string | null;
  page: number;
}

export interface AmlaLogFilters {
  action: string;
  from: string;
  to: string;
  page: number;
}

export const amlaApi = {
  status: () => api.get<AmlaStatus>(A.STATUS),
  settings: () => api.get<AmlaSettingsInForce>(A.SETTINGS),
  settingsVersions: () => api.get<AmlaSettingsVersion[]>(A.SETTINGS_VERSIONS),
  /** `null` asks for this Manila year, as the server decides it. */
  calendar: (year: number | null) => api.get<AmlaCalendar>(A.CALENDAR, { params: only({ year }) }),
  deadlinePreview: (kind: AmlaDeadlineKind, from: string) =>
    api.get<AmlaDeadlinePreview>(A.DEADLINE_PREVIEW, { params: { kind, from } }),

  changeRequests: (filters: AmlaChangeRequestFilters) =>
    paged(
      api.getRaw<AmlaPage<AmlaChangeRequest>>(A.CHANGE_REQUESTS, {
        params: only({ status: filters.status, page: filters.page }),
      }),
    ),
  ask: (body: AmlaChangeRequestBody) => api.post<AmlaChangeRequest>(A.CHANGE_REQUESTS, body),
  approve: (id: number, text: string) => api.post<AmlaChangeRequest>(A.CHANGE_REQUEST_APPROVE(id), note(text)),
  reject: (id: number, text: string) => api.post<AmlaChangeRequest>(A.CHANGE_REQUEST_REJECT(id), { note: text.trim() }),
  withdraw: (id: number, text: string) => api.post<AmlaChangeRequest>(A.CHANGE_REQUEST_WITHDRAW(id), note(text)),

  /** Each read is itself written to the AMLA log by the server. */
  log: (filters: AmlaLogFilters) =>
    paged(
      api.getRaw<AmlaPage<AmlaLogEntry>>(A.LOG, {
        params: only({ action: filters.action, from: filters.from, to: filters.to, page: filters.page }),
      }),
    ),
};
