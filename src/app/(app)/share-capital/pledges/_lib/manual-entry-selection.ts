/**
 * Pledge Entry's bulk "Manual Entry" (finish run round 7). A pledge set to
 * auto-credit takes no entry by hand: the auto-credit run credits it, so an
 * entry by hand could credit a month twice. The server refuses such an entry,
 * single or bulk; here its row can't be ticked, and a row ticked before its
 * pledge was switched to auto-credit is listed as excluded, with the reason,
 * and never sent. The lock holds whether or not the Auto-Credit menu is shown.
 */

export const AUTO_CREDIT_ENTRY_LOCK_REASON =
  "This pledge is set to auto-credit, so the auto-credit run credits it. Turn auto-credit off to record an entry by hand.";

interface EntryPledge {
  id: number;
  autoCredit: boolean;
}

export function canTickForManualEntry(pledge: EntryPledge): boolean {
  return !pledge.autoCredit;
}

/** The ticked pledges, in list order: those an entry goes to, and those left out with why. */
export function manualEntrySelection<T extends EntryPledge>(
  pledges: readonly T[],
  selected: ReadonlySet<number>,
): { included: T[]; excluded: { pledge: T; reason: string }[] } {
  const included: T[] = [];
  const excluded: { pledge: T; reason: string }[] = [];
  for (const pledge of pledges) {
    if (!selected.has(pledge.id)) continue;
    if (canTickForManualEntry(pledge)) included.push(pledge);
    else excluded.push({ pledge, reason: AUTO_CREDIT_ENTRY_LOCK_REASON });
  }
  return { included, excluded };
}

/** The page's "select all" box, over the rows that can be ticked only. */
export function pageSelectionState<T extends EntryPledge>(
  page: readonly T[],
  selected: ReadonlySet<number>,
): { all: boolean; some: boolean; tickable: T[] } {
  const tickable = page.filter(canTickForManualEntry);
  const ticked = tickable.filter((p) => selected.has(p.id)).length;
  return { all: tickable.length > 0 && ticked === tickable.length, some: ticked > 0, tickable };
}
