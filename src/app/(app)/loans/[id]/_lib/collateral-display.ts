/**
 * The value the loan's Collaterals card shows for an attached collateral:
 * the pivot's `snapshot_value`, what it was booked at when attached.
 *
 * The server sends it as null for a share capital pledge when the viewer may
 * not see share capital balances. Null (or no pivot) is a dash on screen; the
 * collateral's own `amount` never stands in for it.
 *
 * Pure, so it runs under `tsx --test`.
 */
import { toNumber } from "@/lib/report-format";

/** The part of a `GET /loans/{id}/collaterals` row this reads; `snapshot_value` may be hidden (null). */
export interface AttachedCollateralPivot {
  /** The collateral's own typed amount: on the row, never shown in place of the snapshot. */
  amount?: number | null;
  pivot?: { snapshot_value?: number | string | null } | null;
}

export function attachedCollateralValue(link: AttachedCollateralPivot): number | null {
  const raw = link.pivot?.snapshot_value;
  return typeof raw === "number" || typeof raw === "string" ? toNumber(raw) : null;
}
