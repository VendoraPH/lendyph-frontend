import type { SubjectKind } from "@/components/common/subject-picker";

/** How a prompt names the record a report needs. `borrower` is the API's key for a member. */
export function reportSubjectNoun(subject: SubjectKind): string {
  return subject === "borrower" ? "member" : subject;
}

/** What a report without date controls covers, for the line in their place. */
export function noDateRangeScope(subject: SubjectKind | undefined): string {
  return `Covers the whole ${subject === "loan" ? "loan" : "portfolio"}, as of the day it is generated.`;
}

/** What the empty preview asks the user to pick before generating. */
export function reportPickPrompt(report: { noDateRange?: boolean; subject?: SubjectKind }): string {
  if (!report.noDateRange) return "a date range";
  return report.subject ? `a ${reportSubjectNoun(report.subject)}` : "a branch";
}

/** The member a `?member=<id>` link opens with: a whole positive id, or nobody. */
export function presetMemberId(param: string | null): number | null {
  return param !== null && /^[1-9]\d*$/.test(param) ? Number(param) : null;
}
