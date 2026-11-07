import type { SubjectKind } from "@/components/common/subject-picker";

/** How a prompt names the record a report needs. `borrower` is the API's key for a member. */
export function reportSubjectNoun(subject: SubjectKind): string {
  return subject === "borrower" ? "member" : subject;
}

/** The member a `?member=<id>` link opens with: a whole positive id, or nobody. */
export function presetMemberId(param: string | null): number | null {
  return param !== null && /^[1-9]\d*$/.test(param) ? Number(param) : null;
}
