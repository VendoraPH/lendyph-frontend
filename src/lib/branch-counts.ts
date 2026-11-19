/**
 * The branch dashboard counts (`GET /branch-counts`, Phase 6 MB-BE5, the
 * multi-branch analysis §15). Each figure is in the caller's branches and is
 * null without its source's permission, which reads "Not available", never 0.
 * Pure, so `BranchCountsCards` and the executive dashboard read alike.
 */

import type { BranchCounts } from "@/types/interbranch-transfer";

export const NOT_AVAILABLE = "Not available";

export interface BranchCountCard {
  key: keyof BranchCounts;
  label: string;
  hint: string;
  value: string;
  available: boolean;
}

const CARDS: { key: keyof BranchCounts; label: string; hint: string }[] = [
  {
    key: "pending_transfers",
    label: "Transfers waiting for approval",
    hint: "Interbranch transfers nobody has approved yet.",
  },
  {
    key: "in_transit_transfers",
    label: "Transfers in transit",
    hint: "Sent, and not yet received by the other branch.",
  },
  {
    key: "suspended_branches",
    label: "Suspended branches",
    hint: "Branches that can't take new business for now.",
  },
  {
    key: "unreconciled_branches",
    label: "Branches not yet reconciled",
    hint: "Branches with a latest reconciliation that isn't reconciled.",
  },
];

/** The cards, in a fixed order, from the server's figures. */
export function branchCountCards(counts: Partial<BranchCounts> | null | undefined): BranchCountCard[] {
  return CARDS.map(({ key, label, hint }) => {
    const figure = counts?.[key];
    const available = typeof figure === "number" && Number.isFinite(figure);
    return { key, label, hint, value: available ? String(figure) : NOT_AVAILABLE, available };
  });
}
