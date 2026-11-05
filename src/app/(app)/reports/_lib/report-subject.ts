import type { SubjectKind } from "@/components/common/subject-picker";

/** How a prompt names the record a report needs. `borrower` is the API's key for a member. */
export function reportSubjectNoun(subject: SubjectKind): string {
  return subject === "borrower" ? "member" : subject;
}
