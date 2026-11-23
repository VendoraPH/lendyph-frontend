/**
 * Staff decisions on an application's documents, by the merged backend's
 * rules (DocumentReview, MemberDocuments). The server re-checks each one and
 * refuses in words; these only decide what each row offers.
 */

import { VALID_ID_OPTIONS } from "@/constants";
import type { DocumentStatus, StaffDocument, VerifyDocumentInput } from "@/types/loan-origination";

export type DocumentReview = "verify" | "replace" | "reject";

/** The statuses each decision is taken from (DocumentReview::FROM). */
const FROM: Record<DocumentReview, readonly DocumentStatus[]> = {
  verify: ["uploaded", "pending_verification"],
  replace: ["uploaded", "pending_verification", "verified", "rejected"],
  reject: ["uploaded", "pending_verification", "verified"],
};

const ORDER: readonly DocumentReview[] = ["verify", "replace", "reject"];

/** Uploads land as Uploaded, so the documents queue opens there. */
export const DEFAULT_QUEUE_STATUS: DocumentStatus = "uploaded";

/** The decisions a document's status allows; none without a file. */
export function reviewActions(doc: Pick<StaffDocument, "status" | "uploaded_at">): DocumentReview[] {
  if (doc.uploaded_at === null) return [];
  return ORDER.filter((kind) => FROM[kind].includes(doc.status));
}

export interface VerifyForm {
  notes: string;
  idType: string;
  customTypeName: string;
  idNumber: string;
}

const ID_TYPES: readonly string[] = VALID_ID_OPTIONS.map((o) => o.value);

/**
 * `POST …/verify`. An ID (`id_document`) also records its type, its name for
 * "others" and its number, which the hand-off files as the member's valid ID;
 * without them the server refuses (422). `problem` is the first missing piece,
 * in the server's words (MemberDocuments::messages()).
 */
export function verifyPayload(idDocument: boolean, form: VerifyForm): { body: VerifyDocumentInput; problem: string | null } {
  const notes = form.notes.trim();
  const body: VerifyDocumentInput = notes ? { notes } : {};
  if (!idDocument) return { body, problem: null };

  const idType = form.idType.trim();
  const custom = form.customTypeName.trim();
  const idNumber = form.idNumber.trim();
  let problem: string | null = null;
  if (idType === "") problem = "Choose the ID type.";
  else if (!ID_TYPES.includes(idType)) problem = "Choose the ID type from the list.";
  else if (idType === "others" && custom === "") problem = "Enter the ID type's name.";
  else if (idNumber === "") problem = "Enter the ID number.";

  return {
    body: {
      ...body,
      id_type: idType,
      ...(idType === "others" ? { custom_type_name: custom } : {}),
      id_number: idNumber,
    },
    problem,
  };
}

/**
 * The file cell. Without `borrowers:view` and the branch the server hides
 * file names (they can hold an address), so an uploaded file reads as such.
 */
export function fileLine(doc: Pick<StaffDocument, "file_name" | "uploaded_at">): { text: string; hidden: boolean } {
  if (doc.file_name) return { text: doc.file_name, hidden: false };
  if (doc.uploaded_at) return { text: "File name hidden", hidden: true };
  return { text: "Not uploaded", hidden: false };
}
