import { lacksBranchAccess, userBranches, type BranchBearing } from "@/lib/user-branches";

/** The member list's summary card titles, and a note under them when needed. */
export interface BookTotalsLabels {
  members: string;
  credits: string;
  debits: string;
  balance: string;
  note: string | null;
}

/** The whole book, as `branches:view_all` sees it. */
export const BOOK_TOTALS_LABELS: BookTotalsLabels = {
  members: "Total Members",
  credits: "Total Credits",
  debits: "Total Debits",
  balance: "Total Share Capital",
  note: null,
};

/**
 * GET /share-capital/members totals each member's whole share capital and
 * scopes a branch user to the members now in their branches. The Share
 * Capital report counts each entry in the branch it posted in (backend #334),
 * so for a branch user the two can differ once a member moves. The titles say
 * whose totals these are; the figures stay the server's.
 *
 * A user not yet known, or with no branch (who sees no data), gets the plain
 * titles: nothing is claimed.
 */
export function bookTotalsLabels(user: BranchBearing | null | undefined, viewAll: boolean): BookTotalsLabels {
  if (!user || viewAll || lacksBranchAccess(user, viewAll)) return BOOK_TOTALS_LABELS;
  const where = userBranches(user).length === 1 ? "your branch" : "your branches";
  const title = where === "your branch" ? "Your Branch" : "Your Branches";
  return {
    members: `Members Now in ${title}`,
    credits: "Their Total Credits",
    debits: "Their Total Debits",
    balance: "Their Total Share Capital",
    note:
      `These totals cover the members now in ${where}, with each member's whole share capital, ` +
      "including entries posted while they were in another branch. " +
      "The Share Capital report counts each entry in the branch where it was posted.",
  };
}
