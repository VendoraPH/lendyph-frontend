/**
 * The house borrower-label fallback chain, narrowed to what a score row carries.
 *
 * Elsewhere (`src/app/(app)/share-capital/ledger/page.tsx:92` and its two
 * siblings) the chain reads
 * "borrower?.full_name ?? borrower?.name ?? borrower_name ?? Borrower #{id}".
 * `CreditScoreHistoryEntry` has no embedded `borrower` relation — only the flat
 * `borrower_name`, which the backend does not send yet — so the chain here is
 * its last two links. The `Borrower #{id}` literal stays as the final resort:
 * it is what both screens printed before, so nothing regresses if the field
 * never arrives.
 *
 * A blank or whitespace-only name is treated as absent rather than rendered:
 * an empty Borrower cell in a risk table reads as a UI fault, and the id is
 * always more useful than nothing.
 */
export function borrowerLabel(row: {
  borrower_id: number;
  borrower_name?: string | null;
}): string {
  const name = row.borrower_name?.trim();
  return name ? name : `Borrower #${row.borrower_id}`;
}
