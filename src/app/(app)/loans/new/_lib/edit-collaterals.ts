// Edit mode's collaterals: what the loan holds, whether that has loaded, and
// what the save sends. Dependency-free, so it runs under `tsx --test`.

import { collateralLock } from "@/lib/collateral-lock";
import type { LoanCollateralInput } from "@/services/loan.service";
import type { LoanCollateral } from "@/types/collateral";
import type { CollateralValueRow } from "@/utils/collateral-value";

/** A collateral on the form, at the value it is (or will be) booked at. */
export interface SelectedCollateral {
  collateral: CollateralValueRow;
  snapshot_value: number;
}

/**
 * Where edit mode is with reading the loan's attached collaterals.
 * - `loading`: not read yet, so nobody knows what the loan holds.
 * - `ready`: read, even when the loan holds none.
 * - `error`: the read failed. Retrying may fix it.
 */
export type EditCollateralLoad = "loading" | "ready" | "error";

/** The outcome of one read of `GET /loans/{id}/collaterals`. */
export interface EditCollateralResult {
  /** Which read this answers, so a stale answer is never taken as current. */
  request: string;
  /** The attached collaterals as form rows, or null when the read failed. */
  attached: SelectedCollateral[] | null;
  /** What to tell the user when the read failed. */
  error: string | null;
}

/**
 * Whether the form tracks the loan's collaterals at all: in edit mode, for a
 * role with `collaterals:view`. Without it the page never reads them, so
 * nothing waits on them and the save never mentions them.
 */
export function tracksEditCollaterals(isEditMode: boolean, canViewCollaterals: boolean): boolean {
  return isEditMode && canViewCollaterals;
}

/**
 * The load state for the current read. A result for an earlier read (another
 * loan, or before a Retry) counts as still loading.
 */
export function editCollateralLoad(
  result: EditCollateralResult | null,
  request: string,
): EditCollateralLoad {
  if (result === null || result.request !== request) return "loading";
  return result.attached === null ? "error" : "ready";
}

/**
 * Why Save is held, or null when it is not. `load` is null when the form does
 * not track collaterals (`tracksEditCollaterals`), which never holds Save.
 *
 * Saving before the attached collaterals are known would state the loan's
 * collaterals from an incomplete list, so Save waits for `ready`.
 */
export function collateralSaveBlock(load: EditCollateralLoad | null): string | null {
  if (load === "loading") return "Save is available once this loan's collaterals have loaded.";
  if (load === "error") {
    return "Save is unavailable until this loan's collaterals load. Use Retry in the Collaterals card.";
  }
  return null;
}

/**
 * Whether the form lets the user change the collaterals.
 *
 * Always for a new application. In edit mode only once the loan's collaterals
 * are known (`ready`) and for a role with `collaterals:update`: the edit
 * states them on the loan update, which the server refuses without it.
 */
export function canChangeCollaterals(
  isEditMode: boolean,
  load: EditCollateralLoad | null,
  canUpdate: boolean,
): boolean {
  return !isEditMode || (load === "ready" && canUpdate);
}

/**
 * What the loan held when the form loaded, for `editedCollaterals` to diff the
 * selection against, or null when the save must not state the collaterals.
 *
 * Null for a new application (it attaches after create instead), and in edit
 * mode whenever the collaterals can't be changed: no `collaterals:view` (so
 * `load` is null and they were never read), no `collaterals:update`, or a read
 * that is still loading or failed.
 */
export function statedAttachedCollaterals(
  isEditMode: boolean,
  load: EditCollateralLoad | null,
  canUpdate: boolean,
  result: EditCollateralResult | null,
): SelectedCollateral[] | null {
  if (!isEditMode || !canChangeCollaterals(isEditMode, load, canUpdate)) return null;
  return result?.attached ?? null;
}

/**
 * The loan's attached collaterals as form rows, built from the link rows
 * themselves.
 *
 * Not looked up in the member's collateral list: a row missing from that list
 * would otherwise drop out of the form, and saving would detach it. The link
 * row is a full `CollateralResource` with its type, valuation and holders, so
 * it carries everything the card shows. The snapshot is the value it was
 * booked at.
 */
export function attachedCollateralRows(
  links: readonly LoanCollateral[],
  loanId: number,
): SelectedCollateral[] {
  return links.map((link) => {
    const snapshot = link.pivot?.snapshot_value ?? link.effective_value ?? link.amount;
    return {
      collateral: {
        id: link.id,
        borrower_id: link.borrower_id,
        collateral_type_id: link.collateral_type_id,
        detail_value: link.detail_value,
        amount: link.amount,
        active_loans: link.active_loans,
        created_at: link.created_at,
        updated_at: link.updated_at,
        type: link.collateral_type ?? link.type,
        lock: collateralLock(link, { exceptLoanId: loanId }),
        effective_value: link.effective_value ?? snapshot,
        value_unknown: link.value_unknown ?? false,
      },
      snapshot_value: snapshot,
    };
  });
}

/**
 * The `collaterals` part of an edit's `PUT /loans/{id}` body.
 *
 * The full list, only when the selection differs from what the loan held when
 * the form loaded (compared by collateral id). Otherwise nothing, so the server
 * leaves the loan's collaterals alone. `attached` is null when the form must
 * not state them: it does not track them, or the role can't change them.
 */
export function editedCollaterals(
  selected: readonly SelectedCollateral[],
  attached: readonly SelectedCollateral[] | null,
): { collaterals?: LoanCollateralInput[] } {
  if (attached === null) return {};
  const before = new Set(attached.map((a) => a.collateral.id));
  const after = new Set(selected.map((s) => s.collateral.id));
  const unchanged = before.size === after.size && [...after].every((id) => before.has(id));
  if (unchanged) return {};
  return {
    collaterals: selected.map((s) => ({
      collateral_id: s.collateral.id,
      snapshot_value: s.snapshot_value,
    })),
  };
}
