import type { CdaDocumentSubjectType } from "@/services/cda.service";

/**
 * A register row's attached documents (trainings, programs, cases): the
 * server's `documents_count` on each row, and the documents list filtered to
 * that row (`subject_type` and `subject_id`, active documents only, as the
 * count counts them), opened on the register's year. That is each row's own
 * period: a program's and a case's year is the register's, and a training is
 * listed under the year it was completed (else started), whose open period is
 * the one nearest it, where its documents are filed.
 */

export interface RegisterDocumentSubject {
  type: CdaDocumentSubjectType;
  id: number;
}

const SUBJECT_TYPES: ReadonlySet<string> = new Set<CdaDocumentSubjectType>(["training", "program", "case"]);

/** The documents list for one row, in the year its documents are filed under. */
export function registerDocumentsHref(subject: RegisterDocumentSubject, year: number): string {
  const params = new URLSearchParams({
    year: String(year),
    subject_type: subject.type,
    subject_id: String(subject.id),
  });
  return `/cda/documents?${params.toString()}`;
}

/** The row a documents list address names, or null. */
export function linkedDocumentSubject(search: string): RegisterDocumentSubject | null {
  const params = new URLSearchParams(search);
  const type = params.get("subject_type");
  const rawId = params.get("subject_id") ?? "";
  if (!type || !SUBJECT_TYPES.has(type) || !/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? { type: type as CdaDocumentSubjectType, id } : null;
}

/** What the documents list asks for when it is filtered to one row; nothing otherwise. */
export function subjectDocumentsParams(
  subject: RegisterDocumentSubject | null,
): { subject_type: CdaDocumentSubjectType; subject_id: number; status: "active" } | undefined {
  return subject ? { subject_type: subject.type, subject_id: subject.id, status: "active" } : undefined;
}

/** "No documents", "1 document", "3 documents"; null when the server sent no count. */
export function documentsCountLabel(count: number | null | undefined): string | null {
  if (typeof count !== "number") return null;
  if (count === 0) return "No documents";
  return `${count} ${count === 1 ? "document" : "documents"}`;
}
