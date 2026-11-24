// Reprint after a change (finish run round 3, R.A. 3765). The disclosure
// statement and the promissory note are printed for the member to sign. While a
// loan is approved, the server lists each printed one whose terms changed since
// (`printed_documents_outdated` on GET /loans/{id}) and refuses the release
// until it is printed again (422 on `documents`).
//
// The words for the loan page: its notice, the Release button's reason and the
// refusal. The server decides what is out of date; nothing here works it out.

import { looksHuman, validationErrors } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import type { Loan, PrintedDocumentOutdated } from "@/types/loan";

/** Each document in words, for an item the server sent without its label. */
const DOCUMENT_NAMES: Record<PrintedDocumentOutdated["document"], string> = {
  disclosure: "Disclosure Statement",
  promissory_note: "Promissory Note",
};

/** What a refusal on `documents` says when the server's sentence can't be shown. */
export const DOCUMENTS_REFUSAL_FALLBACK =
  "The loan's terms changed after a document was printed. Print it again and have the member sign the new copy before releasing.";

/** The server's list for this loan; none when it wasn't sent. */
export function outdatedPrints(
  loan: Pick<Loan, "printed_documents_outdated"> | null | undefined,
): PrintedDocumentOutdated[] {
  const items = loan?.printed_documents_outdated;
  return Array.isArray(items) ? items : [];
}

function nameOf(item: PrintedDocumentOutdated): string {
  const label = item.label?.trim();
  return label ? label : DOCUMENT_NAMES[item.document] ?? "document";
}

/** "the Disclosure Statement", or "the Disclosure Statement and the Promissory Note". */
function joinedWithAnd(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

/**
 * The loan page's notice, naming each document with when it was printed
 * (Manila time); null when nothing is out of date.
 */
export function reprintNotice(items: PrintedDocumentOutdated[]): string | null {
  if (items.length === 0) return null;

  if (items.length === 1) {
    const [item] = items;
    return (
      `The loan's terms changed after the ${nameOf(item)} was printed (${formatDateTime(item.printed_at)}). ` +
      "Print it again and have the member sign the new copy before release."
    );
  }

  const printed = joinedWithAnd(items.map((item) => `the ${nameOf(item)} (${formatDateTime(item.printed_at)})`));
  return (
    `The loan's terms changed after ${printed} were printed. ` +
    "Print them again and have the member sign the new copies before release."
  );
}

/** Why Release is off while a printed document is out of date; null when it isn't held. */
export function releaseBlockedReason(items: PrintedDocumentOutdated[]): string | null {
  if (items.length === 0) return null;

  const names = joinedWithAnd(items.map((item) => `the ${nameOf(item)}`));
  return items.length === 1
    ? `Print ${names} again before release: the loan's terms changed after it was printed.`
    : `Print ${names} again before release: the loan's terms changed after they were printed.`;
}

/**
 * The sentence a release refused on `documents` (422) carries, in words; null
 * for any other answer, which the release dialog handles as before.
 */
export function releaseDocumentsRefusal(err: unknown): string | null {
  const errors = validationErrors(err);
  if (errors === null || !("documents" in errors)) return null;
  const sentence = errors.documents[0];
  return looksHuman(sentence) ? sentence : DOCUMENTS_REFUSAL_FALLBACK;
}
