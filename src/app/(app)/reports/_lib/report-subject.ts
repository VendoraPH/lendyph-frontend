import type { SubjectKind } from "@/components/common/subject-picker";
import { formatDateISO } from "@/lib/format";
import type { DateRange } from "./types";

/** How a prompt names the record a report needs. `borrower` is the API's key for a member. */
export function reportSubjectNoun(subject: SubjectKind): string {
  return subject === "borrower" ? "member" : subject;
}

/** What a report without date controls covers, for the line in their place. */
export function noDateRangeScope(subject: SubjectKind | undefined): string {
  return `Covers the whole ${subject === "loan" ? "loan" : "portfolio"}, as of the day it is generated.`;
}

/** What a report run to one cutoff date covers, for the line in the date presets' place. */
export const CUTOFF_SCOPE =
  "Share capital on the cutoff date, and the profit from January 1 of its year to the cutoff date.";

/** What the empty preview asks the user to pick before generating. */
export function reportPickPrompt(report: {
  noDateRange?: boolean;
  subject?: SubjectKind;
  accountParam?: boolean;
  cutoffDate?: boolean;
}): string {
  if (report.cutoffDate) return "a cutoff date";
  if (report.accountParam) return "a date range for the savings account";
  if (!report.noDateRange) return "a date range";
  return report.subject ? `a ${reportSubjectNoun(report.subject)}` : "a branch";
}

/** The member a `?member=<id>` link opens with: a whole positive id, or nobody. */
export function presetMemberId(param: string | null): number | null {
  return param !== null && /^[1-9]\d*$/.test(param) ? Number(param) : null;
}

/** The savings account a `?account=<id>` link opens with, read the same way. */
export function presetAccountId(param: string | null): number | null {
  return presetMemberId(param);
}

/** The branch a `?branch=<id>` link opens with, read the same way. */
export function presetBranchId(param: string | null): number | null {
  return presetMemberId(param);
}

/**
 * The branch a link's id stands for on this page: only once the picker's list
 * has loaded and only if it offers that branch. Until then, or for a branch the
 * user can't pick, the report runs and is labelled on its default.
 */
export function linkedBranchId(
  branchId: number | null,
  offered: readonly { id: number }[],
  loaded: boolean,
): number | null {
  if (branchId === null || !loaded) return null;
  return offered.some((b) => b.id === branchId) ? branchId : null;
}

/** A strict `YYYY-MM-DD` that names a real calendar day (`2026-02-31` doesn't). */
function isCalendarDate(value: string | null): value is string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return formatDateISO(new Date(y, m - 1, d)) === value;
}

/**
 * The period a report run to `cutoff` covers: January 1 of its year to the
 * cutoff date. Empty while the date isn't a real one (still being typed).
 */
export function cutoffRange(cutoff: string): DateRange {
  return isCalendarDate(cutoff) ? { from: `${cutoff.slice(0, 4)}-01-01`, to: cutoff } : { from: "", to: "" };
}

/** Why a cutoff date can't be run yet, in words, or null when it can. */
export function cutoffProblem(cutoff: string, today: string): string | null {
  if (!isCalendarDate(cutoff)) return "Pick a cutoff date.";
  return cutoff > today ? "The cutoff date can't be after today." : null;
}

/**
 * The period a `?from=YYYY-MM-DD&to=YYYY-MM-DD` link opens with: both real
 * dates, `from` no later than `to`, on a report that has date controls.
 * Anything else opens the report's default period.
 */
export function presetPeriodRange(
  from: string | null,
  to: string | null,
  report: { noDateRange?: boolean } = {},
): DateRange | null {
  if (report.noDateRange || !isCalendarDate(from) || !isCalendarDate(to)) return null;
  return from <= to ? { from, to } : null;
}

/** Why a report that reads one savings account can't run yet. */
export const ACCOUNT_REPORT_HINT =
  "Open this statement from a savings account's page (Savings → Accounts → the account → Statement).";
