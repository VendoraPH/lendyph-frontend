import type { SubjectKind } from "@/components/common/subject-picker";

/**
 * Why a report's or document's subject picker is locked, in words, or null
 * when it isn't. Members need `borrowers:view` and loans `loans:view`, which
 * the report and document screens don't imply.
 */
export function subjectLockedReason(subject: SubjectKind, canList: boolean): string | null {
  if (canList) return null;
  return subject === "loan" ? "Needs access to loans" : "Needs access to member details";
}
