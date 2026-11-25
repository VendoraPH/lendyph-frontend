// Changes made in the Release dialog after a print (finish run round 4). Once
// the disclosure statement and the promissory note are printed for the member
// to sign, two things can still change in the dialog itself:
// - an insurance premium, which the printed statement doesn't show (the premium
//   is only saved by the release);
// - a co-maker added to the loan, whom the printed note doesn't name.
//
// Neither holds the release (round 3's hold is for the loan's own terms): the
// dialog reminds the cashier to print the document again after release, for
// the member (and the new co-maker) to sign. The server says when each
// document was last printed (`printed_documents` on GET /loans/{id}) and when
// each co-maker was linked to the loan (`added_at`); nothing here works out a
// figure.

import { clockDate, formatDateTime } from "@/lib/format";
import type { ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import type { Loan, LoanCoMaker, PrintedDocument } from "@/types/loan";

/** A server time as a number to order by; NaN when it can't be read. */
function readAt(value: unknown): number {
  return typeof value === "string" && value.trim() !== "" ? clockDate(value).getTime() : Number.NaN;
}

/**
 * When `document` was last printed, from the server's list; null when it sent
 * none for it (never printed, or the loan isn't approved).
 */
export function latestPrint(
  loan: Pick<Loan, "printed_documents"> | null | undefined,
  document: PrintedDocument["document"],
): PrintedDocument | null {
  const items = loan?.printed_documents;
  if (!Array.isArray(items)) return null;
  return items.find((item) => item?.document === document && !Number.isNaN(readAt(item.printed_at))) ?? null;
}

/**
 * Under the insurance fields: a premium is set (`insurance`, the release's own
 * query, is null with no percentage or 0%) and the disclosure statement was
 * printed, so the signed statement doesn't show it. Null otherwise.
 */
export function insuranceReprintReminder(
  insurance: ReleasePreviewInsuranceQuery | null,
  loan: Pick<Loan, "printed_documents"> | null | undefined,
): string | null {
  if (insurance === null) return null;
  const print = latestPrint(loan, "disclosure");
  if (print === null) return null;
  return (
    `The disclosure statement printed on ${formatDateTime(print.printed_at)} doesn't show this insurance premium. ` +
    "Print it again after release for the member to sign."
  );
}

/**
 * The co-makers linked to the loan after `print`: the server's `added_at` is
 * later than the print. A link with no time (made before it was recorded, or a
 * row sent without the member's details) isn't counted.
 */
function addedAfter(coMakers: LoanCoMaker[] | undefined, print: PrintedDocument): LoanCoMaker[] {
  const printed = readAt(print.printed_at);
  return (Array.isArray(coMakers) ? coMakers : []).filter((cm) => readAt(cm?.added_at) > printed);
}

/**
 * Under the co-makers: a co-maker was added after the promissory note was last
 * printed, so the signed note doesn't name them. "you added" when the signed-in
 * user (`currentUserId`) added each of them, else "added since". Null
 * otherwise, including when the note was never printed (it will name them).
 */
export function coMakerReprintReminder(
  loan: Pick<Loan, "printed_documents" | "co_makers"> | null | undefined,
  currentUserId: number | null,
): string | null {
  const print = latestPrint(loan, "promissory_note");
  if (print === null) return null;
  const added = addedAfter(loan?.co_makers, print);
  if (added.length === 0) return null;

  const who = currentUserId !== null && added.every((cm) => cm.added_by === currentUserId) ? "you added" : "added since";
  const printedOn = formatDateTime(print.printed_at);
  return added.length === 1
    ? `The promissory note printed on ${printedOn} doesn't name the co-maker ${who}. ` +
        "Print it again after release for the member and the co-maker to sign."
    : `The promissory note printed on ${printedOn} doesn't name the co-makers ${who}. ` +
        "Print it again after release for the member and the co-makers to sign.";
}
