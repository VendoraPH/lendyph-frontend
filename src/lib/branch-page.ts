// What the Branches page shows, by the multi-branch flag and the caller's
// permissions (Phase 6 MB-FE1). Pure, so the flag split is unit-tested.
//
// The status action ships without the flag: MB-BE1 refuses the old
// Activate/Deactivate edit, so it has to work everywhere. The profile fields,
// main office, figures and closure stay behind NEXT_PUBLIC_ENABLE_MULTI_BRANCH.

import { formatCurrency } from "@/lib/format";
import { branchStatusOf, mayChangeBranchStatus, type BranchStatusFields } from "@/lib/branch-status";
import type { Permission } from "@/types";

type Can = (permission: Permission) => boolean;

export interface BranchPageFeatures {
  /** Suspend or Reactivate with a reason; no flag. */
  statusAction: boolean;
  /** Email, manager, opening date and the CDA authority fields on the branch form. */
  profileFields: boolean;
  /** The main-office badge (and, for managers, Make main office). */
  mainOffice: boolean;
  /** The branch details dialog. */
  details: boolean;
  /** The branch's server figures: `loans:view` (the server sends null without it). */
  figures: boolean;
  /** The closure checklist and request: branches:manage plus branches:view_all. */
  closure: boolean;
}

export function branchPageFeatures(multiBranch: boolean, can: Can): BranchPageFeatures {
  const manages = mayChangeBranchStatus(can);
  return {
    statusAction: manages,
    profileFields: multiBranch,
    mainOffice: multiBranch,
    details: multiBranch,
    figures: multiBranch && can("loans:view"),
    closure: multiBranch && manages,
  };
}

/**
 * Make main office: on an active branch that isn't already it, for
 * branches:manage plus view_all. A suspended branch is shown it disabled with
 * the server's reason; a closed one never is. While a closure waits it is
 * disabled too: moving the main office there would make the closure's
 * approval fail (MB-BE2 makes the server refuse it as well).
 */
export function mainOfficeAction(
  branch: BranchStatusFields,
  can: Can,
  { closureWaiting = false }: { closureWaiting?: boolean } = {},
): { disabledReason: string | null } | null {
  if (!mayChangeBranchStatus(can) || branch.is_main_office) return null;
  const status = branchStatusOf(branch);
  if (status === "closed") return null;
  if (status !== "active") return { disabledReason: "Only an active branch can be the main office." };
  if (closureWaiting) {
    return { disabledReason: "A request to close this branch is waiting. Approve, reject or cancel it first." };
  }
  return { disabledReason: null };
}

/** `BranchFigures::for()`: counts and peso figures, all from the server. */
export interface BranchFigures {
  active_loans?: number;
  active_members?: number;
  total_outstanding?: number | string;
  outstanding_principal?: number | string;
  overdue_amount?: number | string;
  overdue_count?: number;
}

const FIGURES: Array<{ key: keyof BranchFigures; label: string; money: boolean }> = [
  { key: "active_loans", label: "Active loans", money: false },
  { key: "active_members", label: "Members with active loans", money: false },
  { key: "total_outstanding", label: "Outstanding", money: true },
  { key: "outstanding_principal", label: "Principal Balance", money: true },
  { key: "overdue_amount", label: "Past Due", money: true },
  { key: "overdue_count", label: "Past due loans", money: false },
];

/** The figures as label and value; a figure the server didn't send reads a dash. */
export function branchFigureRows(figures: BranchFigures): Array<{ label: string; value: string }> {
  return FIGURES.map(({ key, label, money }) => {
    const value = figures[key];
    if (value === undefined || value === null) return { label, value: "—" };
    return { label, value: money ? formatCurrency(value) : String(value) };
  });
}
