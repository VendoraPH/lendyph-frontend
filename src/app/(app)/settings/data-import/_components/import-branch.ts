/**
 * The branch an import runs in, from what its picker offers: the caller's own
 * branches, or every branch with `branches:view_all` (`branchPicker`).
 *
 * The server refuses an import into any other branch (Phase 6, D8), so a
 * branch the picker doesn't offer is never kept, and the only offered branch is
 * picked for the user. Pure, so it runs under `tsx --test`.
 */
export function importBranchChoice(offered: readonly { id: number }[], value: number | null): number | null {
  if (value !== null && offered.some((b) => b.id === value)) return value;
  return offered.length === 1 ? offered[0].id : null;
}
