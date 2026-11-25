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
 * The approval card's line once every approver has signed off on an approved
 * loan (`ready`, from `readyForRelease`): "ready" for release, or, exactly
 * while Release is held (`releaseBlockedReason`), waiting on the reprint.
 * Null when the loan isn't ready.
 */
export function releaseReadyState(
  ready: boolean,
  items: PrintedDocumentOutdated[],
): "ready" | "waiting_for_reprint" | null {
  if (!ready) return null;
  return releaseBlockedReason(items) === null ? "ready" : "waiting_for_reprint";
}

/**
 * What the release waits on, naming each document: "the Disclosure Statement
 * is printed again and the member signs the new copy". Every line that would
 * otherwise invite the release says it while Release is held.
 */
function awaitedReprint(items: PrintedDocumentOutdated[]): string {
  const names = joinedWithAnd(items.map((item) => `the ${nameOf(item)}`));
  return items.length === 1
    ? `${names} is printed again and the member signs the new copy`
    : `${names} are printed again and the member signs the new copies`;
}

/** The waiting line, naming each document; null when nothing is out of date. */
export function waitingForReprintLine(items: PrintedDocumentOutdated[]): string | null {
  if (releaseBlockedReason(items) === null) return null;
  return `All approvers have signed off. The release waits until ${awaitedReprint(items)}.`;
}

/**
 * What the Release step tells the user who holds it, after "Signed in as …":
 * to open the release dialog, or, exactly while Release is held, that the
 * release waits on the reprint.
 */
export function releaseStepInstruction(items: PrintedDocumentOutdated[]): string {
  return releaseBlockedReason(items) === null
    ? "open the release dialog to complete the loan release."
    : `the release waits until ${awaitedReprint(items)}.`;
}

/**
 * What "Waiting for <step>" says to everyone else on the Release step: "to
 * release the loan", and while Release is held, once the reprint is done.
 */
export function waitingForReleasePhrase(items: PrintedDocumentOutdated[]): string {
  return releaseBlockedReason(items) === null
    ? "to release the loan"
    : `to release the loan once ${awaitedReprint(items)}`;
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
