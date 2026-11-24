/**
 * The member page's Membership section (finish run round 2, decision 15): the
 * membership date, member type and membership number, edited with
 * `borrowers:update` through `PATCH /borrowers/{id}/membership`. Pure, so it
 * runs under `tsx --test`.
 *
 * The browser checks only what it can know for sure (a date written as
 * year-month-day, not after today or the day the membership ended, one of the
 * two member types, a number that fits its column). The server holds the
 * number to the members import's rules and decides every refusal, in its own
 * words.
 */

import { MEMBER_TYPE_OPTIONS } from "@/constants";
import { getErrorMessage, httpStatusOf, validationErrors } from "@/lib/api-error";
import { calendarDateParts, isCalendarDate } from "@/lib/calendar-date";
import { formatDate } from "@/lib/format";
import { canonicalMemberNumber } from "@/lib/import-schema";
import type { Permission } from "@/types";
import type { BorrowerMemberType, BorrowerMembershipUpdate } from "@/types/borrower";
import { statusInWords } from "../_components/utils";

/** What these rules read of a member (BorrowerResource). */
export interface MembershipSource {
  status: string;
  borrower_code: string;
  membership_date?: string | null;
  member_type?: string | null;
  membership_number?: string | null;
  membership_ended_on?: string | null;
}

export type MembershipField = "membership_date" | "member_type" | "membership_number";

/** The dialog's fields, as typed. */
export interface MembershipDraft {
  membership_date: string;
  member_type: string;
  membership_number: string;
}

/** `PATCH /borrowers/{id}/membership`: only the fields that changed. A null number goes back to the member code. */
export type MembershipBody = BorrowerMembershipUpdate;

export type MembershipErrors = Partial<Record<MembershipField, string>>;

export type MembershipRequest =
  | { ok: true; changed: boolean; body: MembershipBody }
  | { ok: false; errors: MembershipErrors };

/** `borrowers.membership_number` is varchar(30). */
export const NUMBER_MAX = 30;

/** The backend's default type (`Borrower::MEMBER_TYPE_REGULAR`). */
const DEFAULT_TYPE = "regular";

/** A pending or rejected registration isn't a member (`Borrower::NON_MEMBER_STATUSES`). */
const NOT_MEMBERS: readonly string[] = ["pending", "rejected"];

const DASH = "—";

/** The server's own words (UpdateBorrowerMembershipRequest, MembershipDetails), so a check here and a refusal read alike. */
const DATE_FORMAT = "The membership date must be a date written as year-month-day, such as 2026-01-15.";
const DATE_FUTURE = "The membership date can't be in the future.";
const DATE_REQUIRED = "Enter the membership date. It can be changed but not cleared.";
const TYPE_REQUIRED = "Choose Regular or Associate for the member type.";
const NUMBER_TOO_LONG = `The membership number can be at most ${NUMBER_MAX} characters.`;
const FAILED = "We couldn't save the membership details. Please try again.";
const OUT_OF_REACH =
  "This member is outside your branches now, or no longer exists, so their membership details can't be changed.";

const FIELDS: readonly MembershipField[] = ["membership_date", "member_type", "membership_number"];

function isMemberType(value: string): value is BorrowerMemberType {
  return MEMBER_TYPE_OPTIONS.some((option) => option.value === value);
}

/** A member has membership details; a pending or rejected registration has none. */
export function hasMembership(member: { status: string }): boolean {
  return !NOT_MEMBERS.includes(member.status);
}

/** Edit is offered to `borrowers:update` holders, for a member. A former member's details can still be corrected. */
export function canEditMembership(can: (permission: Permission) => boolean, member: { status: string }): boolean {
  return can("borrowers:update") && hasMembership(member);
}

/** "Regular" or "Associate"; the stored default is Regular. */
export function memberTypeLabel(type: string | null | undefined): string {
  const value = type || DEFAULT_TYPE;
  return MEMBER_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? statusInWords(value);
}

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/**
 * Member since: how long the membership has lasted on `to` (today, or the day
 * it ended), in whole months, as "7 years, 8 months". Null without a date.
 */
export function membershipLength(from: string | null | undefined, to: string): string | null {
  const start = calendarDateParts(from);
  const end = calendarDateParts(to);
  if (!start || !end) return null;
  const months = (end[0] - start[0]) * 12 + (end[1] - start[1]) - (end[2] < start[2] ? 1 : 0);
  if (months < 0) return null;
  if (months === 0) return "Less than a month";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, "month");
  return rest === 0 ? plural(years, "year") : `${plural(years, "year")}, ${plural(rest, "month")}`;
}

export interface MembershipRow {
  label: string;
  value: string;
}

/**
 * The card: Membership Date, Member Type, Membership Number and Member since,
 * and for a withdrawn or deceased member when and how the membership ended.
 */
export function membershipRows(member: MembershipSource, today: string): MembershipRow[] {
  const ended = member.membership_ended_on || null;
  const rows: MembershipRow[] = [
    { label: "Membership Date", value: member.membership_date ? formatDate(member.membership_date) : DASH },
    { label: "Member Type", value: memberTypeLabel(member.member_type) },
    { label: "Membership Number", value: member.membership_number || DASH },
    { label: "Member since", value: membershipLength(member.membership_date, ended ?? today) ?? DASH },
  ];
  if (ended) {
    rows.push({ label: "Membership Ended", value: `${formatDate(ended)} (${statusInWords(member.status)})` });
  }
  return rows;
}

/** The dialog starts from the member's own details. */
export function membershipDraft(member: MembershipSource): MembershipDraft {
  return {
    membership_date: member.membership_date ?? "",
    member_type: member.member_type || DEFAULT_TYPE,
    membership_number: member.membership_number ?? "",
  };
}

/** The latest date the dialog accepts: today, or the day the membership ended if that came first. */
export function latestMembershipDate(member: MembershipSource, today: string): string {
  const ended = member.membership_ended_on || null;
  return ended !== null && ended < today ? ended : today;
}

function dateProblem(date: string, member: MembershipSource, today: string): string | null {
  if (date === "") return member.membership_date ? DATE_REQUIRED : null;
  if (!isCalendarDate(date)) return DATE_FORMAT;
  // Both are `YYYY-MM-DD`, so the strings compare as the dates do.
  if (date > today) return DATE_FUTURE;
  const ended = member.membership_ended_on || null;
  if (ended !== null && date > ended) {
    return `The membership date can't be after the day the membership ended (${formatDate(ended)}).`;
  }
  return null;
}

/**
 * The PATCH body, holding only what changed, or why the dialog can't send it
 * yet. The number is compared and sent as members sign in with it: capitals,
 * spaces removed. A cleared number is sent as null, which the server sets
 * back to the member code.
 */
export function membershipRequest(draft: MembershipDraft, member: MembershipSource, today: string): MembershipRequest {
  const date = draft.membership_date.trim();
  const type = isMemberType(draft.member_type) ? draft.member_type : null;
  const number = canonicalMemberNumber(draft.membership_number);
  const errors: MembershipErrors = {};

  const dateError = dateProblem(date, member, today);
  if (dateError) errors.membership_date = dateError;
  if (type === null) errors.member_type = TYPE_REQUIRED;
  if (number.length > NUMBER_MAX) errors.membership_number = NUMBER_TOO_LONG;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const body: MembershipBody = {};
  if (date !== "" && date !== (member.membership_date ?? "")) body.membership_date = date;
  if (type !== null && type !== (member.member_type || DEFAULT_TYPE)) body.member_type = type;
  const storedNumber = canonicalMemberNumber(member.membership_number ?? "");
  // Blank means the member code, which a number equal to it already is; a
  // member with no number yet keeps none.
  const numberChanged = number === "" ? storedNumber !== "" && storedNumber !== member.borrower_code : number !== storedNumber;
  if (numberChanged) body.membership_number = number === "" ? null : number;

  return { ok: true, changed: Object.keys(body).length > 0, body };
}

/** What the dialog shows after a refused or failed save. */
export interface MembershipFailure {
  /** Refusals of a field, shown under it. */
  fields: MembershipErrors;
  /** Anything else, above the buttons, in the server's words or ours. */
  general: string | null;
  /** 404: the member is outside the caller's branches now, so saving again can't help. */
  outOfReach: boolean;
}

/**
 * Where a refused save is shown, by the server's answer:
 * - 422: each field's refusal under the field; one about the member itself
 *   (a registration not yet approved) above the buttons.
 * - 404: the member is outside the caller's branches now, or gone. The
 *   framework's text never shows.
 * - Anything else (a missing permission, a failure): its words.
 */
export function membershipFailure(err: unknown): MembershipFailure {
  if (httpStatusOf(err) === 404) return { fields: {}, general: OUT_OF_REACH, outOfReach: true };

  const errors = validationErrors(err);
  if (!errors) return { fields: {}, general: getErrorMessage(err, FAILED), outOfReach: false };

  const fields: MembershipErrors = {};
  for (const field of FIELDS) {
    const message = errors[field]?.[0];
    if (message) fields[field] = message;
  }
  const other = Object.entries(errors)
    .filter(([key]) => !(FIELDS as readonly string[]).includes(key))
    .flatMap(([, messages]) => messages)[0];
  const general = other ?? (Object.keys(fields).length > 0 ? null : getErrorMessage(err, FAILED));
  return { fields, general, outOfReach: false };
}

/** The saved details onto the member already on the page, leaving the rest of the record as it was loaded. */
export function withMembership<T extends MembershipSource>(member: T, saved: MembershipSource): T {
  return {
    ...member,
    membership_date: saved.membership_date ?? null,
    member_type: saved.member_type || DEFAULT_TYPE,
    membership_number: saved.membership_number ?? null,
  };
}
