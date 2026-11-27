/**
 * The collateral register's view state, and how it becomes a request and a
 * rendering.
 *
 * The register used to drain every collateral and every member, read each
 * share-capital member's ledger, and filter, group, value and sum the lot in
 * the browser. `GET /collaterals/register` does all of that on the server now
 * and answers one page of member groups, so what is left here is small and
 * pure: which question to ask, and how to word the figures that come back.
 */

import type {
  CollateralRegisterDirection,
  CollateralRegisterGroup,
  CollateralRegisterParams,
  CollateralRegisterSort,
} from "@/types";

export interface RegisterSortState {
  key: CollateralRegisterSort;
  dir: CollateralRegisterDirection;
}

/** Member name A→Z — the order the register has always opened in. */
export const DEFAULT_REGISTER_SORT: RegisterSortState = { key: "member", dir: "asc" };

/**
 * The direction a column starts in on its first click: names A→Z, figures
 * largest first, which is the end of the list anyone sorting by a figure is
 * looking for.
 */
const FIRST_DIRECTION: Record<CollateralRegisterSort, CollateralRegisterDirection> = {
  member: "asc",
  collaterals: "desc",
  total_value: "desc",
  tagged: "desc",
};

/** Clicking a header: a new column starts in its first direction, the same one flips. */
export function nextRegisterSort(
  current: RegisterSortState,
  key: CollateralRegisterSort,
): RegisterSortState {
  if (current.key !== key) return { key, dir: FIRST_DIRECTION[key] };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

/** `aria-sort` for a column header. */
export function ariaSortFor(
  sort: RegisterSortState,
  key: CollateralRegisterSort,
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

/** The type filter's "every type" value. */
export const ALL_TYPES = "all";

/** The server refuses a longer `search` with a 422. */
export const REGISTER_SEARCH_MAX = 100;

export interface RegisterView {
  /** The settled search box. */
  search: string;
  /** A collateral type id, as the Select holds it, or `ALL_TYPES`. */
  typeFilter: string;
  sort: RegisterSortState;
  page: number;
  perPage: number;
}

/**
 * The query for one view of the register.
 *
 * An empty search and "all types" are left out rather than sent empty: the
 * endpoint validates both, and an absent filter is the only unambiguous way to
 * say "no filter".
 */
export function registerQuery(view: RegisterView): CollateralRegisterParams {
  const params: CollateralRegisterParams = {
    sort: view.sort.key,
    direction: view.sort.dir,
    page: view.page,
    per_page: view.perPage,
  };
  const search = view.search.trim().slice(0, REGISTER_SEARCH_MAX);
  if (search) params.search = search;
  const typeId = Number(view.typeFilter);
  if (view.typeFilter !== ALL_TYPES && Number.isInteger(typeId) && typeId >= 1) {
    params.collateral_type_id = typeId;
  }
  return params;
}

/**
 * Where to go when a page came back empty, or null to stay.
 *
 * A delete that empties the last page leaves the cursor past `last_page`, and
 * the server answers that with no rows. Stepping back keeps the operator on
 * the nearest page that still has rows instead of an empty table that reads as
 * an empty register. Bounded by `page - 1` so it strictly decreases and cannot
 * loop on a nonsense `last_page`.
 */
export function pageAfterEmptyResult(
  page: number,
  rows: number,
  lastPage: number,
): number | null {
  if (rows > 0 || page <= 1) return null;
  return Math.max(1, Math.min(lastPage, page - 1));
}

/**
 * A group's Total Value cell.
 *
 * `unavailable` when not one of the group's values is known — ₱0.00 there
 * would read as "worth nothing". Otherwise the sum of the known values, with
 * `excluded` counting the rows left out of it.
 */
export type GroupValue =
  | { kind: "unavailable" }
  | { kind: "amount"; total: number; excluded: number };

export function groupValue(group: CollateralRegisterGroup): GroupValue {
  if (group.unknown_count > 0 && group.unknown_count >= group.collaterals_count) {
    return { kind: "unavailable" };
  }
  return { kind: "amount", total: group.total_value, excluded: group.unknown_count };
}

/** A group's Status badge: its wording, and whether anything in it is spoken for. */
export interface GroupStatus {
  tagged: boolean;
  label: string;
}

export function groupStatus(group: CollateralRegisterGroup): GroupStatus {
  const { tagged_count: tagged, collaterals_count: count } = group;
  if (tagged === 0) return { tagged: false, label: "All available" };
  if (tagged >= count) return { tagged: true, label: `All tagged (${tagged})` };
  return { tagged: true, label: `${tagged} of ${count} tagged` };
}

/** The note under the appraised-value card, or null when nothing was left out. */
export function excludedValueNote(unknownCount: number): string | null {
  if (unknownCount <= 0) return null;
  return `Excludes ${unknownCount} collateral${unknownCount === 1 ? "" : "s"} whose share capital balance could not be read.`;
}
