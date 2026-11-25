import { api } from "@/lib/api-client";
import type { PrintableDocument, PrintableId, PrintedTerms } from "./types";

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
  body: { document: "disclosure" | "promissory_note" } & Partial<PrintedTerms>;
}

const FINGERPRINT = /^[0-9a-f]{64}$/;

/**
 * The terms a document payload states, when it carries them well formed:
 * `terms_fingerprint` (64 lowercase hexadecimal characters) with its
 * whole-number `terms_version`. Anything else, null included, is none: the
 * print log then sends neither and the server works the terms out (it refuses
 * an explicit null, which would be no print to compare).
 */
export function printedTermsOf(raw: unknown): PrintedTerms | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { terms_fingerprint: fingerprint, terms_version: version } = raw as Record<string, unknown>;
  const fingerprintOk = typeof fingerprint === "string" && FINGERPRINT.test(fingerprint);
  const versionOk = typeof version === "number" && Number.isInteger(version) && version >= 1;
  return fingerprintOk && versionOk
    ? { terms_fingerprint: fingerprint, terms_version: version as number }
    : undefined;
}

/**
 * What printing this document posts, or null when it isn't logged. The terms
 * its payload stated go with it, as they were, so the print records what the
 * paper shows even when the loan changed while the print tab stood open.
 */
export function printLogRequest(doc: PrintableDocument): PrintLogRequest | null {
  const document = LOGGED_DOCUMENTS[doc.id];
  if (!document || !doc.subjectId) return null;
  const terms = doc.printedTerms
    ? { terms_fingerprint: doc.printedTerms.terms_fingerprint, terms_version: doc.printedTerms.terms_version }
    : {};
  return { url: `/loans/${doc.subjectId}/print-log`, body: { document, ...terms } };
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
