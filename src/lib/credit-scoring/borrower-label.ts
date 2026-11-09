/**
 * A score row's member label: the server's `borrower_name`, or
 * `Member #{id}` when it is missing (a member record the caller can no longer
 * read). A blank or whitespace-only name is treated as absent rather than
 * rendered: an empty Member cell in a risk table reads as a UI fault, and the
 * id is always more useful than nothing.
 */
export function borrowerLabel(row: {
  borrower_id: number;
  borrower_name?: string | null;
}): string {
  const name = row.borrower_name?.trim();
  return name ? name : `Member #${row.borrower_id}`;
}
