/**
 * The value the loan's Collaterals card shows for an attached collateral:
 * the pivot's `snapshot_value`, what it was booked at when attached.
 *
 * The server sends it as null for a share capital pledge when the viewer may
 * not see share capital balances. Null (or no pivot) is a dash on screen; the
 * collateral's own `amount` never stands in for it.
 *
 * The card's Total Collateral Value and Short by are the loan's
 * `collateral_summary` figures. Both are null, with `value_unknown` true, when
 * the viewer may not see a share capital balance pledged to the loan: a dash
 * then, never ₱0.00. The security status still shows.
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

/** The part of the loan's `collateral_summary` this reads; the figures may be hidden (null). */
export interface CollateralSummaryFigures {
  total_value?: number | string | null;
  short_by?: number | string | null;
  value_unknown?: boolean;
  /** Shown by the card as sent; not read here. */
  security_status?: string;
}

/** The summary's total value and shortfall (null: a dash), and whether the server hid them. */
export function collateralSummaryFigures(summary: CollateralSummaryFigures | null | undefined): {
  totalValue: number | null;
  shortBy: number | null;
  valueHidden: boolean;
} {
  return {
    totalValue: toNumber(summary?.total_value),
    shortBy: toNumber(summary?.short_by),
    valueHidden: summary?.value_unknown === true,
  };
}
