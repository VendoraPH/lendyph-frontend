import type { Permission } from "@/types";
import type { AmlaSubjectSegment, AmlaSubjectType } from "@/types/amla-cdd";

/**
 * Who sees what of AMLA customer due diligence, decided as lendyph-backend's
 * CDD endpoints decide it (Phase 6, AMLA-B4). The server still decides every
 * read: a member in another branch, and any walk-in without head-office
 * access, answers 404 like a missing one.
 */

type Can = (permission: Permission) => boolean;

/** Every CDD endpoint needs this, checked before the record is looked up. */
export const AMLA_CUSTOMERS_PERMISSION: Permission = "amla:cdd";

export interface AmlaCddAccess {
  /** The worklist and subject pages: `amla:cdd`, under the /amla guard's `amla:view`. */
  customers: boolean;
  /** Walk-ins carry no branch, so they are head-office only. */
  walkIns: boolean;
  /** Picking a member's own valid ID reads the member's documents (`borrowers:view`). */
  memberIds: boolean;
}

export function amlaCddAccess(can: Can): AmlaCddAccess {
  const customers = can("amla:view") && can(AMLA_CUSTOMERS_PERMISSION);
  return {
    customers,
    walkIns: customers && can("branches:view_all"),
    memberIds: customers && can("borrowers:view"),
  };
}

export interface AmlaSubjectRef {
  type: AmlaSubjectType;
  segment: AmlaSubjectSegment;
  id: number;
}

const SEGMENTS: Readonly<Record<AmlaSubjectSegment, AmlaSubjectType>> = { members: "member", "walk-ins": "walk_in" };
const ID = /^[0-9]{1,18}$/;

/** The subject a `/amla/customers/{type}/{id}` route names, or null when it names none (the page answers not found). */
export function amlaSubjectFromRoute(segment: unknown, id: unknown): AmlaSubjectRef | null {
  if (typeof segment !== "string" || !Object.hasOwn(SEGMENTS, segment)) return null;
  if (typeof id !== "string" || !ID.test(id)) return null;
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return { type: SEGMENTS[segment as AmlaSubjectSegment], segment: segment as AmlaSubjectSegment, id: number };
}

export function amlaSubjectHref(type: AmlaSubjectType, id: number): string {
  return `/amla/customers/${type === "walk_in" ? "walk-ins" : "members"}/${id}`;
}
