import type { Permission } from "@/types";

/**
 * Who sees what of AMLA, decided as lendyph-backend's `AmlaAccess` decides
 * each endpoint (Phase 6, AMLA-B1). The screens only hide what the server
 * would refuse; the server still decides every read and every change.
 */

type Can = (permission: Permission) => boolean;

/** Every page under /amla opens on this, as the AMLA dashboard and reports do. */
export const AMLA_ROUTE_PERMISSION: Permission = "amla:view";

/** Settings → AMLA opens for any key one of its parts needs. */
export const AMLA_SETTINGS_PAGE_PERMISSIONS: readonly Permission[] = ["amla:view", "amla:settings", "amla:audit"];

const VIEW_ALL: Permission = "branches:view_all";

export type AmlaRouteDecision = "not_found" | "denied" | "open";

/** The /amla guard: not found while the flag is off, then `amla:view`. */
export function amlaRouteDecision(flagOn: boolean, can: Can): AmlaRouteDecision {
  if (!flagOn) return "not_found";
  return can(AMLA_ROUTE_PERMISSION) ? "open" : "denied";
}

export interface AmlaSettingsSections {
  /** Monitoring status: `amla:view`. */
  status: boolean;
  /** The settings in force: `amla:view` or `amla:settings`, with every branch. */
  settings: boolean;
  /** The version history: `amla:settings` or `amla:audit`, with every branch. */
  versions: boolean;
  /** Change requests: `amla:settings` with every branch. */
  changeRequests: boolean;
  /** The calendar and the deadline preview: `amla:view`. */
  calendar: boolean;
  /** Asking for calendar changes, and seeing those waiting: `amla:settings` with every branch. */
  calendarRequests: boolean;
  /** The AMLA log: `amla:audit` with every branch. */
  log: boolean;
}

export function amlaSettingsSections(can: Can): AmlaSettingsSections {
  const headOffice = can(VIEW_ALL);
  const settingsHolder = headOffice && can("amla:settings");
  return {
    status: can("amla:view"),
    settings: headOffice && (can("amla:view") || can("amla:settings")),
    versions: headOffice && (can("amla:settings") || can("amla:audit")),
    changeRequests: settingsHolder,
    calendar: can("amla:view"),
    calendarRequests: settingsHolder,
    log: headOffice && can("amla:audit"),
  };
}

export interface AmlaChangeRequestActions {
  approve: boolean;
  reject: boolean;
  withdraw: boolean;
}

/**
 * Maker-checker: the maker may only withdraw a waiting request, and another
 * settings holder may approve or reject it. A 403 or 409 from the server still
 * wins (someone else decided it first, or the settings moved on).
 */
export function amlaChangeRequestActions(
  request: { status: string; requested_by: { id: number } | null },
  userId: number | null,
  can: Can,
): AmlaChangeRequestActions {
  const none = { approve: false, reject: false, withdraw: false };
  if (request.status !== "pending" || userId === null || !can("amla:settings") || !can(VIEW_ALL)) return none;
  const maker = request.requested_by?.id === userId;
  return { approve: !maker, reject: !maker, withdraw: maker };
}
