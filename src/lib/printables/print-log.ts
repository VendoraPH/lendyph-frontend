import { api } from "@/lib/api-client";
import type { PrintableDocument, PrintableId } from "./types";

/**
 * The documents whose printing is written to the audit trail, under the names
 * `POST /loans/{loan}/print-log` takes.
 */
const LOGGED_DOCUMENTS: Partial<Record<PrintableId, "disclosure" | "promissory_note">> = {
  disclosure_statement: "disclosure",
  promissory_note: "promissory_note",
};

export interface PrintLogRequest {
  url: string;
  body: { document: "disclosure" | "promissory_note" };
}

/** What printing this document posts, or null when it isn't logged. */
export function printLogRequest(doc: PrintableDocument): PrintLogRequest | null {
  const document = LOGGED_DOCUMENTS[doc.id];
  if (!document || !doc.subjectId) return null;
  return { url: `/loans/${doc.subjectId}/print-log`, body: { document } };
}

/**
 * Record a print. The record never gets in the way of the paper: the server can
 * refuse (422 for a status that doesn't have this document) or be unreachable,
 * and the print goes ahead either way, so nothing here is awaited or reported.
 */
export function logPrint(doc: PrintableDocument): void {
  const request = printLogRequest(doc);
  if (!request) return;
  api.rawPost(request.url, request.body).catch(() => {});
}
